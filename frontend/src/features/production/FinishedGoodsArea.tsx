import { useId, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useLocale } from '@/i18n/useLocale';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageError,
  PageTitle,
  Section,
} from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { whApi, type WarehouseContext } from '@/features/warehouse/whApi';
import { usePaged } from '@/features/warehouse/whModel';
import { useOut } from './outCopy';
import {
  outputApi,
  type Receipt,
  type ReceiptDetail,
  type ReceiptLineInput,
  type Tracking,
} from './outputApi';
import { OutTimeline, ReceiptStatusPill } from './outParts';
import { places, QTY } from './productionApi';
import { BackLink, ItemCell, LINK, Table } from './prodParts';

/*
 * /core/warehouse/finished-goods/* (EP38, its own lazy chunk) — Warehouse
 * receives ACCEPTED production output into stock: the pending queue (accepted,
 * received, pending per output report), the receipts list, a receipt editor
 * (location of the branch, lot / expiry / production date per the item's
 * tracking, quantity) and one receipt (FGR-YYYYMM-NNNNNN). Posting asks first,
 * in the exact words: the goods are added to physical stock. No price, cost or
 * customer anywhere (the server's allow-listed views).
 */

const FG = '/core/warehouse/finished-goods';

export default function FinishedGoodsArea() {
  const ctx = useLoad(() => whApi.context());
  const { o, err } = useOut();
  if (ctx.state.status === 'loading') return <Loading label={o.loading} />;
  if (ctx.state.status === 'error')
    return <PageError error={ctx.state.error}>{err(ctx.state.error)}</PageError>;
  const w = ctx.state.data;
  return (
    <div className="grid grid-cols-1 gap-6" data-finished-goods>
      <Routes>
        <Route index element={<Queue w={w} />} />
        {w.finishedGoods?.process && <Route path="new" element={<NewReceipt w={w} />} />}
        <Route path=":id" element={<ById w={w} />} />
      </Routes>
    </div>
  );
}

function ById({ w }: { w: WarehouseContext }) {
  const { id } = useParams();
  return <ReceiptPage key={id} id={id!} w={w} />;
}

function Queue({ w }: { w: WarehouseContext }) {
  const { o, err } = useOut();
  const { date, dateTime } = useDateFormat();
  const pending = usePaged((page) => outputApi.pending({ page, pageSize: 25 }), []);
  const receipts = usePaged((page) => outputApi.receipts({ page, pageSize: 25 }), []);
  return (
    <>
      <BackLink to="/core/warehouse" />
      <PageTitle title={o.fg.title} lead={o.fg.lead} />
      <Section id="fg-pending" title={o.fg.pending}>
        {pending.error && !pending.data ? (
          <Notice tone="error">{err(pending.error)}</Notice>
        ) : !pending.data ? (
          <Loading label={o.loading} />
        ) : pending.data.items.length === 0 ? (
          <p className="text-label text-text-secondary" data-empty>
            {o.none}
          </p>
        ) : (
          <ol className="grid gap-3">
            {pending.data.items.map((p) => (
              <li
                key={p.output.id}
                className="grid gap-2 rounded-xl bg-white/[0.02] p-4"
                data-pending={p.output.number}
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                  <span className="font-mono font-semibold">{p.output.number}</span>
                  <span className="text-text-secondary">{`${o.f.order} ${p.order.number}`}</span>
                  {p.output.productionDate && (
                    <span className="text-caption text-text-muted">
                      {date(p.output.productionDate)}
                    </span>
                  )}
                </p>
                <ItemCell code={p.item.code} name={p.item.name} />
                <p className="text-label tabular-nums">
                  {`${o.f.accepted} ${p.accepted} · ${o.f.received} ${p.received} · `}
                  <strong>{`${o.fg.pending} ${p.pending} ${p.unit.code}`}</strong>
                </p>
                <p className="text-caption text-text-muted">
                  {[
                    p.tracking.lot === 'REQUIRED' ? `${o.f.lot}: ${o.fg.tracking}` : null,
                    p.tracking.expiry === 'REQUIRED' ? `${o.f.expiry}: ${o.fg.tracking}` : null,
                    p.draftReceipts ? o.fg.draftReceipts(p.draftReceipts) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {w.finishedGoods?.process && (
                  <AreaLink
                    to={`${FG}/new?output=${encodeURIComponent(p.output.id)}`}
                    className={buttonClasses('secondary', 'md', 'w-fit')}
                    data-new-receipt
                  >
                    {o.act.newReceipt}
                  </AreaLink>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section id="fg-receipts" title={o.fg.list}>
        {receipts.error && !receipts.data ? (
          <Notice tone="error">{err(receipts.error)}</Notice>
        ) : !receipts.data ? (
          <Loading label={o.loading} />
        ) : receipts.data.items.length === 0 ? (
          <p className="text-label text-text-secondary">{o.none}</p>
        ) : (
          <Table
            data="fg-receipts"
            rows={receipts.data.items}
            rowKey={(r) => r.id}
            cols={[
              {
                head: o.f.number,
                cell: (r) => (
                  <AreaLink to={`${FG}/${encodeURIComponent(r.id)}`} className={LINK}>
                    {r.number}
                  </AreaLink>
                ),
              },
              { head: o.f.status, cell: (r) => <ReceiptStatusPill status={r.status} /> },
              { head: o.fg.output, cell: (r) => r.output.number },
              { head: o.f.item, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
              { head: o.f.quantity, end: true, cell: (r) => `${r.quantity} ${r.unit.code}` },
              {
                head: o.f.postedAt,
                minor: true,
                cell: (r) => (r.postedAt ? dateTime(r.postedAt) : '—'),
              },
            ]}
          />
        )}
        {receipts.data?.hasMore && (
          <button
            type="button"
            disabled={receipts.more}
            onClick={receipts.showMore}
            className={buttonClasses('secondary', 'md', 'mt-3 w-fit')}
          >
            {receipts.more ? o.loading : o.showMore}
          </button>
        )}
      </Section>
    </>
  );
}

type Row = {
  locationId: string;
  lotNumber: string;
  expiryDate: string;
  manufacturedDate: string;
  quantity: string;
};
const blank = (w: WarehouseContext): Row => ({
  locationId:
    w.locations.find((l) => l.branchId === w.selectedBranch?.id && l.isDefault)?.id ??
    w.locations.find((l) => l.branchId === w.selectedBranch?.id)?.id ??
    '',
  lotNumber: '',
  expiryDate: '',
  manufacturedDate: '',
  quantity: '',
});
const toInput = (r: Row): ReceiptLineInput => ({
  locationId: r.locationId,
  lotNumber: r.lotNumber.trim() || null,
  expiryDate: r.expiryDate || null,
  manufacturedDate: r.manufacturedDate || null,
  quantity: r.quantity,
});

/** Receipt lines (shape checked here — tracking, expiry and limits are the server's). */
function LinesForm({
  w,
  initial,
  precision,
  unit,
  tracking,
  submitLabel,
  onSubmit,
}: {
  w: WarehouseContext;
  initial: Row[];
  precision: number;
  unit: string;
  tracking: { lot: Tracking; expiry: Tracking };
  submitLabel: string;
  onSubmit: (lines: ReceiptLineInput[]) => Promise<void>;
}) {
  const { o } = useOut();
  const base = useId();
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState(false);
  const locations = w.locations.filter((l) => l.branchId === w.selectedBranch?.id);
  const qtyBad = (q: string) => !QTY.test(q) || !/[1-9]/.test(q) || places(q) > precision;
  const bad = rows.some((r) => !r.locationId || qtyBad(r.quantity));
  const edit = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (bad) return;
        setBusy(true);
        void onSubmit(rows.map(toInput)).finally(() => setBusy(false));
      }}
      data-receipt-editor
    >
      <ol className="grid gap-3">
        {rows.map((r, i) => (
          <li
            key={i}
            className="grid gap-3 rounded-xl bg-white/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <SelectField
              id={`${base}-${i}-l`}
              label={o.f.location}
              value={r.locationId}
              onChange={(e) => edit(i, { locationId: e.target.value })}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>
              ))}
            </SelectField>
            {tracking.lot !== 'NONE' && (
              <TextField
                id={`${base}-${i}-lot`}
                label={o.f.lot}
                value={r.lotNumber}
                maxLength={60}
                required={tracking.lot === 'REQUIRED'}
                onChange={(e) => edit(i, { lotNumber: e.target.value })}
              />
            )}
            {tracking.lot !== 'NONE' && tracking.expiry !== 'NONE' && (
              <TextField
                id={`${base}-${i}-exp`}
                type="date"
                label={o.f.expiry}
                value={r.expiryDate}
                required={tracking.expiry === 'REQUIRED'}
                onChange={(e) => edit(i, { expiryDate: e.target.value })}
              />
            )}
            {tracking.lot !== 'NONE' && (
              <TextField
                id={`${base}-${i}-mfd`}
                type="date"
                label={o.f.made}
                value={r.manufacturedDate}
                onChange={(e) => edit(i, { manufacturedDate: e.target.value })}
              />
            )}
            <TextField
              id={`${base}-${i}-q`}
              label={`${o.f.quantity} (${unit})`}
              inputMode="decimal"
              value={r.quantity}
              onChange={(e) => edit(i, { quantity: e.target.value.trim() })}
              error={r.quantity && qtyBad(r.quantity) ? o.errors.QUANTITY_PRECISION : undefined}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                className={buttonClasses('ghost', 'md', 'w-fit self-end')}
              >
                {o.act.removeLine}
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, blank(w)])}
          className={buttonClasses('ghost', 'md', 'w-fit')}
        >
          {o.act.addLine}
        </button>
        <button
          type="submit"
          disabled={busy || bad}
          className={buttonClasses('primary', 'md', 'w-fit')}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function NewReceipt({ w }: { w: WarehouseContext }) {
  const { o, err } = useOut();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [params] = useSearchParams();
  const outputId = params.get('output') ?? '';
  const pending = useLoad(() => outputApi.pending({ page: 1, pageSize: 100 }));
  const [error, setError] = useState<string | null>(null);
  if (pending.state.status === 'loading') return <Loading label={o.loading} />;
  if (pending.state.status === 'error')
    return <PageError error={pending.state.error}>{err(pending.state.error)}</PageError>;
  const p = pending.state.data.items.find((x) => x.output.id === outputId);
  return (
    <>
      <BackLink to={FG} />
      <PageTitle title={o.act.newReceipt} lead={o.fg.lead} />
      {!p ? (
        <Notice tone="error">{o.errors.OUTPUT_NOT_ACCEPTED}</Notice>
      ) : (
        <>
          <Facts>
            <Fact term={o.fg.output}>{p.output.number}</Fact>
            <Fact term={o.f.order}>{p.order.number}</Fact>
            <Fact term={o.f.item}>{`${p.item.code} · ${p.item.name}`}</Fact>
            <Fact term={o.fg.pending}>{`${p.pending} ${p.unit.code}`}</Fact>
          </Facts>
          <LinesForm
            w={w}
            initial={[{ ...blank(w), quantity: p.pending }]}
            precision={p.unit.precision}
            unit={p.unit.code}
            tracking={p.tracking}
            submitLabel={o.act.save}
            onSubmit={async (lines) => {
              setError(null);
              try {
                const d = await outputApi.createReceipt({ outputReportId: p.output.id, lines });
                void navigate(`${FG}/${encodeURIComponent(d.receipt.id)}`, { state: { locale } });
              } catch (x) {
                setError(err(x));
              }
            }}
          />
          <div aria-live="polite">{error && <Notice tone="error">{error}</Notice>}</div>
        </>
      )}
    </>
  );
}

type Step = 'post' | 'cancel' | 'reverse';

function ReceiptPage({ id, w }: { id: string; w: WarehouseContext }) {
  const { o, err } = useOut();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => outputApi.receipt(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Step | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={o.loading} />;
  if (state.status === 'error')
    return (
      <PageError error={state.error} back={<BackLink to={FG} />}>
        {err(state.error)}
      </PageError>
    );
  const { receipt: r, timeline } = state.data;
  const run = async (work: () => Promise<ReceiptDetail>, text: string) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: err(e) });
      return false;
    }
  };
  const close = () => {
    setOpen(null);
    heading.current?.focus();
  };
  const steps = (['post', 'cancel', 'reverse'] as const).filter((a) => r.actions.includes(a));
  const label: Record<Step, string> = {
    post: o.act.post,
    cancel: o.act.cancelReceipt,
    reverse: o.act.reverse,
  };
  const ask: Record<Step, string> = {
    post: o.ask.post,
    cancel: o.ask.cancelReceipt,
    reverse: o.ask.reverse,
  };
  return (
    <>
      <BackLink to={FG} />
      <div
        ref={heading}
        tabIndex={-1}
        className="outline-none"
        data-receipt={r.number}
        data-status={r.status}
      >
        <PageTitle title={r.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReceiptStatusPill status={r.status} />
          <span className="text-caption text-text-muted">{`${o.fg.output} ${r.output.number} · ${o.f.order} ${r.order.number}`}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      <Section id="fgr-facts" title={o.f.lines}>
        <Facts className="mb-4">
          <Fact term={o.f.item}>{`${r.item.code} · ${r.item.name}`}</Fact>
          <Fact term={o.f.accepted}>{`${r.output.accepted} ${r.unit.code}`}</Fact>
          <Fact term={o.f.received}>{`${r.output.received} ${r.unit.code}`}</Fact>
          <Fact term={o.fg.pending}>{`${r.output.pending} ${r.unit.code}`}</Fact>
          <Fact
            term={o.f.createdBy}
          >{`${dateTime(r.createdAt)} · ${r.createdBy?.name ?? ''}`}</Fact>
          {r.postedAt && (
            <Fact term={o.f.postedAt}>{`${dateTime(r.postedAt)} · ${r.postedBy?.name ?? ''}`}</Fact>
          )}
          {r.reversalReason && <Fact term={o.f.reason}>{r.reversalReason}</Fact>}
          {r.cancellationReason && <Fact term={o.f.reason}>{r.cancellationReason}</Fact>}
        </Facts>
        {r.actions.includes('edit') ? (
          <LinesForm
            key={r.updatedAt}
            w={w}
            initial={r.lines.map((l) => ({
              locationId: l.location.id,
              lotNumber: l.lotNumber ?? '',
              expiryDate: l.expiryDate ?? '',
              manufacturedDate: l.manufacturedDate ?? '',
              quantity: l.quantity,
            }))}
            precision={r.unit.precision}
            unit={r.unit.code}
            tracking={r.tracking}
            submitLabel={o.act.save}
            onSubmit={async (lines) => {
              await run(() => outputApi.receiptLines(r.id, lines), o.saved);
            }}
          />
        ) : (
          <LinesTable r={r} date={date} />
        )}
      </Section>
      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={ask[open]}
              goLabel={label[open]}
              reason={open === 'reverse' ? 'required' : open === 'cancel' ? 'optional' : undefined}
              onCancel={close}
              onConfirm={async (reason) => {
                if (await run(() => outputApi.receiptAct(r.id, open, reason), o.saved)) close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s === 'post' ? 'primary' : 'ghost', 'md')}
                  data-action={s}
                >
                  {label[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Section id="fgr-timeline" title={o.timeline}>
        <OutTimeline items={timeline} date={dateTime} />
      </Section>
    </>
  );
}

function LinesTable({ r, date }: { r: Receipt; date: (d: string) => string }) {
  const { o } = useOut();
  return (
    <Table
      data="fgr-lines"
      rows={r.lines}
      rowKey={(l) => l.id}
      cols={[
        { head: o.f.location, cell: (l) => <span className="font-mono">{l.location.code}</span> },
        { head: o.f.lot, cell: (l) => l.lotNumber ?? '—' },
        { head: o.f.expiry, minor: true, cell: (l) => (l.expiryDate ? date(l.expiryDate) : '—') },
        {
          head: o.f.made,
          minor: true,
          cell: (l) => (l.manufacturedDate ? date(l.manufacturedDate) : '—'),
        },
        { head: o.f.quantity, end: true, cell: (l) => `${l.quantity} ${r.unit.code}` },
      ]}
    />
  );
}
