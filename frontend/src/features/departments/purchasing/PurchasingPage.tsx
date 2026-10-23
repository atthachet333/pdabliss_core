import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  FileText,
  Link2,
  PauseCircle,
  Wallet,
} from 'lucide-react';
import { useDepartments } from '@/config/departments';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
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
import { PURCHASING } from './copy';

const P = 'var(--color-ws-purchasing)';
const W = 'var(--color-ws-warehouse)';

/** Hero: requests converge on POs, POs reach suppliers, supply flows back in. */
function SupplyNetwork() {
  const c = useCopy(PURCHASING);
  const reduce = usePrefersReducedMotion();
  const reqs = [70, 150, 230].map((y) => ({ x: 70, y }));
  const hub = { x: 270, y: 150 };
  const sups = [60, 150, 240].map((y) => ({ x: 470, y }));
  const wh = { x: 270, y: 288 };
  return (
    <figure aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[38rem]">
      <svg aria-hidden viewBox="0 0 560 330" className="w-full overflow-visible">
        {reqs.map((r, i) => {
          const d = `M ${r.x + 50} ${r.y} C ${r.x + 120} ${r.y}, ${hub.x - 90} ${hub.y}, ${hub.x - 28} ${hub.y}`;
          return (
            <g key={`r${i}`}>
              <path d={d} fill="none" stroke={P} strokeOpacity="0.45" strokeWidth="1.4" />
              {!reduce && (
                <circle r="3" fill={P}>
                  <animateMotion dur={`${2.8 + i * 0.4}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
              <rect
                x={r.x - 58}
                y={r.y - 15}
                width="116"
                height="30"
                rx="8"
                fill="var(--color-surface-base)"
                stroke={P}
                strokeOpacity="0.5"
              />
              <text
                x={r.x}
                y={r.y + 4}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-text-secondary)"
              >
                {c.hero.requests[i]}
              </text>
            </g>
          );
        })}
        {sups.map((s, i) => {
          const d = `M ${hub.x + 28} ${hub.y} C ${hub.x + 100} ${hub.y}, ${s.x - 110} ${s.y}, ${s.x - 52} ${s.y}`;
          return (
            <g key={`s${i}`}>
              <path
                d={d}
                fill="none"
                stroke={P}
                strokeOpacity={i === 2 ? 0.2 : 0.45}
                strokeWidth="1.4"
                strokeDasharray={i === 2 ? '3 5' : undefined}
              />
              <rect
                x={s.x - 52}
                y={s.y - 15}
                width="104"
                height="30"
                rx="15"
                fill="var(--color-surface-raised)"
                stroke={i === 2 ? 'var(--color-warning)' : P}
                strokeOpacity="0.6"
              />
              <text
                x={s.x}
                y={s.y + 4}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-text-primary)"
              >
                {c.hero.suppliers[i]}
              </text>
            </g>
          );
        })}
        {/* Supply coming back in to the warehouse. */}
        {sups.slice(0, 2).map((s, i) => {
          const d = `M ${s.x} ${s.y + 16} C ${s.x} ${wh.y - 20}, ${wh.x + 120} ${wh.y}, ${wh.x + 70} ${wh.y}`;
          return (
            <g key={`in${i}`}>
              <path
                d={d}
                fill="none"
                stroke={W}
                strokeOpacity="0.4"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              {!reduce && (
                <circle r="3" fill={W}>
                  <animateMotion dur={`${3.6 + i * 0.6}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}
        <circle
          cx={hub.x}
          cy={hub.y}
          r="28"
          fill="var(--color-surface-raised)"
          stroke={P}
          strokeWidth="1.5"
        />
        <text x={hub.x} y={hub.y + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill={P}>
          {c.hero.po}
        </text>
        <rect
          x={wh.x - 70}
          y={wh.y - 18}
          width="140"
          height="36"
          rx="10"
          fill="var(--color-surface-base)"
          stroke={W}
          strokeOpacity="0.6"
        />
        <text
          x={wh.x}
          y={wh.y - 1}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-text-primary)"
        >
          {c.hero.incoming}
        </text>
        <text x={wh.x} y={wh.y + 12} textAnchor="middle" fontSize="10" fill={W}>
          {c.hero.partial}
        </text>
      </svg>
    </figure>
  );
}

function NeedToPr() {
  const c = useCopy(PURCHASING);
  const n = c.need;
  return (
    <Section labelledBy="pur-need">
      <SectionHead id="pur-need" eyebrow={n.eyebrow} title={n.title} lead={n.lead} />
      <Reveal className="mt-10 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <ul className="space-y-2">
          {n.sources.map((s) => (
            <li
              key={s.from}
              className="flex items-center justify-between gap-3 rounded-panel border border-border-soft bg-surface-base/70 px-4 py-3"
            >
              <span className="text-label font-medium text-text-primary">{s.from}</span>
              <span className="text-caption text-text-secondary">{s.why}</span>
            </li>
          ))}
        </ul>
        <ArrowRight
          className="mx-auto size-6 rotate-90 text-[var(--dept)] lg:rotate-0"
          aria-hidden
        />
        <div className="rounded-card border border-[color-mix(in_oklab,var(--dept)_45%,transparent)] bg-panel p-4">
          <p className="flex items-center gap-2 text-label font-semibold text-fg-primary">
            <FileText className="size-4 text-[var(--dept)]" aria-hidden />
            {n.pr}
          </p>
          <dl className="mt-3 divide-y divide-line">
            {n.prFields.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 py-2 text-caption">
                <dt className="text-fg-muted">{f.label}</dt>
                <dd className="text-fg-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </Section>
  );
}

function SupplierCompare() {
  const c = useCopy(PURCHASING);
  const s = c.supplier;
  return (
    <Section labelledBy="pur-supplier">
      <SectionHead id="pur-supplier" eyebrow={s.eyebrow} title={s.title} lead={s.lead} />
      <Reveal className="mt-10 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[36rem] text-left text-label">
          <thead className="bg-panel-raised text-caption text-fg-muted">
            <tr>
              {Object.values(s.cols).map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr
                key={r.name}
                className={cn(
                  'border-t border-line',
                  r.pick
                    ? 'bg-[color-mix(in_oklab,var(--dept)_8%,var(--color-panel))]'
                    : 'bg-panel',
                )}
              >
                <th scope="row" className="px-4 py-3 font-medium text-fg-primary">
                  {r.name}
                </th>
                <td className="px-4 py-3 text-fg-secondary">{r.lead}</td>
                <td className="px-4 py-3 text-fg-secondary">{r.terms}</td>
                <td className="px-4 py-3 text-fg-secondary">{r.history}</td>
                <td className="px-4 py-3">
                  {r.pick && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--dept)_55%,transparent)] px-2.5 py-0.5 text-caption text-fg-primary">
                      <Check className="size-3.5 text-[var(--dept)]" aria-hidden />
                      {s.chosen}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <p className="mt-3 text-caption text-text-muted">{s.note}</p>
    </Section>
  );
}

function PoChain() {
  const c = useCopy(PURCHASING);
  const p = c.po;
  return (
    <Section labelledBy="pur-po">
      <SectionHead id="pur-po" eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
      <Reveal className="mt-10">
        <ol className="grid gap-2 sm:grid-cols-4">
          {p.chain.map((st, i) => (
            <li
              key={st.name}
              className="relative rounded-panel border border-border-soft bg-surface-base/70 p-4"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-[var(--dept)] text-text-inverse">
                <Check className="size-4" aria-hidden />
              </span>
              <p className="mt-3 text-label font-semibold text-text-primary">{st.name}</p>
              <p className="text-caption text-text-secondary">{st.state}</p>
              {i < p.chain.length - 1 && (
                <ArrowRight
                  className="absolute top-1/2 -right-3 hidden size-4 -translate-y-1/2 text-text-muted sm:block"
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <p className="flex items-center gap-2.5 rounded-panel border border-ws-accounting/40 bg-surface-base/70 px-4 py-3 text-label text-text-primary">
            <Wallet className="size-4 shrink-0 text-ws-accounting" aria-hidden />
            {p.deposit}
          </p>
          <p className="flex items-center gap-2.5 rounded-panel border border-ws-warehouse/40 bg-surface-base/70 px-4 py-3 text-label text-text-primary">
            <Link2 className="size-4 shrink-0 text-ws-warehouse" aria-hidden />
            {p.expected}
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

function ReceiptTracker() {
  const c = useCopy(PURCHASING);
  const r = c.receipt;
  return (
    <Section labelledBy="pur-receipt">
      <SectionHead id="pur-receipt" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <Reveal stagger className="mt-10 space-y-3">
        {r.lines.map((l) => {
          const pct = Math.round((l.received / l.ordered) * 100);
          const late = l.tone === 'blocked';
          const done = l.tone === 'done';
          return (
            <RevealItem
              key={l.item}
              className="grid gap-3 rounded-panel border border-line bg-panel p-4 sm:grid-cols-[10rem_1fr_15rem] sm:items-center"
            >
              <p className="text-label font-medium text-fg-primary">{l.item}</p>
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-fill-muted">
                  <div
                    className={cn(
                      'h-full',
                      done ? 'bg-success' : late ? 'bg-warning' : 'bg-[var(--dept)]',
                    )}
                    style={{ width: `${Math.max(pct, late ? 2 : 0)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-caption text-fg-muted tabular">
                  {r.received} {l.received} / {r.ordered} {l.ordered}
                </p>
              </div>
              <p
                className={cn(
                  'flex items-center gap-1.5 text-caption',
                  late ? 'text-warning' : done ? 'text-success' : 'text-fg-secondary',
                )}
              >
                {late ? (
                  <PauseCircle className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                )}
                {l.state}
              </p>
            </RevealItem>
          );
        })}
      </Reveal>
    </Section>
  );
}

function LateSupplier() {
  const c = useCopy(PURCHASING);
  const l = c.late;
  const all = useDepartments();
  const ops = all.find((d) => d.id === 'operations')!;
  return (
    <Section labelledBy="pur-late">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <SectionHead id="pur-late" eyebrow={l.eyebrow} title={l.title} lead={l.lead} />
        <Reveal className="rounded-card border border-warning/35 bg-surface-base/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-label font-semibold text-text-primary">{l.item}</p>
            <span className="flex items-center gap-1.5 rounded-full border border-warning/50 px-2.5 py-0.5 text-caption text-warning">
              <AlertTriangle className="size-3.5" aria-hidden />
              {l.overdue}
            </span>
          </div>
          <p className="mt-4 flex items-center gap-2 text-caption text-text-muted">
            <ops.icon className="size-3.5" aria-hidden />
            {l.affects}
          </p>
          <ul className="mt-2 space-y-1.5">
            {l.affected.map((a) => (
              <li
                key={a}
                className="rounded-lg border border-border-soft bg-surface-dark/50 px-3 py-2 text-caption text-text-secondary"
              >
                {a}
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-2 border-t border-border-soft pt-4">
            {l.actions.map((a) => (
              <li key={a} className="flex items-center gap-2 text-label text-text-primary">
                <BellRing className="size-4 shrink-0 text-[var(--dept)]" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

export default function PurchasingPage() {
  const c = useCopy(PURCHASING);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="purchasing">
      <DeptHero
        dept="purchasing"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<SupplyNetwork />}
      />
      <TodayBoard id="pur-today" copy={c.today} layout="lanes" />
      <NeedToPr />
      <SupplierCompare />
      <PoChain />
      <ReceiptTracker />
      <LateSupplier />
      <FlowIO id="pur-io" copy={c.io} />
      <ManagerLens id="pur-manager" copy={c.manager} />
      <ProductPreview
        id="pur-preview"
        dept="purchasing"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="pur-connected" dept="purchasing" copy={c.connections} />
      <DeptCta id="pur-cta" />
    </DeptPage>
  );
}
