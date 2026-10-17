import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import UserActivity from '@/lib/models/UserActivity';

export async function GET(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('userId'); // optional: get detailed activity for one user

    await connectDB();

    // ── Single user detail ──
    if (detailId) {
      const [accounts, recentPosts, activities, allPosts] = await Promise.all([
        Account.find({ ownerId: detailId }).lean(),
        Post.find({ ownerId: detailId }).sort({ createdAt: -1 }).limit(20).populate('account', 'displayName authorUrn').lean(),
        UserActivity.find({ ownerId: detailId }).sort({ createdAt: -1 }).limit(50).lean(),
        Post.find({ ownerId: detailId }).select('commentary mediaUrl status createdAt publishedAt scheduledAt analytics retryCount').lean(),
      ]);

      const [postStats, loginLocations, deviceStats, browserStats, osStats, activeHours] = await Promise.all([
        Post.aggregate([
          { $match: { ownerId: detailId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        UserActivity.aggregate([
          { $match: { ownerId: detailId, action: 'login', country: { $ne: null } } },
          { $group: { _id: { city: '$city', region: '$region', country: '$country' }, count: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
          { $sort: { count: -1 } }, { $limit: 10 },
        ]),
        UserActivity.aggregate([
          { $match: { ownerId: detailId, device: { $ne: null } } },
          { $group: { _id: '$device', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        UserActivity.aggregate([
          { $match: { ownerId: detailId, browser: { $ne: null } } },
          { $group: { _id: '$browser', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        UserActivity.aggregate([
          { $match: { ownerId: detailId, os: { $ne: null } } },
          { $group: { _id: '$os', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        UserActivity.aggregate([
          { $match: { ownerId: detailId } },
          { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } }, { $limit: 5 },
        ]),
      ]);

      const totalPosts = allPosts.length;
      const publishedPosts = allPosts.filter(p => p.status === 'PUBLISHED');
      const failedPosts = allPosts.filter(p => p.status === 'FAILED');
      const now = Date.now();
      const DAY = 86400000;
      const WEEK = 7 * DAY;

      // ── Basic behavior ──
      const avgPostLength = totalPosts > 0 ? Math.round(allPosts.reduce((s, p) => s + (p.commentary?.length || 0), 0) / totalPosts) : 0;
      const avgWordCount = totalPosts > 0 ? Math.round(allPosts.reduce((s, p) => s + (p.commentary?.split(/\s+/).length || 0), 0) / totalPosts) : 0;
      const imageUsageRate = totalPosts > 0 ? Math.round((allPosts.filter(p => p.mediaUrl).length / totalPosts) * 100) : 0;
      const failureRate = totalPosts > 0 ? Math.round((failedPosts.length / totalPosts) * 100) : 0;
      const successRate = totalPosts > 0 ? Math.round((publishedPosts.length / totalPosts) * 100) : 0;

      // ── Posts per week (last 4 weeks) ──
      const fourWeeksAgo = new Date(now - 28 * DAY);
      const recentPostCount = allPosts.filter(p => new Date(p.createdAt) >= fourWeeksAgo).length;
      const postsPerWeek = Math.round((recentPostCount / 4) * 10) / 10;

      // ── Growth trend (this week vs last week) ──
      const thisWeekStart = new Date(now - WEEK);
      const lastWeekStart = new Date(now - 2 * WEEK);
      const thisWeekPosts = allPosts.filter(p => new Date(p.createdAt) >= thisWeekStart).length;
      const lastWeekPosts = allPosts.filter(p => { const d = new Date(p.createdAt); return d >= lastWeekStart && d < thisWeekStart; }).length;
      const growthTrend = lastWeekPosts === 0 ? (thisWeekPosts > 0 ? 'up' : 'flat') : thisWeekPosts > lastWeekPosts ? 'up' : thisWeekPosts < lastWeekPosts ? 'down' : 'flat';

      // ── Engagement ──
      const totalEngagement = publishedPosts.reduce((s, p) => s + ((p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0)), 0);
      const avgEngagement = publishedPosts.length > 0 ? Math.round((totalEngagement / publishedPosts.length) * 10) / 10 : 0;
      // Engagement trend: last 10 vs previous 10 published posts
      const sorted = [...publishedPosts].sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
      const recent10 = sorted.slice(0, 10);
      const prev10 = sorted.slice(10, 20);
      const recentEng = recent10.reduce((s, p) => s + ((p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0)), 0) / (recent10.length || 1);
      const prevEng = prev10.reduce((s, p) => s + ((p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0)), 0) / (prev10.length || 1);
      const engagementTrend = prev10.length === 0 ? 'flat' : recentEng > prevEng ? 'up' : recentEng < prevEng ? 'down' : 'flat';

      // ── Best performing post ──
      const bestPost = sorted.length > 0 ? sorted.reduce((best, p) => {
        const eng = (p.analytics?.likes || 0) + (p.analytics?.comments || 0) + (p.analytics?.shares || 0);
        return eng > best.eng ? { post: p, eng } : best;
      }, { post: null, eng: -1 }) : { post: null, eng: 0 };

      // ── Days since last login ──
      const lastLogin = activities.find(a => a.action === 'login');
      const daysSinceLastLogin = lastLogin ? Math.floor((now - new Date(lastLogin.createdAt).getTime()) / DAY) : null;

      // ── Unique IPs ──
      const uniqueIps = new Set(activities.filter(a => a.ip).map(a => a.ip)).size;

      // ── Login count ──
      const loginCount = activities.filter(a => a.action === 'login').length;

      // ── Account age ──
      const accountAge = accounts[0]?.createdAt ? Math.floor((now - new Date(accounts[0].createdAt).getTime()) / DAY) : null;

      // ── Preferred posting day ──
      const dayCount = [0, 0, 0, 0, 0, 0, 0];
      allPosts.forEach(p => { if (p.scheduledAt) dayCount[new Date(p.scheduledAt).getDay()]++; });
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const preferredDay = totalPosts > 0 ? dayNames[dayCount.indexOf(Math.max(...dayCount))] : null;

      // ── Preferred posting hour ──
      const hourCount = new Array(24).fill(0);
      allPosts.forEach(p => { if (p.scheduledAt) hourCount[new Date(p.scheduledAt).getHours()]++; });
      const preferredHour = totalPosts > 0 ? hourCount.indexOf(Math.max(...hourCount)) : null;

      // ── Health score (0-100) ──
      let healthScore = 50; // base
      if (daysSinceLastLogin !== null) {
        if (daysSinceLastLogin <= 1) healthScore += 15;
        else if (daysSinceLastLogin <= 7) healthScore += 10;
        else if (daysSinceLastLogin <= 30) healthScore += 0;
        else healthScore -= 20;
      }
      if (postsPerWeek >= 3) healthScore += 15;
      else if (postsPerWeek >= 1) healthScore += 10;
      else if (postsPerWeek > 0) healthScore += 5;
      else healthScore -= 10;
      if (failureRate <= 5) healthScore += 10;
      else if (failureRate <= 20) healthScore += 5;
      else healthScore -= 10;
      const primary = accounts[0];
      const tokenDaysLeft = primary?.tokenExpiresAt ? Math.floor((new Date(primary.tokenExpiresAt) - now) / DAY) : 0;
      if (tokenDaysLeft > 14) healthScore += 10;
      else if (tokenDaysLeft > 0) healthScore += 0;
      else healthScore -= 15;
      healthScore = Math.max(0, Math.min(100, healthScore));

      // ── Churn risk ──
      const churnRisk = healthScore >= 70 ? 'low' : healthScore >= 40 ? 'medium' : 'high';

      // ── Posting heatmap (last 12 weeks, 84 days) ──
      const heatmapStart = new Date(now - 84 * DAY);
      const heatmap = [];
      for (let i = 0; i < 84; i++) {
        const d = new Date(heatmapStart.getTime() + i * DAY);
        const dateStr = d.toISOString().slice(0, 10);
        const count = allPosts.filter(p => p.createdAt && new Date(p.createdAt).toISOString().slice(0, 10) === dateStr).length;
        heatmap.push({ date: dateStr, count });
      }

      // ── Content top words ──
      const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','it','its','i','me','my','we','our','you','your','he','his','she','her','they','their','what','which','who','whom','about','up','down','get','got','go','going','also','like','new','one','two','make','know','time','way','people','work','day','well','many','even','want','first']);
      const wordFreq = {};
      allPosts.forEach(p => {
        if (!p.commentary) return;
        p.commentary.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).forEach(w => {
          if (w.length > 2 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
      });
      const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([word, count]) => ({ word, count }));

      const statMap = {};
      for (const s of postStats) statMap[s._id] = { count: s.count };

      return NextResponse.json({
        success: true,
        user: {
          ownerId: detailId,
          accounts,
          stats: {
            total: totalPosts,
            published: publishedPosts.length,
            pending: statMap.PENDING?.count || 0,
            failed: failedPosts.length,
            drafts: statMap.DRAFT?.count || 0,
          },
          behavior: {
            avgPostLength, avgWordCount, imageUsageRate, failureRate, successRate,
            postsPerWeek, daysSinceLastLogin, uniqueIps, loginCount, accountAge,
            preferredDay, preferredHour,
            totalEngagement, avgEngagement,
          },
          trends: { growthTrend, engagementTrend, thisWeekPosts, lastWeekPosts },
          healthScore, churnRisk,
          bestPost: bestPost.post ? { commentary: bestPost.post.commentary?.slice(0, 100), engagement: bestPost.eng, publishedAt: bestPost.post.publishedAt } : null,
          heatmap,
          topWords,
          devices: deviceStats.map(d => ({ name: d._id, count: d.count })),
          browsers: browserStats.map(d => ({ name: d._id, count: d.count })),
          operatingSystems: osStats.map(d => ({ name: d._id, count: d.count })),
          activeHours: activeHours.map(h => ({ hour: h._id, count: h.count })),
          recentPosts,
          activities,
          loginLocations: loginLocations.map(l => ({
            city: l._id.city, region: l._id.region, country: l._id.country,
            count: l.count, lastSeen: l.lastSeen,
          })),
        },
      });
    }

    // ── All users overview ──
    const accounts = await Account.find({}).lean();
    const ownerIds = [...new Set(accounts.map((a) => a.ownerId).filter(Boolean))];

    const [postStats, activityStats, locationStats] = await Promise.all([
      Post.aggregate([
        { $match: { ownerId: { $in: ownerIds } } },
        { $group: {
          _id: '$ownerId',
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'PUBLISHED'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0] } },
          lastPostDate: { $max: '$publishedAt' },
        }},
      ]),
      UserActivity.aggregate([
        { $match: { ownerId: { $in: ownerIds } } },
        { $group: {
          _id: '$ownerId',
          totalActions: { $sum: 1 },
          lastActive: { $max: '$createdAt' },
          loginCount: { $sum: { $cond: [{ $eq: ['$action', 'login'] }, 1, 0] } },
        }},
      ]),
      UserActivity.aggregate([
        { $match: { ownerId: { $in: ownerIds }, action: 'login', country: { $ne: null } } },
        { $sort: { createdAt: -1 } },
        { $group: {
          _id: '$ownerId',
          lastCity: { $first: '$city' },
          lastRegion: { $first: '$region' },
          lastCountry: { $first: '$country' },
          lastTimezone: { $first: '$timezone' },
          lastIp: { $first: '$ip' },
        }},
      ]),
    ]);

    const postMap = {};
    for (const s of postStats) postMap[s._id] = s;
    const actMap = {};
    for (const a of activityStats) actMap[a._id] = a;
    const locMap = {};
    for (const l of locationStats) locMap[l._id] = l;

    const users = ownerIds.map((ownerId) => {
      const ownerAccounts = accounts.filter((a) => a.ownerId === ownerId);
      const primary = ownerAccounts[0];
      const ps = postMap[ownerId] || { total: 0, published: 0, pending: 0, failed: 0, drafts: 0, lastPostDate: null };
      const act = actMap[ownerId] || { totalActions: 0, lastActive: null, loginCount: 0 };
      const loc = locMap[ownerId] || {};

      return {
        ownerId,
        displayName: primary?.displayName || 'Unknown',
        email: primary?.email || 'N/A',
        authorUrn: primary?.authorUrn || 'N/A',
        profilePictureUrl: primary?.profilePictureUrl || null,
        connectedDate: primary?.createdAt || null,
        tokenExpiresAt: primary?.tokenExpiresAt || null,
        accountCount: ownerAccounts.length,
        // Posts
        total: ps.total,
        published: ps.published,
        pending: ps.pending,
        failed: ps.failed,
        drafts: ps.drafts,
        lastPostDate: ps.lastPostDate,
        // Activity
        totalActions: act.totalActions,
        lastActive: act.lastActive,
        loginCount: act.loginCount,
        // Location
        lastCity: loc.lastCity || null,
        lastRegion: loc.lastRegion || null,
        lastCountry: loc.lastCountry || null,
        lastTimezone: loc.lastTimezone || null,
        lastIp: loc.lastIp || null,
      };
    });

    const platformStats = {
      totalUsers: ownerIds.length,
      totalAccounts: accounts.length,
      totalPosts: users.reduce((s, u) => s + u.total, 0),
      totalPublished: users.reduce((s, u) => s + u.published, 0),
      totalPending: users.reduce((s, u) => s + u.pending, 0),
      totalFailed: users.reduce((s, u) => s + u.failed, 0),
      totalDrafts: users.reduce((s, u) => s + u.drafts, 0),
      totalLogins: users.reduce((s, u) => s + u.loginCount, 0),
      totalActions: users.reduce((s, u) => s + u.totalActions, 0),
    };

    // Find top engager — user whose posts have the most total engagement
    const engagementAgg = await Post.aggregate([
      { $match: { ownerId: { $in: ownerIds }, status: 'PUBLISHED' } },
      { $group: {
        _id: '$ownerId',
        totalEngagement: { $sum: { $add: [
          { $ifNull: ['$analytics.likes', 0] },
          { $ifNull: ['$analytics.comments', 0] },
          { $ifNull: ['$analytics.shares', 0] },
        ] } },
        publishedCount: { $sum: 1 },
      }},
      { $sort: { totalEngagement: -1 } },
      { $limit: 1 },
    ]);

    let topEngager = null;
    if (engagementAgg.length > 0) {
      const topUser = users.find(u => u.ownerId === engagementAgg[0]._id);
      if (topUser) {
        topEngager = {
          displayName: topUser.displayName,
          profilePictureUrl: topUser.profilePictureUrl,
          totalEngagement: engagementAgg[0].totalEngagement,
          publishedCount: engagementAgg[0].publishedCount,
          ownerId: topUser.ownerId,
        };
      }
    }

    // Location distribution — unique users per city/country
    const locationAgg = await UserActivity.aggregate([
      { $match: { action: 'login', country: { $ne: null } } },
      { $group: { _id: { country: '$country', city: '$city', ownerId: '$ownerId' } } },
      { $group: { _id: { country: '$_id.country', city: '$_id.city' }, userIds: { $addToSet: '$_id.ownerId' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    // Get display names for users in each location
    const allLocUserIds = [...new Set(locationAgg.flatMap((l) => l.userIds))];
    const locAccounts = await Account.find({ ownerId: { $in: allLocUserIds } }).select('ownerId displayName profilePictureUrl').lean();
    const accMap = {};
    for (const a of locAccounts) accMap[a.ownerId] = a;

    const locations = locationAgg.map((l) => ({
      name: [l._id.city, l._id.country].filter(Boolean).join(', '),
      count: l.count,
      users: l.userIds.map((id) => ({
        ownerId: id,
        displayName: accMap[id]?.displayName || 'Unknown',
        profilePictureUrl: accMap[id]?.profilePictureUrl || null,
      })),
    }));

    return NextResponse.json({ success: true, users, platformStats, topEngager, locations });
  } catch (error) {
    console.error('[ADMIN USERS]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
