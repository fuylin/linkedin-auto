'use client';
import { useEffect, useState } from 'react';

export default function MaintenancePage() {
  const [message, setMessage] = useState('We are currently under maintenance. Please check back shortly.');
  const [checking, setChecking] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (!data.maintenance) {
        window.location.replace('/');
        return;
      }
      if (data.maintenanceMessage) setMessage(data.maintenanceMessage);
    } catch {}
    setChecking(false);
  };

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((data) => {
      if (data.maintenanceMessage) setMessage(data.maintenanceMessage);
      if (!data.maintenance) window.location.replace('/');
    }).catch(() => {});
    // Auto-check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', fontFamily: 'var(--sans)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--primary-green, #18392B)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 12 }}>Under maintenance</h1>
        <p style={{ fontSize: 16, color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 32 }}>{message}</p>
        <button onClick={checkHealth} disabled={checking} style={{ padding: '10px 24px', background: 'var(--primary-green, #18392B)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', opacity: checking ? 0.6 : 1 }}>
          {checking ? 'Checking...' : 'Try again'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 16 }}>This page auto-checks every 30 seconds.</p>
      </div>
    </main>
  );
}
