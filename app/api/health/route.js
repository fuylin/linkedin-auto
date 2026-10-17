import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getPlatformSettings } from '@/lib/platformCheck';

export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    const settings = await getPlatformSettings();
    return NextResponse.json({
      status: 'ok',
      maintenance: settings?.maintenanceMode || false,
      maintenanceMessage: settings?.maintenanceMessage || null,
      announcement: settings?.announcementEnabled ? {
        text: settings.announcementText,
        type: settings.announcementType,
      } : null,
      logoUrl: settings?.logoUrl || null,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({ status: 'unavailable' }, { status: 503 });
  }
}
