import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Post from '@/lib/models/Post';
import { isObjectId, publicError } from '@/lib/api';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { trackActivity } from '@/lib/activity';
import { checkLimit } from '@/lib/limits';

// POST /api/posts/:id/duplicate — creates a DRAFT copy of an existing post
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const limit = await checkLimit(ownerId, 'create_post');
    if (!limit.allowed) return NextResponse.json({ error: limit.reason, upgrade: limit.upgrade }, { status: 403 });
    if (!isObjectId(id)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });

    await connectDB();
    const original = await Post.findOne({ _id: id, ownerId }).lean();
    if (!original) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const duplicate = await Post.create({
      ownerId,
      account: original.account,
      commentary: original.commentary,
      mediaUrl: original.mediaUrl,
      scheduledAt: null,
      status: 'DRAFT',
    });

    trackActivity({ ownerId, action: 'post_duplicated', metadata: { originalId: id, newId: duplicate._id.toString() } }).catch(() => {});
    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    return publicError(error, 'Unable to duplicate post');
  }
}
