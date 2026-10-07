import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import { uploadImageAsset } from '@/lib/linkedinService';
import { downloadImage } from '@/workers/sheetSync';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_STATUSES,
  MAX_IMAGE_BYTES,
  isObjectId,
  parseDate,
  publicError,
} from '@/lib/api';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { trackActivity } from '@/lib/activity';
import { checkLimit, incrementUsage } from '@/lib/limits';

export async function GET(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const accountId = searchParams.get('accountId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (accountId && !isObjectId(accountId)) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }
    await connectDB();

    const filter = { ownerId };
    if (status) filter.status = status;
    if (accountId) filter.account = accountId;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to) filter.scheduledAt.$lte = new Date(to);
    }

    const posts = await Post.find(filter).sort({ scheduledAt: -1 }).limit(500)
      .populate('account', 'authorUrn displayName profilePictureUrl').lean();

    return NextResponse.json(posts);
  } catch (error) {
    return publicError(error, 'Unable to load posts');
  }
}

export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const limit = await checkLimit(ownerId, 'create_post');
    if (!limit.allowed) return NextResponse.json({ error: limit.reason, upgrade: limit.upgrade }, { status: 403 });
    const formData = await request.formData();
    const accountId = formData.get('accountId');
    const commentary = formData.get('commentary');
    const scheduledAt = formData.get('scheduledAt');
    const imageFile = formData.get('image');
    const imageUrl = formData.get('imageUrl');
    const isDraft = formData.get('isDraft') === 'true';

    if (!isObjectId(accountId)) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }
    if (typeof commentary !== 'string' || !commentary.trim() || commentary.trim().length > 3000) {
      return NextResponse.json({ error: 'Commentary must contain 1 to 3000 characters' }, { status: 400 });
    }

    let date = null;
    if (!isDraft) {
      date = parseDate(scheduledAt);
      if (!date) {
        return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
      }
      if (date <= new Date()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
      }
    }

    if (imageFile && imageFile.size > 0 &&
        (!ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size > MAX_IMAGE_BYTES)) {
      return NextResponse.json({ error: 'Image must be JPEG, PNG, or GIF and no larger than 10 MB' }, { status: 400 });
    }

    await connectDB();
    const account = await Account.findOne({ _id: accountId, ownerId }).select('+accessToken');
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (new Date(account.tokenExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Access token expired. Please re-authenticate.' },
        { status: 401 }
      );
    }

    let mediaUrl = null;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      mediaUrl = await uploadImageAsset(
        account.accessToken,
        account.authorUrn,
        buffer,
        imageFile.type
      );
    } else if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
      const image = await downloadImage(imageUrl);
      mediaUrl = await uploadImageAsset(
        account.accessToken,
        account.authorUrn,
        image.buffer,
        image.type
      );
    }

    const post = await Post.create({
      ownerId,
      account: account._id,
      commentary: commentary.trim(),
      mediaUrl,
      scheduledAt: date,
      status: isDraft ? 'DRAFT' : 'PENDING',
    });

    trackActivity({ ownerId, action: 'post_created', request, metadata: { postId: post._id.toString(), status: post.status } }).catch(() => {});
    incrementUsage(ownerId, isDraft).catch(() => {});
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return publicError(error, 'Unable to schedule post');
  }
}
