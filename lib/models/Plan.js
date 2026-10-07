import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  badge: { type: String, default: '' }, // "Most Popular", "Best Value"
  sortOrder: { type: Number, default: 0 },

  // Pricing (in paise — 100 paise = ₹1, 0 = free)
  priceMonthly: { type: Number, default: 0 },
  priceYearly: { type: Number, default: 0 },

  // Cashfree plan IDs (for recurring subscriptions)
  cashfreePlanIdMonthly: { type: String, default: '' },
  cashfreePlanIdYearly: { type: String, default: '' },

  // Limits (-1 = unlimited, 0 = no access)
  limits: {
    maxPosts: { type: Number, default: -1 },
    maxPostsPerMonth: { type: Number, default: -1 },
    maxTemplates: { type: Number, default: -1 },
    maxAccounts: { type: Number, default: -1 },
    analyticsAccess: { type: Boolean, default: true },
    calendarAccess: { type: Boolean, default: true },
    importAccess: { type: Boolean, default: true },
    bulkActionsAccess: { type: Boolean, default: true },
  },

  // Which billing modes this plan applies to
  applicableModes: [{ type: String, enum: ['free', 'free_pro', 'three_tier', 'usage', 'flat'] }],

  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

planSchema.index({ applicableModes: 1, isActive: 1 });

export default mongoose.models.Plan || mongoose.model('Plan', planSchema);
