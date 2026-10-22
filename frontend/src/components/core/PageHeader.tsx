import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="เส้นทางหน้า" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-caption text-fg-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.to && !last ? (
                <Link to={c.to} className="rounded-sm hover:text-fg-primary">
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(last && 'text-fg-secondary')}
                >
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The single page-title pattern for every internal screen:
 * breadcrumb → title (+ status) → one line of description → actions.
 * Actions sit right on desktop and wrap under the title on phones. Put at most
 * one `primary` button in `actions`; everything else goes in secondary or the
 * overflow menu.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  status,
  meta,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  breadcrumb?: readonly Crumb[];
  /** A StatusBadge or Badge shown beside the title. */
  status?: ReactNode;
  /** Small metadata line under the description (owner, updated at, …). */
  meta?: ReactNode;
  /** Secondary actions first, primary last, then an OverflowMenu. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-8 lg:mb-10', className)}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-page text-fg-primary">{title}</h1>
            {status}
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl text-label text-fg-secondary">{description}</p>
          )}
          {meta && <div className="mt-2 text-caption text-fg-muted">{meta}</div>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
    </header>
  );
}
