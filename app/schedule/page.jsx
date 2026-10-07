'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import TemplatePicker from '@/components/TemplatePicker';
import PostPreview from '@/components/PostPreview';
import AIToolbar from '@/components/AIToolbar';
import styles from './page.module.css';

export default function SchedulePost() {
  const router = useRouter();
  const addToast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ accountId: '', commentary: '', scheduledAt: '' });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [bestTimes, setBestTimes] = useState([]);

  useEffect(() => {
    fetch('/api/auth/accounts')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Unable to load accounts');
        return data;
      })
      .then((data) => { setAccounts(data); setAccountsLoaded(true); })
      .catch((err) => { addToast('error', err.message); setAccountsLoaded(true); });
    fetch('/api/analytics/best-times')
      .then((r) => r.json())
      .then((data) => { if (data.slots?.length) setBestTimes(data.slots); })
      .catch(() => {});
  }, [addToast]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (preview) URL.revokeObjectURL(preview);
    setImage(file || null);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e, isDraft = false) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('accountId', form.accountId);
    data.append('commentary', form.commentary);
    if (isDraft) {
      data.append('isDraft', 'true');
    } else {
      data.append('scheduledAt', new Date(form.scheduledAt).toISOString());
    }
    if (image) data.append('image', image);

    try {
      const res = await fetch('/api/posts', { method: 'POST', body: data });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Something went wrong.');

      addToast('success', isDraft ? 'Post saved as draft!' : 'Post scheduled successfully!');
      setForm({ accountId: '', commentary: '', scheduledAt: '' });
      setImage(null);
      setPreview(null);
    } catch (err) {
      addToast('error', err.message);
    }
    setLoading(false);
  };

  const charPct = Math.min((form.commentary.length / 3000) * 100, 100);
  const selectedAccount = accounts.find((a) => a._id === form.accountId) || null;

  return (
    <div>
      <div className="page-header">
        <h1>Create Post</h1>
        <p>Write your content, optionally attach an image, and schedule it.</p>
      </div>

      {accountsLoaded && accounts.length === 0 && (
        <div className="alert alert-error">
          No LinkedIn account connected.{' '}
          <a href="/accounts" style={{ textDecoration: 'underline', fontWeight: 600 }}>Connect one →</a>
        </div>
      )}

      <div className={styles.splitLayout}>
        <div className="card">
          <form onSubmit={(e) => handleSubmit(e, false)}>
            <div className="form-group">
              <label>LinkedIn Account</label>
              <select
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                required
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.displayName || a.authorUrn}{a.accountType === 'organization' ? ' (Org)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div className={styles.labelRow}>
                <label>Post Content</label>
                <TemplatePicker onSelect={(content) => setForm({ ...form, commentary: content })} />
              </div>
              <textarea
                placeholder="What do you want to share?"
                value={form.commentary}
                onChange={(e) => setForm({ ...form, commentary: e.target.value })}
                required
                maxLength={3000}
                rows={6}
              />
              <div className={styles.charCounter}>
                <div className={styles.charBar}>
                  <div
                    className={styles.charFill}
                    style={{
                      width: `${charPct}%`,
                      background: charPct > 90 ? 'var(--red)' : charPct > 70 ? 'var(--orange)' : 'var(--blue)',
                    }}
                  />
                </div>
                <span className={styles.charText}>{form.commentary.length} / 3000</span>
              </div>
              <AIToolbar
                text={form.commentary}
                onResult={(result, error, hooks) => {
                  if (error) { addToast('error', error); return; }
                  if (hooks) {
                    // Show hooks as info toast — user can copy what they like
                    addToast('info', 'Hook suggestions:\n' + hooks);
                    return;
                  }
                  if (result) setForm((prev) => ({ ...prev, commentary: result }));
                }}
                onHashtags={(tags) => {
                  setForm((prev) => ({ ...prev, commentary: prev.commentary.trim() + '\n\n' + tags }));
                }}
              />
            </div>

            <div className="form-group">
              <label>Schedule Date &amp; Time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                min={(() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })()}
              />
              {bestTimes.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '24px' }}>Best times:</span>
                  {bestTimes.slice(0, 3).map((slot) => (
                    <span key={slot.label} style={{ fontSize: 12, background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {slot.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Image (optional)</label>
              <div className={styles.dropZone}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  className={styles.fileInput}
                />
                {preview ? (
                  <div className={styles.preview}>
                    <img src={preview} alt="Preview" />
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={(e) => { e.stopPropagation(); setImage(null); setPreview(null); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropLabel}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Click or drag to upload</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || accounts.length === 0 || !form.scheduledAt}
              >
                {loading ? 'Scheduling…' : 'Schedule Post'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={loading || accounts.length === 0}
                onClick={(e) => handleSubmit(e, true)}
              >
                Save as Draft
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => router.push('/posts')}>
                View All Posts
              </button>
            </div>
          </form>
        </div>

        {/* Live preview panel */}
        <div className={styles.previewPanel}>
          <h3 className={styles.previewTitle}>Live Preview</h3>
          <PostPreview
            commentary={form.commentary}
            imagePreview={preview}
            account={selectedAccount}
          />
        </div>
      </div>
    </div>
  );
}
