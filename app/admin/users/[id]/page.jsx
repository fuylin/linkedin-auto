'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './page.module.css';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  const loadData = () => {
    fetch(`/api/admin/users?userId=${userId}`)
      .then(async (r) => {
        if (r.status === 401) { router.replace('/admin'); return; }
        const json = await r.json();
        if (json.success) setData(json.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    fetch('/api/admin/plans').then((r) => r.json()).then((d) => { if (d.success) setPlans(d.plans || []); }).catch(() => {});
  }, [userId]);

  const manage = async (action, extra = {}) => {
    if (action === 'delete' && !confirm('DELETE this user and ALL their data? This cannot be undone.')) return;
    if (action === 'suspend' && !confirm('Suspend this user? They will be blocked from using the platform.')) return;
    setActing(true);
    setActionMsg('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      setActionMsg(json.success ? json.message : json.error);
      if (json.success && action === 'delete') { router.replace('/admin/dashboard'); return; }
      loadData();
    } catch { setActionMsg('Failed'); }
    setActing(false);
    setTimeout(() => setActionMsg(''), 4000);
  };


  function fmt(d) {
    if (!d) return '--';
    return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }

  if (loading) return <div className={styles.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className={styles.spinner} /></div>;
  if (!data) return <div className={styles.page}><div className={styles.container}><p>User not found.</p><a href="/admin/dashboard" className={styles.backLink}>&larr; Back</a></div></div>;

  const primary = data.accounts?.[0];
  const s = data.stats || {};
  const b = data.behavior || {};
  const t = data.trends || {};
  const tokenDays = primary?.tokenExpiresAt ? Math.floor((new Date(primary.tokenExpiresAt) - new Date()) / 86400000) : null;
  const trendIcon = (dir) => dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  const trendColor = (dir) => dir === 'up' ? 'var(--green)' : dir === 'down' ? 'var(--red)' : 'var(--ink-faint)';

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <a href="/admin/dashboard" className={styles.backLink}>&larr; Back to users</a>

        {/* ── Profile header with health score ── */}
        <div className={styles.profileHeader}>
          {primary?.profilePictureUrl ? (
            <img src={primary.profilePictureUrl} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>{(primary?.displayName || '?')[0].toUpperCase()}</div>
          )}
          <div className={styles.profileInfo}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className={styles.profileName}>{primary?.displayName || 'Unknown'}</h1>
              {data.churnRisk && (
                <span className={`${styles.riskBadge} ${styles[`risk_${data.churnRisk}`]}`}>
                  {data.churnRisk === 'low' ? 'Healthy' : data.churnRisk === 'medium' ? 'At risk' : 'Churning'}
                </span>
              )}
            </div>
            <p className={styles.profileEmail}>{primary?.email || 'No email'}</p>
            <p className={styles.profileUrn}>{primary?.authorUrn || userId}</p>
            <div className={styles.profileMeta}>
              {tokenDays !== null && (
                <span className={styles.metaTag} style={{ color: tokenDays < 0 ? 'var(--red)' : tokenDays < 7 ? 'var(--orange)' : 'var(--green)' }}>
                  Token: {tokenDays < 0 ? 'Expired' : `${tokenDays}d`}
                </span>
              )}
              {b.accountAge != null && <span className={styles.metaTag}>Member for {b.accountAge}d</span>}
              {b.uniqueIps > 0 && <span className={styles.metaTag}>{b.uniqueIps} IP{b.uniqueIps !== 1 ? 's' : ''}</span>}
              {b.loginCount > 0 && <span className={styles.metaTag}>{b.loginCount} logins</span>}
              {primary?.lastScreenSize && <span className={styles.metaTag}>{primary.lastScreenSize}</span>}
            </div>
          </div>
          {/* Health score circle */}
          <div className={styles.healthCircle}>
            <svg viewBox="0 0 36 36" className={styles.healthSvg}>
              <path className={styles.healthBg} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className={styles.healthFill} strokeDasharray={`${data.healthScore || 0}, 100`} style={{ stroke: (data.healthScore || 0) >= 70 ? 'var(--green)' : (data.healthScore || 0) >= 40 ? 'var(--orange)' : 'var(--red)' }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className={styles.healthValue}>{data.healthScore || 0}</div>
            <div className={styles.healthLabel}>Health</div>
          </div>
        </div>

        {/* ── Trends row ── */}
        <div className={styles.trendsRow}>
          <div className={styles.trendCard}>
            <span className={styles.trendValue} style={{ color: trendColor(t.growthTrend) }}>{trendIcon(t.growthTrend)} {t.thisWeekPosts || 0}</span>
            <span className={styles.trendLabel}>Posts this week (vs {t.lastWeekPosts || 0} last week)</span>
          </div>
          <div className={styles.trendCard}>
            <span className={styles.trendValue} style={{ color: trendColor(t.engagementTrend) }}>{trendIcon(t.engagementTrend)} {b.avgEngagement || 0}</span>
            <span className={styles.trendLabel}>Avg engagement per post</span>
          </div>
          <div className={styles.trendCard}>
            <span className={styles.trendValue}>{b.totalEngagement || 0}</span>
            <span className={styles.trendLabel}>Total interactions</span>
          </div>
          {data.bestPost && (
            <div className={styles.trendCard}>
              <span className={styles.trendValue} style={{ color: 'var(--green)' }}>{data.bestPost.engagement}</span>
              <span className={styles.trendLabel}>Best post engagement</span>
            </div>
          )}
        </div>

        {/* ── Stats grid ── */}
        <div className={styles.statsRow}>
          {[
            { value: s.total || 0, label: 'Total' },
            { value: s.published || 0, label: 'Published', color: 'var(--green)' },
            { value: s.pending || 0, label: 'Pending', color: 'var(--orange)' },
            { value: s.failed || 0, label: 'Failed', color: 'var(--red)' },
            { value: b.postsPerWeek ?? '--', label: 'Posts/wk' },
            { value: b.avgWordCount ?? '--', label: 'Avg words' },
            { value: `${b.imageUsageRate ?? 0}%`, label: 'Images' },
            { value: `${b.successRate ?? 0}%`, label: 'Success' },
            { value: b.preferredDay || '--', label: 'Fav day' },
            { value: b.preferredHour != null ? `${String(b.preferredHour).padStart(2,'0')}:00` : '--', label: 'Fav hour' },
          ].map(({ value, label, color }) => (
            <div key={label} className={styles.miniStat}>
              <div className={styles.miniStatValue} style={color ? { color } : {}}>{value}</div>
              <div className={styles.miniStatLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Posting heatmap ── */}
        {data.heatmap?.length > 0 && (
          <div className={styles.detailCard} style={{ marginBottom: 16 }}>
            <h3 className={styles.cardTitle}>Posting activity — last 12 weeks</h3>
            <div className={styles.heatmap}>
              {data.heatmap.map((d, i) => (
                <div key={i} className={styles.heatCell} style={{ opacity: d.count === 0 ? 0.1 : Math.min(0.3 + d.count * 0.25, 1), background: d.count > 0 ? 'var(--green)' : 'var(--border)' }} title={`${d.date}: ${d.count} post${d.count !== 1 ? 's' : ''}`} />
              ))}
            </div>
            <div className={styles.heatLegend}>
              <span>Less</span>
              {[0.1, 0.3, 0.55, 0.8, 1].map((o, i) => (
                <div key={i} className={styles.heatCell} style={{ opacity: o, background: i === 0 ? 'var(--border)' : 'var(--green)' }} />
              ))}
              <span>More</span>
            </div>
          </div>
        )}

        {/* ── Top words ── */}
        {data.topWords?.length > 0 && (
          <div className={styles.detailCard} style={{ marginBottom: 16 }}>
            <h3 className={styles.cardTitle}>Content top words</h3>
            <div className={styles.wordCloud}>
              {data.topWords.map((w, i) => (
                <span key={i} className={styles.wordTag} style={{ fontSize: Math.max(12, Math.min(24, 12 + w.count * 2)) }}>{w.word} <small>{w.count}</small></span>
              ))}
            </div>
          </div>
        )}

        {/* ── Best post ── */}
        {data.bestPost && (
          <div className={styles.detailCard} style={{ marginBottom: 16, borderLeft: '4px solid var(--green)' }}>
            <h3 className={styles.cardTitle}>Best performing post</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 8 }}>{data.bestPost.commentary}...</p>
            <span className={styles.muted}>{data.bestPost.engagement} interactions · {fmt(data.bestPost.publishedAt)}</span>
          </div>
        )}

        {/* ── Cards grid ── */}
        <div className={styles.cardsGrid}>
          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Devices & browsers</h3>
            {(data.devices?.length > 0 || data.browsers?.length > 0) ? (
              <>
                {data.devices?.map((d, i) => <div key={i} className={styles.listItem}><span className={styles.listName}>{d.name}</span><span className={styles.listMeta}>{d.count}x</span></div>)}
                {data.browsers?.map((b, i) => <div key={i} className={styles.listItem}><span className={styles.listName}>{b.name}</span><span className={styles.listMeta}>{b.count}x</span></div>)}
                {data.operatingSystems?.map((o, i) => <div key={i} className={styles.listItem}><span className={styles.listName}>{o.name}</span><span className={styles.listMeta}>{o.count}x</span></div>)}
              </>
            ) : <p className={styles.muted}>No data yet</p>}
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Login locations</h3>
            {data.loginLocations?.length > 0 ? data.loginLocations.map((loc, i) => (
              <div key={i} className={styles.listItem}>
                <span className={styles.listName}>{[loc.city, loc.country].filter(Boolean).join(', ')}</span>
                <span className={styles.listMeta}>{loc.count}x</span>
              </div>
            )) : <p className={styles.muted}>No data yet</p>}
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Most active hours (IST)</h3>
            {data.activeHours?.length > 0 ? data.activeHours.map((h, i) => {
              const istMin = h.hour * 60 + 330;
              const istH = Math.floor(istMin / 60) % 24;
              const istM = istMin % 60;
              return <div key={i} className={styles.listItem}><span className={styles.listName}>{String(istH).padStart(2,'0')}:{String(istM).padStart(2,'0')}</span><span className={styles.listMeta}>{h.count} actions</span></div>;
            }) : <p className={styles.muted}>No data yet</p>}
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Accounts ({data.accounts?.length || 0})</h3>
            {data.accounts?.map((acc, i) => (
              <div key={i} className={styles.listItem}>
                <div><span className={styles.listName}>{acc.displayName || 'Unknown'}</span><div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'monospace' }}>{acc.authorUrn}</div></div>
                <span className={styles.metaTag}>{acc.accountType}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Activity timeline ── */}
        <div className={styles.detailCard} style={{ marginBottom: 16 }}>
          <h3 className={styles.cardTitle}>Recent activity ({data.activities?.length || 0})</h3>
          {data.activities?.length > 0 ? (
            <div className={styles.timeline}>
              {data.activities.map((act, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div style={{ flex: 1 }}>
                    <span className={styles.timelineAction}>{act.action.replace(/_/g, ' ')}</span>
                    {act.device && <span className={styles.timelineDevice}> · {act.device}</span>}
                    {act.browser && <span className={styles.timelineDevice}> · {act.browser}</span>}
                    {act.city && <span className={styles.timelineDevice}> · {act.city}, {act.country}</span>}
                    {act.ip && <span className={styles.timelineIp}> · {act.ip}</span>}
                  </div>
                  <span className={styles.timelineTime}>{fmt(act.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : <p className={styles.muted}>No activity yet</p>}
        </div>

        {/* ── Recent posts ── */}
        <div className={styles.detailCard}>
          <h3 className={styles.cardTitle}>Recent posts ({data.recentPosts?.length || 0})</h3>
          {data.recentPosts?.length > 0 ? (
            <table className={styles.postsTable}>
              <thead><tr><th>Status</th><th>Text</th><th>Engagement</th><th>Created</th></tr></thead>
              <tbody>
                {data.recentPosts.map((post) => {
                  const eng = (post.analytics?.likes || 0) + (post.analytics?.comments || 0) + (post.analytics?.shares || 0);
                  return (
                    <tr key={post._id}>
                      <td><span className={`badge badge-${post.status.toLowerCase()}`}>{post.status}</span></td>
                      <td><span className={styles.postText}>{post.commentary}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{eng || '--'}</td>
                      <td className={styles.muted}>{fmt(post.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className={styles.muted}>No posts yet</p>}
        </div>

        {/* ── User management ── */}
        <div className={styles.detailCard} style={{ marginTop: 16, borderLeft: '4px solid var(--red)' }}>
          <h3 className={styles.cardTitle}>Manage user</h3>

          {actionMsg && <div style={{ padding: '8px 12px', background: '#D1FAE5', color: '#065F46', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{actionMsg}</div>}

          {/* Change plan */}
          {plans.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: 6 }}>Change plan</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select id="planSelect" defaultValue="" style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'var(--sans)', minWidth: 200 }}>
                  <option value="" disabled>Select plan...</option>
                  {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name} {p.priceMonthly > 0 ? `(₹${p.priceMonthly / 100}/mo)` : '(Free)'}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => {
                  const slug = document.getElementById('planSelect').value;
                  if (slug) manage('change_plan', { planSlug: slug });
                }}>Assign plan</button>
                <button className="btn btn-ghost btn-sm" disabled={acting} onClick={() => manage('remove_plan')}>Remove plan (free)</button>
              </div>
            </div>
          )}

          {/* Suspend / Unsuspend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {primary?.status === 'SUSPENDED' ? (
              <button className="btn btn-outline btn-sm" disabled={acting} onClick={() => manage('unsuspend')} style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>
                Reactivate user
              </button>
            ) : (
              <button className="btn btn-outline btn-sm" disabled={acting} onClick={() => manage('suspend', { reason: prompt('Suspension reason (optional):') || '' })} style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}>
                Suspend user
              </button>
            )}
            <button className="btn btn-danger btn-sm" disabled={acting} onClick={() => manage('delete')}>
              Delete user & all data
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            Suspend blocks the user from accessing the platform. Delete permanently removes all their posts, templates, and activity data.
          </p>
        </div>
      </div>
    </main>
  );
}
