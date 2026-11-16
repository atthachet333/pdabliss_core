import { ArrowRight, RefreshCw, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { Notice } from '@/features/auth/AuthFrame';
import { departmentId, type DepartmentCode } from '@/features/company/api';
import { useDateFormat } from '@/features/company-center/model';
import { AreaLink, Loading, Pill } from '@/features/company-center/parts';
import { DASH_COPY } from '@/features/dashboards/dashCopy';
import { useLiveResource, type LiveState } from '@/features/dashboards/liveResource';
import { useCopy } from '@/i18n/useCopy';
import { LOCALE_META } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { execApi, TRACE_KIND, type Overview, type Trace, type WorkItem } from './execApi';
import { EXEC_COPY, type ExecCopy } from './execCopy';

/*
 * EP48 — the Executive Command Center (/core/executive) and its document investigation
 * (/core/executive/documents/:kind/:id). One lazy chunk. READ-ONLY: there is no button that
 * changes anything — numbers and rows lead to the canonical screens, where every action
 * keeps its own permission, approval and audit rules. Nothing is hidden behind hover.
 * Freshness: the shared rules of features/dashboards/liveResource.ts; the view is keyed by
 * the branch filter, and an answer for another scope is never shown.
 */

function useNames() {
  const { locale } = useLocale();
  return (d: string) => getDepartment(departmentId(d as DepartmentCode), locale).name;
}

function useTime() {
  const { locale } = useLocale();
  return (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { timeStyle: 'short' }).format(
      new Date(iso),
    );
}

const SECTION = 'min-w-0 border-t border-white/[0.07] pt-5';
const BOX = 'rounded-xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]';

function Section({
  title,
  lead,
  aside,
  children,
  data,
}: {
  title: string;
  lead?: string;
  aside?: ReactNode;
  children: ReactNode;
  data: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={SECTION} data-exec-section={data}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-body font-semibold text-text-primary">
          {title}
        </h2>
        {aside}
      </div>
      {lead && <p className="mt-1 max-w-3xl text-caption text-text-muted">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LoadFailure({ error, c, retry }: { error: unknown; c: ExecCopy; retry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div className="grid max-w-2xl gap-3" data-exec-error={status || 'network'}>
      <Notice tone="error">
        {status === 401 ? c.sessionEnded : status === 403 ? c.noAccess : c.failed}
      </Notice>
      <div className="flex flex-wrap gap-3">
        {status === 401 ? (
          <AreaLink to="/login" className={buttonClasses('secondary', 'md')}>
            {c.signIn}
          </AreaLink>
        ) : status === 404 ? (
          <AreaLink to="/core/executive" className={buttonClasses('secondary', 'md')}>
            {c.allBranches}
          </AreaLink>
        ) : (
          status !== 403 && (
            <button type="button" onClick={retry} className={buttonClasses('secondary', 'md')}>
              {c.retry}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Header({
  c,
  title,
  state,
  load,
  children,
}: {
  c: ExecCopy;
  title: string;
  state: LiveState<{ generatedAt?: string }>;
  load: () => void;
  children?: ReactNode;
}) {
  const time = useTime();
  const busy = state.status === 'loading' || (state.status === 'ready' && state.busy);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {state.status === 'ready' && state.data.generatedAt && (
          <span className="text-caption text-text-muted" aria-live="polite">
            {busy ? c.refreshing : c.updated(time(state.data.generatedAt))}
          </span>
        )}
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className={buttonClasses('secondary', 'md', 'px-3.5')}
          data-exec-refresh
        >
          <RefreshCw
            aria-hidden
            className={cn('size-4', busy && 'animate-spin motion-reduce:animate-none')}
          />
          {c.refresh}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ one work item

function ItemRow({ item: i, c, trace = true }: { item: WorkItem; c: ExecCopy; trace?: boolean }) {
  const d = useCopy(DASH_COPY);
  const name = useNames();
  const { date } = useDateFormat();
  const kind = d.kinds[i.kind] ?? i.kind;
  const context =
    i.kind === 'PURCHASE_REQUEST' && i.context
      ? name(i.context)
      : i.kind === 'STOCK_ADJUSTMENT' && i.context
        ? (d.reasons[i.context] ?? i.context)
        : i.context;
  const ev = c.evidence[i.evidence.code];
  const evidence = ev
    ? ev(i.evidence.open ?? i.evidence.count ?? 0, i.evidence.total ?? 0)
    : i.evidence.code;
  const traceKind = TRACE_KIND[i.kind];
  const title = (
    <>
      <span className="block text-caption text-text-muted">{kind}</span>{' '}
      <span className="font-mono text-label font-semibold text-text-primary">{i.number}</span>
    </>
  );
  return (
    <li
      className="grid gap-x-6 gap-y-2 rounded-xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)] @3xl:items-start"
      data-exec-item={i.kind}
      data-class={i.class}
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
        <span className="mt-0.5 block text-caption text-text-muted">
          {c.item.from(name(i.department))} · {i.branch.name} · {i.branch.code}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap content-start gap-1.5">
        <Pill tone="neutral" wrap>
          {c.stages[i.stage] ?? i.stage}
        </Pill>
        <Pill tone={i.class === 'BLOCKED' || i.class === 'OVERDUE' ? 'warning' : 'muted'}>
          {(i.class === 'BLOCKED' || i.class === 'OVERDUE') && (
            <TriangleAlert aria-hidden className="size-3.5" />
          )}
          {c.classes[i.class]}
        </Pill>
      </div>
      <div className="min-w-0 text-caption">
        {i.reason && (
          <span className="block font-semibold text-text-primary">{c.reasons[i.reason]}</span>
        )}
        <span className="block text-text-secondary">{evidence}</span>
        <span className="mt-1 inline-flex">
          <Pill tone="teal">{c.item.next(name(i.next))}</Pill>
        </span>
      </div>
      <div className="min-w-0 text-caption text-text-secondary">
        {i.date && i.dateKind ? (
          <span className="block">
            {d.dates[i.dateKind] ?? i.dateKind}: {date(`${i.date}T00:00:00`)}
          </span>
        ) : (
          i.class === 'MISSING_DATE' && <span className="block">{c.item.noDate}</span>
        )}
        {i.overdueDays !== null && (
          <span className="block font-semibold text-[#f3cf8a]">
            {c.item.overdueBy(i.overdueDays)}
          </span>
        )}
        {i.ageDays !== null && <span className="block">{c.item.age(i.ageDays)}</span>}
        {trace && traceKind && (
          <AreaLink
            to={`/core/executive/documents/${traceKind}/${i.id}`}
            className="mt-1 inline-flex min-h-8 items-center gap-1 font-semibold text-brand-soft underline-offset-4 hover:underline"
            data-exec-trace
          >
            <Search aria-hidden className="size-3.5" />
            {c.item.investigate}
            <span className="sr-only"> {i.number}</span>
          </AreaLink>
        )}
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ the overview

export default function CommandCenter() {
  const [params] = useSearchParams();
  const branch = params.get('branch') || 'all';
  // Keyed by the filter: another branch starts from nothing (no stale scope on screen).
  return <Center key={branch} branch={branch} />;
}

function Center({ branch }: { branch: string }) {
  const c = useCopy(EXEC_COPY);
  const { locale } = useLocale();
  const name = useNames();
  const time = useTime();
  const navigate = useNavigate();
  const location = useLocation();
  // The filter lives in the URL; the language stays in router state (signed-in screens).
  const choose = (value: string) => {
    const n = new URLSearchParams(location.search);
    if (value === 'all') n.delete('branch');
    else n.set('branch', value);
    const q = n.toString();
    void navigate(
      { pathname: location.pathname, search: q ? `?${q}` : '' },
      { replace: true, state: location.state as unknown },
    );
  };
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  const { state, load } = useLiveResource<Overview>(
    (signal) => execApi.overview(branch, signal),
    (o) => o.scope.selected === branch,
  );
  const filterId = useId();
  const reload = () => void load();

  const header = (
    <Header c={c} title={c.title} state={state} load={reload}>
      <p className="mt-2 max-w-3xl text-label leading-relaxed text-text-secondary">{c.lead}</p>
      {state.status === 'ready' && (
        <p className="mt-3 flex flex-wrap gap-2">
          <Pill tone="teal" wrap>
            {state.data.scope.company}
          </Pill>
          <Pill tone="muted">{c.roles[state.data.role]}</Pill>
          <Pill tone="muted" data-exec-readonly>
            <ShieldCheck aria-hidden className="size-3.5" />
            {c.readOnly}
          </Pill>
        </p>
      )}
    </Header>
  );

  if (state.status === 'loading')
    return (
      <div className="grid gap-6" data-exec-center>
        {header}
        <Loading label={c.loading} />
      </div>
    );
  if (state.status === 'error')
    return (
      <div className="grid gap-6" data-exec-center>
        {header}
        <LoadFailure error={state.error} c={c} retry={reload} />
      </div>
    );

  const o = state.data;
  const nothing = o.visible.length === 0;
  return (
    <div className="grid gap-8" data-exec-center aria-busy={state.busy}>
      {header}
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={filterId} className="grid gap-1 text-caption text-text-muted">
          {c.branchLabel}
          <select
            id={filterId}
            value={branch}
            onChange={(e) => choose(e.target.value)}
            className="min-h-11 max-w-full rounded-lg bg-white/[0.04] px-3 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            data-exec-branch
          >
            <option value="all">{c.allBranches}</option>
            {o.scope.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.stale && <Notice tone="error">{c.stale(time(o.generatedAt))}</Notice>}
      <ul className="grid gap-1.5 text-caption text-text-muted" data-exec-notes>
        {o.notes.map((n) => (
          <li key={n} className="flex items-start gap-2" data-exec-note={n}>
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-soft" />
            {c.notes[n] ?? n}
          </li>
        ))}
      </ul>
      {nothing ? (
        <Notice tone="info">{c.empty.nothing}</Notice>
      ) : (
        <>
          <Section title={c.sections.pulse} lead={c.sectionLeads.pulse} data="pulse">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.pulse.map((p) => (
                <div key={p.department} className={BOX} data-exec-pulse={p.department}>
                  <h3 className="text-label font-semibold text-text-primary">
                    {name(p.department)}
                  </h3>
                  <dl className="mt-2 grid gap-1 text-caption">
                    {p.metrics.map((m) => {
                      const alert = m.tone === 'blocked' && m.value > 0;
                      const label = c.metrics[p.department]?.[m.key] ?? m.key;
                      return (
                        <div
                          key={m.key}
                          className="flex items-baseline justify-between gap-3"
                          data-metric={m.key}
                          data-value={m.value}
                        >
                          <dt className="min-w-0 text-text-secondary">
                            {m.link ? (
                              <AreaLink to={m.link} className="underline-offset-4 hover:underline">
                                {label}
                              </AreaLink>
                            ) : (
                              label
                            )}
                          </dt>
                          <dd
                            className={cn(
                              'shrink-0 font-semibold tabular-nums',
                              alert ? 'text-[#f3cf8a]' : 'text-text-primary',
                            )}
                          >
                            {alert && (
                              <TriangleAlert aria-hidden className="mr-1 inline size-3.5" />
                            )}
                            {m.value.toLocaleString()}{' '}
                            <span className="font-normal text-text-muted">{c.units[m.unit]}</span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title={c.sections.queue}
            lead={c.sectionLeads.queue}
            data="queue"
            aside={
              o.queue.total > 0 && (
                <span className="text-caption text-text-muted">
                  {c.showing(o.queue.items.length, o.queue.total)}
                </span>
              )
            }
          >
            {o.queue.items.length ? (
              <ol className="@container grid gap-2">
                {o.queue.items.map((i) => (
                  <ItemRow key={`${i.kind}:${i.id}`} item={i} c={c} />
                ))}
              </ol>
            ) : (
              <p className="text-caption text-text-muted" data-exec-empty="queue">
                {c.empty.queue}
              </p>
            )}
          </Section>
          <Section
            title={c.sections.bottlenecks}
            lead={c.sectionLeads.bottlenecks}
            data="bottlenecks"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {o.bottlenecks.map((b) => (
                <div key={b.key} className={BOX} data-exec-flow={b.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-label font-semibold text-text-primary">
                      {c.flows[b.key] ?? b.key}
                    </h3>
                    <span className="text-label font-semibold text-text-primary tabular-nums">
                      {b.total.toLocaleString()}{' '}
                      <span className="text-caption font-normal text-text-muted">
                        {c.units.DOCUMENTS}
                      </span>
                    </span>
                  </div>
                  {b.total > 0 ? (
                    <>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {b.classes.map((k) => (
                          <Pill
                            key={k.key}
                            tone={k.key === 'BLOCKED' || k.key === 'OVERDUE' ? 'warning' : 'muted'}
                          >
                            {c.classes[k.key]}: {k.value}
                          </Pill>
                        ))}
                      </p>
                      <dl className="mt-3 grid gap-1 text-caption">
                        {b.stages
                          .filter((s) => s.value > 0)
                          .map((s) => (
                            <div key={s.key} className="flex justify-between gap-3">
                              <dt className="text-text-secondary">{c.stages[s.key] ?? s.key}</dt>
                              <dd className="font-semibold text-text-primary tabular-nums">
                                {s.value}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      <ol className="@container mt-3 grid gap-2">
                        {b.items.map((i) => (
                          <ItemRow key={`${i.kind}:${i.id}`} item={i} c={c} />
                        ))}
                      </ol>
                      {b.total > b.items.length && (
                        <p className="mt-2 text-caption text-text-muted">
                          {c.showing(b.items.length, b.total)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-caption text-text-muted">{c.empty.flow}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title={c.sections.health} lead={c.sectionLeads.health} data="health">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {o.departments.map((d) => (
                <div key={d.department} className={BOX} data-exec-health={d.department}>
                  <h3 className="text-label font-semibold text-text-primary">
                    {name(d.department)}
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-caption">
                    {(
                      [
                        ['waiting', d.waiting],
                        ['blocked', d.blocked],
                        ['overdue', d.overdue],
                        ['open', d.open],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-text-muted">{c.departmentWord[k]}</dt>
                        <dd
                          className={cn(
                            'text-h3 leading-tight font-semibold tabular-nums',
                            (k === 'blocked' || k === 'overdue') && v > 0
                              ? 'text-[#f3cf8a]'
                              : 'text-text-primary',
                          )}
                        >
                          {v.toLocaleString()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {(
                    [
                      ['stages', d.stages.map((s) => [c.stages[s.key] ?? s.key, s.value])],
                      ['waitsOn', d.waitsOn.map((s) => [name(s.department), s.value])],
                      ['awaitedBy', d.awaitedBy.map((s) => [name(s.department), s.value])],
                      ['completed', d.completed.map((s) => [c.completed[s.key] ?? s.key, s.value])],
                    ] as const
                  ).map(([k, rows]) => (
                    <div key={k} className="mt-3">
                      <p className="text-caption font-semibold text-text-secondary">
                        {c.departmentWord[k]}
                      </p>
                      {rows.length ? (
                        <dl className="mt-1 grid gap-0.5 text-caption">
                          {rows.map(([label, v]) => (
                            <div key={label} className="flex justify-between gap-3">
                              <dt className="text-text-muted">{label}</dt>
                              <dd className="text-text-primary tabular-nums">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-1 text-caption text-text-muted">{c.departmentWord.none}</p>
                      )}
                    </div>
                  ))}
                  {d.link && (
                    <AreaLink
                      to={d.link}
                      className="mt-3 inline-flex min-h-9 items-center gap-1 text-caption font-semibold text-brand-soft underline-offset-4 hover:underline"
                    >
                      {c.departmentWord.dashboard}
                      <ArrowRight aria-hidden className="size-3.5" />
                    </AreaLink>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title={c.sections.branches} lead={c.sectionLeads.branches} data="branches">
            <div
              className="max-w-full overflow-x-auto rounded-xl shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] focus-visible:outline-2 focus-visible:outline-focus"
              tabIndex={0}
              role="region"
              aria-label={c.table.caption}
            >
              <table className="w-full min-w-[40rem] text-left text-caption" data-exec-branches>
                <caption className="sr-only">{c.table.caption}</caption>
                <thead>
                  <tr className="border-b border-white/[0.07] text-text-muted">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {c.table.branch}
                    </th>
                    {o.branchComparison.keys.map((k) => (
                      <th key={k} scope="col" className="px-3 py-2 text-right font-semibold">
                        {c.compare[k] ?? k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {o.branchComparison.rows.map((r) => (
                    <tr key={r.branch.id} className="border-b border-white/[0.05] last:border-0">
                      <th scope="row" className="px-3 py-2 font-semibold text-text-primary">
                        {r.branch.name} · {r.branch.code}
                      </th>
                      {o.branchComparison.keys.map((k) => (
                        <td key={k} className="px-3 py-2 text-right text-text-primary tabular-nums">
                          {(r.values[k] ?? 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={c.sections.activity} lead={c.sectionLeads.activity} data="activity">
            {o.activity.length ? (
              <ol className="grid gap-1.5 text-caption">
                {o.activity.map((a) => (
                  <li
                    key={`${a.event}:${a.id}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                    data-exec-activity={a.event}
                  >
                    <time dateTime={a.at} className="w-28 shrink-0 text-text-muted tabular-nums">
                      {stamp(a.at)}
                    </time>
                    <span className="text-text-secondary">{c.events[a.event] ?? a.event}</span>
                    {a.link ? (
                      <AreaLink
                        to={a.link}
                        className="font-mono font-semibold text-text-primary underline-offset-4 hover:underline"
                      >
                        {a.number}
                      </AreaLink>
                    ) : (
                      <span className="font-mono font-semibold text-text-primary">{a.number}</span>
                    )}
                    <span className="text-text-muted">
                      {name(a.department)} · {a.branch.code}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-caption text-text-muted">{c.empty.activity}</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ document investigation

export function TracePage() {
  const { kind = '', id = '' } = useParams();
  return <TraceView key={`${kind}:${id}`} kind={kind} id={id} />;
}

function TraceView({ kind, id }: { kind: string; id: string }) {
  const c = useCopy(EXEC_COPY);
  const d = useCopy(DASH_COPY);
  const { date } = useDateFormat();
  const { state, load } = useLiveResource<Trace & { generatedAt?: string }>((signal) =>
    execApi.trace(kind, id, signal),
  );
  const reload = () => void load();
  const back = (
    <AreaLink
      to="/core/executive"
      className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
    >
      {c.backToCenter}
    </AreaLink>
  );
  if (state.status !== 'ready')
    return (
      <div className="grid gap-6" data-exec-trace-page>
        {back}
        <Header c={c} title={c.trace.title} state={state} load={reload} />
        {state.status === 'loading' ? (
          <Loading label={c.loading} />
        ) : (
          <LoadFailure error={state.error} c={c} retry={reload} />
        )}
      </div>
    );
  const t = state.data;
  return (
    <div className="grid gap-8" data-exec-trace-page aria-busy={state.busy}>
      {back}
      <Header c={c} title={`${c.trace.title}: ${t.document.number}`} state={state} load={reload}>
        <p className="mt-3 flex flex-wrap gap-2">
          <Pill tone="teal">{d.kinds[t.document.kind] ?? t.document.kind}</Pill>
          <Pill tone="muted">
            {c.trace.status}: {c.statuses[t.document.status] ?? t.document.status}
          </Pill>
          <Pill tone="muted" wrap>
            {t.document.branch.name} · {t.document.branch.code}
          </Pill>
          {t.document.context && (
            <Pill tone="muted" wrap>
              {t.document.context}
            </Pill>
          )}
        </p>
        {t.document.link && (
          <AreaLink
            to={t.document.link}
            className={buttonClasses('secondary', 'md', 'mt-4 w-fit px-3.5')}
          >
            {c.trace.open}
            <ArrowRight aria-hidden className="size-4" />
          </AreaLink>
        )}
      </Header>
      <Section title={c.trace.current} data="trace-item">
        {t.item ? (
          <ul className="@container grid gap-2">
            <ItemRow item={t.item} c={c} trace={false} />
          </ul>
        ) : (
          <p className="text-caption text-text-muted">{c.trace.noWork}</p>
        )}
      </Section>
      <Section title={c.trace.related} data="trace-related">
        {t.related.length ? (
          <ul className="grid gap-2 text-caption">
            {t.related.map((r) => (
              <li
                key={`${r.kind}:${r.id}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                data-exec-related={r.kind}
              >
                <span className="text-text-muted">{c.relatedKinds[r.kind] ?? r.kind}</span>
                {r.link ? (
                  <AreaLink
                    to={r.link}
                    className="font-mono font-semibold text-text-primary underline-offset-4 hover:underline"
                  >
                    {r.number}
                  </AreaLink>
                ) : (
                  <span className="font-mono font-semibold text-text-primary">{r.number}</span>
                )}
                <Pill tone="neutral">{c.statuses[r.status] ?? r.status}</Pill>
                {r.at && <span className="text-text-muted">{date(`${r.at}T00:00:00`)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-text-muted">{c.trace.noRelated}</p>
        )}
      </Section>
    </div>
  );
}
