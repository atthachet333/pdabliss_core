import type { ReactNode } from 'react';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import type { BranchAccess, BranchRef } from './api';
import { CONTROL_COPY } from './copy';
import { Pill } from './parts';

/*
 * Small pieces shared by the EP26 administration screens: how a branch scope
 * reads, a branch code as the primary handle, the active / inactive rail, and
 * a branch's location in one short line. Operational teal, no cards for their
 * own sake, no avatars.
 */

/** The branch code as the row's handle (mono, fixed width). */
export function BranchCode({ code, head }: { code: string; head?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[3.75rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-caption tabular-nums',
        head
          ? 'bg-brand-primary/[0.12] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
          : 'bg-white/[0.05] text-text-secondary',
      )}
    >
      {code}
    </span>
  );
}

/** A thin vertical rail: teal when active, graphite when not. */
export function StatusRail({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-y-2 left-0 w-[3px] rounded-full',
        active ? 'bg-brand-primary/80' : 'bg-white/[0.12]',
      )}
    />
  );
}

export function BranchStatusPill({ status }: { status: string }) {
  const c = useCopy(CONTROL_COPY);
  if (status === 'ACTIVE') return <Pill tone="teal">{c.common.active}</Pill>;
  return <Pill tone="muted">{status === 'CLOSED' ? c.common.closed : c.common.inactive}</Pill>;
}

/** Where a person may work: "All branches" or the codes (names on hover / for screen readers). */
export function ScopeSummary({
  access,
  compact = false,
}: {
  access: BranchAccess;
  compact?: boolean;
}) {
  const a = useCopy(ADMIN_COPY);
  if (access.scope === 'ALL_BRANCHES') {
    return <span className="text-caption text-text-secondary">{a.scope.ALL_BRANCHES}</span>;
  }
  if (access.branches.length === 0) {
    return <Pill tone="warning">{a.scope.none}</Pill>;
  }
  const shown = compact ? access.branches.slice(0, 3) : access.branches;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((b) => (
        <BranchChip key={b.id} branch={b} />
      ))}
      {shown.length < access.branches.length && (
        <span className="text-caption text-text-muted">
          +{access.branches.length - shown.length}
        </span>
      )}
    </span>
  );
}

export function BranchChip({ branch: b }: { branch: BranchRef }) {
  const a = useCopy(ADMIN_COPY);
  return (
    <span
      title={b.name}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-caption tabular-nums',
        b.status === 'ACTIVE'
          ? 'bg-white/[0.06] text-text-secondary'
          : 'text-text-muted line-through shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
      )}
    >
      {b.code}
      <span className="sr-only">
        {' '}
        {b.name}
        {b.status !== 'ACTIVE' && ` (${a.member.inactiveBranch})`}
      </span>
    </span>
  );
}

/** A labelled group of fields inside a form (Identity / Address / Contact …). */
export function FieldGroup({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('grid min-w-0 gap-4', className)}>
      <legend className="mb-3 flex w-full items-center gap-3 text-caption font-semibold tracking-wide text-text-muted uppercase">
        <span className="shrink-0">{legend}</span>
        <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
      </legend>
      {children}
    </fieldset>
  );
}
