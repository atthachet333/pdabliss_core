import { LoaderCircle, LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { AuthLocale } from '@/features/auth/locale';
import { withLocale } from '@/features/auth/localeState';
import { clearIdentity, homeFor, refreshIdentity, useIdentity } from '@/features/auth/session';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

/*
 * Signed-in areas (EP23): the Account Portal (/account) and the Platform
 * Control Center (/platform). The guard here decides what to RENDER from the
 * server's own answer to GET /auth/me; it is not the security boundary —
 * every API behind these screens checks the session and role again.
 */

type Area = 'account' | 'platform';

/** Loads the identity and the language, then renders the area — or sends the visitor where they belong. */
export function SignedInArea({
  area,
  children,
}: {
  area: Area;
  children: (identity: Identity) => ReactNode;
}) {
  const identity = useIdentity();
  const fallback = identity.status === 'ready' ? identity.identity.user.locale : undefined;
  return (
    <AuthLocale fallback={fallback}>
      <Guard area={area}>{children}</Guard>
    </AuthLocale>
  );
}

function Guard({ area, children }: { area: Area; children: (identity: Identity) => ReactNode }) {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const identity = useIdentity();
  const { pathname } = useLocation();

  if (identity.status === 'anonymous') {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(pathname)}`}
        replace
        {...withLocale(locale)}
      />
    );
  }
  if (identity.status === 'error') {
    return (
      <Centered>
        <ShieldAlert aria-hidden className="size-7 text-warning" />
        <p className="text-label text-text-primary">{c.account.loadError}</p>
        <Notice tone="error">{commonError(identity.error, c)}</Notice>
        <button
          type="button"
          onClick={() => void refreshIdentity()}
          className={buttonClasses('secondary')}
        >
          {c.account.retry}
        </button>
      </Centered>
    );
  }
  if (identity.status !== 'ready') {
    return (
      <Centered>
        <LoaderCircle
          aria-hidden
          className="size-6 animate-spin text-brand-soft motion-reduce:animate-none"
        />
        <p role="status" className="text-label text-text-secondary">
          {c.account.loading}
        </p>
      </Centered>
    );
  }
  const home = homeFor(identity.identity);
  if (home !== `/${area}` && !pathname.startsWith('/account/invitation')) {
    return <Navigate to={home} replace {...withLocale(locale)} />;
  }
  return <>{children(identity.identity)}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface-dark px-4 text-center">
      {children}
    </div>
  );
}

/** Top bar + page body for the signed-in areas. The platform bar is visibly different. */
export function PortalShell({
  area,
  identity,
  children,
}: {
  area: Area;
  identity: Identity;
  children: ReactNode;
}) {
  const c = useCopy(AUTH_COPY);
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const platform = area === 'platform';

  // EP23 QA: after sign-in the previous page (and its focused field) is gone, so focus
  // fell back to <body>. Start keyboard and screen-reader users at the new page's content —
  // only when nothing else holds focus.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, [area]);

  const signOut = async () => {
    setError(null);
    try {
      await authApi.logout();
    } catch (e) {
      // Already signed out on the server is fine; anything else is reported.
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(commonError(e, c));
        return;
      }
    }
    clearIdentity();
    navigate('/login', { replace: true, ...withLocale(locale) });
  };

  return (
    <div className="min-h-dvh bg-surface-dark" data-area={area}>
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      <header
        className={cn(
          'border-b',
          platform ? 'border-warning/30 bg-warning/[0.04]' : 'border-white/[0.06]',
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" aria-label={c.common.home} className="shrink-0">
              <span className="max-sm:hidden">
                <Logo compact />
              </span>
              <LogoMark className="size-9 sm:hidden" />
            </Link>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.14em] uppercase',
                platform ? 'bg-warning/15 text-warning' : 'bg-white/[0.06] text-text-secondary',
              )}
            >
              {platform ? 'Platform' : c.account.kicker}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 truncate text-caption text-text-secondary max-sm:hidden">
              {identity.user.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className={buttonClasses('secondary', 'md')}
            >
              <LogOut aria-hidden className="size-4" />
              {c.account.signOut}
            </button>
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 outline-none sm:px-6"
      >
        {error && (
          <div className="mb-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

/** A titled card on the signed-in pages. */
export function Panel({
  title,
  aside,
  children,
  className,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'min-w-0 rounded-[1.25rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.96),rgb(7_15_22/0.98))] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-body font-semibold text-text-primary">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
