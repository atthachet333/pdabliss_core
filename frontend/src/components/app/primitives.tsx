import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CircleCheck, CircleDot, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/*
 * Workspace building blocks. Each workspace sets `--ws-accent` on its shell
 * (see WorkspaceLayout); these components pick it up so the same primitives
 * take on each department's own restrained hue.
 */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const toneChip: Record<Tone, string> = {
  neutral: 'border-border-strong bg-surface-overlay text-text-secondary',
  accent:
    'border-[color-mix(in_oklab,var(--ws-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_10%,transparent)] text-[var(--ws-accent)]',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
};

const toneIcon: Record<Tone, LucideIcon> = {
  neutral: CircleDot,
  accent: CircleDot,
  success: CircleCheck,
  warning: Clock,
  danger: CircleAlert,
  info: TriangleAlert,
};

/** Status chip: colour is never the only signal — every chip has an icon and a label. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = toneIcon[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-medium whitespace-nowrap',
        toneChip[tone],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** Marks illustrative content so nobody mistakes it for real records. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-dashed border-border-strong px-1.5 py-px text-[0.75rem] text-text-muted',
        className,
      )}
    >
      ตัวอย่าง
    </span>
  );
}

/** Workspace page header: department icon, title, one quiet line of context. */
export function WorkspaceHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  motif,
  actions,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  motif?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative mb-10 overflow-hidden rounded-card border border-border-soft bg-surface-base px-6 py-8 sm:px-8 sm:py-10">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--ws-accent)] to-transparent opacity-60"
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--ws-accent)_18%,transparent),transparent_70%)]"
      />
      {motif && (
        <img
          src={motif}
          alt=""
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 [mask-image:linear-gradient(to_left,black,transparent)] object-cover opacity-20 md:block"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--ws-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_10%,transparent)]">
            <Icon className="size-5.5 text-[var(--ws-accent)]" aria-hidden />
          </span>
          <div>
            <p className="text-caption font-semibold tracking-[0.16em] text-[var(--ws-accent)] uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 text-h2 text-text-primary">{title}</h1>
            <p className="mt-2 max-w-xl text-label text-text-secondary">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A single quiet number. Sample values are small and labelled. */
export function Metric({
  label,
  value,
  hint,
  icon: Icon,
  emphasis = false,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  /** Larger, task-first presentation (Warehouse). */
  emphasis?: boolean;
  tone?: 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-text-primary';
  return (
    <div
      className={cn(
        'rounded-panel border border-border-soft bg-surface-base',
        emphasis ? 'p-6' : 'p-5',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-text-secondary">{label}</p>
        {Icon && <Icon className="size-4.5 shrink-0 text-[var(--ws-accent)]" aria-hidden />}
      </div>
      <p
        className={cn(
          'mt-3 font-semibold tabular',
          toneClass,
          emphasis ? 'text-[2.75rem] leading-none' : 'text-kpi',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-caption text-text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-panel border border-border-soft bg-surface-base',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div>
          <h2 className="text-body font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="mt-1 text-caption text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cn('min-w-0 flex-1 p-6', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Preferred over fake data: explains what will appear here and why it is empty. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Label of the future primary action; rendered disabled in the prototype. */
  action?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong text-center',
        compact ? 'px-5 py-8' : 'px-6 py-12',
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-overlay">
        <Icon className="size-5 text-[var(--ws-accent)]" aria-hidden />
      </span>
      <p className="mt-4 text-label font-medium text-text-primary">{title}</p>
      <p className="mt-1.5 max-w-sm text-caption text-text-muted">{description}</p>
      {action && (
        <button
          type="button"
          disabled
          title="ยังไม่เปิดใช้งานในต้นแบบนี้"
          className="mt-5 inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-label text-text-secondary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {action}
          <span className="ml-2 text-caption text-text-muted">· เร็ว ๆ นี้</span>
        </button>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'accent',
}: {
  value: number;
  label: string;
  tone?: 'accent' | 'warning' | 'danger';
}) {
  const bar =
    tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-[var(--ws-accent)]';
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-highlight"
    >
      <div className={cn('h-full rounded-full', bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** A horizontal sequence of workflow stages with counts (stacks on small screens). */
export function StageFlow({
  stages,
  label,
}: {
  stages: readonly { label: string; count: number; hint?: string }[];
  label: string;
}) {
  return (
    <ol aria-label={label} className="grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
      {stages.map((s, i) => (
        <li key={s.label} className="relative">
          <div className="h-full rounded-2xl border border-border-soft bg-surface-raised/60 p-5">
            <p className="flex items-center gap-2 text-caption text-text-muted">
              <span className="flex size-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--ws-accent)_14%,transparent)] text-[0.6875rem] font-semibold text-[var(--ws-accent)] tabular">
                {i + 1}
              </span>
              {s.label}
            </p>
            <p className="mt-3 text-kpi text-text-primary tabular">{s.count}</p>
            {s.hint && <p className="mt-1 text-caption text-text-muted">{s.hint}</p>}
          </div>
          {i < stages.length - 1 && (
            <span
              aria-hidden
              className="absolute top-1/2 -right-2.5 z-10 hidden h-px w-2 bg-[var(--ws-accent)] opacity-60 sm:block"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
