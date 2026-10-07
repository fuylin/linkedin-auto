import { connectDB } from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Subscription from '@/lib/models/Subscription';
import Plan from '@/lib/models/Plan';
import { verifyCashfreeWebhook } from '@/lib/cashfree';

// POST /api/webhooks/cashfree — Cashfree payment webhook
// No auth — verified by webhook signature
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-cashfree-signature') || request.headers.get('x-webhook-signature') || '';

    const valid = await verifyCashfreeWebhook(rawBody, signature);
    if (!valid) {
      console.warn('[CASHFREE WEBHOOK] Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const event = body.type || body.event;
    const data = body.data || {};

    console.log(`[CASHFREE WEBHOOK] Event: ${event}`);

    await connectDB();

    if (event === 'PAYMENT_SUCCESS_WEBHOOK' || event === 'payment.captured') {
      const orderId = data.order?.order_id;
      if (!orderId) return Response.json({ ok: true });

      const payment = await Payment.findOne({ cashfreeOrderId: orderId });
      if (payment && payment.status !== 'captured') {
        payment.status = 'captured';
        payment.cashfreePaymentId = data.payment?.cf_payment_id?.toString() || null;
        payment.method = data.payment?.payment_group || '';
        await payment.save();

        // Activate subscription
        const planSlug = payment.metadata?.planSlug;
        if (planSlug) {
          const plan = await Plan.findOne({ slug: planSlug, isActive: true });
          if (plan) {
            const now = new Date();
            const billingCycle = payment.metadata?.billingCycle || 'monthly';
            const periodEnd = new Date(now);
            if (billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            else periodEnd.setMonth(periodEnd.getMonth() + 1);

            await Subscription.findOneAndUpdate(
              { ownerId: payment.ownerId },
              {
                plan: plan._id,
                planSlug: plan.slug,
                status: 'active',
                billingCycle,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                lastPaymentId: payment._id,
                lastPaymentAt: now,
              },
              { upsert: true }
            );
          }
        }
      }
    }

    if (event === 'PAYMENT_FAILED_WEBHOOK' || event === 'payment.failed') {
      const orderId = data.order?.order_id;
      if (orderId) {
        await Payment.updateOne({ cashfreeOrderId: orderId }, { $set: { status: 'failed' } });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[CASHFREE WEBHOOK ERROR]', error);
    return Response.json({ ok: true }); // Always return 200 to avoid Cashfree retries
  }
}
