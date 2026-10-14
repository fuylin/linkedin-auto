import { NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getAdminSession } from '@/lib/adminSession';

// POST /api/admin/upload — upload logo/favicon to public/uploads
export async function POST(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'logo'; // logo or favicon

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PNG, JPG, SVG, WebP, ICO, or GIF' }, { status: 400 });
    }

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name?.split('.').pop() || 'png';
    const filename = `${type}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const url = `/uploads/${filename}`;
    console.log(`[UPLOAD] ${type} uploaded: ${url}`);

    return NextResponse.json({ success: true, url, filename });
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
