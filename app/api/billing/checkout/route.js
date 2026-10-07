import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Plan from '@/lib/models/Plan';
import Subscription from '@/lib/models/Subscription';
import Payment from '@/lib/models/Payment';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { getSession } from '@/lib/session';
import { cashfreeApi, getCashfreeConfig } from '@/lib/cashfree';
import { getPlatformSettings } from '@/lib/platformCheck';

// POST /api/billing/checkout — create Cashfree payment order
export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();

    const config = await getCashfreeConfig();
    if (!config) return NextResponse.json({ error: 'Payments are not configured. Contact admin.' }, { status: 503 });

    const { planSlug, billingCycle = 'monthly' } = await request.json();
    if (!planSlug) return NextResponse.json({ error: 'Plan is required' }, { status: 400 });

    await connectDB();
    const plan = await Plan.findOne({ slug: planSlug, isActive: true });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    if (!price || price <= 0) return NextResponse.json({ error: 'This plan is free — no payment needed' }, { status: 400 });

    const session = await getSession();
    const settings = await getPlatformSettings();
    const orderId = `order_${ownerId}_${Date.now()}`;

    // Create Cashfree order
    const order = await cashfreeApi('POST', '/orders', {
      order_id: orderId,
      order_amount: price / 100, // Cashfree expects amount in rupees, not paise
      order_currency: settings?.billing?.currency || 'INR',
      customer_details: {
        customer_id: ownerId,
        customer_name: session?.name || 'User',
        customer_email: session?.email || '',
        customer_phone: '9999999999', // placeholder — Cashfree requires phone
      },
      order_meta: {
        return_url: `${settings?.platformUrl || 'http://localhost:3000'}/billing?status=success&order_id={order_id}`,
        notify_url: `${settings?.platformUrl || 'http://localhost:3000'}/api/webhooks/cashfree`,
      },
      order_note: `${plan.name} - ${billingCycle}`,
    });

    // Store pending payment
    await Payment.create({
      ownerId,
      cashfreeOrderId: orderId,
      amount: price,
      currency: settings?.billing?.currency || 'INR',
      status: 'created',
      description: `${plan.name} (${billingCycle})`,
      metadata: { planSlug, billingCycle },
    });

    // Update subscription with pending upgrade
    await Subscription.findOneAndUpdate(
      { ownerId },
      { ownerId },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      environment: config.environment,
    });
  } catch (error) {
    console.error('[CHECKOUT ERROR]', error);
    return NextResponse.json({ error: error.message || 'Checkout failed' }, { status: 500 });
  }
}
