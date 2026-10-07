import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Plan from '@/lib/models/Plan';
import Subscription from '@/lib/models/Subscription';
import Payment from '@/lib/models/Payment';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { cashfreeApi } from '@/lib/cashfree';

// POST /api/billing/verify — verify payment after Cashfree checkout
export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();

    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    // Verify with Cashfree
    const order = await cashfreeApi('GET', `/orders/${orderId}`);

    await connectDB();
    const payment = await Payment.findOne({ cashfreeOrderId: orderId, ownerId });
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    if (order.order_status === 'PAID') {
      // Get payment details
      const payments = await cashfreeApi('GET', `/orders/${orderId}/payments`);
      const paidPayment = payments?.find((p) => p.payment_status === 'SUCCESS') || payments?.[0];

      payment.status = 'captured';
      payment.cashfreePaymentId = paidPayment?.cf_payment_id?.toString() || null;
      payment.method = paidPayment?.payment_group || '';
      await payment.save();

      // Activate subscription
      const planSlug = payment.metadata?.planSlug;
      const billingCycle = payment.metadata?.billingCycle || 'monthly';
      if (planSlug) {
        const plan = await Plan.findOne({ slug: planSlug, isActive: true });
        if (plan) {
          const now = new Date();
          const periodEnd = new Date(now);
          if (billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          else periodEnd.setMonth(periodEnd.getMonth() + 1);

          await Subscription.findOneAndUpdate(
            { ownerId },
            {
              plan: plan._id,
              planSlug: plan.slug,
              status: 'active',
              billingCycle,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd,
              lastPaymentId: payment._id,
              lastPaymentAt: now,
              trialEndsAt: null,
            },
            { upsert: true }
          );
        }
      }

      return NextResponse.json({ success: true, status: 'paid' });
    } else {
      payment.status = 'failed';
      await payment.save();
      return NextResponse.json({ success: false, status: order.order_status, error: 'Payment not completed' }, { status: 400 });
    }
  } catch (error) {
    console.error('[VERIFY ERROR]', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
