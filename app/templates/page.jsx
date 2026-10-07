'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', content: '', category: 'General' });
  const [saving, setSaving] = useState(false);
  const addToast = useToast();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates(data);
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetForm = () => {
    setForm({ name: '', content: '', category: 'General' });
    setShowForm(false);
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editId ? `/api/templates/${editId}` : '/api/templates';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast('success', editId ? 'Template updated!' : 'Template created!');
      resetForm();
      fetchTemplates();
    } catch (err) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t) => {
    setForm({ name: t.name, content: t.content, category: t.category });
    setEditId(t._id);
    setShowForm(true);
  };

  const remove = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to delete');
      addToast('success', 'Template deleted.');
      fetchTemplates();
    } catch (err) {
      addToast('error', err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Post Templates</h1>
        <p>Create reusable templates to speed up your content workflow.</p>
      </div>

      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>
          + New Template
        </button>
      )}

      {showForm && (
        <div className={`card ${styles.formCard}`}>
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
            {editId ? 'Edit Template' : 'New Template'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Weekly Update"
                required
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="General"
              />
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Your template text..."
                required
                maxLength={3000}
                rows={6}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', marginTop: 20 }}>Loading…</p>
      ) : templates.length === 0 && !showForm ? (
        <div className="card">
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            }
            title="No templates yet"
            description="Create a template to quickly fill in post content."
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Template</button>}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {templates.map((t) => (
            <div key={t._id} className={`card card-hover ${styles.templateCard}`}>
              <div className={styles.cardTop}>
                <h3 className={styles.name}>{t.name}</h3>
                <span className={styles.category}>{t.category}</span>
              </div>
              <p className={styles.content}>{t.content}</p>
              <div className={styles.cardBottom}>
                <span className={styles.usage}>Used {t.usageCount || 0}x</span>
                <div className={styles.cardActions}>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => remove(t._id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
