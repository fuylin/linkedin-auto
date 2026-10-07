import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, unique: true, index: true },

  // Current plan
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planSlug: { type: String, default: 'free' },

  // Status
  status: {
    type: String,
    enum: ['active', 'trialing', 'past_due', 'canceled', 'free'],
    default: 'free',
    index: true,
  },

  // Billing cycle
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'none'], default: 'none' },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },

  // Cashfree references
  cashfreeCustomerId: { type: String, default: null },
  cashfreeSubscriptionId: { type: String, default: null },
  lastPaymentId: { type: String, default: null },
  lastPaymentAt: { type: Date, default: null },

  // Usage tracking (for usage-based billing)
  usage: {
    postsThisMonth: { type: Number, default: 0 },
    usageCycleStart: { type: Date, default: null },
  },

  // Admin override
  adminOverride: { type: Boolean, default: false },
  adminNotes: { type: String, default: '' },

  // Cancellation
  canceledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
