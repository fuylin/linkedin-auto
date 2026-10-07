import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Subscription from '@/lib/models/Subscription';
import Payment from '@/lib/models/Payment';
import Plan from '@/lib/models/Plan';

// GET /api/admin/billing-stats — billing dashboard stats
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const [subs, recentPayments, plans, totalRevenueAgg] = await Promise.all([
      Subscription.find({}).lean(),
      Payment.find({ status: 'captured' }).sort({ createdAt: -1 }).limit(50).lean(),
      Plan.find({ isActive: true }).lean(),
      Payment.aggregate([{ $match: { status: 'captured' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const payments = recentPayments;

    const active = subs.filter((s) => s.status === 'active').length;
    const trialing = subs.filter((s) => s.status === 'trialing').length;
    const canceled = subs.filter((s) => s.status === 'canceled').length;
    const free = subs.filter((s) => s.status === 'free').length;

    // MRR = sum of monthly prices for active subscribers
    const planMap = {};
    for (const p of plans) planMap[p.slug] = p;
    let mrr = 0;
    for (const s of subs) {
      if (s.status === 'active' && planMap[s.planSlug]) {
        const plan = planMap[s.planSlug];
        if (s.billingCycle === 'yearly') mrr += (plan.priceYearly || 0) / 12;
        else mrr += plan.priceMonthly || 0;
      }
    }

    // Revenue this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonthRevenue = payments
      .filter((p) => new Date(p.createdAt) >= monthStart)
      .reduce((s, p) => s + p.amount, 0);

    // Total revenue (from aggregation — not limited to 50)
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    return NextResponse.json({
      success: true,
      stats: {
        active, trialing, canceled, free,
        total: subs.length,
        mrr: Math.round(mrr),
        thisMonthRevenue,
        totalRevenue,
      },
      recentPayments: payments.slice(0, 20),
    });
  } catch (error) {
    console.error('[ADMIN BILLING STATS]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
