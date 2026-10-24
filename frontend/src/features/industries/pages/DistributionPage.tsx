import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Check, PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { DISTRIBUTION } from '../copy/distribution';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import { INBOUND, INDUSTRIES, lineState, ORDER_LINES, type LineState } from '../model';
import {
  BackLink,
  Boundaries,
  DeptDot,
  Ending,
  ExampleLabel,
  Head,
  Limits,
  PageTitle,
  PrincipleFit,
  RelatedLinks,
  ToneTag,
} from '../parts';
import { useDeptName, useIndustryPage } from '../useIndustryMeta';

const ID = 'distribution';
const IND = INDUSTRIES[ID];

/* Hero: goods flowing through a network ------------------------------ */

const SUP = [80, 190, 300];
const CUS = [60, 150, 240, 330];
const DC = { x: 300, y: 190 };

function GoodsNetwork() {
  const p = useCopy(DISTRIBUTION).signature.nodes;
  const sig = useCopy(INDUSTRIES_SUMMARY).industries[ID].signals;
  const reduce = usePrefersReducedMotion();
  const draw = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { delay, duration: 1.1, ease: EASE_CORE },
        };
  return (
    <svg aria-hidden viewBox="0 0 600 390" className="w-full overflow-visible" data-motif="network">
      <text x="60" y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)">
        {p.suppliers}
      </text>
      <text x={DC.x} y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)">
        {p.dc}
      </text>
      <text x="540" y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)">
        {p.customers}
      </text>
      {SUP.map((y, i) => (
        <motion.path
          key={`s${y}`}
          d={`M 72 ${y} C 180 ${y}, 200 ${DC.y}, ${DC.x - 36} ${DC.y}`}
          fill="none"
          stroke={i === 2 ? 'var(--color-warning)' : 'var(--color-brand-glow)'}
          strokeOpacity={i === 2 ? 0.7 : 0.45}
          strokeWidth="1.6"
          strokeDasharray={i === 2 ? '5 6' : undefined}
          {...draw(0.2 + i * 0.15)}
        />
      ))}
      {CUS.map((y, i) => (
        <motion.path
          key={`c${y}`}
          d={`M ${DC.x + 36} ${DC.y} C 400 ${DC.y}, 420 ${y}, 528 ${y}`}
          fill="none"
          stroke={i === 3 ? 'var(--color-warning)' : 'var(--color-brand-glow)'}
          strokeOpacity={i === 3 ? 0.7 : 0.45}
          strokeWidth="1.6"
          strokeDasharray={i === 3 ? '5 6' : undefined}
          {...draw(0.9 + i * 0.12)}
        />
      ))}
      {/* Goods in transit */}
      {[
        [150, 128],
        [170, 192],
        [420, 120],
        [440, 196],
        [410, 248],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x! - 5}
          y={y! - 5}
          width="10"
          height="10"
          rx="2"
          fill="var(--color-brand-glow)"
          fillOpacity="0.8"
        />
      ))}
      {SUP.map((y) => (
        <rect
          key={y}
          x="48"
          y={y - 14}
          width="24"
          height="28"
          rx="6"
          fill="var(--color-surface-raised)"
          stroke="var(--color-border-strong)"
        />
      ))}
      {CUS.map((y) => (
        <circle
          key={y}
          cx="540"
          cy={y}
          r="12"
          fill="var(--color-surface-raised)"
          stroke="var(--color-border-strong)"
        />
      ))}
      {/* The hub */}
      <rect
        x={DC.x - 36}
        y={DC.y - 36}
        width="72"
        height="72"
        rx="14"
        fill="var(--color-surface-raised)"
        stroke="var(--color-ws-warehouse)"
        strokeWidth="2"
      />
      <path
        d={`M ${DC.x - 16} ${DC.y + 12} V ${DC.y - 6} L ${DC.x} ${DC.y - 16} L ${DC.x + 16} ${DC.y - 6} V ${DC.y + 12} Z`}
        fill="none"
        stroke="var(--color-ws-warehouse)"
        strokeWidth="1.6"
      />
      {/* Friction badges */}
      <g>
        <rect
          x="150"
          y="300"
          width="112"
          height="24"
          rx="12"
          fill="var(--color-surface-base)"
          stroke="var(--color-warning)"
          strokeOpacity="0.6"
        />
        <text x="206" y="316" textAnchor="middle" fontSize="11" fill="var(--color-warning)">
          {sig.supplierLate}
        </text>
        <rect
          x="372"
          y="346"
          width="132"
          height="24"
          rx="12"
          fill="var(--color-surface-base)"
          stroke="var(--color-warning)"
          strokeOpacity="0.6"
        />
        <text x="438" y="362" textAnchor="middle" fontSize="11" fill="var(--color-warning)">
          {sig.stuckOrders}
        </text>
      </g>
    </svg>
  );
}

function Hero() {
  const c = useCopy(DISTRIBUTION);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID].signals;
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgb(190_235_222/0.07)_1px,transparent_1.5px)] [mask-image:radial-gradient(ellipse_70%_70%_at_70%_40%,black,transparent_75%)] [background-size:22px_22px]"
      />
      <Frame width="wide" className="pt-24 pb-16 sm:pt-28 lg:pt-32 lg:pb-24">
        <BackLink />
        <div className="mt-6 grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.2fr)]">
          <div>
            <Kicker tone="clear">{c.hero.eyebrow}</Kicker>
            <PageTitle className="mt-5">{c.hero.title}</PageTitle>
            <p className="mt-7 max-w-xl text-body-lg text-text-secondary">{c.hero.lead}</p>
          </div>
          <figure aria-label={c.hero.visual}>
            <div className="hidden md:block">
              <GoodsNetwork />
            </div>
            {/* Phones: the same flow, simplified */}
            <ol className="space-y-2 md:hidden">
              {[
                { k: 'sup', t: c.signature.nodes.suppliers, badge: s.supplierLate },
                { k: 'dc', t: c.signature.nodes.dc },
                { k: 'cus', t: c.signature.nodes.customers, badge: s.stuckOrders },
              ].map((n, i) => (
                <li key={n.k}>
                  <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4">
                    <span className="text-label text-text-primary">{n.t}</span>
                    {n.badge && <ToneTag tone="attention" label={n.badge} />}
                  </div>
                  {i < 2 && (
                    <ArrowDown aria-hidden className="mx-auto my-1 size-4 text-brand-glow" />
                  )}
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </Frame>
    </section>
  );
}

/* Signature: one order against stock and an open receipt -------------- */

const STATE_TONE: Record<LineState, 'ok' | 'attention' | 'blocked'> = {
  ready: 'ok',
  partial: 'attention',
  short: 'blocked',
};

function Fulfillment() {
  const c = useCopy(DISTRIBUTION).signature;
  const [received, setReceived] = useState(false);
  const lines = ORDER_LINES.map((l) => {
    const available = Math.min(l.ordered, l.onHand + (received ? INBOUND[l.id] : 0));
    return { ...l, available, state: lineState(l.ordered, available) };
  });
  const allReady = lines.every((l) => l.state === 'ready');
  return (
    <Chapter id="fulfillment" labelledBy="fulfillment-title" plane="deep" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.4fr)] lg:items-center lg:gap-16">
          <Head id="fulfillment-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
          <Stage glow="clear" className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-label font-semibold text-text-primary">{c.order}</p>
              <button
                type="button"
                aria-pressed={received}
                onClick={() => setReceived((r) => !r)}
                data-receive
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label transition-colors',
                  received
                    ? 'bg-brand-primary/20 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                    : 'bg-white/[0.05] text-text-secondary hover:text-text-primary',
                )}
              >
                {received ? (
                  <Check aria-hidden className="size-4 text-brand-glow" />
                ) : (
                  <PackageCheck aria-hidden className="size-4" />
                )}
                {received ? c.received : c.receive}
              </button>
            </div>
            <table className="mt-6 w-full text-left" data-order-lines>
              <thead>
                <tr className="text-caption text-text-muted">
                  <th scope="col" className="pb-3 font-normal">
                    <span className="sr-only">{c.order}</span>
                  </th>
                  <th scope="col" className="pb-3 text-right font-normal">
                    {c.ordered}
                  </th>
                  <th scope="col" className="pb-3 text-right font-normal">
                    {c.available}
                  </th>
                  <th scope="col" className="pb-3 pl-4 font-normal">
                    <span className="sr-only">{c.state.ready}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {lines.map((l) => (
                  <tr key={l.id} data-line={l.id} data-state={l.state}>
                    <th
                      scope="row"
                      className="py-3.5 pr-3 text-label font-normal text-text-primary"
                    >
                      {c.lines[l.id]}
                    </th>
                    <td className="py-3.5 text-right text-label text-text-secondary tabular">
                      {l.ordered}
                    </td>
                    <td className="py-3.5 text-right text-label text-text-primary tabular">
                      {l.available}
                    </td>
                    <td className="py-3.5 pl-4">
                      <ToneTag tone={STATE_TONE[l.state]} label={c.state[l.state]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-label text-text-secondary">
              <Truck aria-hidden className="size-4 shrink-0 text-ws-purchasing" />
              <span className="flex-1">{c.inbound}</span>
              <span className="text-text-primary tabular">
                {received ? 0 : INBOUND.b + INBOUND.c}
              </span>
            </div>
            <p
              aria-live="polite"
              data-outcome={allReady ? 'ready' : 'partial'}
              className={cn(
                'mt-5 text-label font-medium',
                allReady ? 'text-success' : 'text-warning',
              )}
            >
              {allReady ? c.outcome.ready : c.outcome.partial}
            </p>
            <p className="mt-2 text-caption text-text-muted">{c.note}</p>
          </Stage>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: a route with stations ----------------------------- */

function Route() {
  const c = useCopy(DISTRIBUTION);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="full">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Head id="workflow-title" title={c.workflow.title} />
          <ExampleLabel className="lg:max-w-sm lg:text-right" />
        </div>
        <ol
          data-workflow={ID}
          className="relative mt-14 grid grid-cols-1 gap-0 md:grid-cols-7 md:gap-3"
        >
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-[0.5625rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.6),rgb(62_240_192/0.2))] md:top-[0.5625rem] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto md:bg-[linear-gradient(90deg,rgb(62_240_192/0.6),rgb(62_240_192/0.2))]"
          />
          {IND.workflow.map((w, i) => {
            const stuck = w.id === IND.stuckAt;
            return (
              <li key={w.id} data-step={w.id} className="relative pb-7 pl-9 md:pb-0 md:pl-0">
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-0 left-0 size-[1.125rem] rounded-sm md:relative md:block',
                    stuck
                      ? 'bg-warning shadow-[0_0_14px_rgb(245_184_75/0.6)]'
                      : 'bg-surface-dark shadow-[inset_0_0_0_2px_rgb(62_240_192/0.7)]',
                  )}
                />
                <p className="text-caption text-text-muted tabular md:mt-4">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="mt-1 text-label font-semibold text-text-primary">{s.steps[w.id]}</p>
                <p className="mt-1 flex items-center gap-1.5 text-caption text-text-secondary">
                  <DeptDot id={w.dept} className="size-1.5" />
                  {name(w.dept)}
                </p>
                <p className="mt-2 text-caption text-text-muted">{c.workflow.notes[w.id]}</p>
              </li>
            );
          })}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* Page ---------------------------------------------------------------- */

export default function DistributionPage() {
  const c = useIndustryPage(DISTRIBUTION);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  return (
    <>
      <Hero />

      {/* Operating reality: three forces in a band */}
      <Chapter id="reality" labelledBy="reality-title" plane="navy">
        <Frame width="wide">
          <Head id="reality-title" title={c.reality.title} lead={c.reality.lead} />
          <ol className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-soft">
            {c.reality.points.map((pt, i) => (
              <li key={pt.title} className="md:px-8 md:first:pl-0">
                <p className="text-[2.5rem] leading-none font-light text-brand-glow/70 tabular">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="mt-4 text-body font-semibold text-text-primary">{pt.title}</p>
                <p className="mt-2 text-label text-text-secondary">{pt.body}</p>
              </li>
            ))}
          </ol>
        </Frame>
      </Chapter>

      <Fulfillment />
      <Route />

      {/* Frictions + who hands work to whom */}
      <Chapter id="friction" labelledBy="friction-title" plane="grid">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <Head id="friction-title" title={c.frictions.title} />
              <ol className="mt-8 space-y-4" data-frictions>
                {c.frictions.items.map((f, i) => (
                  <li key={f} className="flex gap-4 text-body text-text-secondary">
                    <span className="mt-1 text-caption text-warning tabular">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {f}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Kicker tone="muted">{s.common.departments}</Kicker>
              <h3 className="mt-3 text-h3 text-text-primary">{c.departments.title}</h3>
              <dl className="mt-6 divide-y divide-border-soft" data-departments>
                {IND.departments.map((d) => (
                  <div
                    key={d}
                    data-dept={d}
                    className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6"
                  >
                    <dt className="flex items-center gap-2 text-label font-semibold text-text-primary">
                      <DeptDot id={d} />
                      {name(d)}
                    </dt>
                    <dd className="text-label text-text-secondary">{c.departments.roles[d]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Frame>
      </Chapter>

      {/* Information + what managers watch */}
      <Chapter id="signals" labelledBy="signals-title">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <Kicker tone="muted">{c.information.title}</Kicker>
              <dl className="mt-6 space-y-5" data-information>
                {c.information.items.map((it) => (
                  <div key={it.label}>
                    <dt className="text-body font-semibold text-text-primary">{it.label}</dt>
                    <dd className="mt-1 text-label text-text-secondary">{it.why}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Stage glow="warm" grid={false} className="p-6 sm:p-8">
              <h2 id="signals-title" className="text-h3 text-text-primary">
                {c.signals.title}
              </h2>
              <ul className="mt-6 space-y-4" data-signals={ID}>
                {IND.signals.map((sg) => (
                  <li key={sg.id} data-signal={sg.id} className="border-t border-white/[0.06] pt-4">
                    <ToneTag tone={sg.tone} label={s.industries[ID].signals[sg.id]!} />
                    <p className="mt-1.5 text-label text-text-secondary">
                      {c.signals.notes[sg.id]}
                    </p>
                  </li>
                ))}
              </ul>
            </Stage>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="fit" labelledBy="fit-title" plane="navy">
        <Frame width="wide">
          <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
          <PrincipleFit id={ID} className="mt-12" />
          <div className="mt-16 grid grid-cols-1 gap-12 border-t border-border-soft pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Boundaries id={ID} />
            <Limits notReplace={c.notReplace} custom={c.custom} />
          </div>
        </Frame>
      </Chapter>

      <Chapter labelledBy="next-title" plane="clear" space="lg" className="pb-32 sm:pb-40">
        <Frame width="wide">
          <RelatedLinks id={ID} />
          <div className="mt-20">
            <Ending id={ID}>
              <h2
                id="next-title"
                className="flex items-center justify-center gap-3 text-h2 text-text-primary"
              >
                <ArrowRight aria-hidden className="size-6 text-brand-glow" />
                {s.cta.title}
              </h2>
            </Ending>
          </div>
        </Frame>
      </Chapter>
    </>
  );
}
