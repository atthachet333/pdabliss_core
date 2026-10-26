import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  FileCheck2,
  FileText,
  Lock,
  LockOpen,
  MinusCircle,
  PauseCircle,
  Receipt,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { EASE_CORE } from '@/motion/tokens';
import { Reveal, RevealItem } from '@/motion/Reveal';
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
import { ACCOUNTING } from './copy';

/** Hero: documents are verified one by one until the payment unlocks. */
function VerificationSequence() {
  const c = useCopy(ACCOUNTING);
  const reduce = usePrefersReducedMotion();
  const root = useRef<HTMLElement>(null);
  // The sequence pauses while the hero is offscreen or the tab is hidden.
  const live = useLoopRegion(root);
  const total = c.hero.docs.length;
  const [checked, setChecked] = useState(reduce ? total : 0);
  useEffect(() => {
    if (reduce || !live) return;
    const t = window.setInterval(() => setChecked((n) => (n >= total + 1 ? 0 : n + 1)), 1200);
    return () => window.clearInterval(t);
  }, [reduce, total, live]);
  const done = Math.min(checked, total);
  const ready = done === total;
  return (
    <figure ref={root} aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[34rem]">
      <div aria-hidden className="grid items-center gap-5 sm:grid-cols-[1fr_auto]">
        <ol className="relative space-y-2">
          {c.hero.docs.map((d, i) => {
            const ok = i < done;
            return (
              <motion.li
                key={d}
                animate={{ x: ok ? 0 : 6, opacity: ok ? 1 : 0.65 }}
                transition={{ duration: reduce ? 0 : 0.4, ease: EASE_CORE }}
                style={{ marginInlineStart: `${i * 0.6}rem` }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-[0_12px_30px_-18px_rgb(0_0_0/0.9)]',
                  ok
                    ? 'border-ws-accounting/50 bg-surface-raised'
                    : 'border-border-soft bg-surface-base',
                )}
              >
                <FileText className="size-4 shrink-0 text-ws-accounting" />
                <span className="flex-1 text-label text-text-primary">{d}</span>
                {ok ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-text-muted" />
                )}
              </motion.li>
            );
          })}
        </ol>
        {/* Payment rail */}
        <div className="flex items-center gap-3 sm:flex-col">
          <span
            className={cn('h-px w-10 sm:h-16 sm:w-px', ready ? 'bg-success' : 'bg-border-strong')}
          />
          <motion.div
            animate={{ scale: ready ? 1.04 : 1 }}
            transition={{ duration: reduce ? 0 : 0.35 }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-center',
              ready
                ? 'border-success/60 bg-success/[0.08]'
                : 'border-border-strong bg-surface-base',
            )}
          >
            {ready ? (
              <LockOpen className="size-5 text-success" />
            ) : (
              <Lock className="size-5 text-text-muted" />
            )}
            <span
              className={cn(
                'text-caption font-semibold',
                ready ? 'text-success' : 'text-text-secondary',
              )}
            >
              {ready ? c.hero.ready : c.hero.locked}
            </span>
          </motion.div>
        </div>
      </div>
    </figure>
  );
}

function Positioning() {
  const c = useCopy(ACCOUNTING);
  const p = c.positioning;
  return (
    <Section labelledBy="acc-position">
      <SectionHead id="acc-position" eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
      <Reveal className="mt-10 grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <div className="rounded-card border border-ws-accounting/35 bg-surface-base/70 p-5">
          <p className="text-label font-semibold text-text-primary">{p.does}</p>
          <ul className="mt-3 space-y-2">
            {p.doesItems.map((it) => (
              <li key={it} className="flex items-center gap-2.5 text-label text-text-secondary">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                {it}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-border-soft bg-surface-base/40 p-5">
          <p className="text-label font-semibold text-text-secondary">{p.not}</p>
          <ul className="mt-3 space-y-2">
            {p.notItems.map((it) => (
              <li key={it} className="flex items-center gap-2.5 text-label text-text-muted">
                <MinusCircle className="size-4 shrink-0" aria-hidden />
                {it}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-text-muted">{p.notNote}</p>
        </div>
      </Reveal>
    </Section>
  );
}

function PaymentRequest() {
  const c = useCopy(ACCOUNTING);
  const r = c.request;
  return (
    <Section labelledBy="acc-request">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <SectionHead id="acc-request" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
        <Reveal className="rounded-card border border-line bg-panel p-5">
          <p className="flex items-center gap-2 text-label font-semibold text-fg-primary">
            <Receipt className="size-4 text-ws-accounting" aria-hidden />
            {r.sample}
          </p>
          <dl className="mt-3 divide-y divide-line">
            {r.fields.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 py-2.5 text-caption">
                <dt className="text-fg-muted">{f.label}</dt>
                <dd className="text-right text-fg-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}

function Deposit() {
  const c = useCopy(ACCOUNTING);
  const d = c.deposit;
  return (
    <Section labelledBy="acc-deposit">
      <SectionHead id="acc-deposit" eyebrow={d.eyebrow} title={d.title} lead={d.lead} />
      <Reveal className="relative mt-10">
        <span
          aria-hidden
          className="absolute top-5 right-[12%] left-[12%] hidden h-0.5 bg-gradient-to-r from-success via-success to-border-strong sm:block"
        />
        <ol className="relative grid gap-3 sm:grid-cols-4">
          {d.rail.map((st) => (
            <li
              key={st.name}
              className="flex flex-col items-start gap-2 sm:items-center sm:text-center"
            >
              <span
                className={cn(
                  'relative z-10 flex size-10 items-center justify-center rounded-full border-2 bg-surface-dark',
                  st.done ? 'border-success text-success' : 'border-border-strong text-text-muted',
                )}
              >
                {st.done ? (
                  <CheckCircle2 className="size-5" aria-hidden />
                ) : (
                  <CircleDot className="size-5" aria-hidden />
                )}
              </span>
              <p className="text-label font-semibold text-text-primary">{st.name}</p>
              <p className="text-caption text-text-secondary">{st.state}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}

function GoodsDependency() {
  const c = useCopy(ACCOUNTING);
  const g = c.goods;
  return (
    <Section labelledBy="acc-goods">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <SectionHead id="acc-goods" eyebrow={g.eyebrow} title={g.title} lead={g.lead} />
        <Reveal className="space-y-3">
          <h3 className="text-label font-semibold text-text-primary">{g.remaining}</h3>
          {g.states.map((s) => (
            <div
              key={s.label}
              className={cn(
                'flex items-start gap-3 rounded-panel border p-4',
                s.ok
                  ? 'border-success/40 bg-success/[0.05]'
                  : 'border-warning/40 bg-warning/[0.05]',
              )}
            >
              {s.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              )}
              <p>
                <span className="block text-label font-medium text-text-primary">{s.label}</span>
                <span className="text-caption text-text-secondary">{s.note}</span>
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}

/** Interactive: toggle documents; the payment unlocks only when all are present. */
function DocumentGate() {
  const c = useCopy(ACCOUNTING);
  const g = c.gate;
  const [present, setPresent] = useState<boolean[]>([true, true, false, true]);
  const missing = g.docs.filter((_, i) => !present[i]).map((d) => d.name);
  const ready = missing.length === 0;
  return (
    <Section labelledBy="acc-gate">
      <SectionHead id="acc-gate" eyebrow={g.eyebrow} title={g.title} lead={g.lead} />
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-stretch">
        <ul className="grid gap-2 sm:grid-cols-2">
          {g.docs.map((d, i) => {
            const on = present[i]!;
            return (
              <li key={d.name}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setPresent((p) => p.map((v, k) => (k === i ? !v : v)))}
                  className={cn(
                    'flex min-h-16 w-full items-center gap-3 rounded-panel border px-4 py-3 text-left transition-colors',
                    on
                      ? 'border-ws-accounting/50 bg-surface-raised'
                      : 'border-dashed border-border-strong bg-surface-base/50',
                  )}
                >
                  {on ? (
                    <FileCheck2 className="size-5 shrink-0 text-ws-accounting" aria-hidden />
                  ) : (
                    <FileText className="size-5 shrink-0 text-text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-medium text-text-primary">{d.name}</span>
                    <span className="text-caption text-text-muted">{d.from}</span>
                  </span>
                  <span
                    className={cn('text-caption font-medium', on ? 'text-success' : 'text-warning')}
                  >
                    {on ? g.present : g.missing}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div
          role="status"
          className={cn(
            'flex flex-col justify-center rounded-card border p-6 transition-colors',
            ready
              ? 'border-success/50 bg-success/[0.07]'
              : 'border-border-strong bg-surface-base/70',
          )}
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-2xl',
              ready ? 'bg-success/15 text-success' : 'bg-surface-highlight text-text-muted',
            )}
          >
            {ready ? (
              <LockOpen className="size-6" aria-hidden />
            ) : (
              <Lock className="size-6" aria-hidden />
            )}
          </span>
          <p className={cn('mt-4 text-h3', ready ? 'text-success' : 'text-text-primary')}>
            {ready ? g.ready : g.locked}
          </p>
          {!ready && <p className="mt-1 text-label text-warning">{missing.join(' · ')}</p>}
        </div>
      </div>
    </Section>
  );
}

const OUT_TONE = {
  attention: { icon: AlertTriangle, className: 'text-warning' },
  calm: { icon: CircleDot, className: 'text-info' },
  blocked: { icon: PauseCircle, className: 'text-danger' },
} as const;

function Outstanding() {
  const c = useCopy(ACCOUNTING);
  const o = c.outstanding;
  return (
    <Section labelledBy="acc-out">
      <SectionHead id="acc-out" eyebrow={o.eyebrow} title={o.title} lead={o.lead} />
      <Reveal stagger className="mt-10 grid gap-2 md:grid-cols-3">
        {o.rows.map((r) => {
          const t = OUT_TONE[r.tone as keyof typeof OUT_TONE];
          return (
            <RevealItem key={r.name} className="rounded-panel border border-line bg-panel p-4">
              <p className="text-label font-medium text-fg-primary">{r.name}</p>
              <p
                className={cn(
                  'mt-2 flex items-center gap-1.5 text-caption font-medium',
                  t.className,
                )}
              >
                <t.icon className="size-3.5" aria-hidden />
                {r.state}
              </p>
            </RevealItem>
          );
        })}
      </Reveal>
    </Section>
  );
}

export default function AccountingPage() {
  const c = useCopy(ACCOUNTING);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="accounting">
      <DeptHero
        dept="accounting"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<VerificationSequence />}
      />
      <Positioning />
      <TodayBoard id="acc-today" copy={c.today} />
      <PaymentRequest />
      <Deposit />
      <GoodsDependency />
      <DocumentGate />
      <Outstanding />
      <FlowIO id="acc-io" copy={c.io} layout="ledger" />
      <ManagerLens id="acc-manager" copy={c.manager} />
      <ProductPreview
        id="acc-preview"
        dept="accounting"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="acc-connected" dept="accounting" copy={c.connections} />
      <DeptCta id="acc-cta" dept="accounting" />
    </DeptPage>
  );
}
