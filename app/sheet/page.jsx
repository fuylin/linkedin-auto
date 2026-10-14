'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';
import LocalTime from '@/components/LocalTime';
import ImportModal from '@/components/ImportModal';
import styles from './page.module.css';

function toLocalDatetimeValue(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SheetPage() {
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [newRow, setNewRow] = useState({ accountId: '', commentary: '', scheduledAt: '', imageUrl: '' });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const pickerRef = useRef(null);
  const addToast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, accRes, tplRes] = await Promise.all([
        fetch('/api/posts'), fetch('/api/auth/accounts'), fetch('/api/templates'),
      ]);
      const [postsData, accData, tplData] = await Promise.all([
        postsRes.json(), accRes.json(), tplRes.json(),
      ]);
      if (postsRes.ok) setPosts(postsData);
      if (accRes.ok) setAccounts(accData);
      if (tplRes.ok && Array.isArray(tplData)) setTemplates(tplData);
    } catch { addToast('error', 'Failed to load data'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!showTemplatePicker) return;
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowTemplatePicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplatePicker]);

  // ── Add row ──
  const addPost = async () => {
    if (!newRow.accountId || !newRow.commentary.trim()) return;
    setSaving(true);
    const data = new FormData();
    data.append('accountId', newRow.accountId);
    data.append('commentary', newRow.commentary);
    if (newRow.scheduledAt) data.append('scheduledAt', new Date(newRow.scheduledAt).toISOString());
    else data.append('isDraft', 'true');
    if (newRow.imageUrl.trim()) data.append('imageUrl', newRow.imageUrl.trim());
    try {
      const res = await fetch('/api/posts', { method: 'POST', body: data });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('success', newRow.scheduledAt ? 'Post scheduled!' : 'Draft saved!');
      setNewRow({ accountId: '', commentary: '', scheduledAt: '', imageUrl: '' });
      setShowAdd(false);
      fetchAll();
    } catch (err) { addToast('error', err.message); }
    setSaving(false);
  };

  // ── Inline edit ──
  const startEdit = (post) => {
    setEditId(post._id);
    setEditData({
      commentary: post.commentary,
      scheduledAt: toLocalDatetimeValue(post.scheduledAt),
    });
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const body = { commentary: editData.commentary };
      body.scheduledAt = editData.scheduledAt ? new Date(editData.scheduledAt).toISOString() : null;
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('success', 'Post updated.');
      cancelEdit();
      fetchAll();
    } catch (err) { addToast('error', err.message); }
    setSaving(false);
  };

  // ── Delete ──
  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      addToast('success', 'Deleted.');
      fetchAll();
    } catch (err) { addToast('error', err.message); }
  };

  // ── Publish now ──
  const publishNow = async (id) => {
    if (!confirm('Publish this post to LinkedIn now?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${id}/publish`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('success', 'Published!');
      fetchAll();
    } catch (err) { addToast('error', err.message); }
    setSaving(false);
  };

  // ── Retry ──
  const retryPost = async (id) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${id}/retry`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('success', 'Queued for retry.');
      fetchAll();
    } catch (err) { addToast('error', err.message); }
    setSaving(false);
  };

  // ── Duplicate ──
  const duplicatePost = async (id) => {
    try {
      const res = await fetch(`/api/posts/${id}/duplicate`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('success', 'Duplicated as draft.');
      fetchAll();
    } catch (err) { addToast('error', err.message); }
  };

  // ── Template ──
  const useTemplate = (tpl) => {
    setNewRow((prev) => ({ ...prev, commentary: tpl.content }));
    setShowTemplatePicker(false);
    if (!showAdd) setShowAdd(true);
    fetch(`/api/templates/${tpl._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usageCount: (tpl.usageCount || 0) + 1 }),
    }).catch(() => {});
  };

  const total = posts.length;
  const pending = posts.filter((p) => p.status === 'PENDING').length;
  const published = posts.filter((p) => p.status === 'PUBLISHED').length;
  const failed = posts.filter((p) => p.status === 'FAILED').length;
  const drafts = posts.filter((p) => p.status === 'DRAFT').length;
  const editable = new Set(['DRAFT', 'PENDING']);

  return (
    <div>
      <div className="page-header">
        <h1>Post Sheet</h1>
        <p>Spreadsheet view — add, edit, publish, and export your posts.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? 'Cancel' : '+ Add Row'}
          </button>
          <div className={styles.templatePicker} ref={pickerRef}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowTemplatePicker(!showTemplatePicker)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              From Template
            </button>
            {showTemplatePicker && (
              <div className={styles.templateDropdown}>
                {templates.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No templates yet.</div>
                ) : templates.map((tpl) => (
                  <button key={tpl._id} className={styles.templateItem} onClick={() => useTemplate(tpl)}>
                    <div className={styles.templateItemName}>{tpl.name}</div>
                    <div className={styles.templateItemPreview}>{tpl.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <button className="btn btn-outline btn-sm" onClick={() => setImportOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </button>
          <a href="/api/posts/export" className="btn btn-outline btn-sm" download>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </a>
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>Refresh</button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--ink-faint)' }}>Loading...</p> : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colNum}>#</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colText}>Post Text</th>
                  <th className={styles.colImage}>Image</th>
                  <th className={styles.colAccount}>Account</th>
                  <th className={styles.colScheduled}>Scheduled</th>
                  <th className={styles.colPublished}>Published</th>
                  <th className={styles.colError}>Error</th>
                  <th className={styles.colActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* New row form */}
                {showAdd && (
                  <tr className={styles.addRow}>
                    <td className={styles.rowNum}>+</td>
                    <td><span className="badge badge-draft">NEW</span></td>
                    <td>
                      <textarea value={newRow.commentary} onChange={(e) => setNewRow({ ...newRow, commentary: e.target.value })} placeholder="Write your post content here..." maxLength={3000} rows={3} />
                      <div className={styles.charCount}>{newRow.commentary.length}/3000</div>
                    </td>
                    <td>
                      <textarea className={styles.imageInput} value={newRow.imageUrl} onChange={(e) => setNewRow({ ...newRow, imageUrl: e.target.value })} placeholder="Paste image URL here&#10;e.g. https://example.com/photo.jpg" rows={2} />
                    </td>
                    <td>
                      <select value={newRow.accountId} onChange={(e) => setNewRow({ ...newRow, accountId: e.target.value })} style={{ minWidth: 140 }}>
                        <option value="">Select account...</option>
                        {accounts.map((a) => <option key={a._id} value={a._id}>{a.displayName || a.authorUrn}</option>)}
                      </select>
                    </td>
                    <td><input type="datetime-local" value={newRow.scheduledAt} onChange={(e) => setNewRow({ ...newRow, scheduledAt: e.target.value })} min={toLocalDatetimeValue(new Date())} /></td>
                    <td className={styles.cellMuted}>—</td>
                    <td className={styles.cellMuted}>—</td>
                    <td><button className="btn btn-primary btn-sm" onClick={addPost} disabled={saving || !newRow.commentary.trim() || !newRow.accountId}>{saving ? '...' : 'Save'}</button></td>
                  </tr>
                )}

                {/* Data rows */}
                {posts.map((post, idx) => {
                  const isEditing = editId === post._id;
                  const canEdit = editable.has(post.status);

                  return (
                    <tr key={post._id} className={isEditing ? styles.editingRow : ''}>
                      <td className={styles.rowNum}>{idx + 1}</td>
                      <td><span className={`badge badge-${post.status.toLowerCase()}`}>{post.status}</span></td>
                      <td>
                        {isEditing ? (
                          <>
                            <textarea value={editData.commentary} onChange={(e) => setEditData({ ...editData, commentary: e.target.value })} maxLength={3000} rows={3} className={styles.editInput} />
                            <div className={styles.charCount}>{editData.commentary.length}/3000</div>
                          </>
                        ) : (
                          <div className={styles.cellText}>{post.commentary}</div>
                        )}
                      </td>
                      <td>
                        {post.mediaUrl ? (
                          <div className={styles.imageCell}>
                            <span className={styles.imageBadge}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              Image
                            </span>
                            <span className={styles.imageUrl} title={post.mediaUrl}>{post.mediaUrl.split('/').pop()}</span>
                          </div>
                        ) : <span className={styles.cellMuted}>—</span>}
                      </td>
                      <td className={styles.cellMuted}>{post.account?.displayName || post.account?.authorUrn || '—'}</td>
                      <td>
                        {isEditing ? (
                          <input type="datetime-local" value={editData.scheduledAt} onChange={(e) => setEditData({ ...editData, scheduledAt: e.target.value })} min={toLocalDatetimeValue(new Date())} className={styles.editInput} />
                        ) : (
                          <span className={styles.cellMuted}>{post.scheduledAt ? <LocalTime date={post.scheduledAt} /> : '—'}</span>
                        )}
                      </td>
                      <td className={styles.cellMuted}>{post.publishedAt ? <LocalTime date={post.publishedAt} /> : '—'}</td>
                      <td>{post.errorMessage ? <span className={styles.cellError} title={post.errorMessage}>{post.errorMessage}</span> : <span className={styles.cellMuted}>—</span>}</td>
                      <td>
                        <div className={styles.cellActions}>
                          {isEditing ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => saveEdit(post._id)} disabled={saving} style={{ fontSize: 12 }}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={cancelEdit} style={{ fontSize: 12 }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => startEdit(post)} style={{ fontSize: 12 }}>Edit</button>}
                              {post.status === 'PENDING' && <button className="btn btn-ghost btn-sm" onClick={() => publishNow(post._id)} disabled={saving} style={{ fontSize: 12, color: 'var(--green)' }}>Publish</button>}
                              {(post.status === 'FAILED' || post.status === 'PROCESSING') && <button className="btn btn-ghost btn-sm" onClick={() => retryPost(post._id)} disabled={saving} style={{ fontSize: 12 }}>Retry</button>}
                              <button className="btn btn-ghost btn-sm" onClick={() => duplicatePost(post._id)} style={{ fontSize: 12 }}>Dup</button>
                              {['DRAFT', 'PENDING', 'FAILED'].includes(post.status) && (
                                <button className="btn btn-ghost btn-sm" onClick={() => deletePost(post._id)} style={{ color: 'var(--red)', fontSize: 12 }}>Del</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {posts.length === 0 && !showAdd && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>No posts yet. Click "+ Add Row" or "From Template".</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.stats}>
            <span><strong>{total}</strong> total</span>
            <span><strong>{drafts}</strong> drafts</span>
            <span><strong>{pending}</strong> pending</span>
            <span style={{ color: 'var(--green)' }}><strong>{published}</strong> published</span>
            {failed > 0 && <span style={{ color: 'var(--red)' }}><strong>{failed}</strong> failed</span>}
          </div>
        </>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        onImported={fetchAll}
      />
    </div>
  );
}
