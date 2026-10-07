'use client';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Brand panel */}
        <div className={styles.brandPanel}>
          <img
            src="/FUYL LINKEDINAUTO LOGO.png"
            alt="FUYL"
            className={styles.brandLogo}
          />
          <h1 className={styles.brandHeadline}>
            Plan a month of LinkedIn posts in an afternoon.
          </h1>
          <p className={styles.brandSub}>
            Draft, queue and publish from one calendar — then let it run.
          </p>
          <p className={styles.brandFooter}>
            Powered by FUYL. Your credentials never touch our servers.
          </p>
        </div>

        {/* Sign-in card */}
        <div className={styles.signInPanel}>
          <span className={styles.signInEyebrow}>Sign in</span>
          <h2 className={styles.signInTitle}>Welcome back</h2>
          <p className={styles.signInSub}>
            Sign in with LinkedIn to schedule and manage your posts.
          </p>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {error === 'maintenance' ? 'Platform is under maintenance. Please try again later.' :
               error === 'registration_closed' ? 'New registrations are currently closed.' :
               error === 'domain_not_allowed' ? 'Your email domain is not allowed on this platform.' :
               error === 'invite_only' ? 'This platform is invite-only. You need an invite link to sign up.' :
               error === 'invite_invalid' ? 'Your invite link is invalid or expired. Contact the admin for a new one.' :
               error === 'rejected' ? 'Your account was not approved. Contact the admin for more information.' :
               error === 'suspended' ? 'Your account has been suspended. Contact the admin.' :
               'Sign-in failed. Please try again.'}
            </div>
          )}
          <a
            href="/api/auth/signin"
            className={`btn btn-primary ${styles.signInBtn}`}
          >
            Continue with LinkedIn
          </a>
          <div className={styles.helperBox}>
            <svg className={styles.helperIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className={styles.helperText}>
              To use a different account, first sign out at{' '}
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">linkedin.com</a>{' '}
              or open this page in a private window.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
