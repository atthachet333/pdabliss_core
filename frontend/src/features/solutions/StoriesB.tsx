import {
  ArrowDown,
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
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { SOLUTIONS_COPY } from './copy';
import { COUNT, fefoPicks, GATES, LOTS, PICK, RECEIPT, type Gate } from './model';
import { Panel, Story, ToneBadge } from './parts';

const WorldPreview = lazy(() => import('@/features/landing/home/previews'));

function Preview({ id, caption }: { id: 'warehouse' | 'executive'; caption: string }) {
  return (
    <figure className="mt-8 max-w-3xl">
      <div
        inert
        aria-hidden
        className="pointer-events-none overflow-hidden rounded-2xl border border-border-soft bg-surface-base"
      >
        <Suspense fallback={<div className="h-56 animate-pulse bg-surface-raised/50" />}>
          <WorldPreview id={id} />
        </Suspense>
      </div>
      <figcaption className="mt-2 text-caption text-text-muted">{caption}</figcaption>
    </figure>
  );
}

/* 07 — stock / lot / expiry: quantities, lots, dates and locations only */
function StockVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const s = c.stock;
  const byExpiry = [...LOTS].sort((a, b) => a.days - b.days);
  const picks = fefoPicks(LOTS, PICK);
  const maxDays = 180;
  return (
    <div className="space-y-3" data-stock>
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-5" aria-label={s.stages.join(' → ')}>
        {s.stages.map((st, i) => (
          <li
            key={st}
            className="flex items-center gap-2 rounded-xl border border-border-soft px-3 py-2 text-caption text-text-secondary"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-brand text-[0.6875rem] text-text-primary tabular">
              {i + 1}
            </span>
            {st}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Quantity by location, each with its lot identity */}
        <Panel>
          <ul className="space-y-2">
            {LOTS.map((l) => (
              <li
                key={l.code}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border-soft bg-surface-base px-3 py-2.5"
              >
                <MapPin aria-hidden className="size-4 text-[var(--color-ws-warehouse)]" />
                <span className="min-w-0">
                  <span className="block text-label text-text-primary tabular">{l.code}</span>
                  <span className="block text-caption text-text-muted">
                    {s.location} {l.location}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-label font-semibold text-text-primary tabular">
                    {l.qty}
                  </span>
                  <span className="block text-caption text-text-muted">{c.common.units}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        {/* Expiry timeline */}
        <Panel>
          <div className="relative h-28" aria-hidden>
            <span className="absolute top-14 right-0 left-0 h-px bg-border-strong" />
            <span className="absolute top-8 bottom-6 left-0 w-px bg-brand-glow" />
            <span className="absolute top-0 left-0 text-caption text-brand-soft">{s.today}</span>
            {LOTS.map((l, i) => {
              const near = l.days < 45;
              return (
                <span
                  key={l.code}
                  className="absolute top-14 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(l.days / maxDays) * 92 + 4}%` }}
                >
                  <span
                    className={cn(
                      'block size-3.5 rounded-full border-2 bg-surface-base',
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
          <ul className="mt-2 space-y-1">
            {byExpiry.map((l) => (
              <li key={l.code} className="flex items-center justify-between gap-3 text-caption">
                <span className="text-text-secondary tabular">{l.code}</span>
                {l.days < 45 ? (
                  <ToneBadge tone="attention" label={fill(s.expiresIn, { n: l.days })} />
                ) : (
                  <span className="text-text-muted">{fill(s.expiresIn, { n: l.days })}</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* FEFO */}
        <Panel tone="clear">
          <p className="text-label font-semibold text-text-primary">
            FEFO · {fill(s.pick, { n: PICK })}
          </p>
          <ul className="mt-3 space-y-2" data-fefo>
            {picks.map((p) => (
              <li
                key={p.code}
                data-pick={p.take}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-label',
                  p.take
                    ? 'border-border-brand/60 bg-surface-raised text-text-primary'
                    : 'border-border-soft text-text-muted',
                )}
              >
                <span className="tabular">{p.code}</span>
                <span className="tabular">{p.take ? fill(s.pickFrom, { n: p.take }) : '—'}</span>
              </li>
            ))}
          </ul>
        </Panel>
        {/* Movement and count */}
        <Panel>
          <ul className="space-y-1.5 text-caption text-text-secondary">
            {s.movement.map((m) => (
              <li key={m} className="tabular">
                {m}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-caption" data-count>
            <div className="rounded-lg border border-border-soft px-2 py-1.5">
              <dt className="text-text-muted">{s.count.system}</dt>
              <dd className="text-text-primary tabular">{COUNT.system}</dd>
            </div>
            <div className="rounded-lg border border-border-soft px-2 py-1.5">
              <dt className="text-text-muted">{s.count.counted}</dt>
              <dd className="text-text-primary tabular">{COUNT.counted}</dd>
            </div>
            <div className="rounded-lg border border-warning/50 px-2 py-1.5">
              <dt className="text-text-muted">{s.count.variance}</dt>
              <dd className="text-warning tabular">−{COUNT.system - COUNT.counted}</dd>
            </div>
          </dl>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
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
        </Panel>
      </div>
      <p className="text-caption text-text-muted">{s.privacy}</p>
    </div>
  );
}

export function StockStory() {
  const c = useCopy(SOLUTIONS_COPY);
  return (
    <Story
      id="stock"
      layout="stacked"
      visual={<StockVisual />}
      aside={<Preview id="warehouse" caption={c.previewCaption} />}
    />
  );
}

/* 08 — supplier visibility: commitment vs receipt, and what the delay touches */
function SupplierVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const s = c.supplier;
  const outstanding = RECEIPT.ordered - RECEIPT.received;
  const pctReceived = (RECEIPT.received / RECEIPT.ordered) * 100;
  return (
    <Panel tone="warm">
      <ol className="flex flex-wrap items-center gap-1.5 text-caption">
        {s.chain.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1',
                i < 3
                  ? 'border-border-brand/50 text-text-primary'
                  : i === 3
                    ? 'border-border-strong text-text-primary'
                    : 'border-warning/50 text-warning',
              )}
            >
              {step}
            </span>
            {i < s.chain.length - 1 && (
              <ArrowRight aria-hidden className="size-3 text-text-muted" />
            )}
          </li>
        ))}
      </ol>
      <div className="mt-6" data-receipt>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-label font-semibold text-text-primary tabular">PO-2215</p>
          <ToneBadge tone="attention" label={s.late} />
        </div>
        <div
          className="mt-3 flex h-4 overflow-hidden rounded-full border border-border-soft"
          aria-hidden
        >
          <span className="h-full bg-brand-glow/70" style={{ width: `${pctReceived}%` }} />
          <span className="h-full flex-1 bg-[repeating-linear-gradient(45deg,rgb(245_184_75/0.35)_0_6px,transparent_6px_12px)]" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-caption">
          <div>
            <dt className="text-text-muted">{s.ordered}</dt>
            <dd className="text-body font-semibold text-text-primary tabular">
              {RECEIPT.ordered}{' '}
              <span className="text-caption font-normal text-text-muted">{c.common.units}</span>
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">{s.received}</dt>
            <dd className="text-body font-semibold text-text-primary tabular">
              {RECEIPT.received}
            </dd>
          </div>
          <div>
            <dt className="text-warning">{s.outstanding}</dt>
            <dd className="text-body font-semibold text-warning tabular">{outstanding}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 border-t border-border-soft pt-4">
        <p className="flex items-center gap-1.5 text-caption font-semibold text-text-muted">
          <ArrowDown aria-hidden className="size-3.5" />
          {s.impactTitle}
        </p>
        <ul className="mt-2 space-y-1.5">
          {s.impact.map((item) => (
            <li key={item} className="flex items-center gap-2 text-label text-text-secondary">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export function SupplierStory() {
  return <Story id="supplier" layout="splitReverse" visual={<SupplierVisual />} />;
}

/* 09 — document / payment dependency: gates before payment */
function PaymentVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const p = c.payment;
  const [have, setHave] = useState<Record<Gate, boolean>>({
    po: true,
    receipt: false,
    invoice: true,
    approval: false,
  });
  const ready = GATES.every((g) => have[g]);
  return (
    <Panel tone={ready ? 'clear' : 'neutral'}>
      <div className="flex items-center gap-2">
        <FileText aria-hidden className="size-5 text-[var(--color-ws-accounting)]" />
        <p className="text-label font-semibold text-text-primary tabular">{p.request}</p>
      </div>
      <p className="mt-1 text-caption text-text-muted">{p.hint}</p>
      <ul className="mt-4 space-y-2" data-gates>
        {GATES.map((g) => (
          <li key={g}>
            <button
              type="button"
              role="switch"
              aria-checked={have[g]}
              data-gate={g}
              onClick={() => setHave((h) => ({ ...h, [g]: !h[g] }))}
              className={cn(
                'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors duration-200',
                have[g]
                  ? 'border-border-brand/50 bg-surface-raised'
                  : 'border-dashed border-warning/50',
              )}
            >
              <span className="text-label text-text-primary">{p.gates[g]}</span>
              {have[g] ? (
                <ToneBadge tone="resolved" label={p.present} />
              ) : (
                <ToneBadge tone="blocked" label={p.missing} />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div
        role="status"
        data-payment-state={ready ? 'ready' : 'blocked'}
        className={cn(
          'mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-label font-semibold',
          ready ? 'border-success/50 text-success' : 'border-border-strong text-text-secondary',
        )}
      >
        {ready ? (
          <LockOpen aria-hidden className="size-5" />
        ) : (
          <Lock aria-hidden className="size-5" />
        )}
        {ready ? p.ready : p.notReady}
      </div>
    </Panel>
  );
}

export function PaymentStory() {
  return <Story id="payment" layout="split" visual={<PaymentVisual />} />;
}

/* 10 — management visibility: quiet activity below, exceptions rise */
function ManagementVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const m = c.management;
  const departments = useDepartments();
  const cols = ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'] as const;
  // Which dot in each column is an exception (index), or none.
  const raised: Record<(typeof cols)[number], number | null> = {
    sales: 2,
    operations: null,
    warehouse: 4,
    purchasing: 1,
    accounting: 3,
  };
  return (
    <Panel>
      <div
        className="rounded-2xl border border-border-brand/50 bg-surface-raised p-4"
        data-executive-panel
      >
        <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
          <Eye aria-hidden className="size-4 text-[var(--color-ws-executive)]" />
          {m.panel}
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {m.signals.map((s) => (
            <li key={s.label} className="rounded-lg border border-border-soft px-3 py-2">
              <p className="text-caption text-text-muted">{s.label}</p>
              <p className="text-label text-text-primary">{s.value}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-center text-caption text-warning">↑ {m.rises}</p>
      <div className="mt-3 grid grid-cols-5 gap-2" aria-hidden>
        {cols.map((d) => (
          <div key={d} className="flex flex-col items-center gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-full',
                  raised[d] === i
                    ? 'size-3 -translate-y-1 border-2 border-warning bg-surface-base'
                    : 'size-2 bg-text-muted/35',
                )}
              />
            ))}
            <span className="mt-1 text-center text-[0.6875rem] leading-tight text-text-muted">
              {departments.find((x) => x.id === d)!.name}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-caption text-text-muted">{m.quiet}</p>
    </Panel>
  );
}

export function ManagementStory() {
  const c = useCopy(SOLUTIONS_COPY);
  return (
    <Story
      id="management"
      layout="splitReverse"
      visual={<ManagementVisual />}
      aside={<Preview id="executive" caption={c.previewCaption} />}
    />
  );
}

/* 11 — cross-department: separate workspaces, one process */
function CrossVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const departments = useDepartments();
  const { href } = useLocale();
  return (
    <div>
      <p className="text-caption font-semibold text-text-muted">{c.cross.workspaces}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-cross>
        {DEPT_PAGES.map((d) => {
          const info = departments.find((x) => x.id === d)!;
          return (
            <li key={d}>
              <Link
                to={href(`/departments/${d}`)}
                className="group block overflow-hidden rounded-2xl border border-border-soft bg-surface-base transition-colors hover:border-border-strong"
              >
                <img
                  src={info.image.sm}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                />
                <span className="flex items-center gap-2 px-3 py-2.5 text-label text-text-primary">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: `var(--color-ws-${d})` }}
                  />
                  {info.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* One shared state beneath every workspace */}
      <div className="relative mt-4 flex items-center justify-center" aria-hidden>
        <span className="absolute inset-x-[8%] top-1/2 h-0.5 rounded-full bg-gradient-to-r from-brand-glow/20 via-brand-glow to-brand-glow/20" />
      </div>
      <p className="mt-4 text-center text-label font-semibold text-brand-soft">{c.cross.shared}</p>
    </div>
  );
}

export function CrossDepartmentStory() {
  return <Story id="crossDepartment" layout="stacked" visual={<CrossVisual />} />;
}
