import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Plan from '@/lib/models/Plan';
import Subscription from '@/lib/models/Subscription';

// PUT /api/admin/plans/:id — update a plan
export async function PUT(request, { params }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const plan = await Plan.findById(id);
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const updateable = ['name', 'description', 'badge', 'sortOrder', 'priceMonthly', 'priceYearly', 'cashfreePlanIdMonthly', 'cashfreePlanIdYearly', 'limits', 'applicableModes', 'isDefault', 'isActive'];
    for (const key of updateable) {
      if (body[key] !== undefined) plan[key] = body[key];
    }
    await plan.save();

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[ADMIN PLANS PUT]', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

// DELETE /api/admin/plans/:id — soft delete a plan
export async function DELETE(request, { params }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await connectDB();

    const plan = await Plan.findById(id);
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    // Check if users are on this plan
    const count = await Subscription.countDocuments({ planSlug: plan.slug, status: { $in: ['active', 'trialing'] } });
    if (count > 0) {
      return NextResponse.json({ error: `Cannot delete — ${count} user(s) are on this plan. Move them first.` }, { status: 409 });
    }

    plan.isActive = false;
    await plan.save();

    return NextResponse.json({ success: true, message: 'Plan deactivated' });
  } catch (error) {
    console.error('[ADMIN PLANS DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
