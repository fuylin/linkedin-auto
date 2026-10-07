import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Post from '@/lib/models/Post';
import Template from '@/lib/models/Template';
import Subscription from '@/lib/models/Subscription';
import Plan from '@/lib/models/Plan';
import Payment from '@/lib/models/Payment';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { getPlatformSettings } from '@/lib/platformCheck';

// GET /api/billing — user's current plan, usage, and available plans
export async function GET(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();

    const settings = await getPlatformSettings();
    const billingMode = settings?.billing?.mode || 'free';

    await connectDB();
    const subscription = await Subscription.findOne({ ownerId }).populate('plan').lean();
    const [postCount, templateCount, monthlyPostCount, payments] = await Promise.all([
      Post.countDocuments({ ownerId }),
      Template.countDocuments({ ownerId }),
      Post.countDocuments({ ownerId, createdAt: { $gte: (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })() } }),
      Payment.find({ ownerId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    // Available plans for upgrade
    const availablePlans = billingMode !== 'free'
      ? await Plan.find({ applicableModes: billingMode, isActive: true }).sort({ sortOrder: 1 }).lean()
      : [];

    return NextResponse.json({
      billingMode,
      subscription: subscription || null,
      usage: {
        posts: postCount,
        templates: templateCount,
        postsThisMonth: monthlyPostCount,
        postsThisMonthUsage: subscription?.usage?.postsThisMonth || 0,
      },
      limits: subscription?.plan?.limits || null,
      plans: availablePlans,
      payments,
      currency: settings?.billing?.currency || 'INR',
      freePostsPerMonth: settings?.billing?.freePostsPerMonth || 10,
      cashfreeConfigured: !!(settings?.billing?.cashfreeAppId),
    });
  } catch (error) {
    console.error('[BILLING GET]', error);
    return NextResponse.json({ error: 'Failed to load billing info' }, { status: 500 });
  }
}
