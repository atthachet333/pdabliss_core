import {
  Activity,
  Building2,
  Crown,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi, platformApi, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { withLocale } from '@/features/auth/localeState';
import { clearIdentity } from '@/features/auth/session';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PLATFORM_COPY } from './copy';
import { attentionTotal } from './model';
import { PLATFORM_OPS_COPY } from './opsCopy';

/*
 * The Platform Control Center frame (EP24.1; operator-first in EP24.1.2):
 * PDA BLISS's own operating surface, visibly not a customer's. A thin
 * authority line (gold for the Platform Owner, teal for a Platform Admin)
 * runs above the bar. The bar is the operating system: the real areas
 * (Overview, Companies, Activity, and Operators for the Owner), a quick
 * company search that opens the Company Explorer, how many things need
 * attention, and who is signed in. Content is wide on purpose.
 */
export function PlatformShell({
  identity,
  attention,
  children,
}: {
  identity: Identity;
  /** The overview passes its own count; other pages let the shell fetch it. */
  attention?: number;
  children: ReactNode;
}) {
  const p = useCopy(PLATFORM_COPY);
  const o = useCopy(PLATFORM_OPS_COPY);
  const a = useCopy(AUTH_COPY);
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const searchId = useId();
  const owner = identity.platformRole === 'PLATFORM_OWNER';
  const count = attention ?? fetched;

  // Start keyboard / screen-reader users at the content when nothing else holds focus.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (attention !== undefined) return;
    let live = true;
    platformApi.overview().then(
      (ov) => live && setFetched(attentionTotal(ov.attention)),
      () => undefined, // the badge is optional; pages report their own errors
    );
    return () => {
      live = false;
    };
  }, [attention]);

  const signOut = async () => {
    setError(null);
    try {
      await authApi.logout();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(commonError(e, a));
        return;
      }
    }
    clearIdentity();
    navigate('/login', { replace: true, ...withLocale(locale) });
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/platform/companies?q=${encodeURIComponent(q)}` : '/platform/companies');
    setQuery('');
  };

  const nav = [
    { to: '/platform', end: true, label: p.shell.overview, icon: LayoutDashboard },
    { to: '/platform/companies', end: false, label: p.shell.companies, icon: Building2 },
    { to: '/platform/activity', end: false, label: o.shell.activity, icon: Activity },
    ...(owner
      ? [{ to: '/platform/operators', end: false, label: o.shell.operators, icon: UsersRound }]
      : []),
  ];
  // The explorer has its own, richer search.
  const showSearch = !pathname.startsWith('/platform/companies');

  return (
    <div
      className="min-h-dvh bg-surface-dark"
      data-area="platform"
      data-authority={identity.platformRole}
    >
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      <div
        aria-hidden
        className={cn(
          'h-[2px]',
          owner
            ? 'bg-[linear-gradient(90deg,transparent,rgb(245_184_75/0.85)_20%,rgb(245_184_75/0.85)_80%,transparent)]'
            : 'bg-[linear-gradient(90deg,transparent,rgb(62_240_192/0.55)_20%,rgb(62_240_192/0.55)_80%,transparent)]',
        )}
      />
      <header className="border-b border-white/[0.06] bg-[rgb(7_14_21/0.85)]">
        <div className="mx-auto flex w-full max-w-[120rem] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link to="/" aria-label={a.common.home} className="flex shrink-0 items-center gap-3">
            <span className="max-sm:hidden">
              <Logo compact />
            </span>
            <LogoMark className="size-9 sm:hidden" />
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-white/[0.1] 2xl:block" />
          <p className="hidden font-mono text-[0.6875rem] tracking-[0.18em] text-text-secondary uppercase 2xl:block">
            {p.shell.product}
          </p>
          <nav aria-label={p.shell.nav} className="order-last w-full lg:order-none lg:w-auto">
            <ul
              className={cn('grid gap-1 lg:flex', nav.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}
            >
              {nav.map((item) => (
                <li key={item.to} className="min-w-0">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[0.75rem] transition-colors motion-reduce:transition-none sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-label',
                        isActive
                          ? 'bg-white/[0.07] text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)]'
                          : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            {showSearch && (
              <form role="search" onSubmit={search} className="relative hidden md:block">
                <label htmlFor={searchId} className="sr-only">
                  {o.shell.search}
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-muted"
                />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={o.shell.searchPlaceholder}
                  maxLength={100}
                  autoComplete="off"
                  data-quick-search
                  className="h-11 w-48 rounded-full bg-white/[0.04] pr-4 pl-10 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] placeholder:text-text-muted focus-visible:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.6)] focus-visible:outline-none xl:w-60 2xl:w-72"
                />
              </form>
            )}
            {count !== null && count > 0 && (
              <Link
                to="/platform#attention"
                data-attention-count={count}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-warning/[0.1] px-3.5 text-caption font-medium whitespace-nowrap text-[#f3cf8a] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                {o.shell.attention(count)}
              </Link>
            )}
            <AuthorityMark identity={identity} />
            <button
              type="button"
              onClick={() => void signOut()}
              className={buttonClasses('secondary', 'md')}
            >
              <LogOut aria-hidden className="size-4" />
              <span className="max-2xl:sr-only">{p.shell.signOut}</span>
            </button>
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[120rem] px-4 pt-6 pb-20 outline-none sm:px-6 lg:px-10 lg:pt-8"
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

/**
 * Who holds the controls. The Platform Owner reads as the highest authority —
 * a fine gold frame and crown, not a badge; a Platform Admin is plainly a
 * level below.
 */
export function AuthorityMark({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const role = identity.platformRole;
  if (!role) return null;
  const owner = role === 'PLATFORM_OWNER';
  return (
    <div
      data-platform-role={role}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5',
        owner
          ? 'bg-[linear-gradient(90deg,rgb(245_184_75/0.14),rgb(245_184_75/0.04))] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.38)]'
          : 'bg-white/[0.03] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          owner ? 'bg-warning/15 text-warning' : 'bg-brand-primary/10 text-brand-soft',
        )}
      >
        {owner ? <Crown className="size-4" /> : <ShieldCheck className="size-4" />}
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            'block font-mono text-[0.6875rem] tracking-[0.14em] uppercase',
            owner ? 'text-warning' : 'text-brand-soft',
          )}
        >
          {p.authority[role]}
        </span>
        <span className="block max-w-[12rem] truncate text-caption text-text-secondary max-2xl:hidden">
          {identity.user.fullName ?? identity.user.email}
        </span>
      </span>
    </div>
  );
}
