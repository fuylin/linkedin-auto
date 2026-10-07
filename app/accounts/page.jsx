'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import EmptyState from '@/components/EmptyState';
import LocalTime from '@/components/LocalTime';
import styles from './page.module.css';

const AI_PROVIDERS = [
  { id: 'none', label: 'None' },
  { id: 'claude', label: 'Claude (Anthropic)', placeholder: 'sk-ant-...', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'] },
  { id: 'openai', label: 'ChatGPT (OpenAI)', placeholder: 'sk-...', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'gemini', label: 'Gemini (Google)', placeholder: 'AIza...', models: ['gemini-pro', 'gemini-1.5-flash'] },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ai, setAi] = useState({ provider: 'none', model: '', apiKey: '', configured: false, keyMasked: null });
  const [aiSaving, setAiSaving] = useState(false);
  const searchParams = useSearchParams();
  const addToast = useToast();

  useEffect(() => {
    fetch('/api/auth/accounts')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setAccounts(data);
      })
      .catch((err) => addToast('error', err.message))
      .finally(() => setLoading(false));

    if (searchParams.get('connected')) addToast('success', 'LinkedIn account connected!');
    if (searchParams.get('error')) addToast('error', 'Failed to connect LinkedIn.');
    fetch('/api/ai').then((r) => r.json()).then((d) => setAi({ ...d, apiKey: '' })).catch(() => {});
  }, []);

  const getTokenStatus = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: 'Expired', cls: styles.expired };
    if (days < 7) return { label: `${days}d left`, cls: styles.expiring };
    return { label: `${days}d left`, cls: styles.healthy };
  };

  return (
    <div>
      <div className="page-header">
        <h1>Accounts</h1>
        <p>Your LinkedIn account is connected automatically when you sign in.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <a href="/api/auth/signin" className="btn btn-outline">
          Reconnect LinkedIn (refresh token)
        </a>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            }
            title="No account found"
            description="Sign in again to reconnect your LinkedIn account."
            action={<a href="/api/auth/signin" className="btn btn-primary">Sign in with LinkedIn</a>}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {accounts.map((acc) => {
            const token = getTokenStatus(acc.tokenExpiresAt);
            return (
              <div key={acc._id} className={`card ${styles.accountCard}`}>
                <div className={styles.header}>
                  <div className={styles.avatar}>
                    {acc.profilePictureUrl ? (
                      <img src={acc.profilePictureUrl} alt="" />
                    ) : (
                      <span>{(acc.displayName || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <h3>{acc.displayName || 'LinkedIn User'}</h3>
                    {acc.email && <p className={styles.email}>{acc.email}</p>}
                    <p className={styles.urn}>{acc.authorUrn}</p>
                  </div>
                </div>

                <div className={styles.meta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Token Status</span>
                    <span className={`${styles.tokenBadge} ${token.cls}`}>{token.label}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Connected</span>
                    <LocalTime date={acc.createdAt} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Integration */}
      <div className={styles.guide}>
        <h2 className={styles.guideTitle}>AI content assistant</h2>
        <p className={styles.guideSub}>Connect your AI API key to generate and improve post content directly in the editor.</p>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>AI Provider</label>
              <select value={ai.provider} onChange={(e) => setAi({ ...ai, provider: e.target.value, model: '', apiKey: '' })} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, width: 280, fontFamily: 'var(--sans)' }}>
                {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            {ai.provider !== 'none' && (
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>API Key</label>
                  <input
                    value={ai.apiKey}
                    onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
                    placeholder={ai.keyMasked || AI_PROVIDERS.find((p) => p.id === ai.provider)?.placeholder || 'Enter API key'}
                    type="text"
                    autoComplete="off"
                    style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, width: '100%', fontFamily: 'monospace' }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
                    Your key is encrypted and stored securely. It's only used to call the AI API on your behalf.
                    {ai.provider === 'claude' && <> Get yours at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>console.anthropic.com</a></>}
                    {ai.provider === 'openai' && <> Get yours at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>platform.openai.com</a></>}
                    {ai.provider === 'gemini' && <> Get yours at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>aistudio.google.com</a></>}
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>Model</label>
                  <select value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, width: 280, fontFamily: 'var(--sans)' }}>
                    <option value="">Default</option>
                    {AI_PROVIDERS.find((p) => p.id === ai.provider)?.models?.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </>
            )}

            <button
              className="btn btn-primary btn-sm"
              disabled={aiSaving}
              onClick={async () => {
                setAiSaving(true);
                try {
                  const res = await fetch('/api/ai', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model }),
                  });
                  const json = await res.json();
                  if (!json.success) throw new Error(json.error);
                  addToast('success', ai.provider === 'none' ? 'AI disconnected.' : 'AI settings saved!');
                  // Refresh
                  const fresh = await fetch('/api/ai').then((r) => r.json());
                  setAi({ ...fresh, apiKey: '' });
                } catch (err) { addToast('error', err.message); }
                setAiSaving(false);
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              {aiSaving ? 'Saving...' : 'Save AI settings'}
            </button>
          </div>
        </div>
      </div>

      {/* How to configure */}
      <div className={styles.guide}>
        <h2 className={styles.guideTitle}>How it works</h2>
        <p className={styles.guideSub}>A simple guide to scheduling and publishing your LinkedIn posts.</p>

        <div className={styles.steps}>
          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>Sign in with LinkedIn</div>
              <p className={styles.stepDesc}>
                Click <strong>"Continue with LinkedIn"</strong> on the sign-in page. This connects your LinkedIn account and logs you in — one step, done. Your profile name and photo appear on this page once connected.
              </p>
            </div>
          </div>

          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>Create a post</div>
              <p className={styles.stepDesc}>
                Go to <a href="/schedule"><strong>Create Post</strong></a> in the sidebar. Write your content (up to 3,000 characters), optionally attach an image, and pick a date and time. You can also use a saved <a href="/templates"><strong>Post Template</strong></a> to fill in the content quickly. A live preview shows how the post will look on LinkedIn.
              </p>
            </div>
          </div>

          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>Schedule or save as draft</div>
              <p className={styles.stepDesc}>
                Click <strong>"Schedule Post"</strong> to queue it for auto-publishing, or <strong>"Save as Draft"</strong> to come back later. Drafts have no publish date — you can set one when you're ready. You can also bulk-import posts from a <strong>CSV or Excel</strong> file on the <a href="/posts"><strong>All Posts</strong></a> page.
              </p>
            </div>
          </div>

          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>4</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>It publishes automatically</div>
              <p className={styles.stepDesc}>
                A background scheduler checks every ~60 seconds for posts that are due. When the time comes, it publishes your post directly to LinkedIn using your access token. You don't need to be online — close the browser, go to sleep, it handles itself. You'll get an <strong>email notification</strong> when a post publishes or fails.
              </p>
            </div>
          </div>

          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>5</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>Track and manage</div>
              <p className={styles.stepDesc}>
                Use <a href="/posts"><strong>All Posts</strong></a> to see every post and its status. Use the <a href="/sheet"><strong>Post Sheet</strong></a> for a spreadsheet view you can export. Use <a href="/calendar"><strong>Calendar</strong></a> to see your schedule visually — drag posts between days to reschedule. Check <a href="/analytics"><strong>Analytics</strong></a> for engagement data (likes, comments, shares).
              </p>
            </div>
          </div>

          <div className={`card ${styles.step}`}>
            <div className={styles.stepNum}>6</div>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>Keep your token fresh</div>
              <p className={styles.stepDesc}>
                Your LinkedIn access token lasts <strong>60 days</strong>. Check the status above — if it shows <strong style={{color: 'var(--orange)'}}>expiring</strong> or <strong style={{color: 'var(--red)'}}>expired</strong>, click <strong>"Reconnect LinkedIn"</strong> to refresh it. If the token expires, pending posts will fail until you reconnect.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
