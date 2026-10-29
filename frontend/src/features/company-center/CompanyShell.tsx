import {
  Activity,
  ArrowRight,
  Building2,
  CircleUserRound,
  Database,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Network,
  Package,
  Settings,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { withLocale } from '@/features/auth/localeState';
import { clearIdentity, refreshIdentity } from '@/features/auth/session';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { can, controlApi, type AdminPermission, type PermissionCode } from './api';
import { ControlContext, useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { PERMISSION_COPY } from './permissionCopy';
import { useLoad } from './model';
import { AreaLink, AreaNavLink, CompanyMark, Loading } from './parts';

/*
 * The Company Control Center frame (EP25): the customer's administration of
 * their own company — related to the Platform Control Center but clearly not
 * it. A teal operational line instead of the platform's gold authority; the
 * company itself (logo or initials, name, the person's role) where the
 * platform shows PDA BLISS; the way into CORE always in reach.
 *
 * Navigation lists only the areas this person's role may open (the server
 * sends the effective permissions and checks them again on every call). On large
 * screens the areas form a sidebar; below that, one scrollable row.
 */

/**
 * EP28: Master Data opens for anyone who may view at least one kind of
 * master record (the server's codes; it checks every call again).
 */
const MASTER_VIEW =
  /^(company\.master_data\.manage|[a-z]+\.(customers|suppliers|items|locations)\.view)$/;
const seesMasterData = (codes: readonly PermissionCode[]) =>
  codes.some((code) => MASTER_VIEW.test(code));

/** Shown in place of a page the role may not open (the API would refuse it anyway). */
export function RequirePermission({
  permission,
  children,
}: {
  permission: AdminPermission;
  children: ReactNode;
}) {
  const c = useCopy(CONTROL_COPY);
  const { overview } = useControl();
  if (!can(overview.me.permissions, permission)) {
    return (
      <div className="py-10" data-forbidden={permission}>
        <Notice tone="info">{c.shell.forbidden}</Notice>
      </div>
    );
  }
  return <>{children}</>;
}

export function CompanyShell({ identity, children }: { identity: Identity; children: ReactNode }) {
  const c = useCopy(CONTROL_COPY);
  const p = useCopy(PERMISSION_COPY);
  const a = useCopy(AUTH_COPY);
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { state, reload, set } = useLoad(controlApi.overview);
  usePageMeta(c.meta.title, c.meta.description, { index: false });

  // Start keyboard / screen-reader users at the content when nothing else holds focus.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, []);

  // The company stopped being eligible (or this person lost access) since sign-in:
  // refresh the identity so the guard sends them to the Account Portal.
  const lost =
    state.status === 'error' &&
    state.error instanceof ApiError &&
    ['COMPANY_NOT_ACTIVE', 'MEMBERSHIP_INACTIVE', 'NO_COMPANY'].includes(state.error.code);
  useEffect(() => {
    if (lost) void refreshIdentity();
  }, [lost]);

  const signOut = async () => {
    setSignOutError(null);
    try {
      await authApi.logout();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setSignOutError(commonError(e, a));
        return;
      }
    }
    clearIdentity();
    navigate('/login', { replace: true, ...withLocale(locale) });
  };

  const overview = state.status === 'ready' ? state.data : null;
  const caps = overview?.me.permissions ?? [];
  const nav: {
    to: string;
    end?: boolean;
    label: string;
    icon: typeof Building2;
    cap: AdminPermission;
    /** Shown regardless of `cap` when set (EP28 Master Data follows operational codes). */
    show?: boolean;
  }[] = [
    {
      to: '/company',
      end: true,
      label: c.shell.overview,
      icon: LayoutDashboard,
      cap: 'company.profile.view',
    },
    {
      to: '/company/profile',
      label: c.shell.company,
      icon: Building2,
      cap: 'company.profile.view',
    },
    {
      to: '/company/branches',
      label: c.shell.branches,
      icon: Network,
      cap: 'company.branches.view',
    },
    { to: '/company/users', label: c.shell.users, icon: UsersRound, cap: 'company.members.view' },
    {
      to: '/company/departments',
      label: c.shell.departments,
      icon: Layers,
      cap: 'company.profile.view',
    },
    {
      to: '/company/subscription',
      label: c.shell.subscription,
      icon: Package,
      cap: 'company.subscription.view',
    },
    {
      to: '/company/security',
      label: c.shell.security,
      icon: Activity,
      cap: 'company.activity.view',
    },
    {
      to: '/company/master-data',
      label: c.shell.masterData,
      icon: Database,
      cap: 'company.master_data.manage',
      show: seesMasterData(caps),
    },
    { to: '/company/permissions', label: p.nav, icon: KeyRound, cap: 'company.permissions.view' },
    {
      to: '/company/settings',
      label: c.shell.settings,
      icon: Settings,
      cap: 'company.settings.manage',
    },
  ];
  const visible = nav.filter((n) => n.show ?? can(caps, n.cap));

  return (
    <div
      className="min-h-dvh bg-surface-dark"
      data-area="company"
      data-company-role={overview?.me.role}
    >
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      {/* The customer's operational line — teal, never the platform's gold. */}
      <div
        aria-hidden
        className="h-[3px] bg-[linear-gradient(90deg,rgb(25_195_154/0.9),rgb(62_240_192/0.75)_45%,rgb(90_169_255/0.35))]"
      />
      <header className="border-b border-white/[0.06] bg-[rgb(6_16_20/0.9)]">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <AreaLink to="/" aria-label={a.common.home} className="flex shrink-0 items-center">
            <span className="max-md:hidden">
              <Logo compact />
            </span>
            <LogoMark className="size-9 md:hidden" />
          </AreaLink>
          <span aria-hidden className="h-7 w-px bg-white/[0.1]" />
          {overview ? (
            <div className="flex min-w-0 flex-1 items-center gap-3" data-company-identity>
              <CompanyMark
                name={overview.company.displayName}
                logo={overview.company.logo}
                size="sm"
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-label font-semibold text-text-primary">
                  {overview.company.displayName}
                </p>
                <p className="truncate font-mono text-[0.6875rem] tracking-[0.12em] text-brand-soft uppercase">
                  {a.roles[overview.me.role]}
                  {overview.company.isDemo && (
                    <span className="text-warning"> · {c.shell.demo}</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] tracking-[0.16em] text-text-secondary uppercase">
              {c.shell.product}
            </p>
          )}
          <div className="flex items-center gap-2">
            {overview?.access.canEnterCore && (
              <AreaLink
                to="/core"
                className={buttonClasses('primary', 'md', 'max-sm:px-4')}
                data-enter-core
              >
                <span>{c.shell.enterCore}</span>
                <ArrowRight aria-hidden className="size-4" />
              </AreaLink>
            )}
            <AreaLink
              to="/account"
              className={buttonClasses('ghost', 'md', 'px-3')}
              aria-label={c.shell.account}
              title={c.shell.account}
            >
              <CircleUserRound aria-hidden className="size-5" />
            </AreaLink>
            <button
              type="button"
              onClick={() => void signOut()}
              className={buttonClasses('secondary', 'md', 'px-3.5')}
            >
              <LogOut aria-hidden className="size-4" />
              <span className="max-xl:sr-only">{c.shell.signOut}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[100rem] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-8">
        {overview && (
          <nav
            aria-label={c.shell.nav}
            className="border-b border-white/[0.06] lg:border-0 lg:pt-8"
          >
            <ul className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:p-0">
              {visible.map((item) => (
                <li key={item.to} className="shrink-0">
                  <AreaNavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-2.5 rounded-full px-3.5 text-label whitespace-nowrap transition-colors motion-reduce:transition-none lg:rounded-xl',
                        isActive
                          ? 'bg-brand-primary/[0.1] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28)]'
                          : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-4 shrink-0" />
                    {item.label}
                  </AreaNavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 px-4 pt-6 pb-20 outline-none sm:px-6 lg:col-start-2 lg:px-0 lg:pt-8"
        >
          {signOutError && (
            <div className="mb-4">
              <Notice tone="error">{signOutError}</Notice>
            </div>
          )}
          {state.status === 'loading' && <Loading label={c.shell.loading} />}
          {state.status === 'error' && (
            <div className="grid max-w-xl gap-4 py-8">
              <ShieldAlert aria-hidden className="size-7 text-warning" />
              <p className="text-label text-text-primary">
                {lost ? c.shell.notAvailable : c.shell.loadError}
              </p>
              <div className="flex flex-wrap gap-3">
                {lost ? (
                  <AreaLink to="/account" className={buttonClasses('secondary', 'md')}>
                    {c.shell.toAccount}
                  </AreaLink>
                ) : (
                  <button
                    type="button"
                    onClick={() => void reload().catch(() => undefined)}
                    className={buttonClasses('secondary', 'md')}
                  >
                    {c.shell.retry}
                  </button>
                )}
              </div>
            </div>
          )}
          {overview && (
            <ControlContext.Provider value={{ overview, identity, reload, replace: set }}>
              {children}
            </ControlContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
}
