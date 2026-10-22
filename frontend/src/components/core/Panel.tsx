import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { panelSurface } from './styles';

/**
 * Section heading used between groups of content on a page. One level below
 * the PageHeader title; keeps every page's rhythm identical.
 */
export function SectionHeader({
  id,
  title,
  description,
  aside,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  /** Right-aligned extras: SampleTag, link, count. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-section text-fg-primary">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-caption text-fg-muted">{description}</p>}
      </div>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}

/**
 * Standard content container. `flush` removes body padding for tables and
 * lists that draw their own row dividers.
 */
export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  flush = false,
  className,
  bodyClassName,
  headingLevel = 2,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const hasHeader = Boolean(title || actions);
  const bodyPadding = flush
    ? hasHeader && 'pt-4'
    : cn('px-5 pb-5 sm:px-6 sm:pb-6', hasHeader ? 'pt-4' : 'pt-5 sm:pt-6');
  return (
    <section className={cn('flex min-w-0 flex-col', panelSurface, className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <Heading className="text-section text-fg-primary">{title}</Heading>}
            {description && <p className="mt-0.5 text-caption text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', bodyPadding, bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-5 py-3 sm:px-6">{footer}</footer>}
    </section>
  );
}
