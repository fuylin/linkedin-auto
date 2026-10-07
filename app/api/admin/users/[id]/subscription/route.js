import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Plan from '@/lib/models/Plan';
import Subscription from '@/lib/models/Subscription';

// PUT /api/admin/users/:id/subscription — admin override user's plan
export async function PUT(request, { params }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: ownerId } = await params;
    const { planSlug, status, notes } = await request.json();

    await connectDB();
    const plan = await Plan.findOne({ slug: planSlug });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = await Subscription.findOneAndUpdate(
      { ownerId },
      {
        ownerId,
        plan: plan._id,
        planSlug: plan.slug,
        status: status || (plan.priceMonthly > 0 ? 'active' : 'free'),
        adminOverride: true,
        adminNotes: notes || `Manually set by admin (${session.email})`,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, subscription: sub });
  } catch (error) {
    console.error('[ADMIN SUB OVERRIDE]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
