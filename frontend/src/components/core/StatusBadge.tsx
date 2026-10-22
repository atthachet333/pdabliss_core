import type { LucideIcon } from 'lucide-react';
import {
  AlarmClock,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDotDashed,
  CircleX,
  Clock,
  LoaderCircle,
  Lock,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { STATUS_META, type Status, type StatusTone } from './status';

const TONE: Record<StatusTone, string> = {
  neutral: 'border-neutral/25 bg-neutral/8 text-neutral',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/35 bg-danger/10 text-danger',
};

const ICON: Record<Status, LucideIcon> = {
  draft: CircleDashed,
  pending: Clock,
  processing: LoaderCircle,
  partial: CircleDotDashed,
  completed: CircleCheck,
  closed: Lock,
  rejected: CircleX,
  cancelled: Ban,
  warning: TriangleAlert,
  overdue: AlarmClock,
};

/**
 * The one status chip of CORE. Ten semantic statuses share five colour
 * families; every badge carries an icon and a text label, so state is never
 * communicated by colour alone. Business documents may relabel a status
 * (`label`) but must map onto one of these families.
 */
export function StatusBadge({
  status,
  label,
  size = 'md',
  className,
}: {
  status: Status;
  /** Document-specific wording, e.g. "รับบางส่วน" for `partial`. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = ICON[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-px text-[0.75rem]' : 'px-2.5 py-0.5 text-caption',
        TONE[meta.tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      <span className="truncate">{label ?? meta.label}</span>
    </span>
  );
}
