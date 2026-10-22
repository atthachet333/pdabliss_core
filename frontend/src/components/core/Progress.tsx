import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  label,
  tone = 'accent',
  showValue = false,
}: {
  value: number;
  label: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const bar = {
    accent: 'bg-[var(--ws-accent)]',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[tone];
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-fill-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && (
        <span className="w-10 shrink-0 text-right text-caption text-fg-secondary tabular">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

/**
 * Counts per workflow stage (e.g. PR → PO → รับของ). A quiet row of numbers,
 * horizontal from 640px, a compact list on phones.
 */
export function StageCounts({
  stages,
  label,
}: {
  stages: readonly { label: string; count: number; hint?: string }[];
  label: string;
}) {
  return (
    <ol
      aria-label={label}
      className="grid divide-y divide-line rounded-panel border border-line bg-panel sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0"
    >
      {stages.map((s, i) => (
        <li
          key={s.label}
          className="flex items-center justify-between gap-3 px-5 py-3.5 sm:block sm:py-5"
        >
          <p className="flex items-center gap-2 text-caption text-fg-muted">
            <span className="flex size-5 items-center justify-center rounded-full bg-fill-muted text-[0.6875rem] font-semibold text-fg-secondary tabular">
              {i + 1}
            </span>
            {s.label}
          </p>
          <div className="text-right sm:mt-3 sm:text-left">
            <p className="text-metric text-fg-primary tabular">{s.count}</p>
            {s.hint && <p className="hidden text-caption text-fg-muted sm:block">{s.hint}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
