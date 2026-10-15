'use client';
import { useState } from 'react';
import Modal from './Modal';

// Format a Date as YYYY-MM-DDTHH:mm in the browser's local timezone
function toLocalDatetimeValue(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditPostModal({ post, open, onClose, onSaved }) {
  const [commentary, setCommentary] = useState(post?.commentary || '');
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDatetimeValue(post?.scheduledAt)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const charPct = Math.min((commentary.length / 5000) * 100, 100);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = { commentary };
      // Send scheduledAt: null when cleared (reverts PENDING -> DRAFT)
      // Send the ISO string when a date is set
      body.scheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const res = await fetch(`/api/posts/${post._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  if (!post) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Post"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !commentary.trim()}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-group">
        <label>Post Content</label>
        <textarea
          value={commentary}
          onChange={(e) => setCommentary(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="What do you want to share?"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <div style={{ flex: 1, height: 3, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              width: `${charPct}%`,
              background: charPct > 90 ? 'var(--red)' : charPct > 70 ? 'var(--orange)' : 'var(--blue)',
              transition: 'width 0.15s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {commentary.length} / 5000
          </span>
        </div>
      </div>

      <div className="form-group">
        <label>Schedule Date & Time</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          min={toLocalDatetimeValue(new Date())}
        />
        {post.status === 'DRAFT' && !scheduledAt && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Set a date to move this draft to Pending.
          </span>
        )}
        {post.status === 'PENDING' && scheduledAt && (
          <button type="button" onClick={() => setScheduledAt('')} style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Clear schedule (revert to Draft)
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`badge badge-${post.status.toLowerCase()}`}>{post.status}</span>
        {post.status === 'DRAFT' && scheduledAt && (
          <span style={{ fontSize: 12, color: 'var(--green)' }}>→ Will become PENDING</span>
        )}
      </div>
    </Modal>
  );
}
