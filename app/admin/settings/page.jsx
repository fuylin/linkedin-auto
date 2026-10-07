'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const TABS = [
  { id: 'email', label: 'Email', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { id: 'platform', label: 'Platform', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06"/></svg> },
  { id: 'branding', label: 'Branding', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
  { id: 'scheduler', label: 'Scheduler', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id: 'access', label: 'Access', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { id: 'data', label: 'Data', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> },
  { id: 'billing', label: 'Billing', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [tab, setTab] = useState('email');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(async (r) => {
        if (r.status === 401) { router.replace('/admin'); return; }
        const json = await r.json();
        if (json.success) setSettings(json.settings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.settings);
        setMsg({ text: 'Settings saved successfully.', type: 'success' });
      } else {
        setMsg({ text: json.error || 'Failed to save.', type: 'error' });
      }
    } catch { setMsg({ text: 'Network error.', type: 'error' }); }
    setSaving(false);
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const testEmail = async () => {
    setTesting(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST' });
      const json = await res.json();
      setMsg({ text: json.success ? json.message : json.error, type: json.success ? 'success' : 'error' });
    } catch { setMsg({ text: 'Failed to send test email.', type: 'error' }); }
    setTesting(false);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>Loading...</div>;
  if (!settings) return <div style={{ padding: 40 }}>Failed to load settings. <a href="/admin">Back</a></div>;

  const smtpConfigured = !!(settings.smtpEmail && (settings.smtpPassword || settings.smtpPasswordMasked));

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Settings</h1>
            <p className={styles.headerSub}>Configure how the platform works.</p>
          </div>
          <a href="/admin/dashboard" className={styles.backLink}>&larr; Dashboard</a>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(({ id, label, icon }) => (
            <button key={id} className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`} onClick={() => setTab(id)}>
              <span className={styles.tabIcon}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ═══ EMAIL TAB ═══ */}
        {tab === 'email' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#E8F0EB', color: 'var(--green)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Email notifications {smtpConfigured ? <span className={styles.statusDot} style={{ background: settings.emailNotificationsEnabled ? 'var(--green)' : 'var(--orange)' }} /> : <span className={styles.statusDot} style={{ background: 'var(--red)' }} />}</h2>
                  <p className={styles.sectionDesc}>Send automatic emails to users when their posts publish successfully or fail. Uses Gmail SMTP.</p>
                </div>
              </div>

              {/* How it works */}
              <div className={styles.steps}>
                <div className={styles.step}>
                  <span className={styles.stepNum}>1</span>
                  <span>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>Google App Passwords</a> and generate a 16-character password for this app.</span>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>2</span>
                  <span>Enter your Gmail address and the app password below, then click <strong>Save</strong>.</span>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>3</span>
                  <span>Click <strong>Send test email</strong> to verify. You should receive an email at the address you entered.</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Gmail address</label>
                <input className={styles.input} value={settings.smtpEmail || ''} onChange={(e) => update('smtpEmail', e.target.value)} placeholder="notifications@gmail.com" type="email" />
                <p className={styles.fieldHint}>This is both the sender and the test recipient. All notification emails will come from this address.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>App password</label>
                <input className={styles.inputMono} value={settings.smtpPassword ?? ''} onChange={(e) => update('smtpPassword', e.target.value)} placeholder={settings.smtpPasswordMasked || 'xxxx xxxx xxxx xxxx'} autoComplete="off" />
                <p className={styles.fieldHint}>Not your Gmail password. Generate an App Password from Google. It looks like <code style={{ background: 'var(--hover)', padding: '1px 4px', borderRadius: 3, fontSize: 12 }}>abcd efgh ijkl mnop</code></p>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Enable email notifications</div>
                  <div className={styles.toggleDesc}>When off, no emails are sent to any user — even if SMTP is configured.</div>
                </div>
                <button type="button" className={`${styles.toggle} ${settings.emailNotificationsEnabled ? styles.on : ''}`} onClick={() => update('emailNotificationsEnabled', !settings.emailNotificationsEnabled)} />
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={testEmail} disabled={testing || !smtpConfigured}>
                  {testing ? 'Sending...' : 'Send test email'}
                </button>
                {!smtpConfigured && <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Save email and password first</span>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PLATFORM TAB ═══ */}
        {tab === 'platform' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82.65V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Platform settings</h2>
                  <p className={styles.sectionDesc}>General configuration and maintenance controls.</p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Platform name</label>
                <input className={styles.input} value={settings.platformName || ''} onChange={(e) => update('platformName', e.target.value)} placeholder="LinkedIn Automation" />
                <p className={styles.fieldHint}>Shown in email notifications and the browser tab.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Platform URL</label>
                <input className={styles.input} value={settings.platformUrl || ''} onChange={(e) => update('platformUrl', e.target.value)} placeholder="https://your-app.vercel.app" />
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Maintenance mode</div>
                  <div className={styles.toggleDesc}>When on, new users cannot sign in. Existing sessions remain active until they expire.</div>
                </div>
                <button type="button" className={`${styles.toggle} ${settings.maintenanceMode ? styles.on : ''}`} onClick={() => update('maintenanceMode', !settings.maintenanceMode)} />
              </div>

              {settings.maintenanceMode && (
                <>
                  <div className={styles.field} style={{ marginTop: 12 }}>
                    <label className={styles.fieldLabel}>Maintenance message</label>
                    <input className={styles.input} value={settings.maintenanceMessage || ''} onChange={(e) => update('maintenanceMessage', e.target.value)} />
                  </div>
                  <div className={styles.warningBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Maintenance mode is ON. New logins are blocked.
                  </div>
                </>
              )}

              <div className={styles.field} style={{ marginTop: 20 }}>
                <label className={styles.fieldLabel}>Max posts per user</label>
                <input className={styles.inputSmall} type="number" value={settings.maxPostsPerUser || 500} onChange={(e) => update('maxPostsPerUser', parseInt(e.target.value) || 500)} min="1" />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Max templates per user</label>
                <input className={styles.inputSmall} type="number" value={settings.maxTemplatesPerUser || 50} onChange={(e) => update('maxTemplatesPerUser', parseInt(e.target.value) || 50)} min="1" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ SCHEDULER TAB ═══ */}
        {tab === 'scheduler' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#FEF3C7', color: '#92400E' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Scheduler {settings.schedulerEnabled ? <span className={styles.statusDot} style={{ background: 'var(--green)' }} /> : <span className={styles.statusDot} style={{ background: 'var(--red)' }} />}</h2>
                  <p className={styles.sectionDesc}>The scheduler runs every ~60 seconds and publishes posts whose scheduled time has passed. These settings control its behavior.</p>
                </div>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Auto-publish enabled</div>
                  <div className={styles.toggleDesc}>When off, the scheduler skips all posts. Posts stay as PENDING until you manually publish them or re-enable.</div>
                </div>
                <button type="button" className={`${styles.toggle} ${settings.schedulerEnabled ? styles.on : ''}`} onClick={() => update('schedulerEnabled', !settings.schedulerEnabled)} />
              </div>

              {!settings.schedulerEnabled && (
                <div className={styles.warningBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Scheduler is OFF. No posts will auto-publish for any user.
                </div>
              )}

              <div className={styles.field} style={{ marginTop: 20 }}>
                <label className={styles.fieldLabel}>Max retries on failure</label>
                <input className={styles.inputSmall} type="number" value={settings.maxRetriesPerPost || 3} onChange={(e) => update('maxRetriesPerPost', parseInt(e.target.value) || 3)} min="0" max="10" />
                <p className={styles.fieldHint}>If LinkedIn returns a temporary error (500, 429, timeout), the scheduler retries this many times with increasing delays (5min, 10min, 20min). After exhausting retries, the post is marked FAILED.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACCESS TAB ═══ */}
        {tab === 'access' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#FEE2E2', color: 'var(--red)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Access control</h2>
                  <p className={styles.sectionDesc}>Control who can create an account on this platform.</p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Registration mode</label>
                <select className={styles.input} value={settings.registrationMode || 'open'} onChange={(e) => update('registrationMode', e.target.value)} style={{ width: 280 }}>
                  <option value="open">Open — anyone can sign in</option>
                  <option value="approval">Approval required — admin must approve new users</option>
                  <option value="invite">Invite only — users need an invite link</option>
                </select>
                <p className={styles.fieldHint}>
                  {(settings.registrationMode || 'open') === 'open' && 'Any LinkedIn user can sign in and start using the platform immediately.'}
                  {settings.registrationMode === 'approval' && 'New users see a "Pending approval" page after sign-in. You approve or reject them from the admin dashboard.'}
                  {settings.registrationMode === 'invite' && 'Users can only sign in via an invite link you generate from the admin dashboard.'}
                </p>
              </div>

              <div className={styles.field} style={{ marginTop: 20 }}>
                <label className={styles.fieldLabel}>Allowed email domains</label>
                <input className={styles.input} value={settings.allowedEmailDomains || ''} onChange={(e) => update('allowedEmailDomains', e.target.value)} placeholder="company.com, agency.io" />
                <p className={styles.fieldHint}>Comma-separated list of email domains. Only LinkedIn accounts with these email domains can sign up. Leave empty to allow all domains.</p>
              </div>

              {settings.registrationMode === 'invite' && (
                <div className={styles.warningBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Invite-only mode is active. Users cannot sign up without an invite link from the admin dashboard.
                </div>
              )}
              {settings.registrationMode === 'approval' && (
                <div className={styles.warningBox} style={{ background: '#DBEAFE', borderColor: '#3B82F6', color: '#1E40AF' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Approval mode is active. New users will see a "Pending" page until you approve them in the admin dashboard.
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Security</h3>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Session timeout (days)</label>
                  <input className={styles.inputSmall} type="number" value={settings.sessionTimeoutDays || 60} onChange={(e) => update('sessionTimeoutDays', parseInt(e.target.value) || 60)} min="1" max="365" />
                  <p className={styles.fieldHint}>How long a user stays signed in before they need to log in again. Default is 60 days.</p>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>IP blacklist</label>
                  <input className={styles.input} value={settings.ipBlacklist || ''} onChange={(e) => update('ipBlacklist', e.target.value)} placeholder="1.2.3.4, 5.6.7.8" />
                  <p className={styles.fieldHint}>Comma-separated IP addresses. These IPs will be blocked from accessing the API. Leave empty to allow all.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BRANDING TAB ═══ */}
        {tab === 'branding' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#F3E8FF', color: '#7C3AED' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Branding & appearance</h2>
                  <p className={styles.sectionDesc}>Customize the look of your platform.</p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Logo URL</label>
                <input className={styles.input} value={settings.logoUrl || ''} onChange={(e) => update('logoUrl', e.target.value)} placeholder="https://example.com/logo.png" />
                <p className={styles.fieldHint}>Direct URL to your logo image. Appears in the sidebar and mobile header.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Brand color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="color" value={settings.brandColor || '#18392B'} onChange={(e) => update('brandColor', e.target.value)} style={{ width: 44, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                  <input className={styles.input} value={settings.brandColor || '#18392B'} onChange={(e) => update('brandColor', e.target.value)} placeholder="#18392B" style={{ width: 140 }} />
                </div>
                <p className={styles.fieldHint}>Primary button and accent color used across the platform.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Favicon URL</label>
                <input className={styles.input} value={settings.faviconUrl || ''} onChange={(e) => update('faviconUrl', e.target.value)} placeholder="https://example.com/favicon.ico" />
                <p className={styles.fieldHint}>Browser tab icon. Use a .ico, .png, or .svg file.</p>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Announcement banner</h3>
                <p className={styles.fieldHint} style={{ marginBottom: 16 }}>Show a dismissable banner to all logged-in users. Useful for updates, downtime notices, or feature announcements.</p>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleInfo}>
                    <div className={styles.toggleTitle}>Show announcement</div>
                    <div className={styles.toggleDesc}>Banner appears at the top of every page.</div>
                  </div>
                  <button type="button" className={`${styles.toggle} ${settings.announcementEnabled ? styles.on : ''}`} onClick={() => update('announcementEnabled', !settings.announcementEnabled)} />
                </div>

                {settings.announcementEnabled && (
                  <>
                    <div className={styles.field} style={{ marginTop: 12 }}>
                      <label className={styles.fieldLabel}>Banner message</label>
                      <input className={styles.input} value={settings.announcementText || ''} onChange={(e) => update('announcementText', e.target.value)} placeholder="We just launched a new feature! Check it out." />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Banner type</label>
                      <select className={styles.input} value={settings.announcementType || 'info'} onChange={(e) => update('announcementType', e.target.value)} style={{ width: 200 }}>
                        <option value="info">Info (green)</option>
                        <option value="warning">Warning (yellow)</option>
                        <option value="success">Success (green)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATA TAB ═══ */}
        {tab === 'data' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Data management</h2>
                  <p className={styles.sectionDesc}>Auto-cleanup rules and data backup.</p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Auto-delete failed posts after (days)</label>
                <input className={styles.inputSmall} type="number" value={settings.autoDeleteFailedDays || 0} onChange={(e) => update('autoDeleteFailedDays', parseInt(e.target.value) || 0)} min="0" />
                <p className={styles.fieldHint}>Set to 0 to keep failed posts forever. Otherwise, failed posts older than this many days are automatically removed.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Auto-delete published posts after (days)</label>
                <input className={styles.inputSmall} type="number" value={settings.autoDeletePublishedDays || 0} onChange={(e) => update('autoDeletePublishedDays', parseInt(e.target.value) || 0)} min="0" />
                <p className={styles.fieldHint}>Set to 0 to keep published posts forever. Useful for keeping the database small on long-running instances.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Activity log retention (days)</label>
                <input className={styles.inputSmall} type="number" value={settings.dataRetentionActivityDays || 90} onChange={(e) => update('dataRetentionActivityDays', parseInt(e.target.value) || 90)} min="7" />
                <p className={styles.fieldHint}>User activity records older than this are automatically deleted. Minimum 7 days.</p>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Backup</h3>
                <p className={styles.fieldHint} style={{ marginBottom: 16 }}>Download a full JSON backup of all platform data (accounts, posts, templates, activity logs). Does not include LinkedIn access tokens.</p>
                <a href="/api/admin/export" className="btn btn-outline btn-sm" download>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download backup (JSON)
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BILLING TAB ═══ */}
        {tab === 'billing' && (
          <div className={styles.section}>
            <div className={`card ${styles.sectionCard}`}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIconWrap} style={{ background: '#E0F2FE', color: '#0369A1' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div>
                  <h2 className={styles.sectionTitle}>Billing & subscription</h2>
                  <p className={styles.sectionDesc}>Choose how users are charged. Set to "Free" for no limits and no payments.</p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Billing mode</label>
                <select className={styles.input} value={settings.billing?.mode || 'free'} onChange={(e) => update('billing', { ...settings.billing, mode: e.target.value })} style={{ width: 320 }}>
                  <option value="free">Free — no limits, no payments</option>
                  <option value="free_pro">Free + Pro — free tier with limits, Pro unlocks everything</option>
                  <option value="three_tier">Three tiers — Free / Pro / Business</option>
                  <option value="usage">Usage-based — pay per post after free quota</option>
                  <option value="flat">Flat subscription — everyone pays the same monthly amount</option>
                </select>
                <p className={styles.fieldHint}>
                  {(settings.billing?.mode || 'free') === 'free' && 'Everyone gets full access. No payments, no limits. This is the default.'}
                  {settings.billing?.mode === 'free_pro' && 'Create a Free plan (with limits) and a Pro plan (unlimited). Manage plans below.'}
                  {settings.billing?.mode === 'three_tier' && 'Create Free, Pro, and Business plans with graduated limits. Manage plans below.'}
                  {settings.billing?.mode === 'usage' && 'Users get a free monthly quota. Additional posts are charged individually.'}
                  {settings.billing?.mode === 'flat' && 'All users pay the same monthly amount for full access.'}
                </p>
              </div>

              {/* Usage-based settings */}
              {settings.billing?.mode === 'usage' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Free posts per month</label>
                    <input className={styles.inputSmall} type="number" value={settings.billing?.freePostsPerMonth || 10} onChange={(e) => update('billing', { ...settings.billing, freePostsPerMonth: parseInt(e.target.value) || 10 })} min="0" />
                    <p className={styles.fieldHint}>Number of posts each user can publish for free per month.</p>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Price per additional post (paise)</label>
                    <input className={styles.inputSmall} type="number" value={settings.billing?.pricePerPost || 0} onChange={(e) => update('billing', { ...settings.billing, pricePerPost: parseInt(e.target.value) || 0 })} min="0" />
                    <p className={styles.fieldHint}>In paise. 1000 = ₹10 per post.</p>
                  </div>
                </div>
              )}

              {/* Flat subscription settings */}
              {settings.billing?.mode === 'flat' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Monthly price (paise)</label>
                    <input className={styles.inputSmall} type="number" value={settings.billing?.flatPrice || 0} onChange={(e) => update('billing', { ...settings.billing, flatPrice: parseInt(e.target.value) || 0 })} min="0" />
                    <p className={styles.fieldHint}>In paise. 49900 = ₹499/month.</p>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Price label</label>
                    <input className={styles.input} value={settings.billing?.flatPriceLabel || ''} onChange={(e) => update('billing', { ...settings.billing, flatPriceLabel: e.target.value })} placeholder="₹499/month" style={{ width: 200 }} />
                  </div>
                </div>
              )}

              {/* Trial */}
              {settings.billing?.mode !== 'free' && (
                <div className={styles.field} style={{ marginTop: 16 }}>
                  <label className={styles.fieldLabel}>Trial period (days)</label>
                  <input className={styles.inputSmall} type="number" value={settings.billing?.trialDays || 0} onChange={(e) => update('billing', { ...settings.billing, trialDays: parseInt(e.target.value) || 0 })} min="0" />
                  <p className={styles.fieldHint}>New users get full access during trial. Set to 0 for no trial.</p>
                </div>
              )}

              {/* Plan management note */}
              {['free_pro', 'three_tier'].includes(settings.billing?.mode) && (
                <div className={styles.warningBox} style={{ background: '#DBEAFE', borderColor: '#3B82F6', color: '#1E40AF', marginTop: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Save these settings first, then manage individual plans (names, prices, limits) from the Plans section below.
                </div>
              )}

              {/* Cashfree configuration */}
              {settings.billing?.mode !== 'free' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cashfree Payments</h3>
                  <p className={styles.fieldHint} style={{ marginBottom: 16 }}>Connect Cashfree to accept UPI, cards, and net banking. Leave empty to run without payments (admin manually assigns plans).</p>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Environment</label>
                    <select className={styles.input} value={settings.billing?.cashfreeEnvironment || 'sandbox'} onChange={(e) => update('billing', { ...settings.billing, cashfreeEnvironment: e.target.value })} style={{ width: 180 }}>
                      <option value="sandbox">Sandbox (testing)</option>
                      <option value="production">Production (live)</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>App ID</label>
                    <input className={styles.input} value={settings.billing?.cashfreeAppId || ''} onChange={(e) => update('billing', { ...settings.billing, cashfreeAppId: e.target.value })} placeholder="Enter Cashfree App ID" />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Secret Key</label>
                    <input className={styles.inputMono} value={settings.billing?.cashfreeSecretKey ?? ''} onChange={(e) => update('billing', { ...settings.billing, cashfreeSecretKey: e.target.value })} placeholder={settings.billing?.cashfreeSecretKeyMasked || 'Enter Cashfree Secret Key'} autoComplete="off" />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Webhook Secret</label>
                    <input className={styles.inputMono} value={settings.billing?.cashfreeWebhookSecret ?? ''} onChange={(e) => update('billing', { ...settings.billing, cashfreeWebhookSecret: e.target.value })} placeholder="Cashfree webhook secret" autoComplete="off" />
                    <p className={styles.fieldHint}>Set the webhook URL in Cashfree dashboard to: <code style={{ background: 'var(--hover)', padding: '1px 4px', borderRadius: 3, fontSize: 12 }}>{settings.platformUrl || 'https://your-domain.com'}/api/webhooks/cashfree</code></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STICKY SAVE BAR ═══ */}
        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          {msg.text && <span className={msg.type === 'success' ? styles.msgSuccess : styles.msgError}>{msg.text}</span>}
        </div>
      </div>
    </main>
  );
}
