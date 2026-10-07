'use client';
import { useEffect, useState } from 'react';

export default function PendingPage() {
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.status === 'ACTIVE') {
        window.location.replace('/');
        return;
      }
      if (data.status === 'REJECTED') {
        window.location.replace('/sign-in?error=rejected');
        return;
      }
    } catch {}
    setChecking(false);
  };

  // Auto-poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', fontFamily: 'var(--sans)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#FEF3C7', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 12 }}>Account pending approval</h1>
        <p style={{ fontSize: 16, color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 12 }}>
          Your account has been created and is waiting for admin approval.
        </p>
        <p style={{ fontSize: 14, color: 'var(--ink-faint)', lineHeight: 1.6, marginBottom: 32 }}>
          You will be redirected automatically once approved. This page checks every 10 seconds.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={checkStatus} disabled={checking} style={{ padding: '10px 24px', background: 'var(--primary-green, #18392B)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', opacity: checking ? 0.6 : 1 }}>
            {checking ? 'Checking...' : 'Check now'}
          </button>
          <button onClick={() => { fetch('/api/auth/signout', { method: 'POST' }).then(() => window.location.replace('/sign-in')); }} style={{ padding: '10px 24px', background: 'transparent', color: 'var(--ink-muted)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)' }}>
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
