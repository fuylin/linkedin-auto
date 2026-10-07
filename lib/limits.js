import { connectDB } from './db.js';
import { getPlatformSettings } from './platformCheck.js';

/**
 * Check if a user is allowed to perform an action based on their subscription plan.
 * Returns { allowed: true } or { allowed: false, reason, limit, current, upgrade: true }
 *
 * In 'free' billing mode, always returns allowed: true (zero overhead).
 */
export async function checkLimit(ownerId, action) {
  const settings = await getPlatformSettings();
  const billingMode = settings?.billing?.mode || 'free';

  // Free mode = no limits at all
  if (billingMode === 'free') return { allowed: true };

  await connectDB();
  const Subscription = (await import('./models/Subscription.js')).default;
  const sub = await Subscription.findOne({ ownerId }).populate('plan').lean();

  // No subscription or plan in a paid mode = restrict access
  if (!sub || !sub.plan) {
    // Auto-assign default plan if one exists
    const Plan = (await import('./models/Plan.js')).default;
    const defaultPlan = await Plan.findOne({ applicableModes: billingMode, isDefault: true, isActive: true });
    if (defaultPlan) {
      const Subscription = (await import('./models/Subscription.js')).default;
      const newSub = await Subscription.findOneAndUpdate(
        { ownerId },
        { ownerId, plan: defaultPlan._id, planSlug: defaultPlan.slug, status: defaultPlan.priceMonthly > 0 ? 'trialing' : 'free', 'usage.usageCycleStart': new Date() },
        { upsert: true, new: true }
      ).populate('plan').lean();
      if (newSub?.plan) {
        // Re-run with the newly assigned plan
        return checkLimit(ownerId, action);
      }
    }
    // No default plan configured — block with helpful message
    return { allowed: false, reason: 'No plan assigned. Contact admin.', upgrade: true };
  }

  // Canceled or past_due with no grace
  if (sub.status === 'canceled') {
    return { allowed: false, reason: 'Your subscription has been canceled.', upgrade: true };
  }

  // Trial expired
  if (sub.status === 'trialing' && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date()) {
    return { allowed: false, reason: 'Your trial has expired. Please upgrade to continue.', upgrade: true };
  }

  const limits = sub.plan.limits || {};

  switch (action) {
    case 'create_post': {
      // Check total posts
      if (limits.maxPosts !== -1) {
        const Post = (await import('./models/Post.js')).default;
        const count = await Post.countDocuments({ ownerId });
        if (count >= limits.maxPosts) {
          return { allowed: false, reason: `You've reached the maximum of ${limits.maxPosts} posts on your plan.`, limit: limits.maxPosts, current: count, upgrade: true };
        }
      }
      // Check monthly posts
      if (limits.maxPostsPerMonth !== -1) {
        const Post = (await import('./models/Post.js')).default;
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const count = await Post.countDocuments({ ownerId, createdAt: { $gte: monthStart } });
        if (count >= limits.maxPostsPerMonth) {
          return { allowed: false, reason: `You've reached your monthly limit of ${limits.maxPostsPerMonth} posts.`, limit: limits.maxPostsPerMonth, current: count, upgrade: true };
        }
      }
      // Usage-based mode: check free posts
      if (billingMode === 'usage' && sub.usage) {
        const freeLimit = settings.billing.freePostsPerMonth || 10;
        if (sub.usage.postsThisMonth >= freeLimit && sub.status === 'free') {
          const pricePerPost = settings.billing.pricePerPost || 0;
          return { allowed: false, reason: `You've used your ${freeLimit} free posts this month. Additional posts cost ₹${(pricePerPost / 100).toFixed(0)} each.`, limit: freeLimit, current: sub.usage.postsThisMonth, upgrade: true, payPerPost: true };
        }
      }
      return { allowed: true };
    }

    case 'create_template': {
      if (limits.maxTemplates !== -1) {
        const Template = (await import('./models/Template.js')).default;
        const count = await Template.countDocuments({ ownerId });
        if (count >= limits.maxTemplates) {
          return { allowed: false, reason: `You've reached the maximum of ${limits.maxTemplates} templates on your plan.`, limit: limits.maxTemplates, current: count, upgrade: true };
        }
      }
      return { allowed: true };
    }

    case 'access_analytics':
      if (limits.analyticsAccess === false) {
        return { allowed: false, reason: 'Analytics is not available on your current plan.', upgrade: true };
      }
      return { allowed: true };

    case 'access_calendar':
      if (limits.calendarAccess === false) {
        return { allowed: false, reason: 'Calendar view is not available on your current plan.', upgrade: true };
      }
      return { allowed: true };

    case 'access_import':
      if (limits.importAccess === false) {
        return { allowed: false, reason: 'CSV/Excel import is not available on your current plan.', upgrade: true };
      }
      return { allowed: true };

    case 'access_bulk':
      if (limits.bulkActionsAccess === false) {
        return { allowed: false, reason: 'Bulk actions are not available on your current plan.', upgrade: true };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

/**
 * Increment usage counter for usage-based billing.
 * Only called for non-draft posts.
 */
export async function incrementUsage(ownerId, isDraft = false) {
  if (isDraft) return; // drafts don't count toward usage
  const settings = await getPlatformSettings();
  if (settings?.billing?.mode !== 'usage') return;

  await connectDB();
  const Subscription = (await import('./models/Subscription.js')).default;
  const sub = await Subscription.findOne({ ownerId });
  if (!sub) return;

  // Reset counter if a new month has started
  const cycleStart = sub.usage?.usageCycleStart;
  if (cycleStart) {
    const now = new Date();
    const cycle = new Date(cycleStart);
    if (now.getMonth() !== cycle.getMonth() || now.getFullYear() !== cycle.getFullYear()) {
      sub.usage.postsThisMonth = 0;
      sub.usage.usageCycleStart = now;
    }
  }

  sub.usage.postsThisMonth = (sub.usage.postsThisMonth || 0) + 1;
  await sub.save();
}
