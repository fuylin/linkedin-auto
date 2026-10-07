'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import styles from './page.module.css';

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const addToast = useToast();

  const handleUpgrade = async (planSlug) => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug, billingCycle: 'monthly' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Load Cashfree checkout SDK and open payment
      const env = json.environment === 'production' ? 'production' : 'sandbox';
      const sdkUrl = env === 'production'
        ? 'https://sdk.cashfree.com/js/v3/cashfree.js'
        : 'https://sdk.cashfree.com/js/v3/cashfree-sandbox.js';

      // Load SDK script if not already loaded
      if (!window.Cashfree) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = sdkUrl;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
          document.head.appendChild(script);
        });
      }

      const cashfree = window.Cashfree({ mode: env });
      const result = await cashfree.checkout({ paymentSessionId: json.paymentSessionId });

      if (result.error) {
        addToast('error', result.error.message || 'Payment failed');
      } else if (result.paymentDetails) {
        // Verify payment
        const verifyRes = await fetch('/api/billing/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: json.orderId }),
        });
        const verifyJson = await verifyRes.json();
        if (verifyJson.success) {
          addToast('success', 'Payment successful! Plan upgraded.');
          window.location.reload();
        } else {
          addToast('error', verifyJson.error || 'Payment verification failed');
        }
      }
    } catch (err) {
      addToast('error', err.message);
    }
    setUpgrading(false);
  };

  useEffect(() => {
    fetch('/api/billing')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      })
      .then(setData)
      .catch((err) => addToast('error', err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div><div className="page-header"><h1>Billing</h1></div><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;
  if (!data) return <div><div className="page-header"><h1>Billing</h1></div><p>Failed to load.</p></div>;

  const billingMode = data.billingMode || 'free';
  const subscription = data.subscription || null;
  const usage = data.usage || {};
  const limits = data.limits || null;
  const plans = data.plans || [];
  const payments = data.payments || [];
  const currency = data.currency || 'INR';
  const currentPlan = subscription?.plan || null;
  const isFreeMode = billingMode === 'free';
  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
  const formatPrice = (p) => `${currencySymbol}${(p / 100).toLocaleString()}`;

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <p>{isFreeMode ? 'This platform is completely free — no limits.' : 'Manage your plan and view usage.'}</p>
      </div>

      {isFreeMode ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#D1FAE5', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Free access</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>You have unlimited access to all features.</p>
        </div>
      ) : (
        <>
          {/* Current plan */}
          <div className={styles.planCard}>
            <div className={styles.planHeader}>
              <div>
                <h2 className={styles.planName}>{currentPlan?.name || 'Free'}</h2>
                <span className={`badge badge-${subscription?.status === 'active' ? 'published' : subscription?.status === 'trialing' ? 'pending' : 'draft'}`}>
                  {subscription?.status || 'free'}
                </span>
              </div>
              {currentPlan?.priceMonthly > 0 && (
                <div className={styles.planPrice}>
                  <span className={styles.priceAmount}>{formatPrice(currentPlan.priceMonthly)}</span>
                  <span className={styles.pricePeriod}>/month</span>
                </div>
              )}
            </div>
            {subscription?.currentPeriodEnd && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            )}
            {subscription?.status === 'trialing' && subscription?.trialEndsAt && (
              <p style={{ fontSize: 13, color: 'var(--orange)', marginTop: 4 }}>
                Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            )}
          </div>

          {/* Usage meters */}
          <div className={styles.usageGrid}>
            {limits?.maxPosts !== -1 && limits?.maxPosts != null && (
              <UsageMeter label="Total posts" current={usage.posts} max={limits.maxPosts} />
            )}
            {limits?.maxPostsPerMonth !== -1 && limits?.maxPostsPerMonth != null && (
              <UsageMeter label="Posts this month" current={usage.postsThisMonth} max={limits.maxPostsPerMonth} />
            )}
            {limits?.maxTemplates !== -1 && limits?.maxTemplates != null && (
              <UsageMeter label="Templates" current={usage.templates} max={limits.maxTemplates} />
            )}
          </div>

          {/* Available plans */}
          {plans.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Available plans</h3>
              <div className={styles.plansGrid}>
                {plans.map((plan) => {
                  const isCurrent = currentPlan?.slug === plan.slug;
                  return (
                    <div key={plan._id} className={`card ${styles.planOption} ${isCurrent ? styles.currentPlan : ''}`}>
                      {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
                      <h4 className={styles.optionName}>{plan.name}</h4>
                      <p className={styles.optionPrice}>
                        {plan.priceMonthly > 0 ? <><span style={{ fontSize: 28, fontWeight: 800 }}>{formatPrice(plan.priceMonthly)}</span>/mo</> : <span style={{ fontSize: 28, fontWeight: 800 }}>Free</span>}
                      </p>
                      {plan.description && <p className={styles.optionDesc}>{plan.description}</p>}
                      <ul className={styles.featureList}>
                        <li>{plan.limits?.maxPostsPerMonth === -1 ? 'Unlimited' : plan.limits?.maxPostsPerMonth} posts/month</li>
                        <li>{plan.limits?.maxTemplates === -1 ? 'Unlimited' : plan.limits?.maxTemplates} templates</li>
                        <li>{plan.limits?.analyticsAccess !== false ? '✓' : '✗'} Analytics</li>
                        <li>{plan.limits?.importAccess !== false ? '✓' : '✗'} CSV Import</li>
                      </ul>
                      {isCurrent ? (
                        <button className="btn btn-outline" disabled style={{ width: '100%', marginTop: 16 }}>Current plan</button>
                      ) : plan.priceMonthly === 0 ? (
                        <button className="btn btn-outline" style={{ width: '100%', marginTop: 16 }} onClick={() => addToast('info', 'Contact admin to switch to the free plan.')}>
                          Switch to Free
                        </button>
                      ) : !data.cashfreeConfigured ? (
                        <button className="btn btn-outline" style={{ width: '100%', marginTop: 16 }} onClick={() => addToast('info', 'Payments are not configured. Contact admin to upgrade.')}>
                          Contact admin
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={upgrading} onClick={() => handleUpgrade(plan.slug)}>
                          {upgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Payment history</h3>
              <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{new Date(p.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{formatPrice(p.amount)}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span className={`badge badge-${p.status === 'captured' ? 'published' : p.status === 'failed' ? 'failed' : 'pending'}`}>{p.status}</span></td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{p.method || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UsageMeter({ label, current, max }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--orange)' : 'var(--green)';
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{current} / {max}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
