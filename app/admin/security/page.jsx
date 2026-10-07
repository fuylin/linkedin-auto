'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../settings/page.module.css';

export default function AdminSecurityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=enter password, 2=enter OTP + new creds
  const [currentPassword, setCurrentPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const sendOtp = async () => {
    if (!currentPassword) { setMsg({ text: 'Enter your current password', type: 'error' }); return; }
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'send_otp', currentPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMsg({ text: json.message, type: 'success' });
      setStep(2);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
    setLoading(false);
  };

  const updateCredentials = async () => {
    if (!otp) { setMsg({ text: 'Enter the verification code', type: 'error' }); return; }
    if (newPassword && newPassword !== confirmPassword) { setMsg({ text: 'Passwords do not match', type: 'error' }); return; }
    if (newPassword && newPassword.length < 8) { setMsg({ text: 'Password must be at least 8 characters', type: 'error' }); return; }
    if (!newEmail && !newPassword) { setMsg({ text: 'Enter a new email or password', type: 'error' }); return; }

    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const body = { step: 'verify_and_update', otp };
      if (newEmail) body.newEmail = newEmail;
      if (newPassword) body.newPassword = newPassword;

      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMsg({ text: json.message, type: 'success' });
      // Reset form
      setStep(1);
      setCurrentPassword('');
      setOtp('');
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
    setLoading(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container} style={{ maxWidth: 560 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Admin security</h1>
            <p className={styles.headerSub}>Change your admin email or password.</p>
          </div>
          <a href="/admin/settings" className={styles.backLink}>&larr; Settings</a>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= 1 ? 'var(--primary-green, #18392B)' : 'var(--border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>1</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: step >= 1 ? 'var(--ink)' : 'var(--ink-faint)' }}>Verify identity</span>
            </div>
            <div style={{ width: 24, display: 'flex', alignItems: 'center', color: 'var(--ink-faint)' }}>→</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= 2 ? 'var(--primary-green, #18392B)' : 'var(--border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>2</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: step >= 2 ? 'var(--ink)' : 'var(--ink-faint)' }}>Update credentials</span>
            </div>
          </div>

          {/* Messages */}
          {msg.text && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 600, background: msg.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'success' ? '#065F46' : '#C94A4A' }}>
              {msg.text}
            </div>
          )}

          {/* Step 1: Current password */}
          {step === 1 && (
            <>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Enter your current admin password. We'll send a verification code to your registered email.
              </p>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Current password</label>
                <input className={styles.input} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" onKeyDown={(e) => e.key === 'Enter' && sendOtp()} autoFocus />
              </div>
              <button className="btn btn-primary" onClick={sendOtp} disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Verifying...' : 'Send verification code'}
              </button>
            </>
          )}

          {/* Step 2: OTP + new credentials */}
          {step === 2 && (
            <>
              <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Enter the 6-digit code sent to your email, then set your new email and/or password. Leave a field empty to keep it unchanged.
              </p>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Verification code</label>
                <input className={styles.inputMono} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} style={{ letterSpacing: 6, fontSize: 20, textAlign: 'center' }} autoFocus />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 12 }}>New credentials (leave empty to keep current)</p>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>New email</label>
                  <input className={styles.input} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-admin@example.com" />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>New password</label>
                  <input className={styles.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
                </div>

                {newPassword && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Confirm new password</label>
                    <input className={styles.input} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={updateCredentials} disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Updating...' : 'Update credentials'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setStep(1); setOtp(''); setMsg({ text: '', type: '' }); }}>
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
