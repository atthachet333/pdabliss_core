import type { LucideIcon } from 'lucide-react';
import { CircleCheck, Inbox, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type EmptyKind = 'empty' | 'clear' | 'filtered';

const KIND_ICON: Record<EmptyKind, LucideIcon> = {
  empty: Inbox,
  clear: CircleCheck,
  filtered: SearchX,
};

/**
 * Intentional empty state. Preferred over fake data: it says what will appear
 * here and where it comes from. Three kinds:
 *  - `empty`    nothing has been created yet
 *  - `clear`    good news — nothing outstanding (success-tinted icon)
 *  - `filtered` the filters hide everything (offer "ล้างตัวกรอง")
 * Layouts: `default` (centred, inside a panel), `compact` (smaller panels),
 * `inline` (one row inside a list).
 */
export function EmptyState({
  title,
  description,
  icon,
  kind = 'empty',
  layout = 'default',
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  kind?: EmptyKind;
  layout?: 'default' | 'compact' | 'inline';
  /** One Button / LinkButton; prototype actions use `soon`. */
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icon ?? KIND_ICON[kind];
  const iconTone = kind === 'clear' ? 'text-success' : 'text-[var(--ws-accent)]';

  if (layout === 'inline') {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-control bg-fill-hover px-4 py-3.5 text-left',
          className,
        )}
      >
        <Icon className={cn('size-4.5 shrink-0', iconTone)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-label text-fg-primary">{title}</p>
          {description && <p className="text-caption text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
    );
  }

  const compact = layout === 'compact';
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12 sm:py-14',
        className,
      )}
    >
      {/* Icon tile inside two faint rings — a quiet echo of the CORE orbit motif. */}
      <span
        aria-hidden
        className={cn(
          'relative flex items-center justify-center rounded-full',
          compact ? 'size-12' : 'size-14',
          'bg-panel-raised shadow-[0_0_0_6px_var(--color-fill-hover),0_0_0_7px_var(--color-line),0_0_0_14px_color-mix(in_oklab,var(--color-fill-hover)_50%,transparent)]',
        )}
      >
        <Icon className={cn(compact ? 'size-5' : 'size-6', iconTone)} />
      </span>
      <p
        className={cn(
          'font-medium text-fg-primary',
          compact ? 'mt-5 text-label' : 'mt-6 text-body',
        )}
      >
        {title}
      </p>
      {description && <p className="mt-1.5 max-w-sm text-caption text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
