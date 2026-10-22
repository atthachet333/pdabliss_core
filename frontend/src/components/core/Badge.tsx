import type { LucideIcon } from 'lucide-react';
import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Quiet, non-status label (category, count, reference type). For document or
 * task state use StatusBadge instead.
 */
export function Badge({
  children,
  icon: Icon,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: 'neutral' | 'accent' | 'outline';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[0.75rem] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-fill-muted text-fg-secondary',
        tone === 'accent' &&
          'bg-[color-mix(in_oklab,var(--ws-accent)_12%,transparent)] text-[var(--ws-accent)]',
        tone === 'outline' && 'border border-line-strong text-fg-secondary',
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

/** Marks illustrative content so nobody mistakes it for real records. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-dashed border-line-strong px-1.5 py-px text-[0.75rem] text-fg-muted',
        className,
      )}
    >
      ตัวอย่าง
    </span>
  );
}

/** Marks a prototype-only control (switcher, design lab, placeholders). */
export function PrototypeTag({
  children = 'ต้นแบบ',
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-dashed border-warning/40 px-1.5 py-px text-[0.75rem] font-medium text-warning',
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** Numeric count chip, e.g. on navigation items and tabs. */
export function CountBadge({
  count,
  label,
  className,
}: {
  count: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full bg-fill-muted px-1.5 text-[0.75rem] font-medium text-fg-secondary tabular',
        className,
      )}
    >
      {count}
      {label && <span className="sr-only"> {label}</span>}
    </span>
  );
}
