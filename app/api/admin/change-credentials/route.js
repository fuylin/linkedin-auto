import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminSession';
import { connectDB } from '@/lib/db';
import Admin from '@/lib/models/Admin';
import { hashPassword, verifyPassword } from '@/lib/adminAuth';
import { setOtp, verifyOtp } from '@/lib/otpStore';
import { sendEmail } from '@/lib/email';
import { createAdminSession, adminSessionCookieOptions } from '@/lib/adminSession';
import { cookies } from 'next/headers';

// POST /api/admin/change-credentials
// Step 1: { step: 'send_otp', currentPassword } → sends OTP to current admin email
// Step 2: { step: 'verify_and_update', otp, newEmail?, newPassword? } → verifies OTP then updates
export async function POST(request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    await connectDB();

    const admin = await Admin.findOne({ email: session.email });
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });

    // ── Step 1: Verify current password + send OTP ──
    if (body.step === 'send_otp') {
      if (!body.currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }

      const valid = verifyPassword(body.currentPassword, admin.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      // Generate and send OTP to current email
      const otp = String(crypto.randomInt(100000, 999999));
      setOtp(session.email, otp);

      await sendEmail({
        to: session.email,
        subject: 'Admin credential change — verification code',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #18392B; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
              <h2 style="color: #fff; margin: 0; font-size: 18px;">Credential Change Verification</h2>
            </div>
            <div style="background: #fff; border: 1px solid #E5E3DC; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
              <p style="color: #171717; font-size: 14px; margin: 0 0 16px;">You requested to change your admin credentials. Use this code to verify:</p>
              <div style="background: #F7F5EF; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #18392B;">${otp}</span>
              </div>
              <p style="color: #929292; font-size: 12px; margin: 0;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
            </div>
          </div>
        `,
      });

      return NextResponse.json({ success: true, message: `Verification code sent to ${session.email}` });
    }

    // ── Step 2: Verify OTP + update credentials ──
    if (body.step === 'verify_and_update') {
      if (!body.otp) {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
      }

      const otpValid = verifyOtp(session.email, body.otp);
      if (!otpValid) {
        return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 401 });
      }

      const newEmail = body.newEmail?.trim().toLowerCase();
      const newPassword = body.newPassword;

      if (!newEmail && !newPassword) {
        return NextResponse.json({ error: 'Provide a new email or password to update' }, { status: 400 });
      }

      // Validate new email
      if (newEmail && !newEmail.includes('@')) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      // Validate new password
      if (newPassword && newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      // Check if new email is already taken by another admin
      if (newEmail && newEmail !== admin.email) {
        const existing = await Admin.findOne({ email: newEmail });
        if (existing) return NextResponse.json({ error: 'This email is already used by another admin' }, { status: 409 });
      }

      // Update
      if (newEmail) admin.email = newEmail;
      if (newPassword) admin.passwordHash = hashPassword(newPassword);
      await admin.save();

      // Create new session with updated email
      const token = await createAdminSession({ email: admin.email, role: 'admin' });
      const cookieStore = await cookies();
      cookieStore.set(adminSessionCookieOptions(token));

      return NextResponse.json({
        success: true,
        message: `Credentials updated.${newEmail ? ` Email changed to ${newEmail}.` : ''}${newPassword ? ' Password changed.' : ''}`,
      });
    }

    return NextResponse.json({ error: 'Invalid step. Use "send_otp" or "verify_and_update".' }, { status: 400 });
  } catch (error) {
    console.error('[ADMIN CHANGE CREDENTIALS]', error);
    return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
  }
}
