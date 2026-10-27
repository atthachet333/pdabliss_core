import { LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import type { Identity } from '@/features/auth/api';
import {
  DEPARTMENT_CODES,
  PLAN_CODES,
  planId,
  platformCompanyApi,
  type PlatformCompanyPage,
  type PlatformCompanyQuery,
  type PlatformCompanyRow,
} from '@/features/company/api';
import { getPlan } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { CompanyColumns, CompanyRow } from './CompanyRow';
import { PLATFORM_COPY } from './copy';
import { classifyError, departmentName, type LoadError } from './model';
import { LoadErrorMessage, StateMessage } from './parts';
import { PlatformShell } from './PlatformShell';

/*
 * /platform/companies — the Company Explorer (EP24.1). Search and filters
 * live in the URL (shareable; "Back" from an inspection returns to the same
 * view) and run on the server; results arrive 25 at a time by cursor, so
 * the page never renders the whole platform at once.
 */

const PAGE = 25;
const FILTERS = ['plan', 'subscriptionStatus', 'status', 'onboardingStatus', 'department'] as const;
type FilterKey = (typeof FILTERS)[number];

type View =
  | { status: 'loading' }
  | { status: 'error'; error: LoadError }
  | {
      status: 'ready';
      rows: PlatformCompanyRow[];
      total: number;
      next: string | null;
      more: boolean;
    };

export function CompanyExplorer({ identity }: { identity: Identity }) {
  const p = useCopy(PLATFORM_COPY);
  const e = p.explorer;
  const { locale } = useLocale();
  const location = useLocation();
  usePageMeta(p.meta.companies, p.meta.description, { index: false });
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [view, setView] = useState<View>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const searchId = useId();

  const query = useMemo<PlatformCompanyQuery>(() => {
    const out: Record<string, string> = {};
    if (q) out.q = q;
    for (const key of FILTERS) {
      const v = params.get(key);
      if (v) out[key] = v;
    }
    return out as PlatformCompanyQuery;
  }, [params, q]);
  const queryKey = JSON.stringify(query);
  const filtered = Object.keys(query).length > 0;

  // Debounced search → URL (replace: typing is not history).
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = window.setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (search.trim()) next.set('q', search.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, q, setParams]);

  // First page whenever the query changes.
  useEffect(() => {
    let live = true;
    platformCompanyApi.list({ ...query, limit: PAGE }).then(
      (page: PlatformCompanyPage) =>
        live &&
        setView({
          status: 'ready',
          rows: page.companies,
          total: page.total,
          next: page.nextCursor,
          more: false,
        }),
      (err: unknown) => live && setView({ status: 'error', error: classifyError(err) }),
    );
    return () => {
      live = false;
    };
    // queryKey stands for `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, attempt]);

  const loadMore = async () => {
    if (view.status !== 'ready' || !view.next) return;
    const cursor = view.next;
    setView({ ...view, more: true });
    try {
      const page = await platformCompanyApi.list({ ...query, limit: PAGE, cursor });
      setView((v) =>
        v.status === 'ready'
          ? {
              status: 'ready',
              rows: [...v.rows, ...page.companies],
              total: page.total,
              next: page.nextCursor,
              more: false,
            }
          : v,
      );
    } catch (err) {
      setView({ status: 'error', error: classifyError(err) });
    }
  };

  const setFilter = (key: FilterKey, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const clear = () => {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const options: Record<FilterKey, { value: string; label: string }[]> = {
    plan: PLAN_CODES.map((code) => ({ value: code, label: getPlan(planId(code)).name })),
    subscriptionStatus: (['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const).map((s) => ({
      value: s,
      label: p.statuses.subscription[s],
    })),
    status: (['PENDING_SUBSCRIPTION', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const).map((s) => ({
      value: s,
      label: p.statuses.company[s],
    })),
    onboardingStatus: (['IN_PROGRESS', 'COMPLETED'] as const).map((s) => ({
      value: s,
      label: p.statuses.onboarding[s],
    })),
    department: DEPARTMENT_CODES.map((d) => ({ value: d, label: departmentName(d, locale) })),
  };
  const labels: Record<FilterKey, string> = {
    plan: e.plan,
    subscriptionStatus: e.subscription,
    status: e.status,
    onboardingStatus: e.onboarding,
    department: e.department,
  };
  // Inspection pages link "Back" to exactly this view.
  const backState = { from: `${location.pathname}${location.search}` };

  return (
    <PlatformShell identity={identity}>
      <header className="max-w-3xl">
        <p className="font-mono text-[0.6875rem] tracking-[0.18em] text-brand-soft uppercase">
          {e.kicker}
        </p>
        <h1 className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)] leading-[1.1] font-semibold tracking-tight text-text-primary">
          {e.title}
        </h1>
        <p className="mt-3 text-body text-text-secondary">{e.lead}</p>
      </header>

      <div className="mt-8">
        <form
          role="search"
          aria-label={e.search}
          onSubmit={(ev) => ev.preventDefault()}
          className="grid gap-4 rounded-[1.375rem] bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:p-5 xl:grid-cols-[minmax(18rem,1.4fr)_repeat(5,minmax(0,1fr))_auto] xl:items-end"
        >
          <div className="min-w-0">
            <label
              htmlFor={searchId}
              className="mb-2 block text-caption font-medium text-text-secondary"
            >
              {e.search}
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-muted"
              />
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder={e.searchPlaceholder}
                maxLength={100}
                autoComplete="off"
                className={cn(controlClass(false), 'pl-10')}
              />
            </div>
          </div>
          <fieldset className="contents">
            <legend className="sr-only">{e.filters}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:contents">
              {FILTERS.map((key) => (
                <div key={key} className="min-w-0">
                  <label
                    htmlFor={`${searchId}-${key}`}
                    className="mb-2 block text-caption font-medium text-text-secondary"
                  >
                    {labels[key]}
                  </label>
                  <select
                    id={`${searchId}-${key}`}
                    value={params.get(key) ?? ''}
                    onChange={(ev) => setFilter(key, ev.target.value)}
                    className={controlClass(false)}
                  >
                    <option value="">{e.any}</option>
                    {options[key].map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={clear}
            disabled={!filtered && !search}
            className={cn(buttonClasses('ghost', 'md'), 'justify-self-start xl:justify-self-end')}
          >
            <X aria-hidden className="size-4" />
            {e.clear}
          </button>
        </form>
      </div>

      <div className="mt-6">
        <p
          role="status"
          aria-live="polite"
          className="mb-3 min-h-5 text-caption text-text-muted"
          data-result-count
        >
          {view.status === 'ready'
            ? e.count(view.rows.length, view.total)
            : view.status === 'loading'
              ? e.loading
              : ''}
        </p>
        {view.status === 'error' ? (
          <LoadErrorMessage
            error={view.error}
            p={p}
            onRetry={() => {
              setView({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        ) : view.status === 'loading' ? (
          <ul aria-hidden className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[5.5rem] rounded-2xl bg-white/[0.02] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.05)]"
              />
            ))}
          </ul>
        ) : view.rows.length === 0 ? (
          filtered ? (
            <StateMessage
              kind="noResult"
              title={e.noResultTitle}
              text={e.noResultText}
              action={
                <button type="button" onClick={clear} className={buttonClasses('secondary', 'md')}>
                  {e.clear}
                </button>
              }
            />
          ) : (
            <StateMessage kind="empty" title={e.emptyTitle} text={e.emptyText} />
          )
        ) : (
          <>
            <CompanyColumns />
            <ul className="grid gap-2" data-explorer-rows>
              {view.rows.map((row) => (
                <li key={row.id} className="min-w-0">
                  <CompanyRow row={row} state={backState} />
                </li>
              ))}
            </ul>
            {view.next && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={view.more}
                  className={buttonClasses('secondary', 'md')}
                >
                  {view.more && (
                    <LoaderCircle
                      aria-hidden
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                  )}
                  {e.loadMore}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}
