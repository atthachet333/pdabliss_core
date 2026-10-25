import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';

/*
 * Editorial layout primitives shared by the long-form public pages
 * (/solutions, /enterprise). Hierarchy comes from planes, stages, width,
 * spacing and type — content is held by the layout, not boxed.
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
  lg: 'py-24 sm:py-28 lg:py-36',
  md: 'py-20 sm:py-24 lg:py-28',
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
  /** Omit when the chapter only groups sections that carry their own names (EP19). */
  labelledBy?: string;
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
/* Stage — the layered surface that holds a section's dominant visual   */
/* ------------------------------------------------------------------ */

const STAGE_GLOW = {
  clear: 'bg-[radial-gradient(ellipse_70%_60%_at_70%_0%,rgb(25_195_154/0.13),transparent_70%)]',
  warm: 'bg-[radial-gradient(ellipse_70%_60%_at_30%_0%,rgb(245_184_75/0.08),transparent_70%)]',
  executive: 'bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgb(62_224_180/0.16),transparent_70%)]',
  none: '',
} as const;

/**
 * A layered stage: a deep gradient backplate, a faint inner grid, one
 * controlled glow and a hairline inner edge. Holds content without boxing it.
 */
export function Stage({
  children,
  className,
  glow = 'clear',
  grid = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: keyof typeof STAGE_GLOW;
  grid?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.92),rgb(6_13_20/0.94))] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06),0_50px_140px_-70px_rgb(0_0_0/0.9)] sm:rounded-[2.5rem]',
        className,
      )}
    >
      <div aria-hidden className={cn('absolute inset-0 -z-10', STAGE_GLOW[glow])} />
      {grid && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_75%)] opacity-40"
        />
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                                 */
/* ------------------------------------------------------------------ */

/** Section label with a short accent rule. */
export function Kicker({
  children,
  tone = 'warm',
  rule = true,
  className,
}: {
  children: ReactNode;
  tone?: 'warm' | 'clear' | 'muted';
  rule?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-3 text-caption font-semibold',
        tone === 'warm' ? 'text-warning' : tone === 'clear' ? 'text-brand-soft' : 'text-text-muted',
        className,
      )}
    >
      {rule && <span aria-hidden className="h-px w-6 shrink-0 bg-current opacity-70" />}
      {children}
    </p>
  );
}

const TITLE = {
  statement:
    'text-[clamp(2.125rem,1.25rem+3.1vw,4rem)] leading-[1.18] font-semibold tracking-tight',
  title: 'text-[clamp(1.75rem,1.2rem+1.9vw,2.85rem)] leading-[1.25] font-semibold tracking-tight',
  compact: 'text-h2',
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
