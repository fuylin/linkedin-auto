'use client';
import Link from 'next/link';

export default function UpgradePrompt({ message }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '32px 24px',
      textAlign: 'center',
      maxWidth: 480,
      margin: '24px auto',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF3C7', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Upgrade your plan</h3>
      <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 20 }}>{message || 'You have reached the limit on your current plan.'}</p>
      <Link href="/billing" className="btn btn-primary" style={{ display: 'inline-flex' }}>
        View plans
      </Link>
    </div>
  );
}
