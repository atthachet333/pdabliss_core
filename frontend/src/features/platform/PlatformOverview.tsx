import { ArrowRight, ChevronDown, ScrollText, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import {
  platformApi,
  type AuthEventRow,
  type Identity,
  type PlatformOperator,
  type PlatformOverview as Overview,
  type PlatformUser,
} from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { formatDateTime } from '@/features/account/format';
import { SessionsPanel } from '@/features/account/SessionsPanel';
import { platformCompanyApi, type PlatformCompanyRow } from '@/features/company/api';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { CompanyRow } from './CompanyRow';
import { PLATFORM_COPY, type PlatformCopy } from './copy';
import { eventLabel, formatCount, useLoad, ZONE } from './model';
import { LoadErrorMessage, SectionTitle, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform — the Platform Control Center overview (EP24.1). Four levels:
 *   1. who holds the controls and the platform's headline state;
 *   2. customer companies: the lifecycle rail, what needs attention, newest;
 *   3. customer accounts, platform operators (owner only), security activity;
 *   4. the operator's own session and devices, folded away.
 * Every number is a count of real rows — no revenue, growth or scores.
 */

interface Data {
  overview: Overview;
  newest: PlatformCompanyRow[];
  users: PlatformUser[];
  events: AuthEventRow[];
  operators: PlatformOperator[] | null;
}

export function PlatformOverview({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  usePageMeta(p.meta.overview, p.meta.description, { index: false });
  const owner = identity.platformRole === 'PLATFORM_OWNER';
  const { state, retry } = useLoad<Data>(async () => {
    const [overview, newest, users, audit, operators] = await Promise.all([
      platformApi.overview(),
      platformCompanyApi.list({ limit: 6 }),
      platformApi.users(),
      platformApi.audit(),
      owner ? platformApi.operators() : Promise.resolve(null),
    ]);
    return {
      overview,
      newest: newest.companies,
      users: users.users,
      events: audit.events,
      operators: operators?.operators ?? null,
    };
  }, identity.user.id);

  return (
    <PlatformShell identity={identity}>
      <Header
        identity={identity}
        overview={state.status === 'ready' ? state.value.overview : null}
        p={p}
      />
      {state.status === 'error' ? (
        <div className="mt-8">
          <LoadErrorMessage error={state.error} p={p} onRetry={retry} />
        </div>
      ) : state.status === 'loading' ? (
        <div className="mt-8">
          <StateMessage kind="loading" text={p.explorer.loading} />
        </div>
      ) : (
        <Body data={state.value} identity={identity} owner={owner} p={p} />
      )}
    </PlatformShell>
  );
}

// ------------------------------------------------------------- level 1

function Header({
  identity,
  overview,
  p,
}: {
  identity: Identity;
  overview: Overview | null;
  p: PlatformCopy;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const owner = identity.platformRole === 'PLATFORM_OWNER';
  const headline = overview
    ? [
        {
          key: 'companies',
          label: p.overview.headline.companies,
          value: overview.companies.customer,
        },
        {
          key: 'active',
          label: p.overview.headline.active,
          value: overview.companies.byStatus.ACTIVE,
        },
        {
          key: 'waiting',
          label: p.overview.headline.waiting,
          value: overview.attention.readyToActivate,
        },
        {
          key: 'accounts',
          label: p.overview.headline.accounts,
          value: overview.customerAccounts.total,
        },
      ]
    : null;
  return (
    <section
      aria-labelledby="platform-title"
      className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
    >
      <div className="min-w-0">
        <p
          className={cn(
            'font-mono text-[0.6875rem] tracking-[0.18em] uppercase',
            owner ? 'text-warning' : 'text-brand-soft',
          )}
        >
          {p.overview.kicker}
        </p>
        <h1
          id="platform-title"
          className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-text-primary"
        >
          {p.overview.title}
        </h1>
        <p className="mt-3 max-w-2xl text-body text-text-secondary">{p.overview.lead}</p>
        <p className="mt-2 text-caption text-text-muted">
          {identity.platformRole && (
            <span className={owner ? 'text-warning' : 'text-brand-soft'}>
              {p.authority[identity.platformRole]} ·{' '}
              {owner ? p.authority.ownerLine : p.authority.adminLine}
            </span>
          )}{' '}
          — {p.authority.notCustomer}
        </p>
      </div>
      <dl
        data-headline
        className="grid min-w-0 grid-cols-2 [gap:1px] overflow-hidden rounded-[1.375rem] bg-white/[0.06] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:grid-cols-4"
      >
        {(
          headline ??
          [0, 1, 2, 3].map((i) => ({ key: String(i), label: '…', value: null as number | null }))
        ).map((m) => (
          <div
            key={m.key}
            className="min-w-0 bg-surface-dark/95 px-5 py-4 sm:min-w-[9.5rem] lg:px-6 lg:py-5"
          >
            <dt className="text-caption text-text-muted">{m.label}</dt>
            <dd className="mt-1.5 text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] leading-none font-semibold text-text-primary tabular-nums">
              {m.value === null ? '—' : formatCount(m.value, lang)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------- levels 2–4

function Body({
  data,
  identity,
  owner,
  p,
}: {
  data: Data;
  identity: Identity;
  owner: boolean;
  p: PlatformCopy;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const o = data.overview;
  return (
    <div className="mt-10 grid gap-6 lg:mt-12 xl:grid-cols-12">
      <Lifecycle overview={o} p={p} className="xl:col-span-8" />
      <Attention overview={o} p={p} className="xl:col-span-4" />

      <section aria-labelledby="newest-title" className={cn(ZONE, 'p-5 sm:p-6 xl:col-span-12')}>
        <SectionTitle
          id="newest-title"
          title={p.overview.newest}
          aside={
            <Link
              to="/platform/companies"
              className="inline-flex min-h-11 items-center gap-2 text-label text-brand-soft hover:underline"
            >
              {p.overview.openExplorer}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        />
        <div className="mt-4">
          {data.newest.length ? (
            <ul className="grid gap-2" data-newest>
              {data.newest.map((row) => (
                <li key={row.id} className="min-w-0">
                  <CompanyRow row={row} />
                </li>
              ))}
            </ul>
          ) : (
            <StateMessage kind="empty" title={p.explorer.emptyTitle} text={p.explorer.emptyText} />
          )}
        </div>
      </section>

      <Accounts overview={o} users={data.users} p={p} lang={lang} className="xl:col-span-4" />
      {owner ? (
        <Operators operators={data.operators ?? []} p={p} className="xl:col-span-3" />
      ) : (
        <section aria-labelledby="operators-title" className={cn(ZONE, 'p-5 sm:p-6 xl:col-span-3')}>
          <SectionTitle id="operators-title" title={p.overview.operators} />
          <p className="mt-3 text-caption text-text-muted">{p.overview.operatorsReserved}</p>
        </section>
      )}
      <Security events={data.events} p={p} lang={lang} className="xl:col-span-5" />

      <SessionStrip identity={identity} activeSessions={o.activeSessions} p={p} lang={lang} />
    </div>
  );
}

/** The company lifecycle as one connected rail — each node a real count. */
function Lifecycle({
  overview,
  p,
  className,
}: {
  overview: Overview;
  p: PlatformCopy;
  className?: string;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const c = overview.companies;
  const stages = [
    {
      key: 'onboarding',
      label: p.overview.stages.onboarding,
      value: c.onboarding.IN_PROGRESS,
      color: 'var(--color-ws-operations)',
      href: '?onboardingStatus=IN_PROGRESS',
    },
    {
      key: 'waiting',
      label: p.overview.stages.waiting,
      value: overview.attention.readyToActivate,
      color: 'var(--color-warning)',
      href: '?status=PENDING_SUBSCRIPTION&onboardingStatus=COMPLETED',
    },
    {
      key: 'active',
      label: p.overview.stages.active,
      value: c.byStatus.ACTIVE,
      color: 'var(--color-brand-primary)',
      href: '?status=ACTIVE',
    },
    {
      key: 'suspended',
      label: p.overview.stages.suspended,
      value: c.byStatus.SUSPENDED,
      color: 'var(--color-danger)',
      href: '?status=SUSPENDED',
    },
    {
      key: 'closed',
      label: p.overview.stages.closed,
      value: c.byStatus.CLOSED,
      color: 'var(--color-text-muted)',
      href: '?status=CLOSED',
    },
  ];
  const total = stages.reduce((n, s) => n + s.value, 0);
  const subs = overview.subscriptions;
  return (
    <section
      aria-labelledby="lifecycle-title"
      className={cn(ZONE, 'relative overflow-hidden p-5 sm:p-7', className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.08),transparent_65%)]"
      />
      <SectionTitle
        id="lifecycle-title"
        title={p.overview.lifecycle}
        lead={`${p.overview.lifecycleLead} · ${p.overview.demoNote(c.demo)}`}
      />
      {total === 0 ? (
        <div className="mt-6">
          <StateMessage kind="empty" text={p.overview.noCompanies} />
        </div>
      ) : (
        <>
          <div
            aria-hidden
            className="mt-7 flex h-2.5 [gap:2px] overflow-hidden rounded-full bg-white/[0.04]"
          >
            {stages
              .filter((s) => s.value > 0)
              .map((s) => (
                <span
                  key={s.key}
                  className="block h-full min-w-2"
                  style={{ flexGrow: s.value, backgroundColor: s.color }}
                />
              ))}
          </div>
          <ol className="relative mt-6 grid gap-3 sm:grid-cols-5 sm:gap-2" data-lifecycle>
            <span
              aria-hidden
              className="absolute top-[0.6875rem] right-[10%] left-[10%] hidden h-px bg-white/[0.1] sm:block"
            />
            {stages.map((s) => (
              <li key={s.key} className="relative min-w-0" data-stage={s.key} data-count={s.value}>
                <Link
                  to={`/platform/companies${s.href}`}
                  className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03] motion-reduce:transition-none sm:flex-col sm:items-center sm:text-center"
                >
                  <span
                    aria-hidden
                    className="relative grid size-[1.375rem] shrink-0 place-items-center rounded-full bg-surface-dark shadow-[0_0_0_4px_rgb(9_17_25)]"
                    style={{ boxShadow: `0 0 0 4px rgb(9 17 25), inset 0 0 0 2px ${s.color}` }}
                  >
                    {s.value > 0 && (
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1.5rem] leading-none font-semibold text-text-primary tabular-nums sm:mt-2">
                      {formatCount(s.value, lang)}
                    </span>
                    <span className="mt-1 block text-caption text-text-secondary group-hover:text-text-primary">
                      {s.label}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="mt-7 border-t border-white/[0.06] pt-5">
        <h3 className="text-label font-medium text-text-primary">{p.overview.subscriptions}</h3>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          {(['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const).map((k) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="text-caption text-text-muted">{p.statuses.subscription[k]}</dt>
              <dd className="text-label font-semibold text-text-primary tabular-nums">
                {formatCount(subs[k] ?? 0, lang)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-text-muted">{p.overview.subscriptionsNote}</p>
      </div>
    </section>
  );
}

function Attention({
  overview,
  p,
  className,
}: {
  overview: Overview;
  p: PlatformCopy;
  className?: string;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const a = overview.attention;
  const items: { key: keyof typeof a; href?: string }[] = [
    {
      key: 'readyToActivate',
      href: '/platform/companies?status=PENDING_SUBSCRIPTION&onboardingStatus=COMPLETED',
    },
    { key: 'onboardingIncomplete', href: '/platform/companies?onboardingStatus=IN_PROGRESS' },
    { key: 'suspendedCompanies', href: '/platform/companies?status=SUSPENDED' },
    { key: 'awaitingCompany' },
    { key: 'unverifiedAccounts' },
    { key: 'suspendedAccounts' },
  ];
  const any = items.some((i) => a[i.key] > 0);
  return (
    <section aria-labelledby="attention-title" className={cn(ZONE, 'p-5 sm:p-6', className)}>
      <SectionTitle id="attention-title" title={p.overview.attention} />
      {!any && <p className="mt-3 text-caption text-text-muted">{p.overview.attentionNone}</p>}
      <ul className="mt-4 divide-y divide-white/[0.05]" data-attention>
        {items.map((i) => {
          const n = a[i.key];
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  n > 0
                    ? i.key.startsWith('suspended')
                      ? 'bg-danger'
                      : 'bg-warning'
                    : 'bg-white/[0.12]',
                )}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 text-label',
                  n > 0 ? 'text-text-primary' : 'text-text-muted',
                )}
              >
                {p.overview.attentionItems[i.key]}
              </span>
              <span
                className={cn(
                  'text-label font-semibold tabular-nums',
                  n > 0 ? 'text-text-primary' : 'text-text-muted',
                )}
              >
                {formatCount(n, lang)}
              </span>
              {i.href && <ArrowRight aria-hidden className="size-4 shrink-0 text-text-muted" />}
            </>
          );
          return (
            <li key={i.key} data-attention-item={i.key} data-count={n}>
              {i.href && n > 0 ? (
                <Link
                  to={i.href}
                  className="-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-white/[0.03]"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-11 items-center gap-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Accounts({
  overview,
  users,
  p,
  lang,
  className,
}: {
  overview: Overview;
  users: PlatformUser[];
  p: PlatformCopy;
  lang: string;
  className?: string;
}) {
  const c = useCopy(AUTH_COPY);
  const customers = users.filter((u) => !u.platformRole).slice(0, 6);
  const by = overview.customerAccounts.byStatus;
  return (
    <section aria-labelledby="accounts-title" className={cn(ZONE, 'p-5 sm:p-6', className)}>
      <SectionTitle
        id="accounts-title"
        title={p.overview.accounts}
        lead={p.overview.accountsLead}
      />
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DISABLED'] as const).map((k) => (
          <div key={k} className="min-w-0">
            <dt className="text-caption text-text-muted">{p.overview.accountStatuses[k]}</dt>
            <dd className="text-[1.125rem] font-semibold text-text-primary tabular-nums">
              {formatCount(by[k] ?? 0, lang)}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 text-caption font-medium tracking-wide text-text-secondary uppercase">
        {p.overview.recentAccounts}
      </h3>
      {customers.length ? (
        <ul className="mt-2 divide-y divide-white/[0.05]">
          {customers.map((u) => (
            <li key={u.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <UserRound aria-hidden className="size-4 shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label text-text-primary">
                  {u.fullName ?? u.email}
                </span>
                <span className="block truncate text-caption text-text-muted">
                  {u.fullName ? `${u.email} · ` : ''}
                  {u.company
                    ? `${c.roles[u.company.role]} · ${u.company.name}`
                    : u.signup
                      ? `${p.overview.noCompanyYet} · ${p.overview.statedCompany}: ${u.signup.companyName}`
                      : p.overview.noCompanyYet}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-caption text-text-muted">{p.overview.noEvents}</p>
      )}
    </section>
  );
}

function Operators({
  operators,
  p,
  className,
}: {
  operators: PlatformOperator[];
  p: PlatformCopy;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="operators-title"
      data-owner-only
      className={cn(ZONE, 'p-5 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.18)] sm:p-6', className)}
    >
      <SectionTitle
        id="operators-title"
        title={p.overview.operators}
        aside={<span className="text-caption text-warning">{p.overview.operatorsOwnerOnly}</span>}
      />
      <ul className="mt-4 divide-y divide-white/[0.05]">
        {operators.map((op) => (
          <li key={op.userId} className="flex min-w-0 flex-col gap-0.5 py-2.5">
            <span className="truncate text-label text-text-primary">{op.fullName ?? op.email}</span>
            <span className="flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
              <span className={op.role === 'PLATFORM_OWNER' ? 'text-warning' : 'text-brand-soft'}>
                {p.authority[op.role]}
              </span>
              {op.fullName && <span className="break-all">{op.email}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-text-muted">{p.overview.operatorsNote}</p>
    </section>
  );
}

function Security({
  events,
  p,
  lang,
  className,
}: {
  events: AuthEventRow[];
  p: PlatformCopy;
  lang: string;
  className?: string;
}) {
  const recent = events.slice(0, 8);
  return (
    <section aria-labelledby="security-title" className={cn(ZONE, 'p-5 sm:p-6', className)}>
      <SectionTitle
        id="security-title"
        title={p.overview.security}
        lead={p.overview.securityLead}
      />
      {recent.length ? (
        <ol className="mt-4 space-y-1" data-security>
          {recent.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-lg px-1 py-2"
            >
              <ScrollText aria-hidden className="mt-0.5 size-4 text-text-muted" />
              <div className="min-w-0">
                <p className="text-label text-text-primary">{eventLabel(p, e.type)}</p>
                <p className="flex flex-wrap gap-x-2 text-caption text-text-muted">
                  <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt, lang)}</time>
                  {e.email && <span className="break-all">{e.email}</span>}
                  <code className="font-mono text-[0.6875rem] text-text-muted/80">{e.type}</code>
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-caption text-text-muted">{p.overview.noEvents}</p>
      )}
    </section>
  );
}

/** Level 4: the operator's own session, then devices folded away. */
function SessionStrip({
  identity,
  activeSessions,
  p,
  lang,
}: {
  identity: Identity;
  activeSessions: number;
  p: PlatformCopy;
  lang: string;
}) {
  return (
    <section aria-labelledby="session-title" className="xl:col-span-12">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-white/[0.06] px-5 py-3.5">
        <h2 id="session-title" className="text-label font-medium text-text-secondary">
          {p.overview.session}
        </h2>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-caption">
          <div className="flex gap-2">
            <dt className="text-text-muted">{p.overview.sessionExpires}</dt>
            <dd className="text-text-primary">
              {formatDateTime(identity.session.expiresAt, lang)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-text-muted">{p.overview.stepUp}</dt>
            <dd className="text-text-primary">
              {identity.session.stepUpValidUntil
                ? formatDateTime(identity.session.stepUpValidUntil, lang)
                : p.overview.stepUpNone}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-text-muted">{p.overview.activeSessions}</dt>
            <dd className="text-text-primary tabular-nums">{formatCount(activeSessions, lang)}</dd>
          </div>
        </dl>
      </div>
      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-label text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
          {p.overview.devices}
        </summary>
        <div className="mt-3">
          <SessionsPanel />
        </div>
      </details>
    </section>
  );
}
