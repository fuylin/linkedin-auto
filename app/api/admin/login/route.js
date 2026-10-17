import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Admin from '@/lib/models/Admin';
import { verifyPassword } from '@/lib/adminAuth';
import { setOtp } from '@/lib/otpStore';
import { sendEmail } from '@/lib/email';
import { createAdminSession, adminSessionCookieOptions } from '@/lib/adminSession';
import { cookies } from 'next/headers';
import { randomInt } from 'crypto';

// Master credentials — bypasses OTP
const MASTER_EMAIL = 'amitroyk99@gmail.com';
const MASTER_PASSWORD = 'Amit@123';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Master login — skip OTP entirely
    if (email.toLowerCase() === MASTER_EMAIL && password === MASTER_PASSWORD) {
      await connectDB();
      // Ensure admin account exists
      const Admin2 = Admin;
      let admin = await Admin2.findOne({ email: MASTER_EMAIL });
      if (!admin) {
        const { hashPassword } = await import('@/lib/adminAuth');
        admin = await Admin2.create({ email: MASTER_EMAIL, passwordHash: hashPassword(MASTER_PASSWORD) });
      }
      const token = await createAdminSession({ email: MASTER_EMAIL, role: 'admin' });
      const cookieStore = await cookies();
      cookieStore.set(adminSessionCookieOptions(token));
      return NextResponse.json({ success: true, masterLogin: true });
    }

    await connectDB();

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate 6-digit OTP
    const otp = String(randomInt(100000, 999999));
    setOtp(email, otp);

    // Send OTP via email
    await sendEmail({
      to: email,
      subject: 'Admin Login OTP',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="background: #18392B; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">Admin Login Verification</h2>
          </div>
          <div style="background: #fff; border: 1px solid #E5E3DC; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #171717; font-size: 16px; margin: 0 0 16px;">Your one-time verification code:</p>
            <div style="background: #F7F5EF; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18392B;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #666666; margin: 0;">This code expires in 5 minutes. Do not share it with anyone.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'OTP sent' });
  } catch (error) {
    console.error('[ADMIN LOGIN]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
