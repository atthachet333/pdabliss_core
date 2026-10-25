import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { useDepartment, useDepartments, type DepartmentId } from '@/config/departments';
import { useLocale } from '@/i18n/useLocale';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { ADJACENT, DEPT_ACCENT, DEPT_PAGES, deptPath, type DeptKey } from './catalog';
import {
  COMMON,
  type ConnectionsCopy,
  type IoCopy,
  type ManagerCopy,
  type TodayCopy,
  type Tone,
} from './common';

/*
 * Shared building blocks for the department pages (EP06). Pages combine
 * them differently around their own signature sections — this is a kit, not
 * a template.
 */

const WorldPreview = lazy(() => import('@/features/landing/home/previews'));

/*
 * Page-wide backdrop motifs (EP06): each department carries its own faint
 * visual language behind the whole page, so any part of it is recognizable
 * even without its title. Kept at whisper intensity; decorative only.
 */
const mix = (pct: number) => `color-mix(in oklab, var(--dept) ${pct}%, transparent)`;
const BACKDROP: Record<DeptKey, CSSProperties> = {
  // Horizon: wide, calm horizontal strata.
  executive: {
    backgroundImage: `repeating-linear-gradient(180deg, ${mix(9)} 0 1px, transparent 1px 140px)`,
  },
  // Routes: concentric arcs sweeping across the page.
  sales: {
    backgroundImage: `repeating-radial-gradient(circle at -10% 110%, transparent 0 58px, ${mix(9)} 58px 59px)`,
  },
  // Timeline: day columns with lane rules.
  operations: {
    backgroundImage: `repeating-linear-gradient(90deg, ${mix(9)} 0 1px, transparent 1px 96px), repeating-linear-gradient(180deg, ${mix(4)} 0 1px, transparent 1px 72px)`,
  },
  // Floor grid: storage locations.
  warehouse: {
    backgroundImage: `linear-gradient(${mix(8)} 1px, transparent 1px), linear-gradient(90deg, ${mix(8)} 1px, transparent 1px)`,
    backgroundSize: '56px 56px',
  },
  // Network: a field of supplier nodes.
  purchasing: {
    backgroundImage: `radial-gradient(${mix(22)} 1.3px, transparent 1.8px)`,
    backgroundSize: '38px 38px',
  },
  // Ledger: ruled document lines with a margin.
  accounting: {
    backgroundImage: `linear-gradient(90deg, transparent calc(8% - 1px), ${mix(10)} calc(8% - 1px) 8%, transparent 8%), repeating-linear-gradient(180deg, ${mix(7)} 0 1px, transparent 1px 32px)`,
  },
};

/** Page wrapper: exposes the department accent as `--dept` and lays its backdrop motif. */
export function DeptPage({ id, children }: { id: DeptKey; children: ReactNode }) {
  return (
    <div
      style={{ '--dept': DEPT_ACCENT[id] } as CSSProperties}
      data-department={id}
      className="relative isolate"
    >
      <div
        aria-hidden
        style={BACKDROP[id]}
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_12rem,black_calc(100%-20rem),transparent)]"
      />
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('relative py-16 sm:py-24', className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <Reveal className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className="text-caption font-semibold tracking-[0.18em] text-[var(--dept,var(--color-brand-glow))] uppercase">
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="mt-3 text-h2 whitespace-pre-line text-text-primary">
        {title}
      </h2>
      {lead && <p className="mt-4 text-body-lg text-text-secondary">{lead}</p>}
    </Reveal>
  );
}

/** Move between department pages without losing the CORE context. */
export function DeptSwitcher({ current, className }: { current?: DeptKey; className?: string }) {
  const c = useCopy(COMMON);
  const { href } = useLocale();
  const all = useDepartments();
  return (
    <nav aria-label={c.switcher} className={className}>
      <ul className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
        <li className="col-span-3 sm:col-span-1">
          <Link
            to={href('/departments')}
            className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-border-soft px-4 text-caption text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary sm:justify-start"
          >
            {c.overview}
          </Link>
        </li>
        {DEPT_PAGES.map((id) => {
          const d = all.find((x) => x.id === id)!;
          const Icon = d.icon;
          const on = id === current;
          return (
            <li key={id}>
              <Link
                to={href(deptPath(id))}
                aria-current={on ? 'page' : undefined}
                style={{ '--a': DEPT_ACCENT[id] } as CSSProperties}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 text-caption transition-colors sm:justify-start sm:px-4',
                  on
                    ? 'border-[color-mix(in_oklab,var(--a)_60%,transparent)] bg-[color-mix(in_oklab,var(--a)_12%,transparent)] text-text-primary'
                    : 'border-border-soft text-text-secondary hover:border-border-strong hover:text-text-primary',
                )}
              >
                <Icon className="size-3.5 shrink-0 text-[var(--a)]" aria-hidden />
                <span className="truncate">{d.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** “งานที่เข้ามา → สิ่งที่ต้องทำ → สิ่งที่ส่งต่อ”. */
export function FlowIO({
  id,
  copy,
  layout = 'columns',
}: {
  id: string;
  copy: IoCopy;
  /** columns: three panels with arrows · ledger: one panel with three rows. */
  layout?: 'columns' | 'ledger';
}) {
  const c = useCopy(COMMON);
  const parts = [
    { key: 'in', label: c.io.in, items: copy.in },
    { key: 'do', label: c.io.do, items: copy.do },
    { key: 'out', label: c.io.out, items: copy.out },
  ] as const;
  return (
    <Section labelledBy={id}>
      <SectionHead id={id} eyebrow={c.io.eyebrow} title={copy.title} />
      {layout === 'columns' ? (
        <Reveal
          stagger
          className="mt-10 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch"
        >
          {parts.map((p, i) => (
            <FlowIOColumn key={p.key} label={p.label} items={p.items} index={i} last={i === 2} />
          ))}
        </Reveal>
      ) : (
        <Reveal className="mt-10 overflow-hidden rounded-card border border-border-soft">
          {parts.map((p, i) => (
            <div
              key={p.key}
              className={cn(
                'grid gap-3 p-5 sm:grid-cols-[12rem_1fr] sm:p-6',
                i > 0 && 'border-t border-border-soft',
                i === 1 && 'bg-[color-mix(in_oklab,var(--dept)_6%,transparent)]',
              )}
            >
              <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                <span className="text-caption text-text-muted tabular">0{i + 1}</span>
                {p.label}
              </p>
              <ul className="flex flex-wrap gap-2">
                {p.items.map((it) => (
                  <li
                    key={it}
                    className="rounded-full border border-border-soft bg-surface-base/70 px-3 py-1 text-caption text-text-secondary"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      )}
    </Section>
  );
}

function FlowIOColumn({
  label,
  items,
  index,
  last,
}: {
  label: string;
  items: readonly string[];
  index: number;
  last: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          'rounded-card border p-5',
          index === 1
            ? 'border-[color-mix(in_oklab,var(--dept)_45%,transparent)] bg-[color-mix(in_oklab,var(--dept)_7%,transparent)]'
            : 'border-border-soft bg-surface-base/70',
        )}
      >
        <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
          <span className="text-caption text-text-muted tabular">0{index + 1}</span>
          {label}
        </p>
        <ul className="mt-3 space-y-2 text-label text-text-secondary">
          {items.map((it) => (
            <li key={it} className="flex gap-2">
              <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-[var(--dept)]" />
              {it}
            </li>
          ))}
        </ul>
      </div>
      {!last && (
        <div aria-hidden className="flex items-center justify-center text-text-muted">
          <ArrowRight className="hidden size-5 lg:block" />
          <ArrowDown className="size-5 lg:hidden" />
        </div>
      )}
    </>
  );
}

const TONE: Record<Tone, { icon: LucideIcon; className: string }> = {
  calm: { icon: CircleDot, className: 'text-info' },
  attention: { icon: AlertTriangle, className: 'text-warning' },
  blocked: { icon: PauseCircle, className: 'text-danger' },
  done: { icon: CheckCircle2, className: 'text-success' },
};

/** The department’s “วันนี้” — a few illustrative states, never a fake dataset. */
export function TodayBoard({
  id,
  copy,
  layout = 'tiles',
}: {
  id: string;
  copy: TodayCopy;
  /** tiles: count tiles + items · lanes: one row per state. */
  layout?: 'tiles' | 'lanes';
}) {
  const c = useCopy(COMMON);
  return (
    <Section labelledBy={id}>
      <SectionHead id={id} eyebrow={c.today.eyebrow} title={copy.title} lead={copy.lead} />
      <Reveal
        stagger
        className={cn('mt-10 grid gap-3', layout === 'tiles' ? 'sm:grid-cols-3' : 'grid-cols-1')}
      >
        {copy.groups.map((g) => {
          const tone = TONE[g.tone];
          const Icon = tone.icon;
          return (
            <div
              key={g.label}
              className={cn(
                'rounded-panel border border-line bg-panel p-4',
                layout === 'lanes' && 'grid gap-3 sm:grid-cols-[14rem_1fr] sm:items-center',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-label font-medium text-fg-primary">
                  <Icon className={cn('size-4 shrink-0', tone.className)} aria-hidden />
                  {g.label}
                </p>
                <span className="text-metric text-fg-primary tabular">{g.count}</span>
              </div>
              <ul
                className={cn(
                  'space-y-1.5 text-caption text-fg-secondary',
                  layout === 'tiles'
                    ? 'mt-3 border-t border-line pt-3'
                    : 'flex flex-wrap gap-2 space-y-0',
                )}
              >
                {g.items.map((it) => (
                  <li
                    key={it}
                    className={cn(
                      layout === 'lanes' &&
                        'rounded-full border border-line bg-panel-raised px-2.5 py-1',
                    )}
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Reveal>
      <p className="mt-3 text-caption text-text-muted">{c.today.sample}</p>
    </Section>
  );
}

/** Employee vs department lead — the same data, a different altitude. */
export function ManagerLens({
  id,
  copy,
  labels,
}: {
  id: string;
  copy: ManagerCopy;
  /** Override the compared levels (e.g. department lead vs executive). */
  labels?: { a: string; aSub: string; b: string; bSub: string };
}) {
  const c = useCopy(COMMON);
  const l = labels ?? {
    a: c.manager.employee,
    aSub: c.manager.employeeSub,
    b: c.manager.manager,
    bSub: c.manager.managerSub,
  };
  return (
    <Section labelledBy={id}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <SectionHead id={id} eyebrow={c.manager.eyebrow} title={copy.title} lead={copy.lead} />
        <Reveal stagger className="grid gap-3 sm:grid-cols-2">
          {[
            { label: l.a, sub: l.aSub, items: copy.employee, lift: false },
            { label: l.b, sub: l.bSub, items: copy.manager, lift: true },
          ].map((col) => (
            <div
              key={col.label}
              className={cn(
                'rounded-card border p-5',
                col.lift
                  ? 'border-border-strong bg-surface-raised/80 sm:-translate-y-4'
                  : 'border-border-soft bg-surface-base/70',
              )}
            >
              <p className="text-label font-semibold text-text-primary">{col.label}</p>
              <p className="text-caption text-text-muted">{col.sub}</p>
              <ul className="mt-4 space-y-2 text-label text-text-secondary">
                {col.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-2.5 size-1 shrink-0 rounded-full bg-[var(--dept)]"
                    />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-canvas/80">
      <div className="h-11 border-b border-line bg-nav" />
      <div className="flex-1 space-y-3 p-5">
        <div className="h-4 w-1/3 animate-pulse rounded-full bg-panel-raised" />
        <div className="mt-6 h-40 animate-pulse rounded-panel bg-panel" />
      </div>
    </div>
  );
}

/**
 * The real CORE product (EP02 components, isolated sample data). Inert and
 * hidden from assistive tech: the localized text around it carries the
 * meaning, and the caption says the interface is shown in Thai.
 */
export function ProductPreview({
  id,
  dept,
  title,
  lead,
  className,
}: {
  id: string;
  dept: DeptKey;
  title: string;
  lead: string;
  className?: string;
}) {
  const c = useCopy(COMMON);
  const d = useDepartment(dept);
  return (
    <Section labelledBy={id} className={className}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center">
        <SectionHead id={id} eyebrow={c.preview.eyebrow} title={title} lead={lead} />
        <figure aria-label={c.preview.figure(d.name)}>
          <div
            aria-hidden
            inert
            className="pointer-events-none h-[22rem] select-none sm:h-[27rem] lg:h-[29rem]"
          >
            <Suspense fallback={<PreviewSkeleton />}>
              <WorldPreview id={dept} />
            </Suspense>
          </div>
          <figcaption className="mt-3 text-caption text-text-muted">{c.preview.caption}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

/** “งานนี้เชื่อมต่อกับ…” — the connected-work chain and 2–3 adjacent departments. */
export function ConnectedDepartments({
  id,
  dept,
  copy,
}: {
  id: string;
  dept: DeptKey;
  copy: ConnectionsCopy;
}) {
  const c = useCopy(COMMON);
  const { href } = useLocale();
  const all = useDepartments();
  const nameOf = (at: string) =>
    at === 'supplier'
      ? c.connected.supplier
      : at === 'customer'
        ? c.connected.customer
        : (all.find((d) => d.id === (at as DepartmentId))?.name ?? at);
  return (
    <Section labelledBy={id}>
      <SectionHead
        id={id}
        eyebrow={c.connected.eyebrow}
        title={c.connected.title}
        lead={c.connected.lead}
      />
      {/* The chain: who hands what to whom. */}
      <Reveal className="mt-10">
        <ol className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {copy.chain.map((hop, i) => {
            const self = hop.at === dept;
            return (
              <li
                key={`${hop.at}-${i}`}
                className="flex flex-col items-stretch gap-2 lg:flex-1 lg:flex-row lg:items-center"
              >
                <div
                  className={cn(
                    'flex-1 rounded-panel border px-4 py-3',
                    self
                      ? 'border-[color-mix(in_oklab,var(--dept)_55%,transparent)] bg-[color-mix(in_oklab,var(--dept)_10%,transparent)]'
                      : 'border-border-soft bg-surface-base/70',
                  )}
                >
                  <p className="text-label font-semibold text-text-primary">{nameOf(hop.at)}</p>
                  <p className="mt-0.5 text-caption text-text-secondary">{hop.what}</p>
                </div>
                {i < copy.chain.length - 1 && (
                  <span aria-hidden className="flex justify-center text-text-muted">
                    <ArrowRight className="hidden size-4 lg:block" />
                    <ArrowDown className="size-4 lg:hidden" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Reveal>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {ADJACENT[dept].map((other) => {
          const d = all.find((x) => x.id === other)!;
          return (
            <li key={other}>
              <Link
                to={href(deptPath(other))}
                className="group flex items-center gap-3 rounded-card border border-border-soft bg-surface-base/70 p-3 transition-colors hover:border-border-brand"
              >
                <img
                  src={d.image.sm}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={225}
                  className="h-12 w-20 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0">
                  <span className="block text-label font-medium text-text-primary">{d.name}</span>
                  <span className="flex items-center gap-1 text-caption text-brand-glow">
                    {c.connected.open}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Department pages whose role exists in the public demo (EP14). */
const DEMO_ROLES: readonly DeptKey[] = [
  'sales',
  'warehouse',
  'purchasing',
  'accounting',
  'executive',
];

/** Quiet closing call to action — no hard sell, no pricing. */
export function DeptCta({ id = 'dept-cta', dept }: { id?: string; dept?: DeptKey }) {
  const c = useCopy(COMMON);
  const { href } = useLocale();
  return (
    <Section labelledBy={id} className="pb-24 sm:pb-32">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-soft bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,color-mix(in_oklab,var(--dept,var(--color-brand-primary))_14%,transparent),transparent_70%)] px-6 py-12 text-center sm:px-12">
        <h2 id={id} className="mx-auto max-w-2xl text-h2 text-text-primary">
          {c.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{c.cta.lead}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={href(
              dept
                ? `/contact?interest=consulting&department=${dept}`
                : '/contact?interest=consulting',
            )}
            className={buttonClasses('primary', 'lg')}
          >
            {c.cta.consult}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to={href('/how-core-works')} className={buttonClasses('secondary', 'lg')}>
            {c.cta.how}
          </Link>
        </div>
        {dept && DEMO_ROLES.includes(dept) && (
          <Link
            to={href(`/demo?role=${dept}`)}
            data-cta="try-role"
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft underline-offset-4 hover:underline"
          >
            {c.cta.tryRole}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
        <Link
          to={href('/departments')}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          {c.cta.explore}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}

/**
 * Hero shell for a department page. Each page supplies its own visual — one
 * strong concept per department — and its own copy.
 */
export function DeptHero({
  dept,
  eyebrow,
  title,
  lead,
  visual,
  aside,
}: {
  dept: DeptKey;
  eyebrow: string;
  title: string;
  lead: string;
  visual: ReactNode;
  aside?: ReactNode;
}) {
  const d = useDepartment(dept);
  const { locale } = useLocale();
  return (
    <section
      aria-labelledby="dept-title"
      className="relative isolate overflow-hidden pt-28 sm:pt-32"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_75%_30%,color-mix(in_oklab,var(--dept)_16%,transparent),transparent_72%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-50" />
      </div>
      <Container>
        <DeptSwitcher current={dept} className="mb-10 sm:mb-12" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
          <div>
            <p className="flex items-center gap-2 text-caption font-semibold tracking-[0.18em] text-[var(--dept)] uppercase">
              <d.icon className="size-4" aria-hidden />
              {eyebrow}
              {locale !== 'en' && <span className="text-text-muted">· {d.nameEn}</span>}
            </p>
            <h1
              id="dept-title"
              className="mt-4 text-[clamp(1.875rem,1.25rem+1.9vw,2.75rem)] leading-[1.38] font-semibold text-balance whitespace-pre-line text-text-primary"
            >
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-text-secondary">{lead}</p>
            {aside}
          </div>
          <div className="relative">{visual}</div>
        </div>
      </Container>
    </section>
  );
}
