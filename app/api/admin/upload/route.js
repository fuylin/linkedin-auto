import { NextResponse } from 'next/server';
import path from 'node:path';
import crypto from 'node:crypto';
import { getAdminSession } from '@/lib/adminSession';

// POST /api/admin/upload — upload logo/favicon
export async function POST(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'logo';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PNG, JPG, SVG, WebP, ICO, or GIF' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name?.split('.').pop() || 'png';
    const filename = `${type}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    // Try writing to local filesystem first (works in dev + self-hosted)
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      const url = `/uploads/${filename}`;
      console.log(`[UPLOAD] ${type} saved to filesystem: ${url}`);
      return NextResponse.json({ success: true, url, filename });
    } catch {
      // Filesystem is read-only (Vercel) — fall back to data URI
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type};base64,${base64}`;
      console.log(`[UPLOAD] ${type} stored as data URI (${Math.round(base64.length / 1024)}KB)`);
      return NextResponse.json({ success: true, url: dataUri, filename });
    }
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
