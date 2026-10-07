'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

// Ping /api/cron/tick every 60s while the tab is visible.
function useSchedulerHeartbeat() {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/cron/tick', { method: 'POST' }).catch(() => {});
    };
    const initial = setTimeout(tick, 5_000);
    const interval = setInterval(tick, 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);
}

// Report screen size once per session.
function useScreenBeacon() {
  useEffect(() => {
    if (sessionStorage.getItem('beacon_sent')) return;
    const timer = setTimeout(() => {
      fetch('/api/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenWidth: window.screen.width, screenHeight: window.screen.height }),
      }).catch(() => {});
      sessionStorage.setItem('beacon_sent', '1');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}

// Check maintenance mode + announcement banner on load.
function usePlatformStatus() {
  const [announcement, setAnnouncement] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const skipPages = ['/sign-in', '/maintenance', '/pending'];
    if (skipPages.includes(pathname) || pathname.startsWith('/admin') || pathname.startsWith('/invite')) return;

    // Check maintenance + announcement
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        if (data.maintenance) { router.replace('/maintenance'); return; }
        if (data.announcement?.text) {
          const dismissed = sessionStorage.getItem('announcement_dismissed');
          if (!dismissed) setAnnouncement(data.announcement);
        }
      })
      .catch(() => {});

    // Check if user account is PENDING approval
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'PENDING') router.replace('/pending');
        if (data.status === 'REJECTED') router.replace('/sign-in?error=rejected');
        if (data.status === 'SUSPENDED') router.replace('/sign-in?error=suspended');
      })
      .catch(() => {});
  }, [pathname]);

  const dismiss = () => {
    setAnnouncement(null);
    sessionStorage.setItem('announcement_dismissed', '1');
  };

  return { announcement, dismiss };
}

const bannerColors = {
  info: { bg: '#E8F0EB', color: '#18392B', border: '#18392B' },
  warning: { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  success: { bg: '#D1FAE5', color: '#065F46', border: '#10B981' },
};

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { announcement, dismiss } = usePlatformStatus();
  useSchedulerHeartbeat();
  useScreenBeacon();

  if (pathname === '/sign-in' || pathname.startsWith('/admin') || pathname === '/maintenance' || pathname === '/pending' || pathname.startsWith('/invite')) return children;

  const bc = announcement ? bannerColors[announcement.type] || bannerColors.info : null;

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className={styles.main}>
        {/* Announcement banner */}
        {announcement && (
          <div style={{ background: bc.bg, color: bc.color, borderBottom: `2px solid ${bc.border}`, padding: '10px 20px', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{announcement.text}</span>
            <button onClick={dismiss} style={{ background: 'none', border: 'none', color: bc.color, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>&times;</button>
          </div>
        )}

        {/* Mobile header */}
        <header className={styles.mobileHeader}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <img src="/FUYL LINKEDINAUTO LOGO.png" alt="FUYL" style={{ height: 28 }} />
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}
