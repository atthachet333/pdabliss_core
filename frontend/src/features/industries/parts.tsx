import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Kicker } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import type { DeptKey } from '@/features/departments/catalog';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { INDUSTRIES_SUMMARY } from './copy/summary';
import { useDeptName } from './useIndustryMeta';
import {
  INDUSTRIES,
  INDUSTRY_IDS,
  industryPath,
  PRINCIPLES,
  type Health,
  type IndustryId,
  type Motif,
  type SignalTone,
} from './model';

/*
 * Small /industries primitives. Pages compose these differently — shared
 * parts, never a shared page layout.
 */

/* ------------------------------------------------------------------ */
/* Status                                                               */
/* ------------------------------------------------------------------ */

const TONE_ICON: Record<SignalTone | Health, LucideIcon> = {
  attention: AlertTriangle,
  blocked: Ban,
  waiting: Clock,
  ok: CheckCircle2,
};
const TONE_TEXT: Record<SignalTone | Health, string> = {
  attention: 'text-warning',
  blocked: 'text-danger',
  waiting: 'text-info',
  ok: 'text-success',
};

/** A tone as icon + words — never colour alone. */
export function ToneTag({
  tone,
  label,
  compact = false,
  className,
}: {
  tone: SignalTone | Health;
  label: string;
  /** Icon only on screen; the words stay for assistive technology. */
  compact?: boolean;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1.5 text-caption font-medium',
        TONE_TEXT[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Motif glyphs — the six environments drawn small                      */
/* ------------------------------------------------------------------ */

/** A tiny drawing of an environment's geometry (decorative). */
export function MotifGlyph({ motif, className }: { motif: Motif; className?: string }) {
  const s = {
    stroke: 'currentColor',
    fill: 'none',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
  };
  return (
    <svg aria-hidden viewBox="0 0 48 32" className={cn('h-8 w-12', className)}>
      {motif === 'network' && (
        <g {...s}>
          <path d="M6 8 L24 16 L42 6 M6 24 L24 16 L42 26 M24 16 L40 16" />
          <circle cx="24" cy="16" r="4" fill="currentColor" fillOpacity="0.25" />
          <circle cx="6" cy="8" r="2" /> <circle cx="6" cy="24" r="2" />
          <circle cx="42" cy="6" r="2" /> <circle cx="42" cy="26" r="2" />
        </g>
      )}
      {motif === 'schedule' && (
        <g {...s}>
          <path d="M4 8 H44 M4 16 H44 M4 24 H44" strokeOpacity="0.35" />
          <rect x="6" y="5.5" width="12" height="5" rx="2" fill="currentColor" fillOpacity="0.3" />
          <rect
            x="22"
            y="13.5"
            width="16"
            height="5"
            rx="2"
            fill="currentColor"
            fillOpacity="0.3"
          />
          <rect
            x="12"
            y="21.5"
            width="10"
            height="5"
            rx="2"
            fill="currentColor"
            fillOpacity="0.3"
          />
          <rect x="30" y="21.5" width="10" height="5" rx="2" strokeDasharray="2 2" />
        </g>
      )}
      {motif === 'milestones' && (
        <g {...s}>
          <path d="M4 22 H44" strokeOpacity="0.35" />
          <path d="M10 22 Q 22 4 34 22" strokeDasharray="2 3" />
          <path d="M10 18 l4 4 -4 4 -4 -4 z" fill="currentColor" fillOpacity="0.3" />
          <path d="M24 18 l4 4 -4 4 -4 -4 z" />
          <path d="M38 18 l4 4 -4 4 -4 -4 z" fill="currentColor" fillOpacity="0.3" />
        </g>
      )}
      {motif === 'branches' && (
        <g {...s}>
          <rect x="20" y="12" width="8" height="8" rx="1.5" fill="currentColor" fillOpacity="0.3" />
          {[
            [8, 6],
            [40, 6],
            [6, 24],
            [42, 24],
            [24, 2],
            [24, 30],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <path d={`M24 16 L${x} ${y}`} strokeOpacity="0.4" />
              <circle cx={x} cy={y} r="2.2" />
            </g>
          ))}
        </g>
      )}
      {motif === 'sites' && (
        <g {...s}>
          <path d="M4 28 H44" strokeOpacity="0.35" />
          <rect x="6" y="10" width="10" height="18" rx="1" />
          <rect x="19" y="4" width="11" height="24" rx="1" fill="currentColor" fillOpacity="0.2" />
          <rect x="33" y="14" width="9" height="14" rx="1" />
          <circle cx="24.5" cy="10" r="2" fill="currentColor" />
        </g>
      )}
      {motif === 'lanes' && (
        <g {...s}>
          <path d="M4 7 H44 M4 16 H44 M4 25 H44" strokeOpacity="0.35" />
          <path d="M8 7 C 18 7, 18 16, 26 16 C 34 16, 34 25, 42 25" />
          <rect
            x="22"
            y="12.5"
            width="8"
            height="7"
            rx="1.5"
            fill="currentColor"
            fillOpacity="0.3"
          />
          <path d="M39 22 l3 3 -3 3" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Headings                                                             */
/* ------------------------------------------------------------------ */

/** A section head: kicker, H2 and an optional lead. */
export function Head({
  id,
  eyebrow,
  title,
  lead,
  className,
  center = false,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
  center?: boolean;
}) {
  return (
    <div className={cn(center ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl', className)}>
      {eyebrow && (
        <Kicker tone="clear" className={cn(center && 'justify-center')}>
          {eyebrow}
        </Kicker>
      )}
      <h2
        id={id}
        className={cn(
          'text-[clamp(1.75rem,1.2rem+1.9vw,2.75rem)] leading-[1.25] font-semibold tracking-tight text-balance whitespace-pre-line text-text-primary',
          eyebrow && 'mt-4',
        )}
      >
        {title}
      </h2>
      {lead && <p className="mt-5 text-body text-text-secondary">{lead}</p>}
    </div>
  );
}

/** The industry page H1, line by line (copy uses \n). */
export function PageTitle({ children, className }: { children: string; className?: string }) {
  return (
    <h1
      id="industry-title"
      className={cn(
        'text-[clamp(2rem,1.1rem+3vw,3.6rem)] leading-[1.18] font-semibold tracking-tight text-text-primary',
        className,
      )}
    >
      {children.split('\n').map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </h1>
  );
}

/** "ตัวอย่างกระบวนการ" — always labelled as illustrative. */
export function ExampleLabel({ className }: { className?: string }) {
  const c = useCopy(INDUSTRIES_SUMMARY).common;
  return (
    <div className={className} data-example-label>
      <Kicker tone="warm">{c.example}</Kicker>
      <p className="mt-2 text-caption text-text-muted">{c.exampleNote}</p>
    </div>
  );
}

/** Back to /industries (top of every industry page). */
export function BackLink({ className }: { className?: string }) {
  const c = useCopy(INDUSTRIES_SUMMARY).common;
  const { href } = useLocale();
  return (
    <Link
      to={href('/industries')}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary',
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {c.all}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Departments                                                          */
/* ------------------------------------------------------------------ */

export function DeptDot({ id, className }: { id: DeptKey; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: `var(--color-ws-${id})` }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* How CORE fits — the seven principles, phrased for one industry       */
/* ------------------------------------------------------------------ */

export function PrincipleFit({
  id,
  variant = 'columns',
  className,
}: {
  id: IndustryId;
  variant?: 'columns' | 'ledger';
  className?: string;
}) {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const lines = c.industries[id].principles;
  return (
    <dl
      data-principle-fit={id}
      className={cn(
        variant === 'columns'
          ? 'grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3'
          : 'divide-y divide-border-soft',
        className,
      )}
    >
      {PRINCIPLES.map((p, i) => (
        <div
          key={p}
          data-principle={p}
          className={
            variant === 'columns'
              ? 'border-t border-border-soft pt-4'
              : 'grid grid-cols-1 gap-1 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8'
          }
        >
          <dt className="flex items-baseline gap-2 text-caption font-semibold text-brand-soft">
            <span aria-hidden className="text-text-muted tabular">
              {String(i + 1).padStart(2, '0')}
            </span>
            {c.principles.names[p]}
          </dt>
          <dd className="mt-1.5 text-label text-text-primary sm:mt-0">{lines[p]}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Boundaries                                                           */
/* ------------------------------------------------------------------ */

/** The model's explicit boundaries (POS, property product, MRP, accounting). */
export function Boundaries({
  id,
  prominent = false,
  className,
}: {
  id: IndustryId;
  prominent?: boolean;
  className?: string;
}) {
  const c = useCopy(INDUSTRIES_SUMMARY).common;
  const list = INDUSTRIES[id].boundaries;
  return (
    <div className={cn('space-y-4', className)} data-boundaries={id}>
      {list.map((b, i) => {
        const big = prominent && i === 0;
        return (
          <div
            key={b}
            data-boundary={b}
            className={cn(
              'flex gap-3',
              big &&
                'rounded-[1.75rem] bg-[rgb(245_184_75/0.06)] p-6 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.22)] sm:p-8',
              prominent && i > 0 && 'px-6 sm:px-8',
            )}
          >
            <Info
              aria-hidden
              className={cn('mt-0.5 shrink-0 text-warning', big ? 'size-5' : 'size-4')}
            />
            <div>
              <p className={cn('font-semibold text-text-primary', big ? 'text-h3' : 'text-label')}>
                {c.boundaries[b].title}
              </p>
              <p className="mt-1 text-label text-text-secondary">{c.boundaries[b].body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Not replaced + may need custom implementation, side by side. */
export function Limits({
  notReplace,
  custom,
  className,
}: {
  notReplace: { title: string; items: readonly string[] };
  custom: { title: string; items: readonly string[] };
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14', className)}>
      {[
        { k: 'not-replace', b: notReplace },
        { k: 'custom', b: custom },
      ].map(({ k, b }) => (
        <div key={k} data-limits={k}>
          <Kicker tone="muted">{b.title}</Kicker>
          <ul className="mt-4 space-y-2.5">
            {b.items.map((x) => (
              <li key={x} className="flex items-start gap-2.5 text-label text-text-secondary">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-text-muted" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Links and the ending                                                 */
/* ------------------------------------------------------------------ */

const linkClass =
  'inline-flex min-h-11 min-w-11 items-center gap-2 text-label text-text-secondary hover:text-text-primary';

/** Departments, Solutions, How CORE works, Enterprise, pricing and the other industries. */
export function RelatedLinks({ id, className }: { id: IndustryId; className?: string }) {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  const name = useDeptName();
  const ind = INDUSTRIES[id];
  return (
    <nav aria-label={c.common.solutionsTitle} className={className} data-related={id}>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Kicker tone="muted">{c.common.departmentsTitle}</Kicker>
          <ul className="mt-2">
            {[...ind.departments, ...(ind.optional ?? [])].map((d) => (
              <li key={d}>
                <Link to={href(`/departments/${d}`)} data-dept-link={d} className={linkClass}>
                  <DeptDot id={d} />
                  {name(d)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Kicker tone="muted">{c.common.solutionsTitle}</Kicker>
          <ul className="mt-2">
            {ind.solutions.map((s) => (
              <li key={s}>
                <Link to={href(`/solutions#${s}`)} data-solution-link={s} className={linkClass}>
                  {c.common.solutionLabels[s]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Kicker tone="muted">{c.common.workflowTitle}</Kicker>
          <ul className="mt-2">
            {ind.chapters.map((ch) => (
              <li key={ch}>
                <Link
                  to={href(`/how-core-works#${ch}`)}
                  data-workflow-link={ch}
                  className={linkClass}
                >
                  {c.common.chapterLabels[ch]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Kicker tone="muted">{c.common.otherIndustries}</Kicker>
          <ul className="mt-2">
            {INDUSTRY_IDS.filter((x) => x !== id).map((x) => (
              <li key={x}>
                <Link to={href(industryPath(x))} data-industry-link={x} className={linkClass}>
                  <MotifGlyph motif={INDUSTRIES[x].motif} className="h-5 w-7 text-text-muted" />
                  {c.industries[x].short}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/** The quiet ending every industry page shares: consult, enterprise and pricing. */
export function Ending({ id, children }: { id: IndustryId | null; children?: ReactNode }) {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  const enterprise = id === null || INDUSTRIES[id].enterprise;
  return (
    <div className="mx-auto max-w-3xl text-center" data-ending>
      {children}
      <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link to={href('/contact')} data-cta="consult" className={buttonClasses('primary', 'lg')}>
          {c.common.consult}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-6 border-t border-border-soft pt-8 text-left sm:grid-cols-2">
        {enterprise && (
          <div data-enterprise-link>
            <p className="text-caption text-text-muted">{c.common.enterprise.lead}</p>
            <Link to={href('/enterprise')} className={cn(linkClass, 'text-brand-soft')}>
              {c.common.enterprise.cta}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        )}
        <div data-pricing-link className={cn(!enterprise && 'sm:col-span-2 sm:text-center')}>
          <p className="text-caption text-text-muted">{c.common.pricing.lead}</p>
          <Link to={href('/pricing')} className={linkClass}>
            {c.common.pricing.cta}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
