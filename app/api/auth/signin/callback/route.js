import { NextResponse } from 'next/server';
import axios from 'axios';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import { fetchAdminOrganizations } from '@/lib/linkedinAnalytics';
import { createSession, sessionCookieOptions } from '@/lib/session';
import { trackActivity } from '@/lib/activity';
import { sendEmail } from '@/lib/email';

// GET /api/auth/signin/callback — LinkedIn OAuth callback
// This single route does everything: authenticate the user AND store their LinkedIn token.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    console.error('[AUTH] State mismatch or missing code');
    return redirectTo(request, '/sign-in?error=auth_failed');
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000 }
    );
    const { access_token, expires_in } = tokenRes.data;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // 2. Fetch LinkedIn profile (identity)
    const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
      timeout: 15_000,
    });
    const profile = profileRes.data;
    const authorUrn = `urn:li:person:${profile.sub}`;

    // The ownerId is the LinkedIn person ID — unique per user
    const ownerId = profile.sub;

    // 3. Check platform settings
    await connectDB();
    const Settings = (await import('@/lib/models/Settings')).default;
    const platformSettings = await Settings.findById('platform').lean().catch(() => null);

    // Check maintenance mode
    if (platformSettings?.maintenanceMode) {
      return redirectTo(request, '/sign-in?error=maintenance');
    }

    const existingAccount = await Account.findOne({ authorUrn }).lean();
    const regMode = platformSettings?.registrationMode || 'open';
    const isNewUser = !existingAccount;

    if (isNewUser) {
      // Check allowed email domains
      if (platformSettings?.allowedEmailDomains) {
        const allowed = platformSettings.allowedEmailDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        if (allowed.length > 0 && profile.email) {
          const domain = profile.email.split('@')[1]?.toLowerCase();
          if (!allowed.includes(domain)) {
            return redirectTo(request, '/sign-in?error=domain_not_allowed');
          }
        }
      }

      // Check registration mode
      if (regMode === 'invite') {
        // Check for valid invite token in cookie
        const inviteToken = request.cookies.get('invite_token')?.value;
        if (!inviteToken) {
          return redirectTo(request, '/sign-in?error=invite_only');
        }
        const Invite = (await import('@/lib/models/Invite')).default;
        const invite = await Invite.findOne({ token: inviteToken, usedAt: null, expiresAt: { $gt: new Date() } });
        if (!invite) {
          return redirectTo(request, '/sign-in?error=invite_invalid');
        }
        // Mark invite as used
        invite.usedAt = new Date();
        invite.usedBy = ownerId;
        await invite.save();
      }

      if (regMode === 'approval' && !existingAccount) {
        // Check if user was previously rejected
        const rejected = await Account.findOne({ authorUrn, status: 'REJECTED' }).lean();
        if (rejected) {
          return redirectTo(request, '/sign-in?error=rejected');
        }
      }
    }

    // Determine account status for new users
    const accountStatus = isNewUser && regMode === 'approval' ? 'PENDING' : (existingAccount?.status || 'ACTIVE');

    // 3b. Store LinkedIn account
    await Account.findOneAndUpdate(
      { authorUrn },
      {
        ownerId,
        accessToken: access_token,
        tokenExpiresAt,
        accountType: 'person',
        status: existingAccount ? existingAccount.status : accountStatus,
        displayName: profile.name || null,
        profilePictureUrl: profile.picture || null,
        email: profile.email || null,
      },
      { upsert: true, new: true }
    );

    console.log(`[AUTH] Signed in: ${profile.name} (${authorUrn})`);
    trackActivity({ ownerId, action: 'login', request, metadata: {
      name: profile.name,
      email: profile.email,
      profileUrl: `https://www.linkedin.com/in/${profile.sub}`,
    } }).catch(() => {});

    // 3b. Try to fetch admin organizations (non-fatal if scopes not approved)
    try {
      const orgs = await fetchAdminOrganizations(access_token);
      for (const org of orgs) {
        await Account.findOneAndUpdate(
          { authorUrn: org.urn },
          {
            ownerId,
            accessToken: access_token,
            tokenExpiresAt,
            accountType: 'organization',
            displayName: org.name,
            profilePictureUrl: org.logoUrl || null,
            linkedPersonUrn: authorUrn,
          },
          { upsert: true, new: true }
        );
      }
      if (orgs.length) console.log(`[AUTH] Found ${orgs.length} admin org(s)`);
    } catch (orgError) {
      console.warn('[AUTH] Could not fetch admin orgs:', orgError.message);
    }

    // 3c. Auto-create subscription for new users
    if (isNewUser) {
      try {
        const PlanModel = (await import('@/lib/models/Plan')).default;
        const SubModel = (await import('@/lib/models/Subscription')).default;
        const billingMode = platformSettings?.billing?.mode || 'free';
        if (billingMode !== 'free') {
          const defaultPlan = await PlanModel.findOne({ applicableModes: billingMode, isDefault: true, isActive: true });
          if (defaultPlan) {
            await SubModel.findOneAndUpdate(
              { ownerId },
              {
                ownerId,
                plan: defaultPlan._id,
                planSlug: defaultPlan.slug,
                status: defaultPlan.priceMonthly > 0 ? (platformSettings.billing.trialDays > 0 ? 'trialing' : 'free') : 'free',
                trialEndsAt: platformSettings.billing.trialDays > 0 ? new Date(Date.now() + platformSettings.billing.trialDays * 86400000) : null,
                'usage.usageCycleStart': new Date(),
              },
              { upsert: true, new: true }
            );
          }
        }
      } catch (subError) {
        console.warn('[AUTH] Could not create subscription:', subError.message);
      }
    }

    // 4. Create session JWT and set it as a cookie
    const jwt = await createSession({
      userId: ownerId,
      authorUrn,
      name: profile.name || 'LinkedIn User',
      email: profile.email || null,
      picture: profile.picture || null,
    });

    const redirectUrl = accountStatus === 'PENDING' ? '/pending' : '/';
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    response.cookies.set(sessionCookieOptions(jwt));
    response.cookies.delete('oauth_state');
    response.cookies.delete('invite_token');

    // Notify admin of new pending user
    if (accountStatus === 'PENDING') {
      sendEmail({
        to: platformSettings?.smtpEmail || process.env.SMTP_EMAIL,
        subject: `New user awaiting approval: ${profile.name}`,
        html: `<div style="font-family:sans-serif;padding:24px;"><h2>New user needs approval</h2><p><strong>${profile.name}</strong> (${profile.email}) signed up and is waiting for your approval.</p><p>Go to the admin panel to approve or reject.</p></div>`,
      }).catch(() => {});
    }

    return response;
  } catch (error) {
    console.error('[AUTH] LinkedIn callback failed:', error.response?.data || error.message);
    return redirectTo(request, '/sign-in?error=auth_failed');
  }
}

function redirectTo(request, path) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete('oauth_state');
  return response;
}
