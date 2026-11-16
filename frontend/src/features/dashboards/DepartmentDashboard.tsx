import { ArrowRight, CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { Notice } from '@/features/auth/AuthFrame';
import { departmentId } from '@/features/company/api';
import { useDateFormat } from '@/features/company-center/model';
import { AreaLink, Loading, Pill } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { LOCALE_META } from '@/i18n/locales';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  dashApi,
  type Dashboard,
  type DashboardDepartment,
  type Metric,
  type Queue,
  type QueueItem,
} from './dashApi';
import { DASH_COPY, type DashCopy } from './dashCopy';
import { useLiveResource } from './liveResource';

/*
 * EP47 — one department's operational dashboard (its own lazy chunk; the same
 * generic view for every department, driven by what the server returns).
 *
 * Read-only: numbers lead to the list behind them, rows to the canonical
 * document; "Your step" only marks rows the server says this person may act on —
 * the step itself happens on the document screen, never here.
 *
 * Freshness: loaded on open; refreshed every 2 minutes while the tab is visible,
 * on returning to the tab after 30 s, on the Refresh button, and when any CORE
 * request reports changed authorization. A refusal (401 / 403 / 404) REPLACES the
 * data — numbers of a dashboard the person may no longer open never stay on
 * screen; a network failure keeps the last result, marked as stale. The parent
 * keys this component by branch, so a branch change starts from nothing.
 */

/** EP48: the shared freshness rules (./liveResource.ts). */
function useDashboard(department: DashboardDepartment, branchId: string) {
  return useLiveResource<Dashboard>(
    (signal) => dashApi.get(department, signal),
    (data) => data.branch.id === branchId,
  );
}

export default function DepartmentDashboard({
  department,
  branchId,
  workspace,
  embedded = false,
}: {
  department: DashboardDepartment;
  branchId: string;
  /** The department's workspace (its document screens), when the person may open it. */
  workspace?: string | null;
  /** On the CORE home (which has its own h1): headings start one level lower. */
  embedded?: boolean;
}) {
  const c = useCopy(DASH_COPY);
  const { locale } = useLocale();
  const { state, load } = useDashboard(department, branchId);
  const dept = getDepartment(departmentId(department), locale);
  const titleId = useId();
  const time = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { timeStyle: 'short' }).format(
      new Date(iso),
    );
  const H = embedded ? 'h2' : 'h1';

  const header = (data: Dashboard | null, busy: boolean) => (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 gap-4">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-primary/[0.12] text-brand-soft"
        >
          <dept.icon className="size-5" />
        </span>
        <div className="min-w-0">
          <H
            id={titleId}
            className={cn(
              'font-semibold tracking-tight text-text-primary',
              embedded ? 'text-body' : 'text-[clamp(1.5rem,1.2rem+1vw,2.125rem)]',
            )}
          >
            {c.titles[department]}
          </H>
          <p className="mt-1 max-w-3xl text-label leading-relaxed text-text-secondary">
            {c.leads[department]}
          </p>
          {data && (
            <p className="mt-3 flex flex-wrap gap-2">
              <Pill tone="teal" wrap>
                {c.branch}: {data.branch.name} · {data.branch.code}
              </Pill>
              <Pill tone="muted" data-access={data.access}>
                {c.access[data.access]}
              </Pill>
              {data.manufacturingMode && (
                <Pill tone="muted" data-mode={data.manufacturingMode}>
                  {c.mode[data.manufacturingMode]}
                </Pill>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {data && (
          <span className="text-caption text-text-muted" aria-live="polite">
            {busy ? c.refreshing : c.updated(time(data.generatedAt))}
          </span>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          aria-describedby={titleId}
          className={buttonClasses('secondary', 'md', 'px-3.5')}
          data-dashboard-refresh
        >
          <RefreshCw
            aria-hidden
            className={cn('size-4', busy && 'animate-spin motion-reduce:animate-none')}
          />
          {c.refresh}
        </button>
        {workspace && (
          <AreaLink to={workspace} className={buttonClasses('ghost', 'md', 'px-3.5')}>
            {c.workspace}
            <ArrowRight aria-hidden className="size-4" />
          </AreaLink>
        )}
      </div>
    </div>
  );

  if (state.status === 'loading')
    return (
      <section aria-labelledby={titleId} className="grid gap-6" data-dashboard={department}>
        {header(null, true)}
        <Loading label={c.loading} />
      </section>
    );

  if (state.status === 'error') {
    const e = state.error;
    const status = e instanceof ApiError ? e.status : 0;
    return (
      <section aria-labelledby={titleId} className="grid gap-6" data-dashboard={department}>
        {header(null, false)}
        <div className="grid max-w-2xl gap-3" data-dashboard-error={status || 'network'}>
          <Notice tone="error">
            {status === 401
              ? c.sessionEnded
              : status === 403 || status === 404
                ? c.noAccess
                : c.failed}
          </Notice>
          <div>
            {status === 401 ? (
              <AreaLink to="/login" className={buttonClasses('secondary', 'md')}>
                {c.signIn}
              </AreaLink>
            ) : (
              status !== 403 &&
              status !== 404 && (
                <button
                  type="button"
                  onClick={() => void load()}
                  className={buttonClasses('secondary', 'md')}
                >
                  {c.retry}
                </button>
              )
            )}
          </div>
        </div>
      </section>
    );
  }

  const { data, stale, busy } = state;
  const by = (tones: Metric['tone'][]) => data.metrics.filter((m) => tones.includes(m.tone));
  const groups = (
    [
      ['attention', by(['attention', 'blocked'])],
      ['progress', by(['progress'])],
      ['other', by(['done', 'info'])],
    ] as const
  ).filter(([, list]) => list.length > 0);

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-8"
      data-dashboard={department}
      aria-busy={busy}
    >
      {header(data, busy)}
      {stale && <Notice tone="error">{c.stale(time(data.generatedAt))}</Notice>}
      {data.notes.map((n) => (
        <Notice key={n} tone="info">
          <span data-dashboard-note={n}>{c.notes[n] ?? n}</span>
        </Notice>
      ))}
      {!data.metrics.length && !data.queues.length && (
        <Notice tone="info">
          <span data-dashboard-empty>{c.emptyAll}</span>
        </Notice>
      )}
      {groups.map(([group, list]) => (
        <MetricGroup
          key={group}
          title={c.groups[group]}
          embedded={embedded}
          labels={c.metrics[department] as Record<string, string>}
          metrics={list}
          primary={group === 'attention'}
        />
      ))}
      {data.queues.map((q) => (
        <WorkQueue key={q.key} queue={q} c={c} embedded={embedded} />
      ))}
    </section>
  );
}

function MetricGroup({
  title,
  metrics,
  labels,
  primary,
  embedded,
}: {
  title: string;
  metrics: Metric[];
  labels: Record<string, string>;
  primary: boolean;
  embedded: boolean;
}) {
  const id = useId();
  const H = embedded ? 'h3' : 'h2';
  return (
    <section aria-labelledby={id} className="min-w-0 border-t border-white/[0.07] pt-5">
      <H id={id} className="text-body font-semibold text-text-primary">
        {title}
      </H>
      <ul
        className={cn(
          'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2',
          primary ? 'xl:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4',
        )}
      >
        {metrics.map((m) => {
          const label = labels[m.key] ?? m.key;
          const alert = m.tone === 'blocked' && m.value > 0;
          const body = (
            <>
              <span className="flex items-start justify-between gap-2 text-label text-text-secondary">
                {label}
                {alert ? (
                  <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
                ) : m.tone === 'done' ? (
                  <CircleCheck aria-hidden className="size-4 shrink-0 text-brand-glow" />
                ) : null}
              </span>
              <span
                className={cn(
                  'leading-none font-semibold tabular-nums',
                  primary ? 'text-[1.75rem]' : 'text-h3',
                  alert ? 'text-[#f3cf8a]' : 'text-text-primary',
                )}
              >
                {m.value.toLocaleString()}
              </span>
            </>
          );
          const box = cn(
            'grid min-h-24 content-between gap-2 rounded-xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
            alert ? 'bg-warning/[0.08]' : 'bg-white/[0.03]',
          );
          return (
            <li key={m.key} data-metric={m.key} data-value={m.value}>
              {m.link ? (
                <AreaLink
                  to={m.link}
                  className={cn(
                    box,
                    'hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  )}
                >
                  {body}
                </AreaLink>
              ) : (
                <div className={box}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WorkQueue({ queue, c, embedded }: { queue: Queue; c: DashCopy; embedded: boolean }) {
  const id = useId();
  const H = embedded ? 'h3' : 'h2';
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 border-t border-white/[0.07] pt-5"
      data-queue={queue.key}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <H id={id} className="text-body font-semibold text-text-primary">
          {c.queues[queue.key as keyof DashCopy['queues']] ?? queue.key}
        </H>
        {queue.total > 0 && (
          <span className="text-caption text-text-muted">
            {c.showing(queue.items.length, queue.total)}
          </span>
        )}
      </div>
      {queue.items.length === 0 ? (
        <p className="mt-4 text-caption text-text-muted" data-queue-empty>
          {c.emptyQueue}
        </p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {queue.items.map((i) => (
            <QueueRow key={`${i.kind}:${i.id}`} item={i} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRow({ item: i, c }: { item: QueueItem; c: DashCopy }) {
  const { locale } = useLocale();
  const { date } = useDateFormat();
  const kind = c.kinds[i.kind] ?? i.kind;
  const status = c.statuses[`${i.kind}.${i.status}`] ?? c.statuses[i.status] ?? i.status;
  const context =
    i.kind === 'PURCHASE_REQUEST' && i.context
      ? getDepartment(departmentId(i.context as never), locale).name
      : i.kind === 'STOCK_ADJUSTMENT' && i.context
        ? (c.reasons[i.context] ?? i.context)
        : i.context;
  const amount = i.amount
    ? new Intl.NumberFormat(LOCALE_META[locale].htmlLang, {
        style: 'currency',
        currency: i.amount.currency,
      }).format(Number(i.amount.value))
    : null;
  const title: ReactNode = (
    <>
      <span className="block text-caption text-text-muted">{kind}</span>{' '}
      <span className="font-mono text-label font-semibold text-text-primary">{i.number}</span>
    </>
  );
  return (
    <li
      className="grid gap-x-6 gap-y-2 rounded-xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] md:items-center"
      data-queue-item={i.kind}
      data-can-act={i.canAct}
    >
      <div className="min-w-0">
        {i.link ? (
          <AreaLink
            to={i.link}
            className="block rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {title}
          </AreaLink>
        ) : (
          title
        )}
        {context && (
          <span className="mt-0.5 block truncate text-caption text-text-secondary">{context}</span>
        )}
      </div>
      <div className="min-w-0">
        <span className="sr-only">{c.columns.status}: </span>
        <Pill tone="neutral" wrap>
          {status}
        </Pill>
      </div>
      <div className="min-w-0 text-caption">
        <span className="sr-only">{c.columns.next}: </span>
        <span className="text-text-primary">{c.actions[i.action] ?? i.action}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {i.canAct ? (
            <Pill tone="teal">{c.yourStep}</Pill>
          ) : (
            <Pill tone="muted">
              {c.next(getDepartment(departmentId(i.responsible), locale).name)}
            </Pill>
          )}
        </span>
      </div>
      <div className="min-w-0 text-caption text-text-secondary">
        {i.date && i.dateKind && (
          <span className="block">
            {c.dates[i.dateKind] ?? i.dateKind}: {date(`${i.date}T00:00:00`)}
          </span>
        )}
        {i.overdue && (
          <span className="mt-1 inline-flex">
            <Pill tone="warning">
              <TriangleAlert aria-hidden className="size-3.5" />
              {c.overdue}
            </Pill>
          </span>
        )}
        {i.progress && i.progress.total > 0 && i.progress.open > 0 && (
          <span className="block">{c.linesOpen(i.progress.open, i.progress.total)}</span>
        )}
        {i.quantity && Number(i.quantity.value) > 0 && (
          <span className="block">{c.outstanding(i.quantity.value, i.quantity.unit)}</span>
        )}
        {amount && <span className="block font-semibold text-text-primary">{amount}</span>}
      </div>
    </li>
  );
}
