import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { Kicker } from '@/components/editorial/Layout';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { SOLUTIONS_COPY } from './copy';
import { getSolution, type SolutionId, type Tone } from './model';

/*
 * Story primitives for /solutions. Layout primitives live in
 * components/editorial and are re-exported here for the story files.
 */

export { Chapter, ChapterTitle, Frame, Kicker, Plane, Stage } from '@/components/editorial/Layout';

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
/* Story facts and support                                              */
/* ------------------------------------------------------------------ */

/**
 * Problem / where / impact. `lead` sets the problem as a readable lead with
 * the other two as quiet annotations; `columns` lays all three across.
 */
export function Facts({
  id,
  variant = 'lead',
  className,
}: {
  id: SolutionId;
  variant?: 'lead' | 'columns';
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  if (variant === 'columns') {
    const rows = [
      { k: c.common.problem, v: st.problem },
      { k: c.common.where, v: st.where },
      { k: c.common.impact, v: st.impact },
    ];
    return (
      <dl className={cn('grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-10', className)} data-facts>
        {rows.map((r) => (
          <div key={r.k} className="border-t border-border-soft pt-4">
            <dt className="text-caption text-text-muted">{r.k}</dt>
            <dd className="mt-1.5 text-body text-text-primary">{r.v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn('max-w-xl', className)} data-facts>
      <dt className="sr-only">{c.common.problem}</dt>
      <dd className="text-body-lg text-text-primary">{st.problem}</dd>
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border-soft pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-text-muted">{c.common.where}</dt>
          <dd className="mt-1 text-label text-text-secondary">{st.where}</dd>
        </div>
        <div>
          <dt className="text-caption text-text-muted">{c.common.impact}</dt>
          <dd className="mt-1 text-label text-text-secondary">{st.impact}</dd>
        </div>
      </div>
    </dl>
  );
}

/** What CORE does — a check list, no chips. */
export function ResponseList({
  id,
  columns = 1,
  className,
}: {
  id: SolutionId;
  columns?: 1 | 2;
  className?: string;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  return (
    <div className={className} data-response>
      <Kicker tone="clear">{c.common.response}</Kicker>
      <ul
        className={cn(
          'mt-4 grid gap-x-6 gap-y-2.5',
          columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {st.response.map((r) => (
          <li key={r} className="flex items-start gap-2.5 text-label text-text-primary">
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-primary/15"
            >
              <Check className="size-3 text-brand-glow" />
            </span>
            {r}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-caption text-text-muted">
        {c.common.who} · <span className="text-text-secondary">{st.who}</span>
      </p>
    </div>
  );
}

/**
 * Before → with CORE, as one paired comparison: a dim warm tile, an arrow,
 * a lit emerald tile. Vertical when `stacked` or on small screens.
 */
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
      className={cn(
        'grid grid-cols-1 items-stretch gap-2',
        !stacked && 'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
        className,
      )}
      data-before-after
    >
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgb(245_184_75/0.08),rgb(245_184_75/0.02))] p-5">
        <dt className="text-caption font-semibold text-warning">{c.common.before}</dt>
        <dd className="mt-2 text-label text-text-secondary">“{st.before}”</dd>
      </div>
      <div aria-hidden className="flex items-center justify-center text-brand-glow">
        {stacked ? (
          <ArrowDown className="size-4" />
        ) : (
          <>
            <ArrowDown className="size-4 md:hidden" />
            <ArrowRight className="hidden size-4 md:block" />
          </>
        )}
      </div>
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgb(25_195_154/0.14),rgb(25_195_154/0.04))] p-5 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.12)]">
        <dt className="text-caption font-semibold text-brand-soft">{c.common.after}</dt>
        <dd className="mt-2 text-label text-text-primary">{st.after}</dd>
      </div>
    </dl>
  );
}

/** Departments and the How CORE works chapter — locale preserved. */
export function StoryLinks({ id, className }: { id: SolutionId; className?: string }) {
  const c = useCopy(SOLUTIONS_COPY).common;
  const { href } = useLocale();
  const departments = useDepartments();
  const s = getSolution(id);
  return (
    <div className={className} data-story-links={id}>
      <Kicker tone="muted">{c.departments}</Kicker>
      <ul className="mt-2 flex flex-wrap gap-x-5">
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
        className="group mt-2 inline-flex min-h-11 items-center gap-2 text-label font-medium text-brand-soft hover:text-text-primary"
      >
        {c.workflow}
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
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
 * The support composition that closes a story: what CORE does, the paired
 * before/after and where to go next.
 * - `band`: a low-contrast panel with three zones
 * - `pair`: the before/after pair leads, response and links follow
 * - `inset`: no panel of its own — for use inside a Stage
 */
export function MetaStrip({
  id,
  variant = 'band',
  className,
}: {
  id: SolutionId;
  variant?: 'band' | 'pair' | 'inset';
  className?: string;
}) {
  if (variant === 'pair') {
    return (
      <div className={cn('space-y-10', className)}>
        <BeforeAfter id={id} />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
          <ResponseList id={id} columns={2} />
          <StoryLinks id={id} />
        </div>
      </div>
    );
  }
  const inner = (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,0.8fr)] lg:gap-12">
      <ResponseList id={id} />
      <BeforeAfter id={id} stacked className="lg:px-2" />
      <StoryLinks id={id} />
    </div>
  );
  if (variant === 'inset') {
    return <div className={cn('border-t border-white/[0.06] pt-10', className)}>{inner}</div>;
  }
  return (
    <div
      className={cn(
        'rounded-[2rem] bg-surface-base/45 p-6 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.05)] sm:p-10',
        className,
      )}
    >
      {inner}
    </div>
  );
}
