import {
  ArrowRight,
  Eye,
  FileText,
  Lock,
  LockOpen,
  MapPin,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { SOLUTIONS_COPY } from './copy';
import {
  COUNT,
  fefoPicks,
  GATES,
  getSolution,
  LOTS,
  PICK,
  RECEIPT,
  type Gate,
  type SolutionId,
} from './model';
import {
  Boundary,
  Chapter,
  ChapterTitle,
  Facts,
  Frame,
  Kicker,
  MetaStrip,
  ToneBadge,
} from './parts';

const WorldPreview = lazy(() => import('@/features/landing/home/previews'));
const titleId = (id: SolutionId) => `${getSolution(id).anchor}-title`;

function Preview({
  id,
  caption,
  className,
}: {
  id: 'warehouse' | 'executive';
  caption: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div
        inert
        aria-hidden
        className="pointer-events-none overflow-hidden rounded-2xl bg-surface-base shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)]"
      >
        <Suspense fallback={<div className="h-56 animate-pulse bg-surface-raised/50" />}>
          <WorldPreview id={id} />
        </Suspense>
      </div>
      <figcaption className="mt-2 text-caption text-text-muted">{caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — Stock / Lot / Expiry · operational control surface              */
/* ------------------------------------------------------------------ */

export function StockStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.stock;
  const s = c.stock;
  const picks = fefoPicks(LOTS, PICK);
  const focus = picks[0]!; // the earliest-expiring lot carries the identity panel
  const wide = useMediaQuery('(min-width: 64rem)');
  const maxDays = 180;
  return (
    <Chapter
      id={getSolution('stock').anchor}
      labelledBy={titleId('stock')}
      plane="navy"
      space="lg"
      data={{ solution: 'stock' }}
    >
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('stock')} className="mt-5">
              {st.title}
            </ChapterTitle>
            <Facts id="stock" variant="prose" className="mt-6" />
            <ol
              className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-caption text-text-secondary"
              aria-label={s.stages.join(' → ')}
            >
              {s.stages.map((stage, i) => (
                <li key={stage} className="flex items-center gap-2">
                  <span className="text-[var(--color-ws-warehouse)] tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {stage}
                </li>
              ))}
            </ol>
          </div>
          {wide && <Preview id="warehouse" caption={c.previewCaption} />}
        </div>
      </Frame>

      {/* The control surface: locations · lot identity · expiry & FEFO, then movement & count */}
      <Frame width="full" className="mt-14 lg:mt-20">
        <div
          className="overflow-hidden rounded-[2rem] bg-surface-dark/80 shadow-[inset_0_1px_0_rgb(190_235_222/0.06)]"
          data-stock
        >
          <div className="grid grid-cols-1 divide-y divide-border-soft lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] lg:divide-x lg:divide-y-0">
            {/* Locations */}
            <div className="p-6 sm:p-8">
              <Kicker tone="muted">{s.stages[0]}</Kicker>
              <ul className="mt-4 divide-y divide-border-soft">
                {LOTS.map((l) => (
                  <li
                    key={l.code}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5"
                  >
                    <MapPin aria-hidden className="size-4 text-[var(--color-ws-warehouse)]" />
                    <span className="min-w-0">
                      <span className="block text-label text-text-primary tabular">
                        {l.location}
                      </span>
                      <span className="block text-caption text-text-muted tabular">{l.code}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-body font-semibold text-text-primary tabular">
                        {l.qty}
                      </span>
                      <span className="block text-caption text-text-muted">{c.common.units}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Lot identity */}
            <div className="bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(79_208_143/0.1),transparent_70%)] p-6 sm:p-8">
              <Kicker tone="muted">{s.stages[1]}</Kicker>
              <p className="mt-5 text-caption text-text-muted">{s.lot}</p>
              <p className="text-[clamp(1.75rem,1.2rem+1.5vw,2.5rem)] leading-tight font-semibold text-text-primary tabular">
                {focus.code}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-caption text-text-muted">{s.location}</dt>
                  <dd className="text-label text-text-primary tabular">{focus.location}</dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">{s.qty}</dt>
                  <dd className="text-label text-text-primary tabular">
                    {focus.qty} {c.common.units}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="sr-only">{s.lot}</dt>
                  <dd>
                    <ToneBadge tone="attention" label={fill(s.expiresIn, { n: focus.days })} />
                  </dd>
                </div>
              </dl>
            </div>
            {/* Expiry timeline + FEFO */}
            <div className="p-6 sm:p-8">
              <Kicker tone="muted">{s.stages[2]}</Kicker>
              <div className="relative mt-6 h-24" aria-hidden>
                <span className="absolute top-12 right-0 left-0 h-px bg-border-strong" />
                <span className="absolute top-6 bottom-4 left-0 w-px bg-brand-glow" />
                <span className="absolute top-0 left-0 text-caption text-brand-soft">
                  {s.today}
                </span>
                {LOTS.map((l, i) => {
                  const near = l.days < 45;
                  return (
                    <span
                      key={l.code}
                      className="absolute top-12 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${(l.days / maxDays) * 90 + 6}%` }}
                    >
                      <span
                        className={cn(
                          'block size-3.5 rounded-full border-2 bg-surface-dark',
                          near ? 'border-warning' : 'border-[var(--color-ws-warehouse)]',
                        )}
                      />
                      <span
                        className={cn(
                          'absolute left-1/2 -translate-x-1/2 text-[0.6875rem] whitespace-nowrap tabular',
                          i % 2 ? 'top-5' : '-top-6',
                          near ? 'text-warning' : 'text-text-muted',
                        )}
                      >
                        {l.code}
                      </span>
                    </span>
                  );
                })}
              </div>
              <p className="mt-4 text-label font-semibold text-text-primary">
                FEFO · {fill(s.pick, { n: PICK })}
              </p>
              <ul className="mt-2 divide-y divide-border-soft" data-fefo>
                {picks.map((p) => (
                  <li
                    key={p.code}
                    data-pick={p.take}
                    className={cn(
                      'flex items-center justify-between gap-3 py-2.5 text-label',
                      p.take ? 'text-text-primary' : 'text-text-muted',
                    )}
                  >
                    <span className="flex items-center gap-2 tabular">
                      <span
                        aria-hidden
                        className={cn(
                          'size-1.5 rounded-full',
                          p.take ? 'bg-brand-glow' : 'bg-text-muted/40',
                        )}
                      />
                      {p.code}
                      <span className="text-caption text-text-muted">
                        {fill(s.expiresIn, { n: p.days })}
                      </span>
                    </span>
                    <span className="tabular">
                      {p.take ? fill(s.pickFrom, { n: p.take }) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Movement and count */}
          <div className="grid grid-cols-1 gap-6 border-t border-border-soft p-6 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
            <div>
              <Kicker tone="muted">{s.stages[4]}</Kicker>
              <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-label text-text-secondary sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {s.movement.map((m) => (
                  <li key={m} className="tabular">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <dl className="flex gap-8" data-count>
                <div>
                  <dt className="text-caption text-text-muted">{s.count.system}</dt>
                  <dd className="text-h3 text-text-primary tabular">{COUNT.system}</dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">{s.count.counted}</dt>
                  <dd className="text-h3 text-text-primary tabular">{COUNT.counted}</dd>
                </div>
                <div>
                  <dt className="text-caption text-warning">{s.count.variance}</dt>
                  <dd className="text-h3 text-warning tabular">−{COUNT.system - COUNT.counted}</dd>
                </div>
              </dl>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 text-caption">
                <span className="inline-flex items-center gap-1 text-warning">
                  <PauseCircle aria-hidden className="size-3.5" />
                  {s.count.hold}
                </span>
                <ArrowRight aria-hidden className="size-3.5 text-text-muted" />
                <span className="inline-flex items-center gap-1 text-success">
                  <PlayCircle aria-hidden className="size-3.5" />
                  {s.count.release}
                </span>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-caption text-text-muted">{s.privacy}</p>
      </Frame>
      <Frame width="wide">
        {!wide && <Preview id="warehouse" caption={c.previewCaption} className="mt-12" />}
        <MetaStrip id="stock" variant="quiet" className="mt-16" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — Supplier visibility · wide timeline, cause and effect           */
/* ------------------------------------------------------------------ */

export function SupplierStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.supplier;
  const s = c.supplier;
  const outstanding = RECEIPT.ordered - RECEIPT.received;
  const pctReceived = (RECEIPT.received / RECEIPT.ordered) * 100;
  const nodes = s.chain.slice(0, 5);
  return (
    <Chapter
      id={getSolution('supplier').anchor}
      labelledBy={titleId('supplier')}
      space="lg"
      data={{ solution: 'supplier' }}
    >
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('supplier')} className="mt-5">
              {st.title}
            </ChapterTitle>
          </div>
          <Facts id="supplier" variant="prose" />
        </div>
      </Frame>
      <Frame width="full" className="mt-16 lg:mt-24">
        {/* The timeline: commitment on the left, the delay point, then receipt */}
        <ol className="relative grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-0">
          <span
            aria-hidden
            className="absolute top-4 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-brand-glow/60 via-brand-glow/60 via-45% to-warning/60 lg:block"
          />
          {nodes.map((n, i) => {
            const late = i >= 3;
            return (
              <li key={n} className="relative flex items-center gap-4 lg:flex-col lg:text-center">
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-dark ring-2',
                    late ? 'ring-warning' : 'ring-brand-glow',
                  )}
                >
                  <span
                    className={cn('size-2 rounded-full', late ? 'bg-warning' : 'bg-brand-glow')}
                  />
                </span>
                <span className="lg:mt-4">
                  <span
                    className={cn(
                      'block text-body font-semibold',
                      late ? 'text-warning' : 'text-text-primary',
                    )}
                  >
                    {n}
                  </span>
                  {i === 2 && <ToneBadge tone="attention" label={s.late} className="mt-1" />}
                </span>
              </li>
            );
          })}
        </ol>
        {/* Below the delay point: what it receives, and what it touches downstream */}
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-0">
          <div className="lg:col-span-3 lg:col-start-3 lg:border-l lg:border-dashed lg:border-warning/40 lg:pl-10">
            <div data-receipt>
              <p className="text-label font-semibold text-text-primary tabular">PO-2215</p>
              <div
                className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-raised"
                aria-hidden
              >
                <span className="h-full bg-brand-glow/70" style={{ width: `${pctReceived}%` }} />
                <span className="h-full flex-1 bg-[repeating-linear-gradient(45deg,rgb(245_184_75/0.4)_0_6px,transparent_6px_12px)]" />
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-3">
                <div>
                  <dt className="text-caption text-text-muted">{s.ordered}</dt>
                  <dd className="text-h3 text-text-primary tabular">
                    {RECEIPT.ordered}{' '}
                    <span className="text-caption font-normal text-text-muted">
                      {c.common.units}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-text-muted">{s.received}</dt>
                  <dd className="text-h3 text-text-primary tabular">{RECEIPT.received}</dd>
                </div>
                <div>
                  <dt className="text-caption text-warning">{s.outstanding}</dt>
                  <dd className="text-h3 text-warning tabular">{outstanding}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-10">
              <Kicker>{s.impactTitle}</Kicker>
              <ul className="mt-3 space-y-3">
                {s.impact.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-body text-text-secondary">
                    <span aria-hidden className="mt-2.5 h-px w-6 shrink-0 bg-warning/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Frame>
      <Frame width="wide">
        <MetaStrip id="supplier" variant="split" className="mt-20" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — Document / payment dependency · compact gate                    */
/* ------------------------------------------------------------------ */

export function PaymentStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.payment;
  const p = c.payment;
  const [have, setHave] = useState<Record<Gate, boolean>>({
    po: true,
    receipt: false,
    invoice: true,
    approval: false,
  });
  const ready = GATES.every((g) => have[g]);
  return (
    <Chapter
      id={getSolution('payment').anchor}
      labelledBy={titleId('payment')}
      space="md"
      plane="glow"
      data={{ solution: 'payment' }}
    >
      <Frame width="base" className="max-w-5xl">
        <Kicker>{st.eyebrow}</Kicker>
        <ChapterTitle id={titleId('payment')} size="compact" className="mt-4 text-h2">
          {st.title}
        </ChapterTitle>
        <Facts id="payment" variant="columns" className="mt-8" />
        {/* Documents enter from the left; the gate opens when all are present */}
        <div className="mt-12 grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,0.8fr)] md:gap-10">
          <div>
            <p className="flex items-center gap-2 text-label font-semibold text-text-primary tabular">
              <FileText aria-hidden className="size-4 text-[var(--color-ws-accounting)]" />
              {p.request}
            </p>
            <p className="mt-1 text-caption text-text-muted">{p.hint}</p>
            <ul className="mt-4 space-y-1" data-gates>
              {GATES.map((g) => (
                <li key={g}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={have[g]}
                    data-gate={g}
                    onClick={() => setHave((h) => ({ ...h, [g]: !h[g] }))}
                    className={cn(
                      'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left transition-colors duration-200',
                      have[g]
                        ? 'bg-surface-raised/80'
                        : 'bg-transparent shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]',
                    )}
                  >
                    <span className="flex items-center gap-3 text-label text-text-primary">
                      <span
                        aria-hidden
                        className={cn(
                          'relative h-5 w-9 rounded-full transition-colors',
                          have[g] ? 'bg-brand-primary' : 'bg-surface-overlay',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 size-4 rounded-full bg-text-primary transition-[left]',
                            have[g] ? 'left-4.5' : 'left-0.5',
                          )}
                        />
                      </span>
                      {p.gates[g]}
                    </span>
                    {have[g] ? (
                      <ToneBadge tone="resolved" label={p.present} />
                    ) : (
                      <ToneBadge tone="blocked" label={p.missing} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {/* The gate */}
          <div aria-hidden className="relative hidden h-48 w-14 md:block">
            <span
              className={cn(
                'absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full transition-all duration-500',
                ready ? 'top-0 h-14 bg-success/70' : 'top-0 h-[46%] bg-border-strong',
              )}
            />
            <span
              className={cn(
                'absolute left-1/2 w-1.5 -translate-x-1/2 rounded-full transition-all duration-500',
                ready ? 'bottom-0 h-14 bg-success/70' : 'bottom-0 h-[46%] bg-border-strong',
              )}
            />
            <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-dark">
              {ready ? (
                <LockOpen className="size-5 text-success" />
              ) : (
                <Lock className="size-5 text-text-muted" />
              )}
            </span>
          </div>
          <div
            role="status"
            data-payment-state={ready ? 'ready' : 'blocked'}
            className={cn(
              'flex items-center gap-3 text-h3 font-semibold transition-colors',
              ready ? 'text-success' : 'text-text-secondary',
            )}
          >
            {ready ? (
              <LockOpen aria-hidden className="size-6 md:hidden" />
            ) : (
              <Lock aria-hidden className="size-6 md:hidden" />
            )}
            {ready ? p.ready : p.notReady}
          </div>
        </div>
        <Boundary id="payment" className="mt-10 max-w-3xl" />
        <MetaStrip id="payment" variant="quiet" className="mt-14" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 10 — Management visibility · executive hierarchy                     */
/* ------------------------------------------------------------------ */

const COLS = ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'] as const;
/** Which dot in each department's field is an exception, if any. */
const RAISED: Record<(typeof COLS)[number], number | null> = {
  sales: 7,
  operations: null,
  warehouse: 12,
  purchasing: 4,
  accounting: 9,
};

export function ManagementStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.management;
  const m = c.management;
  const departments = useDepartments();
  const raisedCols = COLS.map((d, i) => ({ d, i })).filter(({ d }) => RAISED[d] !== null);
  return (
    <Chapter
      id={getSolution('management').anchor}
      labelledBy={titleId('management')}
      plane="deep"
      space="lg"
      data={{ solution: 'management' }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-2/3 bg-[radial-gradient(ellipse_60%_55%_at_50%_30%,rgb(62_224_180/0.1),transparent_70%)]"
      />
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('management')} size="statement" className="mt-5">
              {st.title}
            </ChapterTitle>
          </div>
          <Facts id="management" variant="prose" />
        </div>
      </Frame>
      <Frame width="full" className="mt-16 lg:mt-24">
        {/* Executive attention — the top layer */}
        <div
          className="grid grid-cols-1 gap-8 rounded-[2rem] bg-[linear-gradient(to_bottom,rgb(62_224_180/0.09),transparent)] p-6 sm:p-10"
          data-executive-panel
        >
          <div>
            <p className="flex items-center gap-2 text-label font-semibold text-[var(--color-ws-executive)]">
              <Eye aria-hidden className="size-4" />
              {m.panel}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
              {m.signals.map((s) => (
                <li key={s.label} className="border-t border-[var(--color-ws-executive)]/35 pt-3">
                  <p className="text-caption text-text-muted">{s.label}</p>
                  <p className="mt-1 text-body text-text-primary">{s.value}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Signals rising from the floor to the executive layer */}
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 1000 200"
            preserveAspectRatio="none"
            className="h-36 w-full sm:h-48"
          >
            <defs>
              <linearGradient id="rise" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="var(--color-warning)" stopOpacity="0.85" />
                <stop offset="1" stopColor="var(--color-ws-executive)" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {raisedCols.map(({ d, i }, k) => (
              <path
                key={d}
                d={`M ${100 + i * 200} 200 C ${100 + i * 200} 110, ${350 + k * 100} 90, ${350 + k * 100} 0`}
                fill="none"
                stroke="url(#rise)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[clamp(1.25rem,0.9rem+1.4vw,2.25rem)] leading-snug font-semibold whitespace-pre-line text-text-primary [text-shadow:0_0_40px_rgb(3_7_12)]">
            {c.anchors.normal}
          </p>
        </div>
        <p className="text-center text-caption text-warning">↑ {m.rises}</p>
        {/* Departments — normal activity stays quiet */}
        <div className="mt-8 grid grid-cols-5 gap-2 sm:gap-8" aria-hidden>
          {COLS.map((d) => (
            <div key={d} className="flex flex-col items-center">
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2.5">
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'rounded-full',
                      RAISED[d] === i
                        ? 'size-2.5 bg-warning ring-4 ring-warning/15 sm:size-3'
                        : 'size-1.5 bg-text-muted/25 sm:size-2',
                    )}
                  />
                ))}
              </div>
              <span className="mt-4 text-center text-caption leading-tight text-text-muted">
                {departments.find((x) => x.id === d)!.name}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-caption text-text-muted">{m.quiet}</p>
      </Frame>
      <Frame width="wide">
        <MetaStrip id="management" className="mt-20" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 11 — Cross-department · wide synthesis                               */
/* ------------------------------------------------------------------ */

export function CrossDepartmentStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.crossDepartment;
  const departments = useDepartments();
  const { href } = useLocale();
  return (
    <Chapter
      id={getSolution('crossDepartment').anchor}
      labelledBy={titleId('crossDepartment')}
      plane="clear"
      space="lg"
      data={{ solution: 'crossDepartment' }}
    >
      <Frame width="narrow" className="text-center">
        <Kicker tone="clear">{st.eyebrow}</Kicker>
        <ChapterTitle id={titleId('crossDepartment')} size="statement" className="mt-5">
          {st.title}
        </ChapterTitle>
      </Frame>
      <Frame width="full" className="mt-16 lg:mt-20">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-6" data-cross>
          {DEPT_PAGES.map((d) => {
            const info = departments.find((x) => x.id === d)!;
            return (
              <li key={d} className="flex flex-col items-center">
                <Link
                  to={href(`/departments/${d}`)}
                  className="group block w-full overflow-hidden rounded-2xl bg-surface-base"
                >
                  <img
                    src={info.image.sm}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover opacity-75 transition-opacity group-hover:opacity-100"
                  />
                  <span className="flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-label text-text-primary">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-ws-${d})` }}
                    />
                    {info.name}
                  </span>
                </Link>
                <span
                  aria-hidden
                  className="hidden h-10 w-px bg-gradient-to-b from-border-strong to-brand-glow/80 lg:block"
                />
              </li>
            );
          })}
        </ul>
        {/* One shared CORE state beneath every workspace */}
        <div className="relative mt-6 flex items-center justify-center lg:mt-0" aria-hidden>
          <span className="absolute inset-x-[8.3%] top-1/2 h-0.5 rounded-full bg-gradient-to-r from-brand-glow/30 via-brand-glow to-brand-glow/30" />
          <span className="relative rounded-full bg-surface-dark px-5 py-2 text-label font-bold tracking-[0.2em] text-brand-soft ring-1 ring-brand-glow/60">
            CORE
          </span>
        </div>
        <p className="mt-6 text-center text-body font-semibold text-brand-soft">{c.cross.shared}</p>
      </Frame>
      <Frame width="wide">
        <Facts id="crossDepartment" variant="columns" className="mx-auto mt-16 max-w-5xl" />
        <MetaStrip id="crossDepartment" variant="split" className="mt-14" />
      </Frame>
    </Chapter>
  );
}
