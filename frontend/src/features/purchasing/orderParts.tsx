import { useId, useState, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { FieldError } from '@/features/auth/fields';
import { Pill } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import type { DepositStatus, OperationalLine, PoStatus } from './orderApi';
import { ORDER_COPY } from './orderCopy';

/*
 * Small pieces shared by the EP30 screens (Purchasing orders, Accounting
 * deposits, Warehouse pending receive) — kept apart so the Accounting and
 * Warehouse chunks do not load the order editor. Status is text plus a subtle
 * tone, never colour alone.
 */

const PO_TONE: Record<PoStatus, 'teal' | 'neutral' | 'warning' | 'muted'> = {
  DRAFT: 'neutral',
  ISSUED: 'teal',
  WAITING_DEPOSIT: 'warning',
  PENDING_RECEIVE: 'teal',
  CANCELLED: 'muted',
};

export function PoStatusPill({ status }: { status: PoStatus }) {
  const c = useCopy(ORDER_COPY);
  return (
    <Pill
      tone={PO_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-po-status={status}
    >
      {c.statuses[status]}
    </Pill>
  );
}

export function DepositPill({ status }: { status: DepositStatus }) {
  const c = useCopy(ORDER_COPY);
  return (
    <Pill tone={status === 'PENDING' ? 'warning' : 'muted'} data-deposit-status={status}>
      {c.depositStatuses[status]}
    </Pill>
  );
}

/** "OIL-1 · Olive oil" or the described need, then quantity and unit. */
export function LineIdentity({ line, quantity }: { line: OperationalLine; quantity?: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block text-label break-words text-text-primary">
        {line.item ? (
          <>
            <span className="font-mono">{line.item.code}</span> · {line.item.name}
          </>
        ) : (
          line.description
        )}
      </span>
      <span className="block text-caption text-text-secondary">
        {quantity ?? <span className="font-semibold tabular-nums">{line.quantity}</span>}{' '}
        {line.unit?.code ?? line.unit?.name ?? ''}
        <span className="text-text-muted">
          {' '}
          · {line.request.number} #{line.request.lineNo}
        </span>
      </span>
    </span>
  );
}

/**
 * Confirms an action in place (focus moves into it; Escape backs out). A
 * reason box when `reason` is 'required' or 'optional'; a free text field
 * (e.g. a payment reference) when `field` is given.
 */
export function ConfirmBox({
  question,
  goLabel,
  reason,
  field,
  onConfirm,
  onCancel,
}: {
  question: string;
  goLabel: string;
  reason?: 'required' | 'optional';
  field?: { label: string; hint: string; maxLength: number };
  onConfirm: (text?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const c = useCopy(ORDER_COPY);
  const base = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const asks = !!reason || !!field;
  const label = field?.label ?? (reason === 'required' ? c.f.reason : c.reasonOptional);
  return (
    <div
      role="group"
      aria-labelledby={`${base}-title`}
      className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      data-confirm-box
    >
      <p id={`${base}-title`} className="text-label text-text-primary">
        {question}
      </p>
      {asks && (
        <div>
          <label
            htmlFor={`${base}-text`}
            className="mb-2 block text-label font-medium text-text-primary"
          >
            {label}
          </label>
          <textarea
            id={`${base}-text`}
            value={text}
            rows={field ? 1 : 3}
            maxLength={field?.maxLength ?? 500}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={
              [field ? `${base}-hint` : '', error ? `${base}-error` : '']
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={controlClass(!!error, true)}
          />
          {field && (
            <p id={`${base}-hint`} className="mt-1.5 text-caption text-text-muted">
              {field.hint}
            </p>
          )}
          {error && <FieldError id={`${base}-error`}>{error}</FieldError>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          autoFocus={!asks}
          onClick={() => {
            if (reason === 'required' && !text.trim()) {
              setError(c.reasonRequired);
              document.getElementById(`${base}-text`)?.focus();
              return;
            }
            setBusy(true);
            void onConfirm(text.trim() || undefined).finally(() => setBusy(false));
          }}
          className={buttonClasses('primary', 'md')}
          data-confirm-go
        >
          {goLabel}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.cancel}
        </button>
      </div>
    </div>
  );
}
