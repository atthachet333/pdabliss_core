import { useId, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDateFormat } from '@/features/company-center/model';
import { AreaLink, Section } from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useOut } from './outCopy';
import { outputApi } from './outputApi';
import { OutputStatusPill, ProgressFigures, ReceiptStatusPill } from './outParts';
import type { Mo, MoDetail } from './productionApi';
import { LINK, PROD, Table } from './prodParts';

/*
 * The output and completion part of a production order (EP38, its own lazy
 * chunk, loaded only for orders in or past production): the output figures
 * (target, reported, accepted, rejected, received, awaiting receipt,
 * remaining — the order's unit), its output reports and finished goods
 * receipts, what still blocks closing, the completion actions, and the
 * traceability links (order-level granularity, said so).
 */

type Step = 'review' | 'reopen' | 'complete' | 'shortClose';

export default function OutputPanel({
  o,
  run,
  focusHeading,
}: {
  o: Mo;
  run: (work: () => Promise<MoDetail>, text?: string) => Promise<boolean>;
  focusHeading: () => void;
}) {
  const { o: t } = useOut();
  const { date, dateTime } = useDateFormat();
  const base = useId();
  const [open, setOpen] = useState<Step | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const p = o.output;
  if (!p) return null;
  const unit = o.unit.code;
  const comp = o.completion!;
  const blockers = comp.blockers;
  const short = Number(p.accepted) < Number(p.target);
  const steps: Step[] = [];
  if (o.actions.includes('review')) steps.push('review');
  if (o.actions.includes('reopen')) steps.push('reopen');
  if (o.actions.includes('complete') && blockers.length === 0)
    steps.push(short ? 'shortClose' : 'complete');
  const label: Record<Step, string> = {
    review: t.act.review,
    reopen: t.act.reopen,
    complete: t.act.complete,
    shortClose: t.act.shortClose,
  };
  const close = () => {
    setOpen(null);
    setReviewed(false);
    focusHeading();
  };
  const closing = open === 'complete' || open === 'shortClose';
  return (
    <>
      <Section id="mo-output" title={t.progress}>
        <ProgressFigures p={p} unit={unit} />
        {o.actions.includes('output') && (
          <AreaLink
            to={`${PROD}/output/new?order=${encodeURIComponent(o.id)}`}
            className={buttonClasses('secondary', 'md', 'mt-4 w-fit')}
            data-report-output
          >
            {t.newOutput}
          </AreaLink>
        )}
      </Section>
      <Section id="mo-output-reports" title={`${t.reports} · ${o.outputReports?.length ?? 0}`}>
        {o.outputReports?.length ? (
          <Table
            data="mo-outputs"
            rows={o.outputReports}
            rowKey={(r) => r.id}
            cols={[
              {
                head: t.f.number,
                cell: (r) => (
                  <AreaLink to={`${PROD}/output/${encodeURIComponent(r.id)}`} className={LINK}>
                    {r.number}
                  </AreaLink>
                ),
              },
              { head: t.f.status, cell: (r) => <OutputStatusPill status={r.status} /> },
              { head: t.f.good, end: true, cell: (r) => r.good },
              { head: t.f.defective, end: true, minor: true, cell: (r) => r.defective },
              { head: t.f.accepted, end: true, cell: (r) => r.accepted ?? '—' },
              { head: t.f.received, end: true, cell: (r) => r.received },
              { head: t.f.productionDate, minor: true, cell: (r) => date(r.productionDate) },
            ]}
          />
        ) : (
          <p className="text-label text-text-secondary">{t.noReports}</p>
        )}
        {(o.receipts?.length ?? 0) > 0 && (
          <ul className="mt-4 grid gap-2" aria-label={t.receipts}>
            {o.receipts!.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center gap-3 text-label"
                data-mo-receipt={x.number}
              >
                <span className="font-mono">{x.number}</span>
                <ReceiptStatusPill status={x.status} />
                <span className="tabular-nums">{`${x.quantity} ${unit}`}</span>
                <span className="text-caption text-text-muted">
                  {x.outputNumber}
                  {x.postedAt && ` · ${dateTime(x.postedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section id="mo-completion" title={t.completion.title}>
        {comp.outcome ? (
          <p className="text-label" data-outcome={comp.outcome}>
            {`${t.completion.outcome[comp.outcome]} · ${comp.completedAt ? dateTime(comp.completedAt) : ''} · ${comp.completedBy?.name ?? ''}`}
            {comp.reason && (
              <span className="block text-text-secondary">{`${t.f.reason}: ${comp.reason}`}</span>
            )}
          </p>
        ) : o.status === 'COMPLETION_REVIEW' ? (
          blockers.length ? (
            <div data-blockers>
              <p className="text-label font-semibold">{t.completion.blockersTitle}</p>
              <ul className="mt-2 list-disc pl-5 text-label text-text-secondary">
                {blockers.map((b) => (
                  <li key={b}>{t.completion.blockers[b] ?? b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-label" data-ready>
              {t.completion.ready}
            </p>
          )
        ) : null}
        <p className="mt-3 text-caption text-text-muted">{t.completion.unrecorded}</p>
        {steps.length > 0 && (
          <div className="mt-4 grid gap-3" data-completion-actions>
            {open ? (
              <>
                {closing && (
                  <label
                    htmlFor={`${base}-rv`}
                    className="flex min-h-11 items-center gap-3 text-label"
                  >
                    <input
                      id={`${base}-rv`}
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="size-5 accent-brand-primary"
                      data-materials-reviewed
                    />
                    {t.completion.materialsReviewed}
                  </label>
                )}
                <ConfirmBox
                  question={t.ask[open]}
                  goLabel={label[open]}
                  reason={open === 'shortClose' ? 'required' : undefined}
                  onCancel={close}
                  onConfirm={async (reason) => {
                    if (closing && !reviewed) return;
                    const work = () =>
                      open === 'review' || open === 'reopen'
                        ? outputApi.orderAct(o.id, open)
                        : outputApi.orderAct(o.id, 'complete', {
                            outcome: open === 'complete' ? 'COMPLETED' : 'SHORT_CLOSED',
                            materialsReviewed: true,
                            ...(reason ? { reason } : {}),
                          });
                    if (await run(work)) close();
                  }}
                />
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {steps.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setOpen(s)}
                    className={buttonClasses(
                      s === 'complete' || s === 'review' ? 'primary' : 'ghost',
                      'md',
                    )}
                    data-action={s}
                  >
                    {label[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
      {o.traceability &&
        (o.traceability.outputLots.length > 0 || o.traceability.materialLots.length > 0) && (
          <Section id="mo-trace" title={t.trace.title}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-caption text-text-muted">{t.trace.outputLots}</p>
                <ul className="mt-1 grid gap-1 text-label" data-trace="output">
                  {o.traceability.outputLots.map((l, i) => (
                    <li key={i}>
                      {`${l.lotNumber} · ${l.quantity} ${unit} · ${l.receipt}`}
                      {l.expiryDate && ` · ${t.f.expiry} ${date(l.expiryDate)}`}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-caption text-text-muted">{t.trace.materialLots}</p>
                <ul className="mt-1 grid gap-1 text-label" data-trace="material">
                  {o.traceability.materialLots.map((l, i) => (
                    <li
                      key={i}
                    >{`${l.item} · ${l.lotNumber ?? '—'} · ${l.quantity} ${l.unit} · ${l.issue}`}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-caption text-text-muted">{t.trace.note}</p>
          </Section>
        )}
    </>
  );
}
