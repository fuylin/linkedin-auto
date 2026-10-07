import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import Post from '@/lib/models/Post';
import Template from '@/lib/models/Template';
import Subscription from '@/lib/models/Subscription';
import UserActivity from '@/lib/models/UserActivity';
import { sendEmail } from '@/lib/email';

// POST /api/admin/users/:id/manage — perform management actions on a user
export async function POST(request, { params }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: ownerId } = await params;
    const { action, reason, planSlug, status: newStatus } = await request.json();

    await connectDB();
    const account = await Account.findOne({ ownerId });
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    switch (action) {
      case 'suspend': {
        account.status = 'SUSPENDED';
        await account.save();
        if (account.email) {
          sendEmail({ to: account.email, subject: 'Account suspended', html: `<p>Your account has been suspended.${reason ? ` Reason: ${reason}` : ''}</p>` }).catch(() => {});
        }
        return NextResponse.json({ success: true, message: 'User suspended' });
      }

      case 'unsuspend': {
        account.status = 'ACTIVE';
        await account.save();
        if (account.email) {
          sendEmail({ to: account.email, subject: 'Account reactivated', html: `<p>Your account has been reactivated. You can now sign in and use the platform.</p>` }).catch(() => {});
        }
        return NextResponse.json({ success: true, message: 'User reactivated' });
      }

      case 'delete': {
        // Delete all user data
        await Promise.all([
          Account.deleteMany({ ownerId }),
          Post.deleteMany({ ownerId }),
          Template.deleteMany({ ownerId }),
          Subscription.deleteOne({ ownerId }),
          UserActivity.deleteMany({ ownerId }),
        ]);
        return NextResponse.json({ success: true, message: 'User and all data deleted' });
      }

      case 'change_plan': {
        if (!planSlug) return NextResponse.json({ error: 'planSlug required' }, { status: 400 });
        const Plan = (await import('@/lib/models/Plan')).default;
        const plan = await Plan.findOne({ slug: planSlug, isActive: true });
        if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await Subscription.findOneAndUpdate(
          { ownerId },
          {
            ownerId,
            plan: plan._id,
            planSlug: plan.slug,
            status: plan.priceMonthly > 0 ? (newStatus || 'active') : 'free',
            adminOverride: true,
            adminNotes: `Plan changed to ${plan.name} by admin (${session.email})`,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          { upsert: true }
        );

        if (account.email) {
          sendEmail({ to: account.email, subject: `Plan updated to ${plan.name}`, html: `<p>Your plan has been updated to <strong>${plan.name}</strong>.</p>` }).catch(() => {});
        }
        return NextResponse.json({ success: true, message: `Plan changed to ${plan.name}` });
      }

      case 'remove_plan': {
        await Subscription.deleteOne({ ownerId });
        return NextResponse.json({ success: true, message: 'Plan removed — user reverted to free' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[ADMIN MANAGE]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
