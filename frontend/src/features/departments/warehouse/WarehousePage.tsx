import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  CheckCircle2,
  Eye,
  EyeOff,
  PauseCircle,
  PlayCircle,
  ScanLine,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { EASE_CORE } from '@/motion/tokens';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { tabKeys } from '../tabs';
import {
  ConnectedDepartments,
  DeptCta,
  DeptHero,
  DeptPage,
  FlowIO,
  ManagerLens,
  ProductPreview,
  Section,
  SectionHead,
  TodayBoard,
} from '../ui';
import { WAREHOUSE } from './copy';

type CellState = 'ok' | 'near' | 'hold' | null;
const STATE_ICON = {
  ok: { icon: CheckCircle2, className: 'text-success', border: 'border-success/40' },
  near: { icon: AlertTriangle, className: 'text-warning', border: 'border-warning/50' },
  hold: { icon: PauseCircle, className: 'text-danger', border: 'border-danger/50' },
} as const;

/* Location grid: aisles A–D, levels 3 → 1. Lots carry identity and expiry only. */
const AISLES = ['A', 'B', 'C', 'D'];
const CELLS: { lot?: string; exp?: string; state: CellState }[][] = [
  [
    { state: null },
    { lot: 'L-2409-B', exp: '02/27', state: 'ok' },
    { state: null },
    { lot: 'L-2407-D', exp: '01/27', state: 'hold' },
  ],
  [
    { lot: 'L-2408-C', exp: '12/26', state: 'near' },
    { state: null },
    { lot: 'L-2406-E', exp: '05/27', state: 'ok' },
    { state: null },
  ],
  [
    { lot: 'L-2410-A', exp: '03/27', state: 'ok' },
    { lot: 'L-2405-F', exp: '04/27', state: 'ok' },
    { state: null },
    { lot: 'L-2408-G', exp: '12/26', state: 'near' },
  ],
];

function LocationGrid() {
  const c = useCopy(WAREHOUSE);
  const reduce = usePrefersReducedMotion();
  return (
    <figure aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[40rem]">
      <div aria-hidden className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[6rem_1fr]">
        {/* Receiving dock */}
        <div className="relative flex flex-col items-center justify-end rounded-xl border border-dashed border-ws-warehouse/50 bg-ws-warehouse/[0.06] p-2 pb-3">
          <motion.div
            initial={reduce ? false : { y: 0 }}
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-full rounded-md border border-ws-warehouse/60 bg-surface-raised px-1 py-1 text-center text-[0.5625rem] text-text-primary sm:text-[0.625rem]"
          >
            L-2411-H
          </motion.div>
          <ScanLine className="mt-2 size-4 text-ws-warehouse" />
          <span className="mt-1 text-[0.625rem] text-text-muted sm:text-caption">
            {c.hero.dock}
          </span>
        </div>
        <div>
          <div className="mb-1.5 grid grid-cols-4 gap-1.5 text-center text-[0.625rem] text-text-muted sm:text-caption">
            {AISLES.map((a) => (
              <span key={a}>
                {c.hero.aisle} {a}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {CELLS.flatMap((row, r) =>
              row.map((cell, i) => {
                const code = `${AISLES[i]}-0${i + 1}-${3 - r}`;
                const s = cell.state ? STATE_ICON[cell.state] : null;
                const target = r === 2 && i === 0;
                return (
                  <div
                    key={code}
                    className={cn(
                      'relative min-h-[3.75rem] rounded-lg border bg-surface-base/80 p-1.5 sm:min-h-[4.5rem] sm:p-2',
                      s ? s.border : 'border-dashed border-border-soft',
                      target && !reduce && 'ring-2 ring-ws-warehouse/50',
                    )}
                  >
                    <span className="block text-[0.5625rem] text-text-muted tabular sm:text-[0.625rem]">
                      {code}
                    </span>
                    {cell.lot && s && (
                      <span className="mt-1 block">
                        <span className="block truncate text-[0.625rem] font-medium text-text-primary sm:text-[0.6875rem]">
                          {cell.lot}
                        </span>
                        <span
                          className={cn(
                            'flex items-center gap-1 text-[0.5625rem] sm:text-[0.625rem]',
                            s.className,
                          )}
                        >
                          <s.icon className="size-2.5 shrink-0 sm:size-3" />
                          EXP {cell.exp}
                        </span>
                      </span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-secondary">
        {(['ok', 'near', 'hold'] as const).map((k) => {
          const s = STATE_ICON[k];
          return (
            <span key={k} className="flex items-center gap-1.5">
              <s.icon className={cn('size-3.5', s.className)} aria-hidden />
              {c.hero.legend[k]}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}

function Privacy() {
  const c = useCopy(WAREHOUSE);
  const p = c.privacy;
  return (
    <Section labelledBy="wh-privacy" className="py-12 sm:py-16">
      <div
        data-privacy-statement
        className="rounded-[1.75rem] border border-ws-warehouse/30 bg-[radial-gradient(ellipse_70%_100%_at_0%_0%,rgb(79_208_143/0.10),transparent_70%)] p-6 sm:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <SectionHead id="wh-privacy" eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-panel border border-border-soft bg-surface-base/80 p-4">
              <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                <Eye className="size-4 text-success" aria-hidden />
                {p.sees}
              </p>
              <ul className="mt-3 space-y-1.5 text-caption text-text-secondary">
                {p.seesItems.map((it) => (
                  <li key={it} className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-panel border border-border-soft bg-surface-base/80 p-4">
              <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                <EyeOff className="size-4 text-text-muted" aria-hidden />
                {p.never}
              </p>
              <ul className="mt-3 space-y-1.5 text-caption text-text-muted">
                {p.neverItems.map((it) => (
                  <li
                    key={it}
                    className="flex items-center gap-2 line-through decoration-text-muted/60"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Receiving() {
  const c = useCopy(WAREHOUSE);
  const r = c.receiving;
  return (
    <Section labelledBy="wh-receiving">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
        <div>
          <SectionHead id="wh-receiving" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
          <ol className="mt-8 space-y-3">
            {r.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-label text-text-secondary">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-ws-warehouse/50 text-caption text-text-primary tabular">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        {/* Phone-first receiving screen (design direction for floor work). */}
        <figure className="mx-auto w-[17rem]">
          <div
            aria-hidden
            className="rounded-[2.25rem] border border-border-strong bg-surface-dark p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]"
          >
            <div className="overflow-hidden rounded-[1.75rem] border border-line bg-canvas">
              <div className="flex items-center justify-between border-b border-line bg-nav px-4 py-3">
                <span className="text-label font-semibold text-fg-primary">{r.device}</span>
                <ScanLine className="size-4 text-ws-warehouse" />
              </div>
              <div className="space-y-3 p-4">
                <p className="text-caption text-fg-secondary">{r.po}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-panel p-2">
                    <p className="text-[0.625rem] text-fg-muted">{r.expected}</p>
                    <p className="text-metric text-fg-primary tabular">120</p>
                  </div>
                  <div className="rounded-lg border border-ws-warehouse/50 bg-panel p-2">
                    <p className="text-[0.625rem] text-fg-muted">{r.received}</p>
                    <p className="text-metric text-fg-primary tabular">120</p>
                  </div>
                </div>
                <dl className="space-y-1.5">
                  {r.fields.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between rounded-lg border border-line bg-panel-raised px-2.5 py-1.5 text-caption"
                    >
                      <dt className="text-fg-muted">{f.label}</dt>
                      <dd className="font-medium text-fg-primary">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-full bg-ws-warehouse/90 py-2 text-center text-caption font-semibold text-text-inverse">
                  {r.confirm}
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-3 text-center text-caption text-text-muted">
            {r.note}
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

function Stock() {
  const c = useCopy(WAREHOUSE);
  const s = c.stock;
  return (
    <Section labelledBy="wh-stock">
      <SectionHead id="wh-stock" eyebrow={s.eyebrow} title={s.title} lead={s.lead} />
      <Reveal className="mt-10 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[32rem] text-left text-label">
          <thead className="bg-panel-raised text-caption text-fg-muted">
            <tr>
              {Object.values(s.cols).map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => {
              const near = r.location === 'B-03-1';
              return (
                <tr key={r.item} className="border-t border-line bg-panel">
                  <th scope="row" className="px-4 py-3 font-medium text-fg-primary">
                    {r.item}
                  </th>
                  <td className="px-4 py-3 text-fg-secondary tabular">{r.location}</td>
                  <td className="px-4 py-3 text-fg-secondary tabular">{r.lots}</td>
                  <td className="px-4 py-3 text-fg-primary tabular">{r.qty}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-caption',
                        near ? 'text-warning' : 'text-success',
                      )}
                    >
                      {near ? (
                        <AlertTriangle className="size-3.5" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      )}
                      {r.state}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Reveal>
    </Section>
  );
}

function LotIdentity() {
  const c = useCopy(WAREHOUSE);
  const l = c.lot;
  return (
    <Section labelledBy="wh-lot">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <SectionHead id="wh-lot" eyebrow={l.eyebrow} title={l.title} lead={l.lead} />
        <Reveal className="relative overflow-hidden rounded-card border border-ws-warehouse/40 bg-panel p-5 sm:p-6">
          <span
            aria-hidden
            className="absolute -top-10 -right-10 size-40 rounded-full bg-ws-warehouse/10"
          />
          <dl className="relative grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {l.card.map((f, i) => (
              <div key={f.label} className={cn(i === 0 && 'col-span-2 sm:col-span-3')}>
                <dt className="text-caption text-fg-muted">{f.label}</dt>
                <dd
                  className={cn(
                    'font-semibold text-fg-primary',
                    i === 0 ? 'text-[1.75rem] leading-tight tracking-wide tabular' : 'text-label',
                  )}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}

/* Expiry timeline: months on an axis, lots placed by expiry, today marker. */
const TIMELINE_LOTS = [
  { lot: 'L-2408-C', pos: 0.18, near: true },
  { lot: 'L-2408-G', pos: 0.22, near: true },
  { lot: 'L-2409-B', pos: 0.42, near: false },
  { lot: 'L-2410-A', pos: 0.55, near: false },
  { lot: 'L-2406-E', pos: 0.78, near: false },
];

function LotStory() {
  const c = useCopy(WAREHOUSE);
  const s = c.story;
  return (
    <Section labelledBy="wh-story">
      <SectionHead id="wh-story" eyebrow={s.eyebrow} title={s.title} lead={s.lead} />
      <Reveal stagger className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {s.steps.map((st, i) => (
          <RevealItem
            key={st.name}
            className={cn(
              'relative rounded-panel border p-3',
              i === 4
                ? 'border-warning/45 bg-warning/[0.06]'
                : i === 5
                  ? 'border-ws-warehouse/55 bg-ws-warehouse/[0.08]'
                  : 'border-border-soft bg-surface-base/70',
            )}
          >
            <p className="text-caption text-text-muted tabular">0{i + 1}</p>
            <p className="mt-1 text-label font-semibold text-text-primary">{st.name}</p>
            <p className="mt-0.5 text-caption text-text-secondary">{st.body}</p>
          </RevealItem>
        ))}
      </Reveal>
      <figure className="mt-8 rounded-card border border-border-soft bg-surface-base/60 p-5">
        <figcaption className="text-caption text-text-muted">{s.timeline}</figcaption>
        <div
          aria-hidden
          className="relative mt-10 mb-8 h-1 rounded-full bg-gradient-to-r from-warning/60 via-ws-warehouse/40 to-ws-warehouse/20"
        >
          <span className="absolute -top-7 left-[6%] -translate-x-1/2 text-caption text-brand-glow">
            {s.today}
          </span>
          <span className="absolute -top-2 left-[6%] h-5 w-0.5 -translate-x-1/2 bg-brand-glow" />
          {TIMELINE_LOTS.map((l, i) => (
            <span
              key={l.lot}
              style={{ left: `${l.pos * 100}%` }}
              className={cn(
                'absolute -translate-x-1/2 rounded-md border px-1.5 py-0.5 text-[0.625rem] whitespace-nowrap',
                i % 2 ? 'top-3' : '-top-8',
                l.near
                  ? 'border-warning/60 bg-surface-raised text-warning'
                  : 'border-border-soft bg-surface-raised text-text-secondary',
              )}
            >
              {l.lot}
            </span>
          ))}
        </div>
      </figure>
    </Section>
  );
}

function Fefo() {
  const c = useCopy(WAREHOUSE);
  const f = c.fefo;
  const [mode, setMode] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // FEFO takes 30 from the earliest lot and 20 from the next; “nearest” takes all 50 from the newest.
  const picks = mode === 0 ? [30, 20, 0] : [0, 0, 50];
  return (
    <Section labelledBy="wh-fefo">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <SectionHead id="wh-fefo" eyebrow={f.eyebrow} title={f.title} lead={f.lead} />
        <div className="rounded-card border border-line bg-panel p-4 sm:p-5">
          <p className="text-label font-semibold text-fg-primary">{f.request}</p>
          <div
            role="tablist"
            aria-label={f.tabs}
            onKeyDown={(e) => tabKeys(2, mode, setMode, tabs)(e)}
            className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel-raised p-1"
          >
            {[f.fefoTab, f.nearTab].map((label, i) => (
              <button
                key={label}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`fefo-tab-${i}`}
                aria-selected={mode === i}
                aria-controls="fefo-panel"
                tabIndex={mode === i ? 0 : -1}
                onClick={() => setMode(i)}
                className={cn(
                  'min-h-11 rounded-lg px-2 text-caption font-medium transition-colors',
                  mode === i
                    ? 'bg-fill-active text-fg-primary'
                    : 'text-fg-secondary hover:text-fg-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="fefo-panel"
            role="tabpanel"
            aria-labelledby={`fefo-tab-${mode}`}
            className="mt-4"
          >
            <ul className="space-y-2">
              {f.lots.map((l, i) => {
                const pick = picks[i]!;
                const leftBehind = mode === 1 && i === 0;
                return (
                  <li
                    key={l.lot}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-caption',
                      pick
                        ? 'border-ws-warehouse/55 bg-ws-warehouse/[0.08]'
                        : leftBehind
                          ? 'border-warning/50 bg-warning/[0.06]'
                          : 'border-line bg-panel-raised',
                    )}
                  >
                    <span>
                      <span className="block font-medium text-fg-primary">{l.lot}</span>
                      <span className={cn(leftBehind ? 'text-warning' : 'text-fg-muted')}>
                        EXP {l.exp} · {l.qty}
                      </span>
                    </span>
                    {pick > 0 ? (
                      <span className="flex items-center gap-1.5 font-semibold text-ws-warehouse">
                        <ArrowUpFromLine className="size-3.5" aria-hidden />
                        {f.pick} {pick}
                      </span>
                    ) : leftBehind ? (
                      <AlertTriangle className="size-4 text-warning" aria-hidden />
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <motion.p
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_CORE }}
              className={cn(
                'mt-4 flex items-start gap-2 text-label',
                mode === 0 ? 'text-success' : 'text-warning',
              )}
            >
              {mode === 0 ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {mode === 0 ? f.fefoResult : f.nearResult}
            </motion.p>
          </div>
        </div>
      </div>
    </Section>
  );
}

const MOVE_ICON = [ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine];

function Movement() {
  const c = useCopy(WAREHOUSE);
  const m = c.movement;
  return (
    <Section labelledBy="wh-move">
      <SectionHead id="wh-move" eyebrow={m.eyebrow} title={m.title} lead={m.lead} />
      <Reveal stagger className="mt-10 space-y-2">
        {m.rows.map((r, i) => {
          const Icon = MOVE_ICON[i]!;
          return (
            <RevealItem
              key={r.detail}
              className="grid gap-2 rounded-panel border border-line bg-panel px-4 py-3 sm:grid-cols-[10rem_1fr_5rem_12rem] sm:items-center"
            >
              <p className="flex items-center gap-2 text-label font-medium text-fg-primary">
                <Icon className="size-4 text-ws-warehouse" aria-hidden />
                {r.kind}
              </p>
              <p className="text-caption text-fg-secondary tabular">{r.detail}</p>
              <p className="text-label font-semibold text-fg-primary tabular">{r.qty}</p>
              <p className="text-caption text-fg-muted">{r.who}</p>
            </RevealItem>
          );
        })}
      </Reveal>
    </Section>
  );
}

function Count() {
  const c = useCopy(WAREHOUSE);
  const k = c.count;
  return (
    <Section labelledBy="wh-count">
      <SectionHead id="wh-count" eyebrow={k.eyebrow} title={k.title} lead={k.lead} />
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[28rem] text-left text-label">
            <thead className="bg-panel-raised text-caption text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium" />
                <th scope="col" className="px-4 py-3 font-medium">
                  {k.system}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {k.counted}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {k.variance}
                </th>
              </tr>
            </thead>
            <tbody>
              {k.rows.map((r) => {
                const diff = r.counted - r.system;
                return (
                  <tr key={r.item} className="border-t border-line bg-panel">
                    <th
                      scope="row"
                      className="px-4 py-3 text-caption font-medium text-fg-primary tabular"
                    >
                      {r.item}
                    </th>
                    <td className="px-4 py-3 text-fg-secondary tabular">{r.system}</td>
                    <td className="px-4 py-3 text-fg-primary tabular">{r.counted}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-caption',
                          diff ? 'text-warning' : 'text-success',
                        )}
                      >
                        {diff ? (
                          <AlertTriangle className="size-3.5" aria-hidden />
                        ) : (
                          <CheckCircle2 className="size-3.5" aria-hidden />
                        )}
                        <span className="tabular">{diff}</span> · {diff ? k.flagged : k.matched}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Reveal>
        <Reveal className="rounded-card border border-border-soft bg-surface-base/70 p-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-danger/50 px-3 py-1 text-caption text-text-primary">
              <PauseCircle className="size-3.5 text-danger" aria-hidden />
              {k.hold}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-r from-danger/60 to-success/60"
            />
            <span className="flex items-center gap-1.5 rounded-full border border-success/50 px-3 py-1 text-caption text-text-primary">
              <PlayCircle className="size-3.5 text-success" aria-hidden />
              {k.release}
            </span>
          </div>
          <p className="mt-4 text-label text-text-secondary">{k.holdNote}</p>
        </Reveal>
      </div>
    </Section>
  );
}

export default function WarehousePage() {
  const c = useCopy(WAREHOUSE);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="warehouse">
      <DeptHero
        dept="warehouse"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<LocationGrid />}
      />
      <Privacy />
      <TodayBoard id="wh-today" copy={c.today} />
      <Receiving />
      <Stock />
      <LotIdentity />
      <LotStory />
      <Fefo />
      <Movement />
      <Count />
      <FlowIO id="wh-io" copy={c.io} />
      <ManagerLens id="wh-manager" copy={c.manager} />
      <ProductPreview
        id="wh-preview"
        dept="warehouse"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="wh-connected" dept="warehouse" copy={c.connections} />
      <DeptCta id="wh-cta" dept="warehouse" />
    </DeptPage>
  );
}
