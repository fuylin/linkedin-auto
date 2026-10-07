import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Settings from '@/lib/models/Settings';
import { clearEmailCache } from '@/lib/email';
import { clearPlatformCache } from '@/lib/platformCheck';

// GET /api/admin/settings
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    let settings = await Settings.findById('platform').lean();
    if (!settings) {
      settings = (await Settings.create({ _id: 'platform' })).toObject();
    }
    if (settings.smtpPassword) {
      settings.smtpPasswordMasked = settings.smtpPassword.slice(0, 4) + '••••••••';
    }
    delete settings.smtpPassword;
    if (settings.billing?.cashfreeSecretKey) {
      settings.billing.cashfreeSecretKeyMasked = settings.billing.cashfreeSecretKey.slice(0, 4) + '••••••••';
      delete settings.billing.cashfreeSecretKey;
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[ADMIN SETTINGS GET]', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings
export async function PUT(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    await connectDB();

    const allowed = [
      'smtpEmail', 'smtpPassword', 'emailNotificationsEnabled',
      'platformName', 'platformUrl', 'maintenanceMode', 'maintenanceMessage',
      'logoUrl', 'brandColor', 'faviconUrl',
      'announcementEnabled', 'announcementText', 'announcementType',
      'maxPostsPerUser', 'maxTemplatesPerUser',
      'schedulerEnabled', 'maxRetriesPerPost',
      'registrationMode', 'registrationEnabled', 'allowedEmailDomains',
      'sessionTimeoutDays', 'maxSessionsPerUser', 'ipBlacklist',
      'autoDeleteFailedDays', 'autoDeletePublishedDays', 'dataRetentionActivityDays',
      'billing.mode', 'billing.cashfreeAppId', 'billing.cashfreeSecretKey',
      'billing.cashfreeWebhookSecret', 'billing.cashfreeEnvironment',
      'billing.currency', 'billing.freePostsPerMonth', 'billing.pricePerPost',
      'billing.flatPrice', 'billing.flatPriceLabel', 'billing.trialDays',
    ];

    const update = {};
    for (const key of allowed) {
      // Handle nested keys like billing.mode
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (body[parent] && body[parent][child] !== undefined) {
          update[key] = body[parent][child];
        }
      } else if (body[key] !== undefined) {
        update[key] = body[key];
      }
    }
    // Don't overwrite passwords with masked versions
    if (update.smtpPassword && update.smtpPassword.includes('••••')) {
      delete update.smtpPassword;
    }
    if (update['billing.cashfreeSecretKey'] && (update['billing.cashfreeSecretKey'].includes('••••') || update['billing.cashfreeSecretKey'] === '')) {
      delete update['billing.cashfreeSecretKey'];
    }
    if (update['billing.cashfreeWebhookSecret'] === '') {
      delete update['billing.cashfreeWebhookSecret'];
    }

    const settings = await Settings.findByIdAndUpdate(
      'platform',
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    clearEmailCache();
    clearPlatformCache();

    if (settings.smtpPassword) {
      settings.smtpPasswordMasked = settings.smtpPassword.slice(0, 4) + '••••••••';
    }
    delete settings.smtpPassword;
    if (settings.billing?.cashfreeSecretKey) {
      settings.billing.cashfreeSecretKeyMasked = settings.billing.cashfreeSecretKey.slice(0, 4) + '••••••••';
      delete settings.billing.cashfreeSecretKey;
    }

    return NextResponse.json({ success: true, settings, message: 'Settings saved.' });
  } catch (error) {
    console.error('[ADMIN SETTINGS PUT]', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// POST /api/admin/settings — send test email
export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const settings = await Settings.findById('platform').lean();

    // Use ONLY the DB settings — this tests what the admin just saved
    const smtpEmail = settings?.smtpEmail;
    const smtpPassword = settings?.smtpPassword;

    if (!smtpEmail || !smtpPassword) {
      return NextResponse.json({ error: 'SMTP not configured. Enter Gmail address and App Password, click "Save all settings" first, then test.' }, { status: 400 });
    }

    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpEmail, pass: smtpPassword },
    });

    // Send TO the same SMTP email so admin can verify it in that inbox
    await transporter.sendMail({
      from: `"${settings?.platformName || 'LinkedIn Automation'}" <${smtpEmail}>`,
      to: smtpEmail,
      subject: 'Test email — SMTP is working',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #18392B; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: #fff; margin: 0; font-size: 18px;">SMTP Test Successful</h2>
          </div>
          <div style="background: #fff; border: 1px solid #E5E3DC; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #2F6B4F; font-weight: 600; margin: 0 0 8px;">Email is working correctly.</p>
            <p style="color: #666; font-size: 13px; margin: 0;">Sent from: ${smtpEmail}</p>
            <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: `Test email sent to ${smtpEmail}` });
  } catch (error) {
    console.error('[ADMIN TEST EMAIL]', error);
    const msg = error.message?.includes('Invalid login')
      ? 'Gmail rejected the credentials. Make sure you are using an App Password, not your regular password.'
      : error.message?.includes('EAUTH')
        ? 'Authentication failed. Check your Gmail address and App Password.'
        : error.message || 'Failed to send test email';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
