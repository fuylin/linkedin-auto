import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Template from '@/lib/models/Template';
import { publicError } from '@/lib/api';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { trackActivity } from '@/lib/activity';
import { checkLimit } from '@/lib/limits';

export async function GET(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    await connectDB();
    const templates = await Template.find({ ownerId }).sort({ usageCount: -1, updatedAt: -1 }).lean();
    return NextResponse.json(templates);
  } catch (error) {
    return publicError(error, 'Unable to load templates');
  }
}

export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const limit = await checkLimit(ownerId, 'create_template');
    if (!limit.allowed) return NextResponse.json({ error: limit.reason, upgrade: limit.upgrade }, { status: 403 });
    const body = await request.json();
    const { name, content, category } = body;

    if (!name || typeof name !== 'string' || name.trim().length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || content.trim().length > 3000) {
      return NextResponse.json({ error: 'Content is required (max 3000 chars)' }, { status: 400 });
    }

    await connectDB();
    const template = await Template.create({
      ownerId,
      name: name.trim(),
      content: content.trim(),
      category: category?.trim() || 'General',
    });

    trackActivity({ ownerId, action: 'template_created', metadata: { templateId: template._id.toString(), name: name.trim() } }).catch(() => {});
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return publicError(error, 'Unable to create template');
  }
}
