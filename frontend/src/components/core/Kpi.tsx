import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KpiTrend {
  direction: 'up' | 'down' | 'flat';
  /** e.g. "+2 จากเมื่อวาน" — always text, never an arrow alone. */
  label: string;
  /** Whether this direction is good news. Colours the trend, nothing else. */
  sentiment?: 'positive' | 'negative' | 'neutral';
}

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const;

/**
 * Restrained metric. Three variants:
 *  - `compact` (default): small tile for a row of 3–4 numbers
 *  - `primary`: the one number that matters on a page (larger, accent rail)
 *  - `alert`: a number that needs action (warning/danger frame + reason)
 * Not every page needs KPIs. Prefer three meaningful numbers over eight.
 */
export function Kpi({
  label,
  value,
  unit,
  supporting,
  icon: Icon,
  variant = 'compact',
  alertTone = 'warning',
  trend,
  action,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  supporting?: ReactNode;
  icon?: LucideIcon;
  variant?: 'compact' | 'primary' | 'alert';
  alertTone?: 'warning' | 'danger';
  trend?: KpiTrend;
  action?: ReactNode;
  className?: string;
}) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const alert = variant === 'alert';
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col',
        'rounded-panel border bg-panel shadow-panel',
        variant === 'primary' ? 'p-6' : 'p-5',
        alert ? (alertTone === 'danger' ? 'border-danger/30' : 'border-warning/30') : 'border-line',
        className,
      )}
    >
      {variant === 'primary' && (
        <span
          aria-hidden
          className="absolute top-5 bottom-5 left-0 w-0.5 rounded-full bg-[var(--ws-accent)]"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-label text-fg-secondary">{label}</p>
        {alert ? (
          <TriangleAlert
            className={cn(
              'size-4 shrink-0',
              alertTone === 'danger' ? 'text-danger' : 'text-warning',
            )}
            aria-label="ต้องดำเนินการ"
          />
        ) : (
          Icon && <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            'tabular',
            variant === 'primary' ? 'text-[2.5rem] leading-none font-semibold' : 'text-metric',
            alert ? (alertTone === 'danger' ? 'text-danger' : 'text-warning') : 'text-fg-primary',
          )}
        >
          {value}
        </span>
        {unit && <span className="text-caption text-fg-muted">{unit}</span>}
      </p>
      {(supporting || trend) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
          {trend && TrendIcon && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                trend.sentiment === 'positive' && 'text-success',
                trend.sentiment === 'negative' && 'text-danger',
                (!trend.sentiment || trend.sentiment === 'neutral') && 'text-fg-secondary',
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden />
              {trend.label}
            </span>
          )}
          {supporting && <span className="text-fg-muted">{supporting}</span>}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Responsive KPI row: 1 → 2 → up to 4 columns, never cramped. */
export function KpiGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}
