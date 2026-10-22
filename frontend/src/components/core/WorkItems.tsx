import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarClock,
  ChevronsUp,
  Equal,
  ChevronDown,
  OctagonAlert,
  TriangleAlert,
  Info,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StatusBadge } from './StatusBadge';
import type { Status } from './status';

/* ---------------------------------------------------------------------------
 * Task — the unit of "งานของฉัน" (My Work)
 * ------------------------------------------------------------------------ */

export type Priority = 'high' | 'normal' | 'low';

const PRIORITY: Record<Priority, { label: string; icon: LucideIcon; className: string }> = {
  high: { label: 'ด่วน', icon: ChevronsUp, className: 'text-danger' },
  normal: { label: 'ปกติ', icon: Equal, className: 'text-fg-secondary' },
  low: { label: 'ไม่เร่ง', icon: ChevronDown, className: 'text-fg-muted' },
};

export interface Task {
  id: string;
  title: string;
  /** Document reference, e.g. "SO-0001". */
  reference: string;
  /** Department short name. */
  department: string;
  priority: Priority;
  due: string;
  /** True when the due date has passed — shown in text, not only colour. */
  overdue?: boolean;
  status: Status;
  statusLabel?: string;
  /** The single thing to do next, phrased as a verb. */
  nextAction: string;
}

/**
 * One task row. Layout: priority · title + reference/department · due ·
 * status · next-action button. Stacks into a card on phones.
 */
export function TaskItem({
  task,
  onAction,
  actionSlot,
}: {
  task: Task;
  onAction?: (task: Task) => void;
  /** Replace the default next-action button (e.g. a disabled prototype button). */
  actionSlot?: ReactNode;
}) {
  const p = PRIORITY[task.priority];
  const PIcon = p.icon;
  return (
    <article className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn('mt-0.5 flex shrink-0 items-center', p.className)}
          title={`ความสำคัญ: ${p.label}`}
        >
          <PIcon className="size-4" aria-hidden />
          <span className="sr-only">ความสำคัญ {p.label}</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-label font-medium text-fg-primary">{task.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-fg-muted">
            <span className="tabular">{task.reference}</span>
            <span aria-hidden>·</span>
            <span>{task.department}</span>
            <span aria-hidden>·</span>
            <span className={cn('inline-flex items-center gap-1', task.overdue && 'text-danger')}>
              <CalendarClock className="size-3.5" aria-hidden />
              {task.overdue ? `เลยกำหนด · ${task.due}` : task.due}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pl-7 sm:pl-0">
        <StatusBadge status={task.status} label={task.statusLabel} size="sm" />
        {actionSlot ?? (
          <button
            type="button"
            onClick={() => onAction?.(task)}
            className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-caption font-medium text-[var(--ws-accent)] hover:bg-fill-hover"
          >
            {task.nextAction}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

export function TaskList({
  tasks,
  label,
  onAction,
}: {
  tasks: readonly Task[];
  label: string;
  onAction?: (t: Task) => void;
}) {
  return (
    <ul aria-label={label} className="divide-y divide-line">
      {tasks.map((t) => (
        <li key={t.id}>
          <TaskItem task={t} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * Exception — something that deviated from plan and needs a decision
 * ------------------------------------------------------------------------ */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY: Record<Severity, { label: string; icon: LucideIcon; rail: string; text: string }> =
  {
    critical: { label: 'วิกฤต', icon: OctagonAlert, rail: 'bg-danger', text: 'text-danger' },
    high: { label: 'สูง', icon: TriangleAlert, rail: 'bg-danger/70', text: 'text-danger' },
    medium: { label: 'ปานกลาง', icon: TriangleAlert, rail: 'bg-warning', text: 'text-warning' },
    low: { label: 'ต่ำ', icon: Info, rail: 'bg-info', text: 'text-info' },
  };

export interface ExceptionRecord {
  id: string;
  severity: Severity;
  title: string;
  reference: string;
  department?: string;
  /** Relative time or due, e.g. "เลยกำหนด 1 วัน". */
  time: string;
  reason: string;
  actionLabel: string;
}

/** Exception row — severity rail + icon + label, reason, one action. */
export function ExceptionItem({
  item,
  onAction,
}: {
  item: ExceptionRecord;
  onAction?: (item: ExceptionRecord) => void;
}) {
  const s = SEVERITY[item.severity];
  const SIcon = s.icon;
  return (
    <article className="relative flex flex-col gap-3 py-4 pr-5 pl-6 sm:flex-row sm:items-center sm:gap-5 sm:pr-6 sm:pl-7">
      <span
        aria-hidden
        className={cn('absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full', s.rail)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={cn('inline-flex items-center gap-1 text-caption font-medium', s.text)}>
            <SIcon className="size-3.5" aria-hidden />
            {s.label}
          </span>
          <h3 className="text-label font-medium text-fg-primary">{item.title}</h3>
        </div>
        <p className="mt-1 text-caption text-fg-secondary">{item.reason}</p>
        <p className="mt-1 flex flex-wrap gap-x-2 text-caption text-fg-muted">
          <span className="tabular">{item.reference}</span>
          {item.department && (
            <>
              <span aria-hidden>·</span>
              <span>{item.department}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{item.time}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAction?.(item)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-control border border-line-strong px-3 text-caption font-medium text-fg-primary hover:bg-fill-hover sm:self-center"
      >
        {item.actionLabel}
        <ArrowRight className="size-3.5" aria-hidden />
      </button>
    </article>
  );
}

export function ExceptionList({
  items,
  label,
  onAction,
}: {
  items: readonly ExceptionRecord[];
  label: string;
  onAction?: (item: ExceptionRecord) => void;
}) {
  return (
    <ul aria-label={label} className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.id}>
          <ExceptionItem item={it} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}
