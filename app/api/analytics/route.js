import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Post from '@/lib/models/Post';
import { fetchPostAnalytics } from '@/lib/linkedinAnalytics';
import { publicError } from '@/lib/api';
import { checkLimit } from '@/lib/limits';
import { getOwnerId, unauthorized } from '@/lib/currentUser';

// GET — return aggregated analytics data
export async function GET(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const limit = await checkLimit(ownerId, 'access_analytics');
    if (!limit.allowed) return NextResponse.json({ error: limit.reason, upgrade: limit.upgrade }, { status: 403 });
    await connectDB();

    const published = await Post.find({ ownerId, status: 'PUBLISHED' })
      .sort({ createdAt: -1 })
      .populate('account', 'authorUrn displayName profilePictureUrl')
      .lean();

    const total = published.length;
    const failed = await Post.countDocuments({ ownerId, status: 'FAILED' });
    const pending = await Post.countDocuments({ ownerId, status: 'PENDING' });
    const drafts = await Post.countDocuments({ ownerId, status: 'DRAFT' });

    // Aggregate engagement
    let totalLikes = 0, totalComments = 0, totalShares = 0, totalImpressions = 0;
    for (const post of published) {
      const a = post.analytics || {};
      totalLikes += a.likes || 0;
      totalComments += a.comments || 0;
      totalShares += a.shares || 0;
      totalImpressions += a.impressions || 0;
    }

    // Top posts by engagement (likes + comments + shares)
    const ranked = [...published]
      .map((p) => {
        const a = p.analytics || {};
        return { ...p, engagement: (a.likes || 0) + (a.comments || 0) + (a.shares || 0) };
      })
      .sort((a, b) => b.engagement - a.engagement);

    return NextResponse.json({
      stats: { total, failed, pending, drafts, totalLikes, totalComments, totalShares, totalImpressions },
      posts: ranked,
    });
  } catch (error) {
    return publicError(error, 'Unable to load analytics');
  }
}

// POST — refresh analytics for all published posts (or specific IDs)
export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const postIds = body.postIds; // optional: refresh only specific posts

    await connectDB();

    const query = { ownerId, status: 'PUBLISHED', linkedinPostUrn: { $ne: null } };
    if (Array.isArray(postIds) && postIds.length > 0) {
      query._id = { $in: postIds };
    }

    const posts = await Post.find(query)
      .populate({ path: 'account', select: '+accessToken authorUrn tokenExpiresAt ownerId' });

    // Skip stale-check: only refresh posts older than 5 minutes
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = Date.now();

    let refreshed = 0;
    let skipped = 0;

    for (const post of posts) {
      // Skip if recently fetched (unless forced via postIds)
      if (!postIds && post.analytics?.fetchedAt && (now - post.analytics.fetchedAt.getTime()) < FIVE_MINUTES) {
        skipped++;
        continue;
      }

      if (!post.account || post.account.ownerId !== ownerId || !post.account.accessToken) {
        skipped++;
        continue;
      }
      if (new Date(post.account.tokenExpiresAt) < new Date()) {
        skipped++;
        continue;
      }

      const metrics = await fetchPostAnalytics(post.account.accessToken, post.linkedinPostUrn);
      post.analytics = { ...metrics, fetchedAt: new Date() };
      await post.save();
      refreshed++;
    }

    return NextResponse.json({ refreshed, skipped, total: posts.length });
  } catch (error) {
    return publicError(error, 'Unable to refresh analytics');
  }
}
