'use client';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locModal, setLocModal] = useState(null); // { name, users } or null
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [usersRes, pendingRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/pending'),
      ]);
      if (usersRes.status === 401) { router.replace('/admin'); return; }
      const [usersJson, pendingJson] = await Promise.all([usersRes.json(), pendingRes.json()]);
      if (usersJson.success) setData(usersJson);
      if (pendingJson.success) setPendingUsers(pendingJson.users || []);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  async function approveUser(ownerId) {
    const res = await fetch('/api/admin/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId }) });
    const json = await res.json();
    flash(json.success ? 'User approved!' : json.error);
    fetchAll();
  }

  async function rejectUser(ownerId) {
    const reason = prompt('Rejection reason (optional):');
    const res = await fetch('/api/admin/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerId, reason }) });
    const json = await res.json();
    flash(json.success ? 'User rejected.' : json.error);
    fetchAll();
  }

  async function sendInvite() {
    if (!inviteEmail.includes('@')) return;
    const res = await fetch('/api/admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail }) });
    const json = await res.json();
    flash(json.success ? `Invite sent to ${inviteEmail}` : json.error);
    setInviteEmail('');
  }

  function flash(msg) { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); }
  function fmt(d) { if (!d) return '--'; return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }); }
  async function handleLogout() { await fetch('/api/admin/logout', { method: 'POST' }); router.replace('/admin'); }

  if (loading) return <div className={styles.loadingPage}><div className={styles.spinner} /></div>;
  if (error) return <main className={styles.page}><div className={styles.container}><div className="alert alert-error">{error}</div></div></main>;

  const { users = [], platformStats: ps = {}, topEngager, locations = [] } = data || {};
  const maxLoc = locations[0]?.count || 1;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.lockBadge}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <h1 className={styles.headerTitle}>Admin Dashboard</h1>
              <p className={styles.headerSub}>{users.length} user{users.length !== 1 ? 's' : ''} · {ps.totalPosts || 0} posts · {ps.totalPublished || 0} published</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <a href="/api/admin/export" className="btn btn-ghost btn-sm" download>Export</a>
            <a href="/admin/security" className="btn btn-ghost btn-sm">Security</a>
            <a href="/admin/settings" className="btn btn-ghost btn-sm">Settings</a>
            <button className="btn btn-ghost btn-sm" onClick={fetchAll}>Refresh</button>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {/* KPI cards */}
        <div className={styles.kpiGrid}>
          {[
            { label: 'Users', value: ps.totalUsers || 0, color: '#18392B', bg: '#E8F0EB' },
            { label: 'Total Posts', value: ps.totalPosts || 0, color: '#0369A1', bg: '#E0F2FE' },
            { label: 'Published', value: ps.totalPublished || 0, color: '#2F6B4F', bg: '#D1FAE5' },
            { label: 'Pending', value: ps.totalPending || 0, color: '#92400E', bg: '#FEF3C7' },
            { label: 'Failed', value: ps.totalFailed || 0, color: '#C94A4A', bg: '#FEE2E2' },
            { label: 'Logins', value: ps.totalLogins || 0, color: '#6B21A8', bg: '#F3E8FF' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${styles.glass} ${styles.kpiCard}`}>
              <div className={styles.kpiIcon} style={{ background: bg, color }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  {label === 'Users' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}
                  {label === 'Total Posts' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>}
                  {label === 'Published' && <polyline points="22 4 12 14.01 9 11.01"/>}
                  {label === 'Pending' && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                  {label === 'Failed' && <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></>}
                  {label === 'Logins' && <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/></>}
                </svg>
              </div>
              <div className={styles.kpiValue}>{value}</div>
              <div className={styles.kpiLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Top engager + Action message */}
        {actionMsg && <div style={{ padding: '10px 16px', background: '#D1FAE5', color: '#065F46', borderRadius: 12, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>{actionMsg}</div>}

        {topEngager && (
          <div className={`${styles.glass} ${styles.topEngager}`}>
            {topEngager.profilePictureUrl ? (
              <img src={topEngager.profilePictureUrl} alt="" className={styles.topEngagerAvatar} />
            ) : (
              <div className={styles.topEngagerPlaceholder}>{(topEngager.displayName || '?')[0]}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Top Engager: {topEngager.displayName}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{topEngager.totalEngagement} interactions · {topEngager.publishedCount} posts</div>
            </div>
            <a href={`/admin/users/${topEngager.ownerId}`} className="btn btn-ghost btn-sm">View</a>
          </div>
        )}

        {/* Sections: Locations + Pending */}
        <div className={styles.sectionsRow}>
          {/* Location distribution */}
          <div className={`${styles.glass} ${styles.sectionCard}`}>
            <h3 className={styles.sectionTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Users by location
            </h3>
            {locations.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No location data yet. Users need to log in at least once.</p>
            ) : (
              <div className={styles.locationList}>
                {locations.map((loc, i) => (
                  <div key={i} className={styles.locationItem} onClick={() => setLocModal(loc)} style={{ cursor: 'pointer' }}>
                    <span className={styles.locationName}>{loc.name}</span>
                    <div className={styles.locationBar}>
                      <div className={styles.locationFill} style={{ width: `${(loc.count / maxLoc) * 100}%` }} />
                    </div>
                    <span className={styles.locationCount}>{loc.count} user{loc.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending approvals */}
          <div className={`${styles.glass} ${styles.sectionCard}`}>
            <h3 className={styles.sectionTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Pending approvals
              {pendingUsers.length > 0 && <span className={styles.pendingBadge}>{pendingUsers.length}</span>}
            </h3>
            {pendingUsers.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No pending users.</p>
            ) : (
              pendingUsers.map((u) => (
                <div key={u.ownerId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{u.email || '--'}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => approveUser(u.ownerId)} style={{ fontSize: 12 }}>Approve</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => rejectUser(u.ownerId)} style={{ fontSize: 12, color: 'var(--red)' }}>Reject</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invite bar */}
        <div className={`${styles.glass} ${styles.inviteBar}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          <input className={styles.inviteInput} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite user by email..." onKeyDown={(e) => e.key === 'Enter' && sendInvite()} />
          <button className="btn btn-primary btn-sm" onClick={sendInvite} disabled={!inviteEmail.includes('@')}>Send invite</button>
        </div>

        {/* Users table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>All users ({users.length})</h3>
          <a href="/api/admin/export-users" className="btn btn-outline btn-sm" download>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </a>
        </div>
        <div className={`${styles.glass} ${styles.tableWrap}`}>
          {users.length === 0 ? (
            <div className={styles.emptyState}><p>No users yet</p></div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th className={styles.numCell}>Posts</th>
                  <th className={styles.numCell}>Published</th>
                  <th className={styles.numCell}>Logins</th>
                  <th>Last Active</th>
                  <th>Token</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const tokenDays = user.tokenExpiresAt ? Math.floor((new Date(user.tokenExpiresAt) - new Date()) / 86400000) : null;
                  const tokenStatus = tokenDays === null ? '--' : tokenDays < 0 ? 'Expired' : `${tokenDays}d`;
                  const tokenColor = tokenDays === null ? '' : tokenDays < 0 ? 'var(--red)' : tokenDays < 7 ? 'var(--orange)' : 'var(--green)';
                  const location = [user.lastCity, user.lastCountry].filter(Boolean).join(', ') || '--';

                  return (
                    <tr key={user.ownerId} onClick={() => router.push(`/admin/users/${user.ownerId}`)} className={styles.clickableRow}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {user.profilePictureUrl ? (
                            <img src={user.profilePictureUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--blue-light)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                              {(user.displayName || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className={styles.userName}>{user.displayName}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'monospace' }}>{user.authorUrn}</div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.userEmail}>{user.email}</td>
                      <td style={{ fontSize: 13 }}>{location}</td>
                      <td className={styles.numCell}>{user.total}</td>
                      <td className={styles.numCell}>{user.published}</td>
                      <td className={styles.numCell}>{user.loginCount || 0}</td>
                      <td className={styles.dateCell}>{fmt(user.lastActive)}</td>
                      <td style={{ fontWeight: 600, color: tokenColor, fontSize: 13 }}>{tokenStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Location users modal */}
      {locModal && (
        <div onClick={() => setLocModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Users in {locModal.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{locModal.count} user{locModal.count !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setLocModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}>✕</button>
            </div>
            {locModal.users?.map((u, i) => (
              <div key={i} onClick={() => { setLocModal(null); router.push(`/admin/users/${u.ownerId}`); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                {u.profilePictureUrl ? (
                  <img src={u.profilePictureUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-light)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{(u.displayName || '?')[0]}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
