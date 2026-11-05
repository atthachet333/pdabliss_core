import { Pill } from '@/features/company-center/parts';
import { useOut } from './outCopy';
import type { OutputProgress, OutputStatus, ReceiptStatus, TimelineItem } from './outputApi';

/* EP38 shared parts: status pills, the output figures, a document timeline. */

const OUT_TONE: Record<OutputStatus, 'neutral' | 'teal' | 'muted' | 'warning'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  ACCEPTED: 'teal',
  REJECTED: 'muted',
  CANCELLED: 'muted',
};
const RECEIPT_TONE: Record<ReceiptStatus, 'neutral' | 'teal' | 'muted'> = {
  DRAFT: 'neutral',
  POSTED: 'teal',
  CANCELLED: 'muted',
  REVERSED: 'muted',
};

export function OutputStatusPill({ status }: { status: OutputStatus }) {
  const { o } = useOut();
  return (
    <Pill
      tone={OUT_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-output-status={status}
    >
      {o.statuses[status]}
    </Pill>
  );
}

export function ReceiptStatusPill({ status }: { status: ReceiptStatus }) {
  const { o } = useOut();
  return (
    <Pill
      tone={RECEIPT_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-receipt-status={status}
    >
      {o.receiptStatuses[status]}
    </Pill>
  );
}

/** Target, reported, accepted, rejected, received, awaiting receipt, remaining — one unit. */
export function ProgressFigures({ p, unit }: { p: OutputProgress; unit: string }) {
  const { o } = useOut();
  const rows: [string, string, string][] = [
    ['target', o.f.target, p.target],
    ['goodReported', o.f.goodReported, p.goodReported],
    ['pendingReview', o.f.pending, p.pendingReview],
    ['accepted', o.f.accepted, p.accepted],
    ['rejected', o.f.rejected, p.rejected],
    ['received', o.f.received, p.received],
    ['awaitingReceipt', o.f.awaiting, p.awaitingReceipt],
    ['remaining', o.f.remaining, p.remaining],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-output-progress>
      {rows.map(([key, label, value]) => (
        <div key={key} className="rounded-xl bg-white/[0.02] p-3" data-figure={key}>
          <dt className="text-caption text-text-muted">{label}</dt>
          <dd className="text-label font-semibold text-text-primary tabular-nums">{`${value} ${unit}`}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OutTimeline({
  items,
  date,
}: {
  items: TimelineItem[];
  date: (iso: string) => string;
}) {
  const { o, c } = useOut();
  return (
    <ol className="grid gap-2" data-timeline>
      {items.map((t, i) => (
        <li key={i} className="flex flex-wrap gap-x-3 text-label">
          <span className="font-semibold text-text-primary">
            {o.timelineTypes[t.type.replace(/^PRODUCTION_OUTPUT_|^FINISHED_GOODS_RECEIPT_/, '')] ??
              t.type}
          </span>
          <span className="text-text-secondary">{t.actor?.name ?? c.system}</span>
          <span className="text-caption text-text-muted">{date(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}
