import { CircleDashed, CircleDot, Layers, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Kicker } from '@/components/editorial/Layout';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ENTERPRISE } from './copy';
import { CLAIM_STATUSES, type ClaimStatus } from './model';

/*
 * Small /enterprise primitives. Layout comes from components/editorial;
 * these carry the page's claim discipline (status in words + icon).
 */

const STATUS_ICON: Record<ClaimStatus, LucideIcon> = {
  prototype: CircleDot,
  configurable: SlidersHorizontal,
  ready: Layers,
  planned: CircleDashed,
};
const STATUS_TEXT: Record<ClaimStatus, string> = {
  prototype: 'text-brand-soft',
  configurable: 'text-info',
  ready: 'text-text-primary',
  planned: 'text-text-muted',
};

/** How real a capability is — always an icon and words, never colour alone. */
export function StatusTag({ status, className }: { status: ClaimStatus; className?: string }) {
  const c = useCopy(ENTERPRISE).common.status[status];
  const Icon = STATUS_ICON[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 text-caption font-medium',
        STATUS_TEXT[status],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {c.label}
    </span>
  );
}

/** The legend for every status tag on the page. */
export function StatusKey({ className }: { className?: string }) {
  const c = useCopy(ENTERPRISE).common;
  return (
    <div className={className} data-status-key>
      <Kicker tone="muted">{c.keyTitle}</Kicker>
      <p className="mt-3 max-w-xl text-label text-text-secondary">{c.keyLead}</p>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {CLAIM_STATUSES.map((s) => (
          <div key={s} className="border-t border-border-soft pt-3">
            <dt>
              <StatusTag status={s} />
            </dt>
            <dd className="mt-1 text-caption text-text-muted">{c.status[s].note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A quiet note that bounds a claim. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      data-note
      className={cn(
        'border-l-2 border-brand-primary/40 pl-4 text-label text-text-secondary',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Eyebrow + title + lead, the head every chapter shares. */
export function Head({
  eyebrow,
  id,
  title,
  lead,
  className,
  size = 'title',
  center = false,
  children,
}: {
  eyebrow: string;
  id: string;
  title: string;
  lead?: string;
  className?: string;
  size?: 'statement' | 'title';
  center?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn(center ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl', className)}>
      <Kicker tone="clear" className={cn(center && 'justify-center')}>
        {eyebrow}
      </Kicker>
      <h2
        id={id}
        className={cn(
          'mt-4 text-balance whitespace-pre-line text-text-primary',
          size === 'statement'
            ? 'text-[clamp(2rem,1.25rem+2.8vw,3.6rem)] leading-[1.2] font-semibold tracking-tight'
            : 'text-[clamp(1.75rem,1.2rem+1.9vw,2.85rem)] leading-[1.25] font-semibold tracking-tight',
        )}
      >
        {title}
      </h2>
      {lead && <p className="mt-5 text-body text-text-secondary">{lead}</p>}
      {children}
    </div>
  );
}
