import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { SOLUTIONS_COPY } from './copy';
import { getSolution, type SolutionId, type Tone } from './model';

/*
 * Layout primitives for /solutions (EP09 revision). Hierarchy comes from
 * planes, width, spacing and type — not from outlining every element.
 */

/* ------------------------------------------------------------------ */
/* Chapters: background planes and widths                               */
/* ------------------------------------------------------------------ */

type Plane = 'obsidian' | 'navy' | 'grid' | 'glow' | 'deep' | 'clear';

const PLANES: Record<Plane, string> = {
  obsidian: '',
  navy: 'bg-[linear-gradient(to_bottom,transparent,rgb(9_19_31/0.85)_14%,rgb(9_19_31/0.85)_86%,transparent)]',
  grid: '',
  glow: 'bg-[radial-gradient(ellipse_70%_55%_at_50%_45%,rgb(25_195_154/0.07),transparent_72%)]',
  deep: 'bg-[linear-gradient(to_bottom,transparent,#03070c_10%,#03070c_90%,transparent)]',
  clear: 'bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgb(25_195_154/0.1),transparent_70%)]',
};

const SPACE = {
  lg: 'py-24 sm:py-32 lg:py-40',
  md: 'py-20 sm:py-28 lg:py-32',
  sm: 'py-16 sm:py-20 lg:py-24',
} as const;

export function Chapter({
  id,
  labelledBy,
  plane = 'obsidian',
  space = 'md',
  className,
  children,
  data,
}: {
  id?: string;
  labelledBy: string;
  plane?: Plane;
  space?: keyof typeof SPACE;
  className?: string;
  children: ReactNode;
  data?: Record<string, string>;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('relative isolate scroll-mt-20', SPACE[space], PLANES[plane], className)}
      {...Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]))}
    >
      {plane === 'grid' && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_75%_70%_at_55%_50%,black,transparent_80%)] opacity-60"
        />
      )}
      {children}
    </section>
  );
}

const WIDTHS = {
  narrow: 'max-w-3xl',
  base: 'max-w-[1240px]',
  wide: 'max-w-[1440px]',
  full: 'max-w-[1640px]',
} as const;

export function Frame({
  width = 'base',
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-10', WIDTHS[width], className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                                 */
/* ------------------------------------------------------------------ */

export function Kicker({
  children,
  tone = 'warm',
  className,
}: {
  children: ReactNode;
  tone?: 'warm' | 'clear' | 'muted';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-caption font-semibold',
        tone === 'warm' ? 'text-warning' : tone === 'clear' ? 'text-brand-soft' : 'text-text-muted',
        className,
      )}
    >
      {children}
    </p>
  );
}

const TITLE = {
  statement: 'text-[clamp(2rem,1.2rem+3vw,3.75rem)] leading-[1.22] font-semibold tracking-tight',
  title: 'text-h2',
  compact: 'text-h3',
} as const;

export function ChapterTitle({
  id,
  size = 'title',
  className,
  children,
}: {
  id: string;
  size?: keyof typeof TITLE;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Reveal>
      <h2
        id={id}
        className={cn('text-balance whitespace-pre-line text-text-primary', TITLE[size], className)}
      >
        {children}
      </h2>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                               */
/* ------------------------------------------------------------------ */

const TONE_ICON: Record<Tone | 'resolved', LucideIcon> = {
  attention: AlertTriangle,
  blocked: Ban,
  waiting: Clock,
  resolved: CheckCircle2,
};
const TONE_TEXT: Record<Tone | 'resolved', string> = {
  attention: 'text-warning',
  blocked: 'text-danger',
  waiting: 'text-info',
  resolved: 'text-success',
};

/** Problem / resolved state — icon and words, never colour alone. */
export function ToneBadge({
  tone,
  label,
  className,
}: {
  tone: Tone | 'resolved';
  label?: string;
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY).common;
  const Icon = TONE_ICON[tone];
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1 text-caption font-medium',
        TONE_TEXT[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label ?? (tone === 'resolved' ? c.resolved : c.tones[tone])}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Story meta — open, typographic                                       */
/* ------------------------------------------------------------------ */

/** Problem / where / impact. `prose` reads as one paragraph; `rows` as quiet labelled lines. */
export function Facts({
  id,
  variant = 'rows',
  className,
}: {
  id: SolutionId;
  variant?: 'rows' | 'prose' | 'columns';
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  const rows = [
    { k: c.common.problem, v: st.problem },
    { k: c.common.where, v: st.where },
    { k: c.common.impact, v: st.impact },
  ];
  if (variant === 'prose') {
    return (
      <dl className={cn('space-y-3', className)} data-facts>
        {rows.map((r) => (
          <div key={r.k} className="flex flex-wrap gap-x-2">
            <dt className="text-label text-text-muted">{r.k} —</dt>
            <dd className="text-body text-text-secondary">{r.v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl
      className={cn(
        variant === 'columns' ? 'grid grid-cols-1 gap-6 md:grid-cols-3' : 'space-y-4',
        className,
      )}
      data-facts
    >
      {rows.map((r) => (
        <div key={r.k}>
          <dt className="text-caption text-text-muted">{r.k}</dt>
          <dd className="mt-1 text-label text-text-primary">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What CORE does — a plain list with check marks, no chips. */
export function ResponseList({
  id,
  columns = 1,
  inline = false,
  className,
}: {
  id: SolutionId;
  columns?: 1 | 2;
  inline?: boolean;
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  return (
    <div className={className} data-response>
      <Kicker tone="clear">{c.common.response}</Kicker>
      <ul
        className={cn(
          'mt-3 gap-x-6 gap-y-2',
          inline
            ? 'flex flex-wrap'
            : columns === 2
              ? 'grid grid-cols-1 sm:grid-cols-2'
              : 'grid grid-cols-1',
        )}
      >
        {st.response.map((r) => (
          <li key={r} className="flex items-start gap-2 text-label text-text-primary">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
            {r}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-text-muted">
        {c.common.who} · <span className="text-text-secondary">{st.who}</span>
      </p>
    </div>
  );
}

/** “Before” in a restrained warm tone, “with CORE” back in emerald — separated by a line, not boxed. */
export function BeforeAfter({
  id,
  stacked = false,
  className,
}: {
  id: SolutionId;
  stacked?: boolean;
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  return (
    <dl
      className={cn('grid grid-cols-1 gap-5', !stacked && 'sm:grid-cols-2 sm:gap-0', className)}
      data-before-after
    >
      <div className={cn(!stacked && 'sm:pr-6')}>
        <dt className="text-caption font-semibold text-warning">{c.common.before}</dt>
        <dd className="mt-1.5 text-label text-text-secondary">“{st.before}”</dd>
      </div>
      <div
        className={cn(
          'border-t border-border-soft pt-5',
          !stacked && 'sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6',
        )}
      >
        <dt className="text-caption font-semibold text-brand-soft">{c.common.after}</dt>
        <dd className="mt-1.5 text-label text-text-primary">{st.after}</dd>
      </div>
    </dl>
  );
}

/** Departments and the How CORE works chapter — locale preserved, as quiet text links. */
export function StoryLinks({ id, className }: { id: SolutionId; className?: string }) {
  const c = useCopy(SOLUTIONS_COPY).common;
  const { href } = useLocale();
  const departments = useDepartments();
  const s = getSolution(id);
  return (
    <div className={className} data-story-links={id}>
      <Kicker tone="muted">{c.departments}</Kicker>
      <ul className="mt-1 flex flex-wrap gap-x-4">
        {s.departments.map((d) => (
          <li key={d}>
            <Link
              to={href(`/departments/${d}`)}
              data-dept-link={d}
              className="inline-flex min-h-11 items-center gap-2 text-label text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: `var(--color-ws-${d})` }}
              />
              {departments.find((x) => x.id === d)!.name}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to={href(`/how-core-works#${s.workflow}`)}
        data-workflow-link={s.workflow}
        className="inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
      >
        {c.workflow}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

export function Boundary({ id, className }: { id: SolutionId; className?: string }) {
  const c = useCopy(SOLUTIONS_COPY);
  const text = c.stories[id].boundary;
  if (!text) return null;
  return (
    <p
      data-boundary
      className={cn('flex items-start gap-2 text-label text-text-secondary', className)}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
      <span>
        <span className="font-semibold text-text-primary">{c.common.boundary}: </span>
        {text}
      </span>
    </p>
  );
}

/**
 * The quiet footer of a chapter: what CORE does, before/after and links,
 * divided by hairlines instead of boxes. Three arrangements, so the nine
 * stories don't all end the same way.
 */
export function MetaStrip({
  id,
  variant = 'strip',
  className,
}: {
  id: SolutionId;
  variant?: 'strip' | 'split' | 'quiet';
  className?: string;
}) {
  if (variant === 'split') {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-10 border-t border-border-soft pt-8 lg:grid-cols-2 lg:gap-16',
          className,
        )}
      >
        <div className="space-y-6">
          <ResponseList id={id} columns={2} />
          <StoryLinks id={id} />
        </div>
        <BeforeAfter id={id} stacked />
      </div>
    );
  }
  if (variant === 'quiet') {
    return (
      <div className={cn('space-y-8 border-t border-border-soft pt-8', className)}>
        <ResponseList id={id} inline />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <BeforeAfter id={id} />
          <StoryLinks id={id} />
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-8 border-t border-border-soft pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.85fr)] lg:gap-10',
        className,
      )}
    >
      <ResponseList id={id} />
      <BeforeAfter id={id} className="lg:border-x lg:border-border-soft lg:px-10" />
      <StoryLinks id={id} />
    </div>
  );
}

/** A soft surface plane for a visual — depth without an outline. */
export function Plane({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'neutral' | 'warm' | 'clear';
}) {
  return (
    <div
      className={cn(
        'rounded-[2rem] p-5 sm:p-8',
        tone === 'warm'
          ? 'bg-surface-base/50 bg-[radial-gradient(ellipse_90%_80%_at_20%_0%,rgb(245_184_75/0.07),transparent_70%)]'
          : tone === 'clear'
            ? 'bg-surface-base/60 bg-[radial-gradient(ellipse_90%_80%_at_80%_0%,rgb(25_195_154/0.1),transparent_70%)]'
            : 'bg-surface-base/50',
        className,
      )}
    >
      {children}
    </div>
  );
}
