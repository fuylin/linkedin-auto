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
  const [newRows, setNewRows] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
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

  // ── Multi-row add ──
  const emptyRow = () => ({ id: Date.now() + Math.random(), accountId: '', commentary: '', scheduledAt: '', imageUrl: '' });

  const addNewRow = () => setNewRows((prev) => [...prev, emptyRow()]);

  const updateNewRow = (id, key, value) => {
    setNewRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r));
  };

  const removeNewRow = (id) => {
    setNewRows((prev) => prev.filter((r) => r.id !== id));
  };

  const saveOneRow = async (row) => {
    if (!row.accountId || !row.commentary.trim()) { addToast('error', 'Account and text are required'); return false; }
    const data = new FormData();
    data.append('accountId', row.accountId);
    data.append('commentary', row.commentary);
    if (row.scheduledAt) data.append('scheduledAt', new Date(row.scheduledAt).toISOString());
    else data.append('isDraft', 'true');
    if (row.imageUrl.trim()) data.append('imageUrl', row.imageUrl.trim());
    const res = await fetch('/api/posts', { method: 'POST', body: data });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    return true;
  };

  const saveAllRows = async () => {
    const valid = newRows.filter((r) => r.commentary.trim() && r.accountId);
    if (valid.length === 0) { addToast('error', 'No rows to save — add text and select an account'); return; }
    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        await saveOneRow(row);
        saved++;
        removeNewRow(row.id);
      } catch (err) {
        failed++;
        addToast('error', `Row failed: ${err.message}`);
      }
    }
    if (saved > 0) {
      addToast('success', `${saved} post${saved !== 1 ? 's' : ''} saved.${failed > 0 ? ` ${failed} failed.` : ''}`);
      fetchAll();
    }
    setSaving(false);
  };

  const saveSingleRow = async (row) => {
    setSaving(true);
    try {
      await saveOneRow(row);
      addToast('success', row.scheduledAt ? 'Post scheduled!' : 'Draft saved!');
      removeNewRow(row.id);
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
    // Add template content as a new row
    setNewRows((prev) => [...prev, { ...emptyRow(), commentary: tpl.content }]);
    setShowTemplatePicker(false);
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
          <button className="btn btn-primary btn-sm" onClick={addNewRow}>+ Add Row</button>
          {newRows.length > 0 && (
            <>
              <button className="btn btn-outline btn-sm" onClick={saveAllRows} disabled={saving} style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>
                {saving ? 'Saving...' : `Save all (${newRows.filter(r => r.commentary.trim() && r.accountId).length})`}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setNewRows([])} style={{ fontSize: 12 }}>Clear all</button>
            </>
          )}
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
                {/* New rows inline */}
                {newRows.map((row) => (
                  <tr key={row.id} className={styles.addRow}>
                    <td className={styles.rowNum}>+</td>
                    <td><span className="badge badge-draft">NEW</span></td>
                    <td>
                      <textarea value={row.commentary} onChange={(e) => updateNewRow(row.id, 'commentary', e.target.value)} placeholder="Write your post content..." maxLength={5000} rows={3} />
                      <div className={styles.charCount}>{row.commentary.length}/5000</div>
                    </td>
                    <td>
                      <input className={styles.imageInput} value={row.imageUrl} onChange={(e) => updateNewRow(row.id, 'imageUrl', e.target.value)} placeholder="https://..." />
                    </td>
                    <td>
                      <select value={row.accountId} onChange={(e) => updateNewRow(row.id, 'accountId', e.target.value)}>
                        <option value="">Select...</option>
                        {accounts.map((a) => <option key={a._id} value={a._id}>{a.displayName || a.authorUrn}</option>)}
                      </select>
                    </td>
                    <td><input type="datetime-local" value={row.scheduledAt} onChange={(e) => updateNewRow(row.id, 'scheduledAt', e.target.value)} min={toLocalDatetimeValue(new Date())} /></td>
                    <td className={styles.cellMuted}>—</td>
                    <td className={styles.cellMuted}>—</td>
                    <td>
                      <div className={styles.cellActions}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveSingleRow(row)} disabled={saving || !row.commentary.trim() || !row.accountId} style={{ fontSize: 12 }}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeNewRow(row.id)} style={{ color: 'var(--red)', fontSize: 14, padding: '2px 6px' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}

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
                            <textarea value={editData.commentary} onChange={(e) => setEditData({ ...editData, commentary: e.target.value })} maxLength={5000} rows={3} className={styles.editInput} />
                            <div className={styles.charCount}>{editData.commentary.length}/5000</div>
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

                {posts.length === 0 && newRows.length === 0 && (
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
