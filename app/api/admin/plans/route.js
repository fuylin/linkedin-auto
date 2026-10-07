import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Plan from '@/lib/models/Plan';
import Subscription from '@/lib/models/Subscription';

// GET /api/admin/plans — list all plans with subscriber counts
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const plans = await Plan.find({}).sort({ sortOrder: 1 }).lean();

    // Get subscriber count per plan
    const counts = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'trialing', 'free'] } } },
      { $group: { _id: '$planSlug', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const c of counts) countMap[c._id] = c.count;

    const result = plans.map((p) => ({ ...p, subscriberCount: countMap[p.slug] || 0 }));
    return NextResponse.json({ success: true, plans: result });
  } catch (error) {
    console.error('[ADMIN PLANS GET]', error);
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
  }
}

// POST /api/admin/plans — create a new plan
export async function POST(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    if (!body.slug || !body.name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 });
    }
    await connectDB();

    // Check slug uniqueness
    const existing = await Plan.findOne({ slug: body.slug.toLowerCase() });
    if (existing) return NextResponse.json({ error: 'A plan with this slug already exists' }, { status: 409 });

    const plan = await Plan.create({
      slug: body.slug.toLowerCase(),
      name: body.name,
      description: body.description || '',
      badge: body.badge || '',
      sortOrder: body.sortOrder || 0,
      priceMonthly: body.priceMonthly || 0,
      priceYearly: body.priceYearly || 0,
      cashfreePlanIdMonthly: body.cashfreePlanIdMonthly || '',
      cashfreePlanIdYearly: body.cashfreePlanIdYearly || '',
      limits: body.limits || {},
      applicableModes: body.applicableModes || [],
      isDefault: body.isDefault || false,
      isActive: true,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[ADMIN PLANS POST]', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
