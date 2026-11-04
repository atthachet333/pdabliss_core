import { useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Pill, Section } from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { salesApi, type SalesOrder, type SoDetail } from './salesApi';
import { SALES_COPY } from './salesCopy';

/*
 * The allocation of a CONFIRMED sales order (EP34) — its own lazy chunk,
 * loaded only on confirmed orders. Per inventory-tracked line: ordered,
 * reserved, short (shortage first, never colour alone), then the order's
 * allocation state and pick readiness. Managers may allocate (repeatable:
 * it only adds what is still short), allocate again (release + allocate) or
 * release — each asked first; the server decides every quantity, location and
 * lot. Sales never sees locations or lots: that is the Warehouse's Pending Pick.
 */

type Step = 'allocate' | 'reallocate' | 'release';

export default function AllocationSection({
  o,
  run,
}: {
  o: SalesOrder;
  run: (work: () => Promise<SoDetail>, text?: string | (() => string)) => Promise<boolean>;
}) {
  const a = useCopy(SALES_COPY).alloc;
  const [open, setOpen] = useState<Step | null>(null);
  // Focus returns here when the confirm box closes (it unmounts with the focused button).
  const top = useRef<HTMLParagraphElement>(null);
  const close = () => {
    setOpen(null);
    top.current?.focus();
  };
  const lines = o.lines.filter((l) => l.allocation);
  if (!o.allocationState || !lines.length) return null;
  const steps = (['allocate', 'reallocate', 'release'] as const).filter((s) =>
    o.actions.includes(s),
  );
  const short = lines.filter((l) => l.allocation!.shortage !== '0');
  const go = async (s: Step) => {
    let text = a.released;
    const ok = await run(
      async () => {
        const r = await salesApi.act(o.id, s);
        // The server's result, worded: whether anything was added, and whether lines are still short.
        if (r.allocation) {
          text = a.result(
            r.allocation.allocatedNow !== '0',
            r.allocation.lines.every((l) => l.shortage === '0'),
          );
        }
        return r;
      },
      () => text,
    );
    if (ok) close();
  };
  return (
    <Section
      id="so-allocation"
      title={a.title}
      aside={
        <span className="flex flex-wrap gap-2">
          <Pill
            tone={o.allocationState === 'FULLY_ALLOCATED' ? 'teal' : 'warning'}
            data-allocation-state={o.allocationState}
          >
            {a.states[o.allocationState]}
          </Pill>
          {o.pickReadiness && (
            <Pill
              tone={o.pickReadiness === 'READY' ? 'teal' : 'muted'}
              data-readiness={o.pickReadiness}
            >
              {a.ready[o.pickReadiness]}
            </Pill>
          )}
        </span>
      }
    >
      <p ref={top} tabIndex={-1} className="mb-3 text-caption text-text-muted outline-none">
        {a.lead}
      </p>
      {short.length > 0 && (
        <p
          className="mb-3 rounded-lg bg-warning/[0.08] px-3 py-2 text-label text-[#f3cf8a]"
          role="status"
          data-shortage
        >
          {short
            .map((l) => `${l.item.code}: ${a.shortage} ${l.allocation!.shortage} ${l.unit.code}`)
            .join(' · ')}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-allocation-lines>
        {lines.map((l) => (
          <li
            key={l.id}
            className="grid gap-2 rounded-xl bg-white/[0.02] p-3"
            data-allocation-line={l.lineNo}
          >
            <span className="min-w-0 text-label break-words">
              <span className="font-mono text-caption text-text-muted">#{l.lineNo}</span>{' '}
              <span className="font-mono">{l.item.code}</span> · {l.item.name}
            </span>
            <dl className="grid grid-cols-3 gap-2 text-caption">
              {(
                [
                  [a.ordered, l.quantity, false],
                  [a.allocated, l.allocation!.allocated, false],
                  [a.shortage, l.allocation!.shortage, l.allocation!.shortage !== '0'],
                ] as const
              ).map(([t, v, warn]) => (
                <div key={t} className="min-w-0">
                  <dt className="text-text-muted">{t}</dt>
                  <dd
                    className={cn(
                      'font-semibold tabular-nums',
                      warn ? 'text-[#f3cf8a]' : 'text-text-primary',
                    )}
                  >
                    {v} <span className="font-normal text-text-muted">{l.unit.code}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {steps.length > 0 ? (
        <div className="mt-4 grid gap-3" data-allocation-actions>
          {open ? (
            <ConfirmBox
              question={a.ask[open]}
              goLabel={a.act[open]}
              onCancel={close}
              onConfirm={() => go(open)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s === 'allocate' ? 'primary' : 'secondary', 'md')}
                  data-action={s}
                >
                  {a.act[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        !o.actions.includes('cancel') && (
          <p className="mt-3 text-caption text-text-muted">{a.staffNote}</p>
        )
      )}
    </Section>
  );
}
