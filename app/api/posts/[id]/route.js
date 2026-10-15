import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Post from '@/lib/models/Post';
import { isObjectId, parseDate, publicError } from '@/lib/api';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { trackActivity } from '@/lib/activity';

const EDITABLE = new Set(['DRAFT', 'PENDING']);

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    if (!isObjectId(id)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
    await connectDB();
    const post = await Post.findOne({ _id: id, ownerId }).populate('account', 'authorUrn displayName').lean();
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json(post);
  } catch (error) {
    return publicError(error, 'Unable to load post');
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    if (!isObjectId(id)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
    await connectDB();
    const post = await Post.findOne({ _id: id, ownerId });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (!EDITABLE.has(post.status)) {
      return NextResponse.json({ error: 'Only DRAFT or PENDING posts can be updated' }, { status: 400 });
    }

    const body = await request.json();
    if (body.commentary !== undefined) {
      if (typeof body.commentary !== 'string' || !body.commentary.trim() || body.commentary.trim().length > 5000) {
        return NextResponse.json({ error: 'Commentary must contain 1 to 5000 characters' }, { status: 400 });
      }
      post.commentary = body.commentary.trim();
    }
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null || body.scheduledAt === '') {
        // Clear schedule — revert to DRAFT
        post.scheduledAt = null;
        if (post.status === 'PENDING') post.status = 'DRAFT';
      } else {
        const date = parseDate(body.scheduledAt);
        if (!date) return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
        if (date <= new Date()) return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
        post.scheduledAt = date;
        if (post.status === 'DRAFT') post.status = 'PENDING';
      }
    }
    await post.save();
    trackActivity({ ownerId, action: 'post_edited', metadata: { postId: id } }).catch(() => {});

    return NextResponse.json(post);
  } catch (error) {
    return publicError(error, 'Unable to update post');
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    if (!isObjectId(id)) return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
    await connectDB();
    const post = await Post.findOneAndDelete({ _id: id, ownerId, status: { $in: ['DRAFT', 'PENDING', 'FAILED'] } });
    if (!post) {
      return NextResponse.json({ error: 'Editable post not found' }, { status: 404 });
    }
    trackActivity({ ownerId, action: 'post_deleted', metadata: { postId: id } }).catch(() => {});
    return NextResponse.json({ message: 'Post deleted' });
  } catch (error) {
    return publicError(error, 'Unable to delete post');
  }
}
