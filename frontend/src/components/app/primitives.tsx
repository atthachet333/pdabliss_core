import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CircleCheck, CircleDot, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const toneText: Record<Tone, string> = {
  neutral: 'text-text-primary',
  brand: 'text-brand-glow',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

const toneChip: Record<Tone, string> = {
  neutral: 'border-border-strong bg-surface-overlay text-text-secondary',
  brand: 'border-border-brand bg-brand-primary/10 text-brand-soft',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
};

const toneIcon: Record<Tone, LucideIcon> = {
  neutral: CircleDot,
  brand: CircleDot,
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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-medium whitespace-nowrap',
        toneChip[tone],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

interface KpiTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  /** Emphasised, larger tile — used by task-first workspaces like Warehouse. */
  size?: 'md' | 'lg';
}

export function KpiTile({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  size = 'md',
}: KpiTileProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-panel border border-border-soft bg-surface-raised',
        size === 'lg' ? 'p-5' : 'p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label text-text-secondary">{label}</p>
        <Icon
          className={cn('size-5 shrink-0', tone === 'neutral' ? 'text-text-muted' : toneText[tone])}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          'mt-2 font-semibold tabular',
          toneText[tone],
          size === 'lg' ? 'text-[2.5rem] leading-none' : 'text-kpi',
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
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
        <div>
          <h2 className="text-body font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="mt-0.5 text-caption text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={cn('min-w-0 flex-1 p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  label,
}: {
  value: number;
  tone?: Tone;
  label: string;
}) {
  const bar = {
    neutral: 'bg-text-muted',
    brand: 'bg-brand-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }[tone];
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

/** Scroll container for tables so wide data never causes page-level horizontal scroll. */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export const th =
  'px-3 py-2.5 text-left text-caption font-medium whitespace-nowrap text-text-muted';
export const td = 'px-3 py-3 text-label whitespace-nowrap text-text-primary';

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h2 text-text-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-label text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
