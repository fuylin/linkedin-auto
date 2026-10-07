import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'platform' },

  // ── Email / SMTP ──
  smtpEmail: { type: String, default: '' },
  smtpPassword: { type: String, default: '' },
  emailNotificationsEnabled: { type: Boolean, default: true },

  // ── Platform ──
  platformName: { type: String, default: 'LinkedIn Automation' },
  platformUrl: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'We are currently under maintenance. Please check back shortly.' },

  // ── Branding ──
  logoUrl: { type: String, default: '' },
  brandColor: { type: String, default: '#18392B' },
  faviconUrl: { type: String, default: '' },

  // ── Announcement ──
  announcementEnabled: { type: Boolean, default: false },
  announcementText: { type: String, default: '' },
  announcementType: { type: String, enum: ['info', 'warning', 'success'], default: 'info' },

  // ── User limits ──
  maxPostsPerUser: { type: Number, default: 500 },
  maxTemplatesPerUser: { type: Number, default: 50 },

  // ── Scheduler ──
  schedulerEnabled: { type: Boolean, default: true },
  maxRetriesPerPost: { type: Number, default: 3 },

  // ── Registration / Access ──
  registrationMode: { type: String, enum: ['open', 'approval', 'invite'], default: 'open' },
  registrationEnabled: { type: Boolean, default: true }, // legacy — kept for backward compat
  allowedEmailDomains: { type: String, default: '' },

  // ── Security ──
  sessionTimeoutDays: { type: Number, default: 60 },
  maxSessionsPerUser: { type: Number, default: 5 },
  ipBlacklist: { type: String, default: '' },

  // ── Data management ──
  autoDeleteFailedDays: { type: Number, default: 0 },   // 0 = never
  autoDeletePublishedDays: { type: Number, default: 0 }, // 0 = never
  dataRetentionActivityDays: { type: Number, default: 90 },

  // ── Billing ──
  billing: {
    mode: { type: String, enum: ['free', 'free_pro', 'three_tier', 'usage', 'flat'], default: 'free' },
    // Cashfree credentials (optional — platform works without them)
    cashfreeAppId: { type: String, default: '' },
    cashfreeSecretKey: { type: String, default: '' },
    cashfreeWebhookSecret: { type: String, default: '' },
    cashfreeEnvironment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
    // Currency
    currency: { type: String, default: 'INR' },
    // Usage-based mode
    freePostsPerMonth: { type: Number, default: 10 },
    pricePerPost: { type: Number, default: 0 },  // in paise
    // Flat subscription mode
    flatPrice: { type: Number, default: 0 },      // monthly, in paise
    flatPriceLabel: { type: String, default: '' },
    // Trial
    trialDays: { type: Number, default: 0 },      // 0 = no trial
  },

}, { timestamps: true });

export default mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
