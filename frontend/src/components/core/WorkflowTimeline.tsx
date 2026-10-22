import type { LucideIcon } from 'lucide-react';
import { Ban, Check, CircleSlash, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StepState = 'completed' | 'current' | 'upcoming' | 'rejected' | 'blocked';

export interface WorkflowStep {
  label: string;
  state: StepState;
  /** Who / when, e.g. "ฝ่ายขาย · 21 ต.ค." */
  meta?: string;
  /** Reason for rejected / blocked steps. */
  note?: string;
}

const STATE_TEXT: Record<StepState, string> = {
  completed: 'เสร็จแล้ว',
  current: 'ขั้นตอนปัจจุบัน',
  upcoming: 'ยังไม่ถึง',
  rejected: 'ไม่อนุมัติ',
  blocked: 'ติดขัด',
};

const STATE_ICON: Partial<Record<StepState, LucideIcon>> = {
  completed: Check,
  rejected: X,
  blocked: Ban,
};

function Marker({ state }: { state: StepState }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2',
        state === 'completed' && 'border-brand-primary bg-brand-primary text-text-inverse',
        state === 'current' && 'border-[var(--ws-accent)] bg-panel',
        state === 'upcoming' && 'border-line-strong bg-panel',
        state === 'rejected' && 'border-danger bg-danger/15 text-danger',
        state === 'blocked' && 'border-warning bg-warning/12 text-warning',
      )}
    >
      {Icon && <Icon className="size-3.5" strokeWidth={3} />}
      {state === 'current' && <span className="size-2.5 rounded-full bg-[var(--ws-accent)]" />}
    </span>
  );
}

/**
 * Process progress for a document or order. Horizontal from 768px, vertical
 * on phones (and always vertical with `orientation="vertical"`, e.g. inside a
 * drawer). State is conveyed by marker shape + text, never colour alone.
 */
export function WorkflowTimeline({
  steps,
  label,
  orientation = 'responsive',
  className,
}: {
  steps: readonly WorkflowStep[];
  label: string;
  orientation?: 'responsive' | 'vertical';
  className?: string;
}) {
  const responsive = orientation === 'responsive';
  return (
    <ol
      aria-label={label}
      className={cn('flex flex-col', responsive && 'md:flex-row md:items-start', className)}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const done = step.state === 'completed';
        return (
          <li
            key={`${step.label}-${i}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex gap-3.5 pb-6 last:pb-0',
              responsive && 'md:flex-1 md:flex-col md:items-center md:gap-3 md:pb-0 md:text-center',
            )}
          >
            {/* Connector to the next step: solid when this step is done. */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-7 bottom-0 left-[0.8125rem] w-0.5',
                  responsive &&
                    'md:top-[0.8125rem] md:right-[calc(-50%+0.875rem)] md:bottom-auto md:left-[calc(50%+0.875rem)] md:h-0.5 md:w-auto',
                  done ? 'bg-brand-primary/70' : 'bg-line-strong',
                )}
              />
            )}
            <Marker state={step.state} />
            <div className={cn('min-w-0 pt-0.5', responsive && 'md:px-2 md:pt-0')}>
              <p
                className={cn(
                  'text-label',
                  step.state === 'current' ? 'font-semibold text-fg-primary' : 'text-fg-secondary',
                  step.state === 'upcoming' && 'text-fg-muted',
                )}
              >
                {step.label}
              </p>
              <p
                className={cn(
                  'text-caption',
                  step.state === 'rejected'
                    ? 'text-danger'
                    : step.state === 'blocked'
                      ? 'text-warning'
                      : 'text-fg-muted',
                )}
              >
                {STATE_TEXT[step.state]}
                {step.meta && <span className="text-fg-muted"> · {step.meta}</span>}
              </p>
              {step.note && (
                <p className="mt-1 flex items-start gap-1 text-caption text-fg-secondary">
                  <CircleSlash className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {step.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
