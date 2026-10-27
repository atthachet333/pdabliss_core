import { Building2, ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router';
import { planId, type PlatformCompanyRow } from '@/features/company/api';
import { getPlan } from '@/features/pricing/plans';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { PLATFORM_COPY } from './copy';
import { companyTone, formatDate, subscriptionTone } from './model';
import { DepartmentTrack, Monogram, Pill } from './parts';

/*
 * One company in the Explorer (EP24.1): identity, package + subscription,
 * lifecycle, the department track, footprint and dates — and the whole row
 * is the "inspect" link (one tab stop, keyboard-operable, a visible focus
 * ring). On a phone the same facts stack; on a wide screen they align in
 * columns that `CompanyColumns` labels.
 */

export const ROW_GRID =
  'lg:grid lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1fr)_1.5rem] lg:items-center lg:gap-x-5';

export function CompanyRow({ row, state }: { row: PlatformCompanyRow; state?: unknown }) {
  const p = useCopy(PLATFORM_COPY);
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const e = p.explorer;
  const plan = row.plan ? getPlan(planId(row.plan)) : null;
  const max =
    row.maxDepartments === 'CUSTOM'
      ? p.inspection.custom
      : row.maxDepartments === null
        ? '—'
        : String(row.maxDepartments);
  const notInPackage = plan && !plan.executiveAccess ? (['EXECUTIVE'] as const) : [];

  return (
    <Link
      to={`/platform/companies/${encodeURIComponent(row.id)}`}
      state={state}
      data-company-row={row.id}
      className={`group relative block rounded-2xl bg-white/[0.018] px-4 py-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)] transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.035] hover:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.2)] focus-visible:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)] motion-reduce:transition-none sm:px-5 ${ROW_GRID}`}
    >
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-3.5">
        <Monogram name={row.name} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-semibold text-text-primary">{row.name}</span>
            {row.isDemo && (
              <span className="shrink-0 rounded-md bg-brand-cool/[0.12] px-1.5 py-0.5 font-mono text-[0.625rem] tracking-[0.12em] text-[#a9cfff] uppercase">
                {e.demo}
              </span>
            )}
          </p>
          {row.legalName && row.legalName !== row.name && (
            <p className="truncate text-caption text-text-muted">{row.legalName}</p>
          )}
          <p className="truncate text-caption text-text-secondary">
            {row.owner ? (
              <>
                {row.ownerName && <span className="text-text-primary/85">{row.ownerName} · </span>}
                {row.owner}
              </>
            ) : (
              e.noOwner
            )}
          </p>
        </div>
      </div>

      {/* Package + subscription */}
      <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:block">
        <span className="sr-only">{e.columns.package}: </span>
        <p className="text-label font-medium text-text-primary lg:mb-1.5">
          {plan?.name ?? p.statuses.none}
          {row.billingCycle && (
            <span className="ml-1.5 text-caption font-normal text-text-muted">
              {p.statuses.billing[row.billingCycle]}
            </span>
          )}
        </p>
        <Pill tone={subscriptionTone(row.subscriptionStatus)}>
          {row.subscriptionStatus
            ? p.statuses.subscription[row.subscriptionStatus]
            : p.statuses.none}
        </Pill>
      </div>

      {/* Lifecycle */}
      <div className="mt-2 flex flex-wrap items-center gap-2 lg:mt-0 lg:block">
        <span className="sr-only">{e.columns.lifecycle}: </span>
        <Pill tone={companyTone(row.status)} className="lg:mb-1.5">
          {p.statuses.company[row.status]}
        </Pill>
        <p className="text-caption text-text-muted">
          {e.onboarding}: {p.statuses.onboarding[row.onboardingStatus]}
        </p>
      </div>

      {/* Departments */}
      <div className="mt-3 flex items-center gap-3 lg:mt-0">
        <DepartmentTrack
          enabled={row.enabledDepartments}
          notInPackage={notInPackage}
          locale={locale}
          label={e.columns.departments}
        />
        <span className="text-caption text-text-secondary tabular-nums">
          {p.inspection.enabledOf(row.departments, max)}
        </span>
      </div>

      {/* Footprint */}
      <div className="mt-2 flex gap-4 text-caption text-text-secondary lg:mt-0 lg:flex-col lg:gap-1">
        <span className="inline-flex items-center gap-1.5">
          <Building2 aria-hidden className="size-3.5 text-text-muted" />
          {e.branches(row.branches)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users aria-hidden className="size-3.5 text-text-muted" />
          {e.members(row.members)}
        </span>
      </div>

      {/* Dates */}
      <div className="mt-2 flex flex-wrap gap-x-4 text-caption lg:mt-0 lg:block">
        <p className="text-text-secondary">
          <span className="text-text-muted">{e.created} </span>
          <time dateTime={row.createdAt}>{formatDate(row.createdAt, lang)}</time>
        </p>
        <p className="text-text-muted">
          {row.lastActivityAt ? (
            <>
              {e.lastActivity}{' '}
              <time dateTime={row.lastActivityAt}>{formatDate(row.lastActivityAt, lang)}</time>
            </>
          ) : (
            e.noActivity
          )}
        </p>
      </div>

      <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-caption text-brand-soft lg:static lg:justify-end">
        <span className="sr-only">{e.inspect}</span>
        <ChevronRight
          aria-hidden
          className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-soft motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}

/** Column labels above the rows on wide screens (the rows carry their own labels for AT). */
export function CompanyColumns() {
  const p = useCopy(PLATFORM_COPY);
  const c = p.explorer.columns;
  return (
    <div
      aria-hidden
      className={`hidden px-5 pb-2 font-mono text-[0.625rem] tracking-[0.14em] text-text-muted uppercase lg:grid ${ROW_GRID}`}
    >
      <span>{c.company}</span>
      <span>{c.package}</span>
      <span>{c.lifecycle}</span>
      <span>{c.departments}</span>
      <span>{c.footprint}</span>
      <span>{c.activity}</span>
      <span />
    </div>
  );
}
