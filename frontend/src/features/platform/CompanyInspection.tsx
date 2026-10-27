import { ArrowLeft, Check, Eye, LoaderCircle, MapPin, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { formatDateTime } from '@/features/account/format';
import type { Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { formatPhone } from '@/features/auth/profile';
import { PROFILE_COPY } from '@/features/auth/profileCopy';
import {
  planId,
  platformCompanyApi,
  type DepartmentState,
  type PlatformCompanyDetail,
} from '@/features/company/api';
import { formatNumber, getPlan } from '@/features/pricing/plans';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { PLATFORM_COPY, type PlatformCopy } from './copy';
import {
  companyTone,
  DEPT_COLOR,
  departmentName,
  eventLabel,
  formatDate,
  subscriptionTone,
  useLoad,
  ZONE,
} from './model';
import { LoadErrorMessage, Monogram, Pill, SectionTitle, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform/companies/:companyId — Platform Inspection (EP24.1). A read-only
 * view of one customer company at platform level. It is NOT impersonation:
 * the operator stays signed in as themselves, the band says so on every
 * screen, nothing here acts as the customer, and the visit is audited
 * (PLATFORM_COMPANY_INSPECTED). The only action is the development-only
 * activation, shown where the server actually offers it.
 */

const SECTIONS = [
  'subscription',
  'departments',
  'branches',
  'members',
  'activity',
  'security',
] as const;

export function CompanyInspection({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const { companyId = '' } = useParams();
  const location = useLocation();
  const back = (location.state as { from?: string } | null)?.from ?? '/platform/companies';
  const { state, retry, setState } = useLoad(() => platformCompanyApi.detail(companyId), companyId);
  usePageMeta(
    state.status === 'ready'
      ? `${state.value.company.displayName} · ${p.meta.company}`
      : p.meta.company,
    p.meta.description,
    { index: false },
  );

  return (
    <PlatformShell identity={identity}>
      <InspectionBand identity={identity} back={back} p={p} />
      {state.status === 'loading' ? (
        <div className="mt-8">
          <StateMessage kind="loading" text={p.inspection.loading} />
        </div>
      ) : state.status === 'error' ? (
        <div className="mt-8">
          <LoadErrorMessage error={state.error} p={p} onRetry={retry} />
        </div>
      ) : (
        <Inspection
          d={state.value}
          p={p}
          onActivated={(d) => setState({ status: 'ready', value: d })}
        />
      )}
    </PlatformShell>
  );
}

/** The context band: always first, always explicit — inspection, not impersonation. */
function InspectionBand({
  identity,
  back,
  p,
}: {
  identity: Identity;
  back: string;
  p: PlatformCopy;
}) {
  return (
    <div className="space-y-4">
      <Link
        to={back}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-label text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {p.inspection.back}
      </Link>
      <div
        role="note"
        data-inspection-band
        className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-2xl bg-[linear-gradient(90deg,rgb(90_169_255/0.12),rgb(90_169_255/0.03))] px-4 py-3.5 shadow-[inset_0_0_0_1px_rgb(90_169_255/0.3)] sm:px-5"
      >
        <span className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium tracking-[0.18em] text-[#a9cfff] uppercase">
          <Eye aria-hidden className="size-4" />
          {p.inspection.band}
        </span>
        <p className="min-w-0 flex-1 basis-80 text-caption text-text-secondary">
          {p.inspection.bandText}{' '}
          {identity.platformRole && (
            <span className="text-text-primary">
              {p.inspection.actingAs(p.authority[identity.platformRole])}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function Inspection({
  d,
  p,
  onActivated,
}: {
  d: PlatformCompanyDetail;
  p: PlatformCopy;
  onActivated: (d: PlatformCompanyDetail) => void;
}) {
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const i = p.inspection;
  const current =
    d.subscriptions.find((s) => s.status !== 'CANCELED' && s.status !== 'EXPIRED') ?? null;
  const plan = current ? getPlan(planId(current.plan)) : null;
  const max =
    d.entitlements?.maxDepartments === 'CUSTOM'
      ? i.custom
      : d.entitlements
        ? String(d.entitlements.maxDepartments)
        : '—';

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: i.facts.owner,
      value: d.owner ? (
        <>
          <span className="block truncate text-text-primary">
            {d.owner.fullName ?? d.owner.email}
          </span>
          {d.owner.fullName && (
            <span className="block truncate text-caption text-text-muted">{d.owner.email}</span>
          )}
        </>
      ) : (
        i.notGiven
      ),
    },
    { label: i.facts.package, value: plan?.name ?? p.statuses.none },
    {
      label: i.facts.departments,
      value: <span className="tabular-nums">{i.enabledOf(d.departments.length, max)}</span>,
    },
    { label: i.facts.branches, value: <span className="tabular-nums">{d.branches.length}</span> },
    { label: i.facts.members, value: <span className="tabular-nums">{d.members.length}</span> },
    { label: i.facts.created, value: formatDate(d.company.createdAt, lang) },
  ];

  return (
    <article aria-labelledby="company-title" className="mt-6">
      {/* Identity */}
      <header className={cn(ZONE, 'relative overflow-hidden p-5 sm:p-7')}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 -left-20 size-80 rounded-full bg-[radial-gradient(circle,rgb(90_169_255/0.08),transparent_65%)]"
        />
        <div className="relative flex flex-wrap items-start gap-5">
          <Monogram name={d.company.displayName} size="lg" />
          <div className="min-w-0 flex-1 basis-72">
            <h1
              id="company-title"
              className="text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] leading-tight font-semibold tracking-tight break-words text-text-primary"
            >
              {d.company.displayName}
            </h1>
            <p className="mt-1 text-label text-text-secondary">
              {d.company.legalName ?? i.notGiven}
              {d.company.taxId && (
                <span className="ml-2 text-caption text-text-muted">
                  {i.facts.taxId} <span className="font-mono tabular-nums">{d.company.taxId}</span>
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.company.isDemo && <Pill tone="info">{p.explorer.demo}</Pill>}
              <Pill tone={companyTone(d.company.status)}>
                {p.statuses.company[d.company.status]}
              </Pill>
              <Pill tone={subscriptionTone(current?.status ?? null)}>
                {i.facts.subscription}:{' '}
                {current ? p.statuses.subscription[current.status] : p.statuses.none}
              </Pill>
              <Pill tone={d.company.onboardingStatus === 'COMPLETED' ? 'active' : 'waiting'}>
                {i.facts.onboarding}: {p.statuses.onboarding[d.company.onboardingStatus]}
              </Pill>
              <Pill tone={d.access.canEnterCore ? 'active' : 'muted'}>
                {i.facts.access}: {d.access.canEnterCore ? i.facts.canEnter : i.facts.cannotEnter}
              </Pill>
            </div>
          </div>
        </div>
        <dl
          className="relative mt-6 grid grid-cols-2 [gap:1px] overflow-hidden rounded-2xl bg-white/[0.06] sm:grid-cols-3 xl:grid-cols-6"
          data-facts
        >
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 bg-[rgb(9_17_25)] px-4 py-3.5">
              <dt className="text-caption text-text-muted">{f.label}</dt>
              <dd className="mt-1 min-w-0 text-label font-medium text-text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
        <Timeline d={d} p={p} lang={lang} />
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={i.sections} className="xl:sticky xl:top-6 xl:self-start">
          <ul className="flex flex-wrap gap-2 xl:flex-col xl:gap-1">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a
                  href={`#section-${s}`}
                  className="flex min-h-11 items-center rounded-full bg-white/[0.03] px-4 text-label text-text-secondary hover:bg-white/[0.06] hover:text-text-primary xl:rounded-xl xl:bg-transparent"
                >
                  {i[s]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <SubscriptionSection d={d} p={p} lang={lang} onActivated={onActivated} />
          <DepartmentsSection d={d} p={p} />
          <BranchesSection d={d} p={p} />
          <MembersSection d={d} p={p} lang={lang} />
          <div className="grid gap-6 2xl:grid-cols-2">
            <ActivitySection d={d} p={p} lang={lang} />
            <SecuritySection d={d} p={p} lang={lang} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** The onboarding path, each step dated from the company's own audit trail. */
function Timeline({ d, p, lang }: { d: PlatformCompanyDetail; p: PlatformCopy; lang: string }) {
  const first = (action: string, match?: (details: Record<string, unknown>) => boolean) =>
    [...d.activity].reverse().find((a) => a.action === action && (!match || match(a.details)))
      ?.occurredAt ?? null;
  const t = p.inspection.timelineSteps;
  const steps = [
    { key: 'created', label: t.created, at: first('COMPANY_CREATED') ?? d.company.createdAt },
    { key: 'headOffice', label: t.headOffice, at: first('HEAD_OFFICE_CREATED') },
    {
      key: 'departments',
      label: t.departments,
      at: d.departments.length ? (first('DEPARTMENTS_SELECTED') ?? d.company.createdAt) : null,
    },
    { key: 'subscription', label: t.subscription, at: first('SUBSCRIPTION_CREATED') },
    {
      key: 'completed',
      label: t.completed,
      at:
        d.company.onboardingStatus === 'COMPLETED'
          ? (first('COMPANY_ONBOARDING_COMPLETED') ?? d.company.createdAt)
          : null,
    },
    {
      key: 'activated',
      label: t.activated,
      at: d.company.activatedAt ?? first('SUBSCRIPTION_STATUS_CHANGED', (x) => x.to === 'ACTIVE'),
    },
  ];
  return (
    <div className="relative mt-6">
      <h2 className="text-caption font-medium tracking-wide text-text-secondary uppercase">
        {p.inspection.timeline}
      </h2>
      <ol className="relative mt-4 grid gap-3 md:grid-cols-6 md:gap-2" data-timeline>
        <span
          aria-hidden
          className="absolute top-[0.5625rem] right-[8%] left-[8%] hidden h-px bg-white/[0.1] md:block"
        />
        {steps.map((s) => (
          <li
            key={s.key}
            data-step={s.key}
            data-done={!!s.at}
            className="relative flex items-start gap-3 md:flex-col md:items-center md:text-center"
          >
            <span
              aria-hidden
              className={cn(
                'relative grid size-[1.125rem] shrink-0 place-items-center rounded-full shadow-[0_0_0_4px_rgb(9_17_25)]',
                s.at
                  ? 'bg-brand-primary text-text-inverse'
                  : 'bg-surface-dark shadow-[0_0_0_4px_rgb(9_17_25),inset_0_0_0_1.5px_rgb(190_235_222/0.25)]',
              )}
            >
              {s.at && <Check className="size-3" />}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-caption font-medium',
                  s.at ? 'text-text-primary' : 'text-text-muted',
                )}
              >
                {s.label}
              </span>
              <span className="block text-[0.75rem] text-text-muted">
                {s.at ? <time dateTime={s.at}>{formatDate(s.at, lang)}</time> : p.inspection.notYet}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({
  id,
  title,
  lead,
  children,
  aside,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      aria-labelledby={`${id}-title`}
      className={cn(ZONE, 'scroll-mt-6 p-5 sm:p-6')}
    >
      <SectionTitle id={`${id}-title`} title={title} lead={lead} aside={aside} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SubscriptionSection({
  d,
  p,
  lang,
  onActivated,
}: {
  d: PlatformCompanyDetail;
  p: PlatformCopy;
  lang: string;
  onActivated: (d: PlatformCompanyDetail) => void;
}) {
  const i = p.inspection;
  const current =
    d.subscriptions.find((s) => s.status !== 'CANCELED' && s.status !== 'EXPIRED') ?? null;
  const e = d.entitlements;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const canActivate =
    d.developmentActivation &&
    current?.status === 'PENDING' &&
    d.company.status === 'PENDING_SUBSCRIPTION' &&
    d.company.onboardingStatus === 'COMPLETED';

  const activate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      onActivated(await platformCompanyApi.activateForDevelopment(d.company.id));
      setMessage({ tone: 'success', text: i.devActivated });
    } catch (err) {
      setMessage({
        tone: 'error',
        text:
          err instanceof ApiError && err.code === 'STEP_UP_REQUIRED' ? i.devStepUp : i.devFailed,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!current || !e) {
    return (
      <Section id="subscription" title={i.subscription}>
        <StateMessage kind="empty" text={i.noSubscription} />
      </Section>
    );
  }
  const price =
    current.monthlyPriceThb === null
      ? i.quotation
      : i.perMonth(formatNumber(current.monthlyPriceThb));
  const rows: [string, ReactNode][] = [
    [i.plan, getPlan(planId(current.plan)).name],
    [
      i.status,
      <Pill key="s" tone={subscriptionTone(current.status)}>
        {p.statuses.subscription[current.status]}
      </Pill>,
    ],
    [i.billingCycle, p.statuses.billing[current.billingCycle]],
    [i.catalogPrice, price],
    [i.catalogVersion, `v${current.catalogVersion}`],
    [i.activatedAt, current.activatedAt ? formatDateTime(current.activatedAt, lang) : i.notYet],
    [
      i.period,
      current.currentPeriodStart && current.currentPeriodEnd
        ? `${formatDate(current.currentPeriodStart, lang)} – ${formatDate(current.currentPeriodEnd, lang)}`
        : i.notYet,
    ],
  ];
  const ent: [string, ReactNode][] = [
    [
      i.departments,
      i.enabledOf(
        d.departments.length,
        e.maxDepartments === 'CUSTOM' ? i.custom : String(e.maxDepartments),
      ),
    ],
    [i.storage, e.storage === 'CUSTOM' ? i.custom : `${e.storage.gb} GB`],
    [i.api, i.apiValues[e.api]],
    [i.executive, e.executiveAllowed ? i.allowed : i.notAllowed],
  ];
  return (
    <Section id="subscription" title={i.subscription} lead={i.subscriptionLead}>
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-label sm:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] sm:gap-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-muted">{k}</dt>
              <dd className="mb-2 min-w-0 text-text-primary sm:mb-0">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-2xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]">
          <h3 className="text-label font-medium text-text-primary">{i.entitlements}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {ent.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-caption text-text-muted">{k}</dt>
                <dd className="text-label font-semibold text-text-primary tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3 text-caption text-text-secondary">
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-soft" />
              {i.allBranches}
            </li>
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-soft" />
              {i.fefo}
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-2 text-caption text-text-muted">
        <ShieldAlert aria-hidden className="size-4 shrink-0" />
        {i.noPayment}
      </p>
      {d.subscriptions.length > 1 && (
        <div className="mt-5">
          <h3 className="text-caption font-medium tracking-wide text-text-secondary uppercase">
            {i.history}
          </h3>
          <ul className="mt-2 divide-y divide-white/[0.05] text-caption">
            {d.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="text-text-primary">{getPlan(planId(s.plan)).name}</span>
                <Pill tone={subscriptionTone(s.status)}>{p.statuses.subscription[s.status]}</Pill>
                <time dateTime={s.createdAt} className="text-text-muted">
                  {formatDate(s.createdAt, lang)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
      {canActivate && (
        <div
          className="mt-6 rounded-2xl border border-warning/25 bg-warning/[0.04] p-4"
          data-dev-activation
        >
          <p className="text-caption text-text-secondary">{i.devActivateNote}</p>
          <button
            type="button"
            onClick={() => void activate()}
            disabled={busy}
            className={cn(buttonClasses('secondary', 'md'), 'mt-3')}
          >
            {busy && (
              <LoaderCircle
                aria-hidden
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {busy ? i.devActivating : i.devActivate}
          </button>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </Section>
  );
}

const STATE_TONE: Record<DepartmentState, string> = {
  ENABLED: 'text-brand-soft',
  NOT_ENABLED: 'text-text-muted',
  NOT_IN_PACKAGE: 'text-text-muted/80',
};

function DepartmentsSection({ d, p }: { d: PlatformCompanyDetail; p: PlatformCopy }) {
  const { locale } = useLocale();
  const i = p.inspection;
  return (
    <Section id="departments" title={i.departments} lead={i.departmentsLead}>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-departments>
        {d.departmentStates.map(({ code, state }) => (
          <li
            key={code}
            data-dept={code}
            data-state={state}
            className={cn(
              'relative min-w-0 overflow-hidden rounded-2xl p-4',
              state === 'ENABLED'
                ? 'bg-white/[0.035] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]'
                : 'bg-transparent shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)]',
            )}
          >
            {state === 'ENABLED' && (
              <span
                aria-hidden
                className="absolute inset-y-3 left-0 w-[3px] rounded-r-full"
                style={{ backgroundColor: DEPT_COLOR[code] }}
              />
            )}
            <p
              className={cn(
                'text-label font-medium',
                state === 'ENABLED' ? 'text-text-primary' : 'text-text-secondary',
              )}
            >
              {departmentName(code, locale)}
            </p>
            <p className={cn('mt-1 text-caption', STATE_TONE[state])}>
              {i.departmentStates[state]}
            </p>
            {code === 'WAREHOUSE' && (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-text-muted">
                {i.warehousePrivacy}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BranchesSection({ d, p }: { d: PlatformCompanyDetail; p: PlatformCopy }) {
  const i = p.inspection;
  return (
    <Section
      id="branches"
      title={i.branches}
      lead={i.branchesLead}
      aside={
        d.branches.length === 1 ? (
          <span className="text-caption text-text-muted">{i.onlyHeadOffice}</span>
        ) : undefined
      }
    >
      <ul className="grid gap-3 lg:grid-cols-2">
        {d.branches.map((b) => (
          <li
            key={b.id}
            className="flex min-w-0 gap-3 rounded-2xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]"
          >
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-caption text-brand-soft tabular-nums">
                  {b.code}
                </span>
                <span className="text-label font-medium break-words text-text-primary">
                  {b.name}
                </span>
                <Pill tone={b.type === 'HEAD_OFFICE' ? 'active' : 'muted'}>
                  {b.type === 'HEAD_OFFICE' ? i.headOffice : i.branch}
                </Pill>
              </p>
              <p className="mt-1.5 text-caption break-words text-text-secondary">
                {[
                  b.address.line1,
                  b.address.line2,
                  b.address.subdistrict,
                  b.address.district,
                  b.address.province,
                  b.address.postalCode,
                  b.address.countryCode,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {b.phone && <p className="mt-1 text-caption text-text-muted">{b.phone}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MembersSection({
  d,
  p,
  lang,
}: {
  d: PlatformCompanyDetail;
  p: PlatformCopy;
  lang: string;
}) {
  const a = useCopy(AUTH_COPY);
  const pr = useCopy(PROFILE_COPY);
  const i = p.inspection;
  const h = i.memberColumns;
  return (
    <Section id="members" title={i.members} lead={i.membersLead}>
      {d.members.length === 0 ? (
        <StateMessage kind="empty" text={i.noMembers} />
      ) : (
        <ul className="divide-y divide-white/[0.05]" data-members>
          {d.members.map((m) => (
            <li
              key={m.email}
              className="grid gap-x-5 gap-y-1 py-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-label font-medium text-text-primary">
                  {m.fullName ?? m.email}
                </p>
                {m.fullName && <p className="truncate text-caption text-text-muted">{m.email}</p>}
              </div>
              <p className="text-caption text-text-secondary">
                <span className="text-text-muted md:sr-only">{h.role}: </span>
                <span
                  className={m.role === 'COMPANY_OWNER' ? 'text-brand-soft' : 'text-text-primary'}
                >
                  {a.roles[m.role]}
                </span>
                <span className="block text-text-muted">
                  {h.jobFunction}: {m.jobFunction ? pr.jobFunctions[m.jobFunction] : i.notGiven}
                </span>
              </p>
              <p className="text-caption text-text-secondary">
                <span className="text-text-muted">{h.status}: </span>
                {p.overview.accountStatuses[m.status as keyof typeof p.overview.accountStatuses] ??
                  m.status}
                <span className="block text-text-muted">
                  {h.joined} <time dateTime={m.joinedAt}>{formatDate(m.joinedAt, lang)}</time>
                </span>
              </p>
              <p className="text-caption text-text-muted">
                {h.lastLogin}{' '}
                {m.lastLoginAt ? (
                  <time dateTime={m.lastLoginAt}>{formatDateTime(m.lastLoginAt, lang)}</time>
                ) : (
                  i.never
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {d.owner?.phone && (
        <p className="mt-4 text-caption text-text-muted">
          {i.facts.phone}:{' '}
          <span className="text-text-secondary tabular-nums">{formatPhone(d.owner.phone)}</span>
        </p>
      )}
      <SignupContextPanel signup={d.owner?.signup ?? null} p={p} />
    </Section>
  );
}

function ActivitySection({
  d,
  p,
  lang,
}: {
  d: PlatformCompanyDetail;
  p: PlatformCopy;
  lang: string;
}) {
  const i = p.inspection;
  return (
    <Section id="activity" title={i.activity} lead={i.activityLead}>
      {d.activity.length === 0 ? (
        <StateMessage kind="empty" text={i.noActivity} />
      ) : (
        <ol className="relative space-y-0.5 pl-5" data-activity>
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[0.3125rem] w-px bg-white/[0.08]"
          />
          {d.activity.map((a) => {
            const platform = a.actorScope === 'platform_owner' || a.actorScope === 'platform_admin';
            return (
              <li key={a.id} className="relative py-2">
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-[0.9rem] -left-5 size-2.5 rounded-full shadow-[0_0_0_3px_rgb(9_17_25)]',
                    platform ? 'bg-brand-cool' : 'bg-brand-primary',
                  )}
                />
                <p className="text-label text-text-primary">{eventLabel(p, a.action)}</p>
                <p className="flex flex-wrap gap-x-2 text-caption text-text-muted">
                  <time dateTime={a.occurredAt}>{formatDateTime(a.occurredAt, lang)}</time>
                  <span>
                    {i.by} {i.actorScopes[a.actorScope ?? 'unknown']}
                    {a.actor && ` · ${a.actor.fullName ?? a.actor.email}`}
                  </span>
                  <code className="font-mono text-[0.6875rem] text-text-muted/80">{a.action}</code>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function SecuritySection({
  d,
  p,
  lang,
}: {
  d: PlatformCompanyDetail;
  p: PlatformCopy;
  lang: string;
}) {
  const i = p.inspection;
  return (
    <Section id="security" title={i.security} lead={i.securityLead}>
      {d.security.length === 0 ? (
        <StateMessage kind="empty" text={i.noSecurity} />
      ) : (
        <ol className="space-y-0.5" data-member-security>
          {d.security.map((e) => (
            <li key={e.id} className="rounded-lg py-2">
              <p className="text-label text-text-primary">{eventLabel(p, e.type)}</p>
              <p className="flex flex-wrap gap-x-2 text-caption text-text-muted">
                <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt, lang)}</time>
                {e.email && <span className="break-all">{e.email}</span>}
                <code className="font-mono text-[0.6875rem] text-text-muted/80">{e.type}</code>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** The owner's sign-up context: what they said, kept visibly apart from verified company data. */
function SignupContextPanel({
  signup,
  p,
}: {
  signup: NonNullable<PlatformCompanyDetail['owner']>['signup'];
  p: PlatformCopy;
}) {
  const pr = useCopy(PROFILE_COPY);
  const i = p.inspection;
  const f = i.signupFields;
  return (
    <section
      aria-labelledby="signup-title"
      className="mt-6 rounded-2xl bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:p-5"
      data-signup-context
    >
      <h3 id="signup-title" className="text-label font-medium text-text-primary">
        {i.signup}
      </h3>
      <p className="mt-1 text-caption text-text-muted">{i.signupLead}</p>
      {signup ? (
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-label sm:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-caption text-text-muted">{f.companyName}</dt>
            <dd className="break-words text-text-primary">{signup.companyName}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-muted">{f.industry}</dt>
            <dd className="text-text-primary">{pr.business.industries[signup.industry]}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-muted">{f.teamSize}</dt>
            <dd className="text-text-primary">{pr.business.teamSizes[signup.teamSize]}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-caption text-text-muted">{f.contact}</dt>
            <dd className="break-words text-text-primary">
              {pr.business.contacts[signup.preferredContact]}
              {signup.lineId && <span className="text-text-secondary"> · {signup.lineId}</span>}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-caption text-text-muted">{f.interests}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {signup.interests.length
                ? signup.interests.map((x) => (
                    <Pill key={x} tone="muted">
                      {pr.business.interestOptions[x]}
                    </Pill>
                  ))
                : '—'}
            </dd>
          </div>
          {signup.note && (
            <div className="min-w-0 sm:col-span-2 xl:col-span-3">
              <dt className="text-caption text-text-muted">{f.note}</dt>
              <dd className="mt-1 break-words whitespace-pre-line text-text-secondary">
                {signup.note}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-caption text-text-muted">{i.noSignup}</p>
      )}
    </section>
  );
}
