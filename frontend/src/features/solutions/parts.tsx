import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { SOLUTIONS_COPY } from './copy';
import { getSolution, type SolutionId, type Tone } from './model';

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

/** Departments and the How CORE works chapter a story connects to — locale preserved. */
export function StoryLinks({ id }: { id: SolutionId }) {
  const c = useCopy(SOLUTIONS_COPY).common;
  const { href } = useLocale();
  const departments = useDepartments();
  const s = getSolution(id);
  return (
    <div className="flex flex-col gap-3" data-story-links={id}>
      <div>
        <p className="text-caption font-semibold text-text-muted">{c.departments}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {s.departments.map((d) => {
            const info = departments.find((x) => x.id === d)!;
            return (
              <li key={d}>
                <Link
                  to={href(`/departments/${d}`)}
                  data-dept-link={d}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft px-3 text-label text-text-secondary hover:border-border-strong hover:text-text-primary"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: `var(--color-ws-${d})` }}
                  />
                  {info.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Link
        to={href(`/how-core-works#${s.workflow}`)}
        data-workflow-link={s.workflow}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-label text-brand-soft hover:text-text-primary"
      >
        {c.workflow}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

/** “Before” in a restrained warm tone, “with CORE” back in emerald clarity. */
export function BeforeAfter({ id }: { id: SolutionId }) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  return (
    <dl
      className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-soft bg-border-soft sm:grid-cols-2"
      data-before-after
    >
      <div className="bg-surface-base bg-[linear-gradient(to_bottom,rgb(245_184_75/0.06),transparent)] p-4">
        <dt className="text-caption font-semibold text-warning">{c.common.before}</dt>
        <dd className="mt-1 text-label text-text-secondary">“{st.before}”</dd>
      </div>
      <div className="bg-surface-base bg-[linear-gradient(to_bottom,rgb(25_195_154/0.08),transparent)] p-4">
        <dt className="text-caption font-semibold text-brand-soft">{c.common.after}</dt>
        <dd className="mt-1 text-label text-text-primary">{st.after}</dd>
      </div>
    </dl>
  );
}

function Facts({ id, columns = 1 }: { id: SolutionId; columns?: 1 | 3 }) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  const rows = [
    { k: c.common.problem, v: st.problem },
    { k: c.common.where, v: st.where },
    { k: c.common.impact, v: st.impact },
  ];
  return (
    <dl
      className={cn('grid gap-4', columns === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1')}
      data-facts
    >
      {rows.map((r) => (
        <div key={r.k} className="border-l-2 border-warning/40 pl-3">
          <dt className="text-caption font-semibold text-text-muted">{r.k}</dt>
          <dd className="mt-0.5 text-label text-text-primary">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Response({ id }: { id: SolutionId }) {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories[id];
  return (
    <div data-response>
      <p className="text-caption font-semibold text-brand-soft">{c.common.response}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {st.response.map((r) => (
          <li
            key={r}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-brand/50 bg-brand-primary/[0.06] px-2.5 py-1.5 text-label text-text-primary"
          >
            <CheckCircle2 aria-hidden className="size-3.5 text-brand-glow" />
            {r}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-text-muted">
        {c.common.who}: <span className="text-text-secondary">{st.who}</span>
      </p>
    </div>
  );
}

/**
 * The frame every story shares (problem, impact, CORE response, before/after,
 * links). Each story brings its own visual and chooses a layout, so the page
 * never repeats one template nine times.
 */
export function Story({
  id,
  layout,
  visual,
  aside,
}: {
  id: SolutionId;
  layout: 'split' | 'splitReverse' | 'stacked';
  visual: ReactNode;
  aside?: ReactNode;
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const s = getSolution(id);
  const st = c.stories[id];
  const titleId = `${s.anchor}-title`;
  const head = (
    <Reveal>
      <p className="text-caption font-semibold text-warning">{st.eyebrow}</p>
      <h2 id={titleId} className="mt-3 text-h2 whitespace-pre-line text-text-primary">
        {st.title}
      </h2>
    </Reveal>
  );
  const boundary = st.boundary && (
    <p
      data-boundary
      className="flex items-start gap-2 rounded-xl border border-border-soft bg-surface-base/70 px-3.5 py-3 text-label text-text-secondary"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
      <span>
        <span className="font-semibold text-text-primary">{c.common.boundary}: </span>
        {st.boundary}
      </span>
    </p>
  );

  return (
    <section
      id={s.anchor}
      aria-labelledby={titleId}
      data-solution={id}
      className="relative scroll-mt-20 py-16 sm:py-24"
    >
      <Container>
        {layout === 'stacked' ? (
          <>
            {head}
            <div className="mt-8">
              <Facts id={id} columns={3} />
            </div>
            <div className="mt-10">{visual}</div>
            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-6">
                <Response id={id} />
                {boundary}
              </div>
              <div className="space-y-6">
                <BeforeAfter id={id} />
                <StoryLinks id={id} />
              </div>
            </div>
            {aside}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <div className={cn('space-y-7', layout === 'splitReverse' && 'lg:order-2')}>
              {head}
              <Facts id={id} />
              <Response id={id} />
              {boundary}
            </div>
            <div className={cn('min-w-0 space-y-6', layout === 'splitReverse' && 'lg:order-1')}>
              {visual}
              <BeforeAfter id={id} />
              <StoryLinks id={id} />
              {aside}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

/** A panel for story visuals. */
export function Panel({
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
        'rounded-[1.75rem] border p-5 sm:p-7',
        tone === 'warm'
          ? 'border-warning/25 bg-surface-base/60 bg-[radial-gradient(ellipse_80%_70%_at_20%_0%,rgb(245_184_75/0.06),transparent_70%)]'
          : tone === 'clear'
            ? 'border-border-brand/50 bg-surface-base/60 bg-[radial-gradient(ellipse_80%_70%_at_80%_0%,rgb(25_195_154/0.1),transparent_70%)]'
            : 'border-border-soft bg-surface-base/60',
        className,
      )}
    >
      {children}
    </div>
  );
}
