import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Circle,
  CircleDot,
  History,
  LogOut,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useRef, type Dispatch, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { DEMO_COPY } from './copy';
import { ROLE_ICON, useDemoFormat } from './format';
import {
  isTerminal,
  OWNER,
  ROLES,
  STAGE_OF,
  STAGES,
  summarize,
  type DemoSession,
  type Role,
  type SessionAction,
} from './machine';
import { DEMO_LINKS, OUTSTANDING, SCENARIO } from './scenario';
import { Pill, RoleWorkspace } from './Workspaces';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';

/*
 * The public DemoShell (EP14) — deliberately not the internal AppShell.
 * One work item (SO-1042) stays anchored at the top while the workspace
 * around it changes with the role. All state comes from DemoSession.
 */

/* ------------------------------------------------------------------ */
/* Role tabs                                                            */
/* ------------------------------------------------------------------ */

function RoleTabs({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY);
  const owner = OWNER[s.state.status];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? ROLES.length - 1
          : d
            ? (i + d + ROLES.length) % ROLES.length
            : -1;
    if (to < 0) return;
    e.preventDefault();
    dispatch({ kind: 'role', role: ROLES[to]! });
    refs.current[to]?.focus();
  };
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        role="tablist"
        aria-label={c.shell.viewAs}
        data-role-tabs
        className="flex min-w-max gap-1.5"
      >
        {ROLES.map((r, i) => {
          const on = r === s.role;
          const Icon = ROLE_ICON[r];
          const incoming = r === owner && !on && !isTerminal(s.state.status);
          return (
            <button
              key={r}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`demo-tab-${r}`}
              aria-selected={on}
              aria-controls="demo-workspace"
              tabIndex={on ? 0 : -1}
              data-role={r}
              onClick={() => dispatch({ kind: 'role', role: r })}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'relative inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-label transition-colors',
                on
                  ? 'bg-brand-primary/15 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]'
                  : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary',
              )}
            >
              <Icon aria-hidden className="size-4" style={{ color: `var(--color-ws-${r})` }} />
              {c.roles[r].name}
              {incoming && (
                <span
                  data-incoming
                  className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[0.625rem] font-semibold text-warning"
                >
                  {c.shell.newWork}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The anchored work item                                               */
/* ------------------------------------------------------------------ */

function WorkItemBar({ s }: { s: DemoSession }) {
  const c = useCopy(DEMO_COPY);
  const reduce = usePrefersReducedMotion();
  const owner = OWNER[s.state.status];
  const ex = s.state.exception;
  // A shared-state pulse after each change of the work item.
  const pulseKey = s.state.trace.filter((e) => !e.prevented).length;
  return (
    <motion.div
      key={reduce ? 'still' : pulseKey}
      data-work-item
      data-status={s.state.status}
      initial={
        reduce || pulseKey === 0
          ? false
          : { boxShadow: '0 0 0 1px rgb(62 240 192 / 0.9), 0 0 32px rgb(62 240 192 / 0.35)' }
      }
      animate={{ boxShadow: '0 0 0 1px rgb(190 235 222 / 0.1), 0 0 0px rgb(62 240 192 / 0)' }}
      transition={{ duration: 1.2, ease: EASE_CORE }}
      className="flex flex-col gap-3 rounded-2xl bg-[#08141c] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6"
    >
      <p className="flex items-baseline gap-2">
        <span className="text-[1.25rem] font-semibold tracking-wide text-text-primary tabular">
          {SCENARIO.order.id}
        </span>
        <span className="text-caption text-text-muted">{c.shell.scenario}</span>
      </p>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:flex sm:flex-wrap sm:items-center">
        <div>
          <dt className="text-[0.6875rem] text-text-muted">{c.shell.state}</dt>
          <dd data-state-label>
            <Pill tone={isTerminal(s.state.status) ? 'ok' : ex === 'open' ? 'alert' : 'wait'}>
              {c.states[s.state.status]}
            </Pill>
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-text-muted">{c.shell.owner}</dt>
          <dd
            data-owner={owner}
            className="flex min-h-7 items-center gap-1.5 text-label text-text-primary"
          >
            <DeptDot id={owner} />
            {c.roles[owner].name}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-[0.6875rem] text-text-muted">{c.shell.exception}</dt>
          <dd data-exception={ex}>
            {ex === 'open' ? (
              <Pill tone="alert">{c.shell.exceptionOpen(OUTSTANDING)}</Pill>
            ) : ex === 'resolved' ? (
              <Pill tone="ok">{c.shell.exceptionResolved}</Pill>
            ) : (
              <span className="flex min-h-7 items-center text-label text-text-secondary">
                {c.shell.exceptionNone}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Stages                                                               */
/* ------------------------------------------------------------------ */

function StageList({ s, className }: { s: DemoSession; className?: string }) {
  const c = useCopy(DEMO_COPY);
  const current = STAGES.indexOf(STAGE_OF[s.state.status]);
  const done = isTerminal(s.state.status);
  return (
    <ol aria-label={c.shell.stagesLabel} data-stages className={cn('space-y-1', className)}>
      {STAGES.map((st, i) => {
        const state = done || i < current ? 'done' : i === current ? 'current' : 'ahead';
        const Icon = state === 'done' ? Check : state === 'current' ? CircleDot : Circle;
        return (
          <li
            key={st}
            data-stage={st}
            data-stage-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-label',
              state === 'current'
                ? 'bg-brand-primary/10 text-text-primary'
                : state === 'done'
                  ? 'text-text-secondary'
                  : 'text-text-muted',
            )}
          >
            <span className="w-5 text-caption tabular opacity-70">
              {String(i + 1).padStart(2, '0')}
            </span>
            <Icon
              aria-hidden
              className={cn(
                'size-3.5 shrink-0',
                state === 'current' && 'text-brand-glow',
                state === 'done' && 'text-success',
              )}
            />
            {c.stages[st]}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Context: next action, handoff, boundaries                            */
/* ------------------------------------------------------------------ */

function NextCard({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY);
  const owner = OWNER[s.state.status];
  if (isTerminal(s.state.status)) return null;
  const elsewhere = s.role !== owner;
  return (
    <section
      aria-labelledby="demo-next"
      data-next
      className="rounded-2xl bg-brand-primary/[0.07] p-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
    >
      <h3 id="demo-next" className="text-caption font-semibold text-brand-soft">
        {c.shell.next}
      </h3>
      {(s.guided || !elsewhere) && (
        <p data-guidance className="mt-1.5 text-label text-text-primary">
          {c.guidance[s.state.status]}
        </p>
      )}
      {elsewhere && (
        <div className="mt-3">
          <p className="text-caption text-text-secondary">{c.elsewhere(c.roles[owner].name)}</p>
          <button
            type="button"
            data-switch-owner
            onClick={() => dispatch({ kind: 'role', role: owner })}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-label font-semibold text-text-primary hover:bg-white/[0.12]"
          >
            {c.switchTo(c.roles[owner].name)}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </section>
  );
}

function HandoffCard({ s, dispatch }: { s: DemoSession; dispatch: Dispatch<SessionAction> }) {
  const c = useCopy(DEMO_COPY);
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const event = s.last?.ok ? s.last.event : null;
  const h = s.showHandoff && event?.handoff;
  // Focus the handoff after it happens, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (h) ref.current?.focus();
  }, [h, event?.seq]);
  if (!h || !event) return null;
  return (
    <motion.section
      key={event.seq}
      aria-labelledby="demo-handoff"
      data-handoff={h.id}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_CORE }}
      className="rounded-2xl bg-[#0b1a1c] p-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          id="demo-handoff"
          ref={ref}
          tabIndex={-1}
          className="text-caption font-semibold text-brand-glow outline-none"
        >
          {c.handoff.title}
        </h3>
        <button
          type="button"
          onClick={() => dispatch({ kind: 'dismissHandoff' })}
          className="-mt-2 -mr-2 inline-flex size-11 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">{c.handoff.dismiss}</span>
        </button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-label font-semibold text-text-primary">
        <span className="flex items-center gap-1.5">
          <DeptDot id={h.from} />
          {c.roles[h.from].name}
        </span>
        <ArrowRight aria-hidden className="size-4 text-brand-glow" />
        <span className="flex items-center gap-1.5">
          <DeptDot id={h.to} />
          {c.roles[h.to].name}
        </span>
      </p>
      <dl className="mt-3 space-y-2.5 text-label">
        <div>
          <dt className="text-caption text-text-muted">{c.handoff.changed}</dt>
          <dd className="text-text-primary">
            {c.states[event.before]} → {c.states[event.after]}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">{c.handoff.travels}</dt>
          <dd>
            <ul className="mt-0.5 space-y-0.5">
              {c.handoff.items[h.id].map((x) => (
                <li key={x} className="flex items-baseline gap-2 text-text-secondary">
                  <span
                    aria-hidden
                    className="size-1 shrink-0 translate-y-[-0.15em] rounded-full bg-brand-glow"
                  />
                  {x}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">{c.handoff.next}</dt>
          <dd className="text-text-primary">{c.roles[h.to].name}</dd>
        </div>
      </dl>
    </motion.section>
  );
}

function BoundaryCard({ role }: { role: Role }) {
  const c = useCopy(DEMO_COPY);
  return (
    <section
      aria-labelledby="demo-boundary"
      data-boundary={role}
      className="rounded-2xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]"
    >
      <h3 id="demo-boundary" className="text-caption font-semibold text-text-muted">
        {c.boundary.title}
      </h3>
      <ul className="mt-2 space-y-1">
        {c.boundary.items[role].map((x) => (
          <li key={x} className="flex items-baseline gap-2 text-caption text-text-secondary">
            <X aria-hidden className="size-3 shrink-0 translate-y-[0.1em] text-text-muted" />
            {x}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-brand-soft">{c.shell.sameWork}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* History and completion                                               */
/* ------------------------------------------------------------------ */

export function HistoryTable({ s }: { s: DemoSession }) {
  const c = useCopy(DEMO_COPY);
  const h = c.history;
  if (!s.state.trace.length) return <p className="text-label text-text-muted">{h.empty}</p>;
  return (
    <>
      {/* Phones: one event per row, every field labelled */}
      <ol data-history-list className="space-y-2 sm:hidden">
        {s.state.trace.map((e) => (
          <li key={e.seq} className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-caption">
            <p className="flex flex-wrap items-center gap-x-2 text-label text-text-primary">
              <span className="text-text-muted tabular">{e.seq}.</span>
              {c.roles[e.role].name} · {c.actions[e.action]}
              {e.prevented && (
                <span className="inline-flex items-center gap-1 text-caption text-warning">
                  <TriangleAlert aria-hidden className="size-3" />
                  {h.prevented}
                </span>
              )}
            </p>
            <p className="mt-1 text-text-secondary">
              {h.cols.before}: {c.states[e.before]} → {h.cols.after}: {c.states[e.after]}
            </p>
            {e.handoff && (
              <p className="mt-0.5 text-brand-soft">
                {h.cols.handoff}: {c.roles[e.handoff.from].name} → {c.roles[e.handoff.to].name}
              </p>
            )}
          </li>
        ))}
      </ol>
      <div className="hidden sm:block">
        <table data-history className="w-full text-left text-caption">
          <caption className="sr-only">{h.caption}</caption>
          <thead>
            <tr className="text-text-muted">
              {Object.values(h.cols).map((col) => (
                <th key={col} scope="col" className="px-2 py-2 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {s.state.trace.map((e) => (
              <tr
                key={e.seq}
                data-trace={e.action}
                data-prevented={e.prevented ? 'true' : undefined}
              >
                <td className="px-2 py-2 text-text-muted tabular">{e.seq}</td>
                <td className="px-2 py-2 text-text-primary">{c.roles[e.role].name}</td>
                <td className="px-2 py-2 text-text-primary">
                  {c.actions[e.action]}
                  {e.prevented && (
                    <span className="ml-2 inline-flex items-center gap-1 text-warning">
                      <TriangleAlert aria-hidden className="size-3" />
                      {h.prevented}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-text-secondary">{c.states[e.before]}</td>
                <td className="px-2 py-2 text-text-secondary">{c.states[e.after]}</td>
                <td className="px-2 py-2 text-text-secondary">
                  {e.handoff
                    ? `${c.roles[e.handoff.from].name} → ${c.roles[e.handoff.to].name}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Completion({
  s,
  dispatch,
  onHistory,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
  onHistory: () => void;
}) {
  const c = useCopy(DEMO_COPY);
  const { href } = useLocale();
  const f = useDemoFormat();
  const sum = summarize(s.state);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const stats = [
    ['handoffs', sum.handoffs],
    ['departments', sum.departments],
    ['exceptions', sum.exceptions],
    ['prevented', sum.prevented],
    ['events', sum.events],
  ] as const;
  return (
    <section
      aria-labelledby="demo-complete"
      data-completion
      className="rounded-[1.75rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.95),rgb(6_13_20/0.95))] p-5 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)] sm:p-8"
    >
      <h3
        id="demo-complete"
        ref={ref}
        tabIndex={-1}
        className="text-h2 text-text-primary outline-none"
      >
        {c.completion.title}
      </h3>
      <p className="mt-2 text-body text-text-secondary">{c.completion.lead}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} data-stat={k} className="rounded-xl bg-white/[0.04] px-3 py-3">
            <dt className="text-caption text-text-muted">{c.completion.stats[k]}</dt>
            <dd className="mt-1 text-[1.75rem] leading-none font-semibold text-text-primary tabular">
              {f.num(v)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-caption text-text-muted">{c.completion.note}</p>
      <h4 className="mt-6 text-caption font-semibold text-text-muted">
        {c.completion.learnedTitle}
      </h4>
      <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {c.completion.learned.map((l) => (
          <li key={l} className="flex items-baseline gap-2 text-label text-text-primary">
            <Check aria-hidden className="size-3.5 shrink-0 translate-y-[0.15em] text-brand-glow" />
            {l}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          to={href(DEMO_LINKS.contact)}
          data-cta="contact"
          className={buttonClasses('primary', 'lg', 'whitespace-normal')}
        >
          {c.completion.contact}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link
          to={href(DEMO_LINKS.pricing)}
          data-cta="pricing"
          className={buttonClasses('secondary', 'lg')}
        >
          {c.completion.pricing}
        </Link>
        <button
          type="button"
          data-cta="again"
          onClick={() => dispatch({ kind: 'reset' })}
          className={buttonClasses('ghost', 'lg')}
        >
          <RotateCcw aria-hidden className="size-4" />
          {c.completion.again}
        </button>
        <button type="button" onClick={onHistory} className={buttonClasses('ghost', 'lg')}>
          <History aria-hidden className="size-4" />
          {c.history.open}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live announcements — meaningful scenario events only                 */
/* ------------------------------------------------------------------ */

function useAnnouncement(s: DemoSession) {
  const c = useCopy(DEMO_COPY);
  const r = s.last;
  if (!r) return '';
  if (!r.ok) return r.reason === 'lotRequired' ? `${c.prevent.title} — ${c.prevent.body}` : '';
  const e = r.event;
  const parts: string[] = [];
  if (e.action === 'receiveGoods') {
    parts.push(
      c.announce.received(SCENARIO.firstReceipt, SCENARIO.po.qty),
      c.announce.outstanding(OUTSTANDING),
    );
  }
  if (e.exception === 'resolved') parts.push(c.announce.resolved);
  if (e.handoff)
    parts.push(c.announce.handoff(c.roles[e.handoff.from].name, c.roles[e.handoff.to].name));
  if (!parts.length && e.before !== e.after) parts.push(c.announce.status(c.states[e.after]));
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* The shell                                                            */
/* ------------------------------------------------------------------ */

export function DemoShell({
  s,
  dispatch,
  historyOpen,
  setHistoryOpen,
}: {
  s: DemoSession;
  dispatch: Dispatch<SessionAction>;
  historyOpen: boolean;
  setHistoryOpen: (v: boolean) => void;
}) {
  const c = useCopy(DEMO_COPY);
  const reduce = usePrefersReducedMotion();
  const announcement = useAnnouncement(s);
  const done = isTerminal(s.state.status);
  const historyRef = useRef<HTMLDivElement>(null);
  const openHistory = () => {
    setHistoryOpen(true);
    requestAnimationFrame(() =>
      historyRef.current?.scrollIntoView?.({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start',
      }),
    );
  };

  return (
    <section
      aria-labelledby="demo-shell-title"
      data-demo-shell
      className="rounded-[1.75rem] bg-[#060e15] p-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.09),0_60px_160px_-80px_rgb(0_0_0/0.9)] sm:p-5"
    >
      <h2 id="demo-shell-title" className="sr-only">
        {c.shell.label}
      </h2>
      {/* Top bar */}
      <div className="flex flex-col gap-3 border-b border-border-soft pb-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex flex-wrap items-center gap-2.5">
          <span className="text-label font-semibold tracking-[0.12em] text-text-primary">
            {c.shell.brand}
          </span>
          <span
            data-demo-tag
            className="rounded-md bg-warning/15 px-2 py-0.5 text-caption font-semibold tracking-[0.2em] text-warning"
          >
            {c.demoTag}
          </span>
          <span data-disclosure className="text-caption text-text-muted">
            {c.disclosure}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={c.shell.mode}
            className="inline-flex rounded-full bg-white/[0.04] p-1"
          >
            {([true, false] as const).map((g) => (
              <button
                key={String(g)}
                type="button"
                aria-pressed={s.guided === g}
                data-mode={g ? 'guided' : 'explore'}
                onClick={() => dispatch({ kind: 'guided', value: g })}
                className={cn(
                  'min-h-11 rounded-full px-3.5 text-caption font-semibold transition-colors sm:min-h-9',
                  s.guided === g
                    ? 'bg-white/[0.1] text-text-primary'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {g ? c.shell.guided : c.shell.explore}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-history-toggle
            aria-expanded={historyOpen}
            aria-controls="demo-history"
            onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
          >
            <History aria-hidden className="size-4" />
            {c.shell.history}
          </button>
          <button
            type="button"
            data-reset
            onClick={() => dispatch({ kind: 'reset' })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
          >
            <RotateCcw aria-hidden className="size-4" />
            {c.shell.reset}
          </button>
          <button
            type="button"
            data-exit
            onClick={() => dispatch({ kind: 'exit' })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-text-secondary hover:bg-white/[0.05] hover:text-text-primary"
          >
            <LogOut aria-hidden className="size-4" />
            {c.shell.exit}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <RoleTabs s={s} dispatch={dispatch} />
      </div>
      <div className="mt-3 lg:sticky lg:top-20 lg:z-10">
        <WorkItemBar s={s} />
      </div>

      <p aria-live="polite" data-announcer className="sr-only">
        {announcement}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[12.5rem_minmax(0,1fr)_19rem] xl:grid-cols-[13.5rem_minmax(0,1fr)_21rem]">
        {/* Stages: a rail on wide screens, collapsible on small ones */}
        <aside className="order-4 lg:order-1">
          <details className="group rounded-2xl bg-white/[0.02] p-2 lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-2 text-caption font-semibold text-text-muted">
              {c.shell.stagesLabel}
              <DisclosureIcon size="sm" />
            </summary>
            <StageList s={s} className="mt-1" />
          </details>
          <div className="hidden lg:block">
            <p className="px-2.5 pb-2 text-caption font-semibold text-text-muted">
              {c.shell.stagesLabel}
            </p>
            <StageList s={s} />
          </div>
        </aside>

        {/* The role workspace */}
        <div className="order-2 min-w-0">
          {done && (
            <div className="mb-4">
              <Completion s={s} dispatch={dispatch} onHistory={openHistory} />
            </div>
          )}
          <motion.div
            key={s.role}
            id="demo-workspace"
            role="tabpanel"
            aria-labelledby={`demo-tab-${s.role}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-[#0a1219] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)] sm:p-5"
          >
            <RoleWorkspace s={s} dispatch={dispatch} />
          </motion.div>
        </div>

        {/* Context: one thing at a time on small screens (it sits above the workspace) */}
        <aside aria-label={c.shell.context} className="order-1 flex flex-col gap-3 lg:order-3">
          <HandoffCard s={s} dispatch={dispatch} />
          <NextCard s={s} dispatch={dispatch} />
          <div className="hidden lg:block">
            <BoundaryCard role={s.role} />
          </div>
        </aside>
        <div className="order-3 lg:hidden">
          <BoundaryCard role={s.role} />
        </div>
      </div>

      <div
        ref={historyRef}
        id="demo-history"
        hidden={!historyOpen}
        className="mt-4 scroll-mt-24 rounded-2xl bg-white/[0.02] p-4 sm:p-5"
      >
        <h3 className="mb-3 text-label font-semibold text-text-primary">{c.history.title}</h3>
        <HistoryTable s={s} />
      </div>
    </section>
  );
}
