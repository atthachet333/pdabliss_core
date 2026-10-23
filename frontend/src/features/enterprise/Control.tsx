import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChevronRight,
  Clock,
  GitFork,
  Gauge,
  Network,
  Radar,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { Segmented } from '@/components/ui/Segmented';
import { useDepartments } from '@/config/departments';
import { tabKeys } from '@/features/departments/tabs';
import { PLANS } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ENTERPRISE } from './copy';
import {
  APPROVAL_RAILS,
  AUDIT_DEPT,
  AUDIT_EVENTS,
  CHAPTER,
  CONTROLS,
  DRILL,
  EXEC_SIGNALS,
  type AuditEvent,
  type RailId,
} from './model';
import { Head, Note, StatusTag } from './parts';

/* ------------------------------------------------------------------ */
/* 04 Workflow & approval control — one board, three rails              */
/* ------------------------------------------------------------------ */

const APPROVER = new Set(['manager', 'finance', 'executive']);

export function ControlChapter() {
  const c = useCopy(ENTERPRISE).control;
  const [rail, setRail] = useState<RailId>('advanced');
  const steps = APPROVAL_RAILS.find((r) => r.id === rail)!.steps;
  return (
    <Chapter id={CHAPTER.control} labelledBy="control-title" plane="deep" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="control-title" title={c.title} lead={c.lead} />

        <Stage glow="executive" className="mt-14">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <Segmented
              label={c.eyebrow}
              options={APPROVAL_RAILS.map((r) => ({ value: r.id, label: c.rails[r.id].name }))}
              value={rail}
              onChange={setRail}
              className="grid w-full grid-cols-1 sm:grid-cols-3 lg:w-auto"
            />
            <p aria-live="polite" className="text-label text-text-secondary lg:text-right">
              {c.rails[rail].body}
            </p>
          </div>
          <ol
            data-rail={rail}
            className="flex flex-col gap-3 p-6 sm:p-10 md:flex-row md:items-center md:gap-0"
          >
            {steps.map((s, i) => {
              const approver = APPROVER.has(s);
              const condition = s === 'condition';
              return (
                <li key={`${s}-${i}`} data-step={s} className="flex items-center md:flex-1">
                  <div
                    className={cn(
                      'flex min-h-14 flex-1 items-center gap-2.5 rounded-2xl px-4 py-3 md:flex-col md:items-start md:gap-1',
                      approver
                        ? 'bg-[linear-gradient(160deg,rgb(25_195_154/0.2),rgb(25_195_154/0.05))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]'
                        : condition
                          ? 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.45)] [background:repeating-linear-gradient(135deg,rgb(245_184_75/0.06),rgb(245_184_75/0.06)_6px,transparent_6px,transparent_12px)]'
                          : 'bg-white/[0.04]',
                    )}
                  >
                    <span className="text-caption text-text-muted tabular">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-label font-medium',
                        condition ? 'text-warning' : 'text-text-primary',
                      )}
                    >
                      {approver && <Check aria-hidden className="size-3.5 text-brand-glow" />}
                      {condition && <GitFork aria-hidden className="size-3.5" />}
                      {c.steps[s]}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight
                      aria-hidden
                      className="mx-1 hidden size-4 shrink-0 text-text-muted md:block"
                    />
                  )}
                </li>
              );
            })}
          </ol>
          {rail === 'conditional' && (
            <p className="px-6 pb-8 text-label text-text-secondary sm:px-10" data-condition-note>
              {c.conditionNote}
            </p>
          )}
        </Stage>

        <div className="mt-14 grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {CONTROLS.map((x) => (
            <div
              key={x.id}
              data-control={x.id}
              className="flex flex-col gap-1 border-t border-border-soft py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <div>
                <p className="text-body font-semibold text-text-primary">
                  {c.controls[x.id].title}
                </p>
                <p className="mt-1 text-label text-text-secondary">{c.controls[x.id].body}</p>
              </div>
              <StatusTag status={x.status} className="shrink-0 sm:mt-1" />
            </div>
          ))}
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Audit / trace — a timeline and one expanded record                */
/* ------------------------------------------------------------------ */

export function AuditChapter() {
  const c = useCopy(ENTERPRISE).audit;
  const departments = useDepartments();
  const [index, setIndex] = useState(2);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const ev: AuditEvent = AUDIT_EVENTS[index]!;
  const e = c.events[ev];
  const dept = AUDIT_DEPT[ev];
  const rows = [
    { k: 'user', v: e.user },
    { k: 'role', v: e.role },
    { k: 'department', v: departments.find((d) => d.id === dept)!.name },
    { k: 'order', v: `${index + 1} / ${AUDIT_EVENTS.length}` },
    { k: 'source', v: e.source },
  ] as const;
  return (
    <Chapter id={CHAPTER.audit} labelledBy="audit-title" space="lg">
      <Frame width="base">
        <Head eyebrow={c.eyebrow} id="audit-title" title={c.title} lead={c.lead} />

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <p id="audit-events" className="text-caption font-semibold text-text-muted">
              {c.choose}
            </p>
            <div
              role="tablist"
              aria-labelledby="audit-events"
              aria-orientation="vertical"
              onKeyDown={(e) => tabKeys(AUDIT_EVENTS.length, index, setIndex, refs)(e)}
              className="relative mt-4 space-y-1 before:absolute before:top-4 before:bottom-4 before:left-[1.4rem] before:w-px before:bg-border-strong"
            >
              {AUDIT_EVENTS.map((x, i) => {
                const on = i === index;
                return (
                  <button
                    key={x}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`audit-tab-${x}`}
                    aria-selected={on}
                    aria-controls="audit-record"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setIndex(i)}
                    data-audit-event={x}
                    className={cn(
                      'relative flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left transition-colors duration-200',
                      on ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface-dark',
                        on && 'shadow-[0_0_14px_rgb(62_240_192/0.6)]',
                      )}
                      style={{ borderColor: `var(--color-ws-${AUDIT_DEPT[x]})` }}
                    >
                      {on && <span className="size-1.5 rounded-full bg-brand-glow" />}
                    </span>
                    <span
                      className={cn(
                        'flex-1 text-label',
                        on ? 'font-medium text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {c.events[x].title}
                    </span>
                    {on && <ArrowRight aria-hidden className="size-4 text-brand-glow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Stage glow="clear" grid={false}>
            <div
              id="audit-record"
              role="tabpanel"
              aria-labelledby={`audit-tab-${ev}`}
              aria-live="polite"
              data-audit-record={ev}
              className="p-6 sm:p-10"
            >
              <p className="text-caption text-text-muted">{e.source}</p>
              <p className="mt-2 text-h3 font-semibold text-text-primary">{e.title}</p>
              {/* State change */}
              <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-white/[0.03] p-4">
                <div>
                  <p className="text-caption text-text-muted">{c.fields.before}</p>
                  <p className="mt-1 text-label text-text-secondary" data-before>
                    {e.before}
                  </p>
                </div>
                <ArrowRight aria-hidden className="size-4 text-brand-glow" />
                <div>
                  <p className="text-caption text-brand-soft">{c.fields.after}</p>
                  <p className="mt-1 text-label font-medium text-text-primary" data-after>
                    {e.after}
                  </p>
                </div>
              </div>
              <dl className="mt-6 divide-y divide-white/[0.05]">
                {rows.map((r) => (
                  <div
                    key={r.k}
                    data-audit-field={r.k}
                    className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-2.5"
                  >
                    <dt className="text-caption text-text-muted">{c.fields[r.k]}</dt>
                    <dd className="text-label text-text-primary">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Stage>
        </div>
        <Note className="mt-10">
          <span data-audit-claim>{c.claim}</span>
        </Note>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Executive visibility — a command layer that descends to source    */
/* ------------------------------------------------------------------ */

const SIGNAL_ICON: Record<(typeof EXEC_SIGNALS)[number], LucideIcon> = {
  blocked: Ban,
  exceptions: AlertTriangle,
  approvals: Clock,
  departments: Network,
  bottlenecks: Gauge,
  risk: Radar,
};

export function ExecutiveChapter() {
  const c = useCopy(ENTERPRISE).executive;
  const [depth, setDepth] = useState(2);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <Chapter id={CHAPTER.executive} labelledBy="executive-title" plane="glow" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="executive-title" title={c.title} lead={c.lead} />

        {/* The executive band: signals, not transactions */}
        <ul
          data-signals
          className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] bg-brand-glow/10 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.2)] sm:grid-cols-3 lg:grid-cols-6"
        >
          {EXEC_SIGNALS.map((s) => {
            const Icon = SIGNAL_ICON[s];
            return (
              <li
                key={s}
                data-signal={s}
                className="flex min-h-20 flex-col justify-center gap-2 bg-[rgb(8_24_28)] px-4 py-4 sm:px-5"
              >
                <Icon aria-hidden className="size-4 text-brand-glow" />
                <span className="text-label text-text-primary">{c.signals[s]}</span>
              </li>
            );
          })}
        </ul>

        {/* Terraces — each layer one step closer to the source */}
        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div
            role="radiogroup"
            aria-label={c.drillLabel}
            onKeyDown={(e) => tabKeys(DRILL.length, depth, setDepth, refs)(e)}
            className="space-y-2"
          >
            {DRILL.map((d, i) => {
              const open = i <= depth;
              const on = i === depth;
              return (
                <button
                  key={d}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setDepth(i)}
                  data-drill={d}
                  data-open={open}
                  style={{ ['--indent' as string]: `${i * 2.25}rem` }}
                  className={cn(
                    'flex min-h-14 w-full flex-col items-start gap-1 rounded-2xl px-5 py-3 text-left transition-[background-color,box-shadow] duration-300 sm:ml-[var(--indent)] sm:w-[calc(100%-var(--indent))] sm:flex-row sm:items-center sm:gap-5',
                    on
                      ? 'bg-[linear-gradient(90deg,rgb(25_195_154/0.2),rgb(25_195_154/0.04))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                      : open
                        ? 'bg-white/[0.04]'
                        : 'bg-white/[0.015] hover:bg-white/[0.04]',
                  )}
                >
                  <span className="flex shrink-0 items-center gap-2 text-label font-semibold text-text-primary sm:w-36">
                    <span className="text-caption font-normal text-text-muted tabular">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {c.drill[d].name}
                  </span>
                  <span
                    className={cn('text-label', open ? 'text-text-secondary' : 'text-text-muted')}
                  >
                    {open ? c.drill[d].shows : '…'}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <Kicker tone="muted">{c.reportsTitle}</Kicker>
            <ol className="mt-5 space-y-2" data-report-tiers>
              {PLANS.map((p, i) => (
                <li
                  key={p.id}
                  data-report-plan={p.id}
                  data-report-level={p.reports}
                  style={{ ['--w' as string]: `${55 + i * 15}%` }}
                  className={cn(
                    'w-full rounded-xl px-4 py-3 sm:w-[var(--w)]',
                    p.id === 'enterprise'
                      ? 'bg-[linear-gradient(90deg,rgb(62_224_180/0.18),rgb(62_224_180/0.05))]'
                      : 'bg-white/[0.035]',
                  )}
                >
                  <p className="text-caption text-text-muted">{p.name}</p>
                  <p className="mt-0.5 text-label text-text-primary">{c.reports[p.id]}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}
