import { ArrowRight, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  platformApi,
  type ActivityItem,
  type Identity,
  type PlatformOverview as Overview,
} from '@/features/auth/api';
import { formatDateTime } from '@/features/account/format';
import { SessionsPanel } from '@/features/account/SessionsPanel';
import { planId, platformCompanyApi, type PlatformCompanyRow } from '@/features/company/api';
import { getPlan } from '@/features/pricing/plans';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { ActivityList } from './ActivityList';
import { PLATFORM_COPY, type PlatformCopy } from './copy';
import {
  ATTENTION_RULES,
  attentionTotal,
  companyTone,
  formatCount,
  KEY_ACTIVITY,
  useLoad,
} from './model';
import { PLATFORM_OPS_COPY, type OpsCopy } from './opsCopy';
import { DepartmentTrack, LoadErrorMessage, Pill, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform — the operator-first overview (EP24.1.2). It answers, top down:
 *   1. real customers: companies, active, pending, suspended, accounts —
 *      with demo data and the platform team counted separately beside them;
 *   2. where customers stand on their path, and what needs attention now;
 *   3. the latest real customer companies (demo never appears as a customer);
 *   4. key activity, the isolated demo environment, accounts and operators;
 *   5. the operator's own session, folded away.
 * Every figure is a count of real rows decided on the server (isDemo, platform
 * roles) — no revenue, growth or scores.
 */

interface Data {
  overview: Overview;
  customers: PlatformCompanyRow[];
  demo: PlatformCompanyRow[];
  activity: ActivityItem[];
}

export function PlatformOverview({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const o = useCopy(PLATFORM_OPS_COPY);
  usePageMeta(p.meta.overview, p.meta.description, { index: false });
  const { state, retry } = useLoad<Data>(async () => {
    const [overview, customers, demo, activity] = await Promise.all([
      platformApi.overview(),
      platformCompanyApi.list({ demo: 'exclude', limit: 5 }),
      platformCompanyApi.list({ demo: 'only', limit: 3 }),
      platformApi.activity(40),
    ]);
    return {
      overview,
      customers: customers.companies,
      demo: demo.companies,
      activity: activity.items.filter((i) => KEY_ACTIVITY.has(i.type)).slice(0, 8),
    };
  }, identity.user.id);
  const owner = identity.platformRole === 'PLATFORM_OWNER';

  return (
    <PlatformShell
      identity={identity}
      attention={
        state.status === 'ready' ? attentionTotal(state.value.overview.attention) : undefined
      }
    >
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] leading-tight font-semibold tracking-tight text-text-primary">
            {o.overview.title}
          </h1>
          <p className="mt-1 text-label text-text-secondary">{o.overview.lead}</p>
        </div>
        {identity.platformRole && (
          <p className="text-caption text-text-muted">
            <span className={owner ? 'text-warning' : 'text-brand-soft'}>
              {p.authority[identity.platformRole]}
            </span>{' '}
            · {owner ? p.authority.ownerLine : p.authority.adminLine}
          </p>
        )}
      </header>

      {state.status === 'error' ? (
        <div className="mt-6">
          <LoadErrorMessage error={state.error} p={p} onRetry={retry} />
        </div>
      ) : state.status === 'loading' ? (
        <div className="mt-6">
          <StateMessage kind="loading" text={p.explorer.loading} />
        </div>
      ) : (
        <Body data={state.value} identity={identity} owner={owner} p={p} o={o} />
      )}
    </PlatformShell>
  );
}

function Body({
  data,
  identity,
  owner,
  p,
  o,
}: {
  data: Data;
  identity: Identity;
  owner: boolean;
  p: PlatformCopy;
  o: OpsCopy;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  return (
    <>
      <CustomerBand overview={data.overview} o={o} lang={lang} />
      {/* Two independent stacks on wide screens; on phones one column in priority order:
          attention → customers → demo → activity → accounts (display: contents + order). */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <div className="contents xl:flex xl:flex-col xl:gap-6">
          <LatestCustomers rows={data.customers} p={p} o={o} className="order-2" />
          <KeyActivity items={data.activity} p={p} o={o} lang={lang} className="order-4" />
        </div>
        <div className="contents xl:flex xl:flex-col xl:gap-6">
          <Attention overview={data.overview} p={p} o={o} lang={lang} className="order-1" />
          <DemoEnvironment rows={data.demo} p={p} o={o} className="order-3" />
          <People
            overview={data.overview}
            owner={owner}
            p={p}
            o={o}
            lang={lang}
            className="order-5"
          />
        </div>
      </div>
      <SessionFold
        identity={identity}
        activeSessions={data.overview.activeSessions}
        p={p}
        o={o}
        lang={lang}
      />
    </>
  );
}

const explorer = (q: string) => `/platform/companies?demo=exclude${q}`;

/** Level 1: real customers, with demo and platform counted separately beside them. */
function CustomerBand({ overview, o, lang }: { overview: Overview; o: OpsCopy; lang: string }) {
  const c = overview.companies;
  const m = o.overview.metrics;
  const metrics = [
    { key: 'companies', label: m.companies, value: c.customer, href: explorer(''), lead: true },
    { key: 'active', label: m.active, value: c.byStatus.ACTIVE, href: explorer('&status=ACTIVE') },
    {
      key: 'pending',
      label: m.pending,
      value: c.byStatus.PENDING_SUBSCRIPTION,
      href: explorer('&status=PENDING_SUBSCRIPTION'),
    },
    {
      key: 'suspended',
      label: m.suspended,
      value: c.byStatus.SUSPENDED,
      href: explorer('&status=SUSPENDED'),
    },
    { key: 'accounts', label: m.accounts, value: overview.customerAccounts.total, href: null },
  ];
  return (
    <section
      aria-labelledby="customers-title"
      data-customer-band
      className="mt-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,rgb(12_26_34/0.95),rgb(7_14_21/0.97))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.14)]"
    >
      <div className="grid xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              id="customers-title"
              className="text-label font-semibold tracking-wide text-brand-soft uppercase"
            >
              {o.overview.customers}
            </h2>
            <p className="text-caption text-text-muted">{o.overview.customersNote}</p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.06] sm:grid-cols-5">
            {metrics.map((x) => {
              const body = (
                <>
                  <span className="block text-caption text-text-muted">{x.label}</span>
                  <span
                    className={cn(
                      'mt-1 block leading-none font-semibold text-text-primary tabular-nums',
                      x.lead ? 'text-[2.5rem]' : 'text-[1.875rem]',
                    )}
                  >
                    {formatCount(x.value, lang)}
                  </span>
                </>
              );
              return (
                <li
                  key={x.key}
                  data-metric={x.key}
                  data-count={x.value}
                  className={cn('min-w-0 bg-[rgb(8_17_25)]', x.lead && 'col-span-2 sm:col-span-1')}
                >
                  {x.href ? (
                    <Link
                      to={x.href}
                      className="block h-full px-4 py-4 transition-colors hover:bg-white/[0.03] motion-reduce:transition-none sm:px-5"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-4 py-4 sm:px-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <Path overview={overview} o={o} lang={lang} />
        </div>
        <aside
          aria-label={o.overview.separate}
          data-separate
          className="border-t border-white/[0.06] bg-white/[0.015] p-5 sm:p-6 xl:border-t-0 xl:border-l"
        >
          <p className="text-caption font-medium tracking-wide text-text-muted uppercase">
            {o.overview.separate}
          </p>
          <ul className="mt-4 space-y-3 text-label">
            <li data-separate-demo className="flex items-center gap-2.5 text-text-secondary">
              <FlaskConical aria-hidden className="size-4 shrink-0 text-[#a9cfff]" />
              {o.overview.demoLine(overview.companies.demo, overview.demoAccounts)}
            </li>
            <li data-separate-operators className="flex items-center gap-2.5 text-text-secondary">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
              {o.overview.operatorsLine(
                overview.operators.PLATFORM_OWNER,
                overview.operators.PLATFORM_ADMIN,
              )}
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

/** The customer path as one compact strip — real counts, or a short line when nobody has signed up. */
function Path({ overview, o, lang }: { overview: Overview; o: OpsCopy; lang: string }) {
  const c = overview.companies;
  const s = o.overview.stages;
  const stages = [
    {
      key: 'registered',
      label: s.registered,
      value: overview.attention.awaitingCompany,
      href: null,
    },
    {
      key: 'setup',
      label: s.setup,
      value: c.onboarding.IN_PROGRESS,
      href: explorer('&onboardingStatus=IN_PROGRESS'),
    },
    {
      key: 'pending',
      label: s.pending,
      value: overview.attention.readyToActivate,
      href: explorer('&status=PENDING_SUBSCRIPTION&onboardingStatus=COMPLETED'),
    },
    { key: 'active', label: s.active, value: c.byStatus.ACTIVE, href: explorer('&status=ACTIVE') },
    {
      key: 'suspended',
      label: s.suspended,
      value: c.byStatus.SUSPENDED,
      href: explorer('&status=SUSPENDED'),
    },
  ];
  const any = stages.some((x) => x.value > 0);
  return (
    <div className="mt-5">
      <h3 className="text-caption font-medium text-text-muted">{o.overview.lifecycle}</h3>
      {any ? (
        <ol data-path className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2">
          {stages.map((x, i) => {
            const inner = (
              <>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    x.value ? 'text-text-primary' : 'text-text-muted',
                  )}
                >
                  {formatCount(x.value, lang)}
                </span>
                <span className={x.value ? 'text-text-secondary' : 'text-text-muted'}>
                  {x.label}
                </span>
              </>
            );
            return (
              <li
                key={x.key}
                data-stage={x.key}
                data-count={x.value}
                className="flex items-center gap-1"
              >
                {x.href && x.value > 0 ? (
                  <Link
                    to={x.href}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-caption hover:bg-white/[0.04]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-1.5 px-2.5 text-caption">
                    {inner}
                  </span>
                )}
                {i < stages.length - 1 && (
                  <ChevronRight aria-hidden className="size-3.5 text-text-muted/60" />
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p data-path-empty className="mt-1.5 text-caption text-text-muted">
          {o.overview.lifecycleEmpty}
        </p>
      )}
    </div>
  );
}

const ZONE_LINE =
  'min-w-0 rounded-[1.375rem] bg-[rgb(8_16_24/0.7)] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]';

function ZoneHead({
  id,
  title,
  lead,
  aside,
}: {
  id: string;
  title: string;
  lead?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-white/[0.06] px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 id={id} className="text-body font-semibold text-text-primary">
          {title}
        </h2>
        {lead && <p className="mt-0.5 text-caption text-text-muted">{lead}</p>}
      </div>
      {aside}
    </div>
  );
}

function LatestCustomers({
  rows,
  p,
  o,
  className,
}: {
  rows: PlatformCompanyRow[];
  p: PlatformCopy;
  o: OpsCopy;
  className?: string;
}) {
  const { locale } = useLocale();
  const v = o.overview;
  return (
    <section aria-labelledby="latest-title" className={cn(ZONE_LINE, className)} data-latest>
      <ZoneHead
        id="latest-title"
        title={v.latest}
        lead={v.latestLead}
        aside={
          <Link
            to={explorer('')}
            className="inline-flex min-h-11 items-center gap-2 text-label text-brand-soft hover:underline"
          >
            {v.openExplorer}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="p-5 sm:p-6">
          <StateMessage kind="empty" title={v.latestEmptyTitle} text={v.latestEmptyText} />
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.05]">
          {rows.map((r) => {
            const plan = r.plan ? getPlan(planId(r.plan)) : null;
            const max =
              r.maxDepartments === 'CUSTOM' ? p.inspection.custom : (r.maxDepartments ?? '—');
            return (
              <li key={r.id} className="min-w-0" data-latest-row={r.id}>
                <Link
                  to={`/platform/companies/${encodeURIComponent(r.id)}`}
                  className="grid gap-x-5 gap-y-2 px-5 py-3.5 transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] motion-reduce:transition-none sm:px-6 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_1.25rem] md:items-center"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-label font-semibold text-text-primary">
                      {r.name}
                    </span>
                    <span className="block truncate text-caption text-text-muted">
                      {r.ownerName ? `${r.ownerName} · ` : ''}
                      {r.owner ?? p.explorer.noOwner}
                    </span>
                  </span>
                  <span className="text-caption text-text-secondary">
                    <span className="sr-only">{v.columns.package}: </span>
                    {plan?.name ?? p.statuses.none}
                    <span className="block text-text-muted">{v.members(r.members)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Pill tone={companyTone(r.status)}>{p.statuses.company[r.status]}</Pill>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <DepartmentTrack
                      enabled={r.enabledDepartments}
                      notInPackage={plan && !plan.executiveAccess ? ['EXECUTIVE'] : []}
                      locale={locale}
                      label={v.columns.departments}
                    />
                    <span className="text-caption text-text-muted tabular-nums">
                      {r.departments} / {max}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-text-muted max-md:hidden" />
                  <span className="sr-only">{v.open}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Attention({
  overview,
  p,
  o,
  lang,
  className,
}: {
  overview: Overview;
  p: PlatformCopy;
  o: OpsCopy;
  lang: string;
  className?: string;
}) {
  const a = overview.attention;
  const open = ATTENTION_RULES.filter((r) => a[r.key] > 0);
  return (
    <section
      id="attention"
      aria-labelledby="attention-title"
      data-attention
      className={cn(
        ZONE_LINE,
        'scroll-mt-6',
        open.some((r) => r.counted) && 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.28)]',
        className,
      )}
    >
      <ZoneHead id="attention-title" title={o.overview.attention} />
      {open.length === 0 ? (
        <p
          data-attention-none
          className="flex items-center gap-2.5 px-5 py-4 text-label text-text-secondary sm:px-6"
        >
          <span aria-hidden className="size-2 rounded-full bg-brand-primary" />
          {o.overview.attentionNone}
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {open.map((r) => {
            const n = a[r.key];
            const inner = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    !r.counted
                      ? 'bg-text-muted'
                      : r.key.startsWith('suspended')
                        ? 'bg-danger'
                        : 'bg-warning',
                  )}
                />
                <span className="min-w-0 flex-1 text-label text-text-primary">
                  {p.overview.attentionItems[r.key]}
                </span>
                <span className="text-body font-semibold text-text-primary tabular-nums">
                  {formatCount(n, lang)}
                </span>
                {r.href && <ArrowRight aria-hidden className="size-4 shrink-0 text-text-muted" />}
              </>
            );
            return (
              <li key={r.key} data-attention-item={r.key} data-count={n}>
                {r.href ? (
                  <Link
                    to={r.href}
                    className="flex min-h-12 items-center gap-3 px-5 hover:bg-white/[0.03] sm:px-6"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 px-5 sm:px-6">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function KeyActivity({
  items,
  p,
  o,
  lang,
  className,
}: {
  items: ActivityItem[];
  p: PlatformCopy;
  o: OpsCopy;
  lang: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="activity-title"
      className={cn(ZONE_LINE, className)}
      data-key-activity
    >
      <ZoneHead
        id="activity-title"
        title={o.overview.activity}
        aside={
          <Link
            to="/platform/activity"
            className="inline-flex min-h-11 items-center gap-2 text-label text-brand-soft hover:underline"
          >
            {o.overview.activityAll}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="px-5 py-4 text-caption text-text-muted sm:px-6">{o.overview.activityEmpty}</p>
      ) : (
        <ActivityList items={items} p={p} o={o} lang={lang} />
      )}
    </section>
  );
}

/** The demo environment, visibly apart from customers. */
function DemoEnvironment({
  rows,
  p,
  o,
  className,
}: {
  rows: PlatformCompanyRow[];
  p: PlatformCopy;
  o: OpsCopy;
  className?: string;
}) {
  const v = o.overview;
  return (
    <section
      aria-labelledby="demo-title"
      data-demo-environment
      className={cn(
        'min-w-0 overflow-hidden rounded-[1.375rem] bg-[rgb(9_17_28/0.75)] shadow-[inset_0_0_0_1px_rgb(90_169_255/0.22)]',
        className,
      )}
    >
      <div
        aria-hidden
        className="h-1.5 [background-image:repeating-linear-gradient(135deg,rgb(90_169_255/0.35)_0_6px,transparent_6px_12px)]"
      />
      <div className="px-5 pt-4 pb-1 sm:px-6">
        <div className="flex items-center gap-2.5">
          <h2 id="demo-title" className="text-body font-semibold text-text-primary">
            {v.demo}
          </h2>
          <span className="rounded-md bg-brand-cool/[0.14] px-1.5 py-0.5 font-mono text-[0.625rem] tracking-[0.12em] text-[#a9cfff] uppercase">
            {v.demoTag}
          </span>
        </div>
        <p className="mt-1 text-caption text-text-muted">{v.demoLead}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-caption text-text-muted sm:px-6">{v.demoNone}</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.05]">
          {rows.map((r) => (
            <li
              key={r.id}
              data-demo-row={r.id}
              className="flex min-w-0 items-center gap-3 px-5 py-3 sm:px-6"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label font-medium text-text-primary">
                  {r.name}
                </span>
                <span className="block text-caption text-text-muted">
                  {r.plan ? getPlan(planId(r.plan)).name : p.statuses.none} ·{' '}
                  {v.demoDepartments(r.departments)} · {v.demoAccounts(r.members)}
                </span>
              </span>
              <Link
                to={`/platform/companies/${encodeURIComponent(r.id)}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-caption text-[#a9cfff] hover:bg-white/[0.04]"
              >
                {v.inspect}
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function People({
  overview,
  owner,
  p,
  o,
  lang,
  className,
}: {
  overview: Overview;
  owner: boolean;
  p: PlatformCopy;
  o: OpsCopy;
  lang: string;
  className?: string;
}) {
  const v = o.overview;
  const by = overview.customerAccounts.byStatus;
  return (
    <section aria-labelledby="people-title" className={cn(ZONE_LINE, className)} data-people>
      <ZoneHead id="people-title" title={v.people} />
      <ul className="divide-y divide-white/[0.05] text-label">
        <li className="px-5 py-3 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-text-secondary">{v.customerAccounts}</span>
            <span className="font-semibold text-text-primary tabular-nums">
              {formatCount(overview.customerAccounts.total, lang)}
            </span>
          </div>
          <p className="mt-1 text-caption text-text-muted">
            {(['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'] as const)
              .map((k) => `${p.overview.accountStatuses[k]} ${formatCount(by[k] ?? 0, lang)}`)
              .join(' · ')}
          </p>
        </li>
        <li className="flex items-baseline justify-between gap-3 px-5 py-3 sm:px-6">
          <span className="text-text-secondary">{v.demoAccountsLabel}</span>
          <span className="font-semibold text-[#a9cfff] tabular-nums">
            {formatCount(overview.demoAccounts, lang)}
          </span>
        </li>
        <li className="px-5 py-3 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-text-secondary">{v.operators}</span>
            <span className="text-caption text-text-secondary">
              <span className="text-warning">Owner {overview.operators.PLATFORM_OWNER}</span> ·{' '}
              <span className="text-brand-soft">Admin {overview.operators.PLATFORM_ADMIN}</span>
            </span>
          </div>
          {owner && (
            <Link
              to="/platform/operators"
              className="mt-1 inline-flex min-h-10 items-center gap-1.5 text-caption text-brand-soft hover:underline"
            >
              {v.manageOperators}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </li>
      </ul>
    </section>
  );
}

/** The operator's own session and devices — folded by default. */
function SessionFold({
  identity,
  activeSessions,
  p,
  o,
  lang,
}: {
  identity: Identity;
  activeSessions: number;
  p: PlatformCopy;
  o: OpsCopy;
  lang: string;
}) {
  return (
    <details className="group mt-8" data-session>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-label text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
        {o.overview.session}
      </summary>
      <div className="mt-3 space-y-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-1 rounded-2xl border border-white/[0.06] px-5 py-3.5 text-caption">
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
        <SessionsPanel />
      </div>
    </details>
  );
}
