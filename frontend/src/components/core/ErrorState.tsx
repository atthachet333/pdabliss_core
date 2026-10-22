import type { LucideIcon } from 'lucide-react';
import { CircleAlert, CloudOff, FileQuestion, OctagonAlert, RotateCw, ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { ERROR_COPY } from './copy';

export type ErrorKind = keyof typeof ERROR_COPY;

const ICON: Record<ErrorKind, LucideIcon> = {
  pageLoad: CloudOff,
  section: CircleAlert,
  permission: ShieldX,
  notFound: FileQuestion,
  unexpected: OctagonAlert,
};

/**
 * Calm, professional error presentation. `section` renders inline inside a
 * panel so the rest of the page keeps working; every other kind is a centred
 * page-level state. Provide `onRetry` wherever trying again could succeed
 * (load errors) — not for permission or not-found.
 */
export function ErrorState({
  kind,
  title,
  description,
  onRetry,
  action,
  reference,
  className,
}: {
  kind: ErrorKind;
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  /** Extra navigation, e.g. a LinkButton back to the overview. */
  action?: ReactNode;
  /** Support reference for unexpected errors. */
  reference?: string;
  className?: string;
}) {
  const copy = ERROR_COPY[kind];
  const Icon = ICON[kind];
  const tone = kind === 'permission' || kind === 'notFound' ? 'text-fg-secondary' : 'text-danger';
  const retry = onRetry && (
    <Button size={kind === 'section' ? 'sm' : 'md'} icon={RotateCw} onClick={onRetry}>
      ลองอีกครั้ง
    </Button>
  );

  if (kind === 'section') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col gap-3 rounded-control border border-danger/25 bg-danger/[0.05] px-4 py-4 sm:flex-row sm:items-center',
          className,
        )}
      >
        <Icon className="size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-label font-medium text-fg-primary">{title ?? copy.title}</p>
          <p className="text-caption text-fg-muted">{description ?? copy.description}</p>
        </div>
        {retry}
      </div>
    );
  }

  return (
    <div
      role={kind === 'notFound' || kind === 'permission' ? 'status' : 'alert'}
      className={cn('flex flex-col items-center px-6 py-14 text-center sm:py-20', className)}
    >
      <span className="flex size-14 items-center justify-center rounded-full border border-line-strong bg-panel-raised">
        <Icon className={cn('size-6', tone)} aria-hidden />
      </span>
      <h2 className="mt-6 text-section text-fg-primary">{title ?? copy.title}</h2>
      <p className="mt-2 max-w-md text-label text-fg-secondary">
        {description ?? copy.description}
      </p>
      {(retry || action) && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {retry}
          {action}
        </div>
      )}
      {reference && (
        <p className="mt-6 text-caption text-fg-muted">
          รหัสอ้างอิง <code className="rounded bg-fill-muted px-1.5 py-0.5">{reference}</code>
        </p>
      )}
    </div>
  );
}
