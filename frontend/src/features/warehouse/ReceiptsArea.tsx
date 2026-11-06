import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Route, Routes, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { BranchCode } from '@/features/company-center/adminParts';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { CELL, useDateFormat, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Section,
} from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import {
  QTY,
  REJECT_REASONS,
  decimals,
  scaled,
  unscaled,
  whApi,
  type GrStatus,
  type ReceiptDetail,
  type ReceiptLine,
  type RejectReason,
  type WarehouseContext,
} from './whApi';
import { WH_COPY, whError } from './whCopy';
import { GrStatusPill, ShowMore, TrackingNote, WarehouseNav } from './whParts';
import { WH, useDebounced, usePaged } from './whModel';

/*
 * /core/warehouse/receipts/* — goods receipts (EP31), Warehouse's own lazy
 * chunk. A receipt starts from an order pending receive; Warehouse enters per
 * line what was accepted and rejected, and where each accepted quantity goes
 * (location, and lot / expiry where the item tracks them). Posting adds the
 * stock and locks the receipt; cancelling a posted receipt reverses it. The
 * server checks every rule again — these screens only help.
 */

const BASE = `${WH}/receipts`;
const STATUSES: GrStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

export default function ReceiptsArea() {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{whError(state.error, c, cc)}</Notice>;
  return (
    <div className="grid grid-cols-1 gap-6" data-receipts>
      <Routes>
        <Route index element={<ReceiptList ctx={state.data} />} />
        <Route path=":id" element={<ReceiptRoute ctx={state.data} />} />
      </Routes>
    </div>
  );
}

function ReceiptRoute({ ctx }: { ctx: WarehouseContext }) {
  const { id } = useParams();
  return <ReceiptPage key={id} id={id!} ctx={ctx} />;
}

function ReceiptList({ ctx }: { ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { dateTime } = useDateFormat();
  const base = useId();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) => whApi.receipts({ status, q: debounced, page, pageSize: 25 }),
    [status, debounced],
  );
  return (
    <>
      <PageTitle title={c.receipts} lead={c.receiptsLead} />
      <WarehouseNav ctx={ctx} />
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end"
      >
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-count`}
        />
        <SelectField
          id={`${base}-status`}
          label={c.f.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-filter="status"
        >
          <option value="">{c.f.any}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {c.statuses[s]}
            </option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{whError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.noReceipts}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-receipt-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {[
                c.f.number,
                c.f.order,
                c.f.status,
                c.f.branch,
                c.f.receivedAt,
                c.f.receivedBy,
                c.f.lines,
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    (h === c.f.receivedBy || h === c.f.lines) && 'md:max-lg:hidden',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((r) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(CELL, extra)}>
                  {content}
                </td>
              );
              return (
                <tr
                  key={r.id}
                  className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                  data-receipt={r.number}
                >
                  {cell(
                    c.f.number,
                    <>
                      <AreaLink
                        to={`${BASE}/${encodeURIComponent(r.id)}`}
                        className="inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-7"
                      >
                        {r.number}
                      </AreaLink>
                      <span className="block max-w-48 truncate text-caption text-text-muted">
                        {r.supplier.name ?? '—'}
                      </span>
                    </>,
                    'max-md:before:hidden',
                  )}
                  {cell(
                    c.f.order,
                    <span className="font-mono text-caption">{r.order.number}</span>,
                  )}
                  {cell(c.f.status, <GrStatusPill status={r.status} />)}
                  {cell(
                    c.f.branch,
                    <BranchCode code={r.branch.code} head={r.branch.code === '00000'} />,
                  )}
                  {cell(c.f.receivedAt, dateTime(r.receivedAt), 'md:whitespace-nowrap')}
                  {cell(c.f.receivedBy, r.createdBy?.name ?? '—', 'md:max-lg:hidden')}
                  {cell(
                    c.f.lines,
                    <span className="tabular-nums">{r.lineCount}</span>,
                    'md:max-lg:hidden',
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ShowMore visible={!!data?.hasMore} busy={more} onClick={showMore} />
    </>
  );
}

// ------------------------------------------------------------------ one receipt

/** "2026-11-03T09:30" in the browser's time zone, for a datetime-local input. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ReceiptPage({ id, ctx }: { id: string; ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { dateTime } = useDateFormat();
  const { state, set } = useLoad(() => whApi.receipt(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{whError(state.error, c, cc)}</Notice>;
  const d = state.data;
  const r = d.receipt;
  const editable = r.actions.includes('edit');
  const locations = ctx.locations.filter((l) => l.branchId === r.branch.id);
  const run = async (work: () => Promise<ReceiptDetail>, text = c.saved) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: whError(e, c, cc) });
      return false;
    }
  };
  return (
    <div className="grid grid-cols-1 gap-6" data-receipt={r.number} data-status={r.status}>
      <AreaLink
        to={BASE}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.receipts}
      </AreaLink>
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={r.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GrStatusPill status={r.status} />
          <span className="text-caption text-text-muted">{c.receipts}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      <Section id="gr-facts" title={c.f.order}>
        <Facts>
          <Fact term={c.f.order}>
            <AreaLink
              to={`${WH}/pending-receive/${encodeURIComponent(r.order.id)}`}
              className="inline-flex min-h-7 items-center font-mono font-semibold text-brand-soft underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {r.order.number}
            </AreaLink>
          </Fact>
          <Fact term={c.f.supplier}>{`${r.supplier.code ?? ''} · ${r.supplier.name ?? ''}`}</Fact>
          <Fact term={c.f.branch}>{`${r.branch.code} · ${r.branch.name}`}</Fact>
          <Fact term={c.f.receivedAt}>{dateTime(r.receivedAt)}</Fact>
          <Fact term={c.f.receivedBy}>{r.createdBy?.name ?? '—'}</Fact>
          <Fact term={c.f.defaultLocation}>
            {r.defaultLocation ? `${r.defaultLocation.code} · ${r.defaultLocation.name}` : '—'}
          </Fact>
          {r.postedAt && (
            <Fact term={c.f.postedBy}>{`${dateTime(r.postedAt)} · ${r.postedBy?.name ?? ''}`}</Fact>
          )}
          {r.note && (
            <Fact term={c.f.note}>
              <span className="whitespace-pre-line">{r.note}</span>
            </Fact>
          )}
          {r.cancellationReason && (
            <Fact term={c.f.reason}>
              <span className="whitespace-pre-line">{r.cancellationReason}</span>
            </Fact>
          )}
        </Facts>
        {editable && (
          <HeaderEditor
            r={r}
            locations={locations}
            onSave={(body) => run(() => whApi.update(r.id, body))}
          />
        )}
      </Section>

      <Section id="gr-lines" title={`${c.f.lines} · ${r.lines.length}`}>
        {editable && <p className="mb-3 text-caption text-text-muted">{c.draftNote}</p>}
        <ol className="grid grid-cols-1 gap-3" data-lines>
          {r.lines.map((l) => (
            <li key={l.id} className="rounded-xl bg-white/[0.02] p-4" data-line={l.lineNo}>
              {editing === l.id ? (
                <LineEditor
                  line={l}
                  locations={locations}
                  defaultLocationId={r.defaultLocation?.id ?? locations[0]?.id ?? ''}
                  onCancel={() => setEditing(null)}
                  onSave={async (body) => {
                    if (await run(() => whApi.saveLine(r.id, l.id, body))) setEditing(null);
                  }}
                />
              ) : (
                <LineSummary
                  line={l}
                  status={r.status}
                  action={
                    editable && (
                      <button
                        type="button"
                        onClick={() => setEditing(l.id)}
                        className={buttonClasses('secondary', 'md')}
                        aria-label={`${c.edit} #${l.lineNo} ${l.item.code}`}
                        data-edit-line={l.lineNo}
                      >
                        {c.edit}
                      </button>
                    )
                  }
                />
              )}
            </li>
          ))}
        </ol>
      </Section>

      {r.actions.some((a) => a === 'post' || a === 'cancel') && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {confirm ? (
            <ConfirmBox
              question={
                confirm === 'post'
                  ? c.postAsk
                  : r.status === 'POSTED'
                    ? c.reverseAsk
                    : c.cancelDraftAsk
              }
              goLabel={
                confirm === 'post' ? c.post : r.status === 'POSTED' ? c.reverse : c.cancelDraft
              }
              reason={confirm === 'cancel' && r.status === 'POSTED' ? 'required' : undefined}
              onCancel={() => {
                setConfirm(null);
                heading.current?.focus();
              }}
              onConfirm={async (reason) => {
                const ok = await run(
                  () => (confirm === 'post' ? whApi.post(r.id) : whApi.cancel(r.id, reason)),
                  confirm === 'post' ? c.posted : c.cancelled,
                );
                if (ok) {
                  setConfirm(null);
                  heading.current?.focus();
                }
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {r.actions.includes('post') && (
                <button
                  type="button"
                  onClick={() => setConfirm('post')}
                  className={buttonClasses('primary', 'md')}
                  data-action="post"
                >
                  {c.post}
                </button>
              )}
              {r.actions.includes('cancel') && (
                <button
                  type="button"
                  onClick={() => setConfirm('cancel')}
                  className={buttonClasses('ghost', 'md')}
                  data-action="cancel"
                >
                  {r.status === 'POSTED' ? c.reverse : c.cancelDraft}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <Section id="gr-timeline" title={c.timeline}>
        <ol className="grid gap-2" data-timeline>
          {d.timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 text-label">
              <span className="font-semibold text-text-primary">
                {c.timelineTypes[t.type] ?? t.type}
              </span>
              <span className="text-text-secondary">{t.actor?.name ?? c.system}</span>
              <span className="text-caption text-text-muted">{dateTime(t.at)}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function HeaderEditor({
  r,
  locations,
  onSave,
}: {
  r: ReceiptDetail['receipt'];
  locations: WarehouseContext['locations'];
  onSave: (body: {
    receivedAt?: string;
    defaultLocationId?: string | null;
    note?: string | null;
  }) => Promise<boolean>;
}) {
  const c = useCopy(WH_COPY);
  const base = useId();
  const [at, setAt] = useState(toLocalInput(r.receivedAt));
  const [locationId, setLocationId] = useState(r.defaultLocation?.id ?? '');
  const [note, setNote] = useState(r.note ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await onSave({
      receivedAt: new Date(at).toISOString(),
      defaultLocationId: locationId || null,
      note: note.trim() || null,
    });
    setBusy(false);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
      data-header-editor
    >
      <TextField
        id={`${base}-at`}
        type="datetime-local"
        label={c.f.receivedAt}
        value={at}
        onChange={(e) => setAt(e.target.value)}
      />
      <SelectField
        id={`${base}-loc`}
        label={c.f.defaultLocation}
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
      >
        <option value="">—</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>
        ))}
      </SelectField>
      <TextField
        id={`${base}-note`}
        label={c.f.note}
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
        className="sm:col-span-2"
      />
      <button type="submit" disabled={busy} className={buttonClasses('secondary', 'md', 'w-fit')}>
        {busy ? c.saving : c.save}
      </button>
    </form>
  );
}

/** Ordered / already received / remaining, then what this receipt accepts and rejects. */
function LineSummary({
  line: l,
  status,
  action,
}: {
  line: ReceiptLine;
  status: GrStatus;
  action: ReactNode;
}) {
  const c = useCopy(WH_COPY);
  const posted = status !== 'DRAFT';
  // A draft shows what it may still take; a posted or cancelled receipt shows what it
  // did, and what the order line still has to receive now (other receipts counted).
  const closed = l.replacementRequired ? 0n : scaled(l.rejectedQuantity);
  const left =
    status === 'POSTED'
      ? unscaled(scaled(l.remaining) - scaled(l.acceptedQuantity) - closed)
      : l.remaining;
  const figures: [string, string][] = posted
    ? [
        [c.f.ordered, l.ordered],
        [c.f.accepted, l.acceptedQuantity],
        [c.f.rejected, l.rejectedQuantity],
        [c.f.remainingNow, left],
      ]
    : [
        [c.f.ordered, l.ordered],
        [c.f.received, l.receivedElsewhere],
        [c.f.remaining, l.remaining],
        [c.f.acceptNow, l.acceptedQuantity],
        [c.f.rejectNow, l.rejectedQuantity],
      ];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-label break-words text-text-primary">
            <span className="font-mono">{l.item.code}</span> · {l.item.name}
          </span>
          <span className="block">
            <TrackingNote lot={l.item.lotTracking} expiry={l.item.expiryTracking} />
          </span>
        </span>
        {action}
      </div>
      <dl
        className={cn(
          'grid grid-cols-2 gap-x-4 gap-y-1 text-caption',
          posted ? 'sm:grid-cols-4' : 'sm:grid-cols-5',
        )}
        data-figures
      >
        {figures.map(([t, v], i) => (
          <div key={t} className={cn(i >= 3 && !posted && 'text-brand-soft')}>
            <dt className="text-text-muted">{t}</dt>
            <dd className="font-semibold text-text-primary tabular-nums">
              {v} <span className="font-normal text-text-muted">{l.unit.code}</span>
            </dd>
          </div>
        ))}
      </dl>
      {l.rejectReason && (
        <p className="text-caption text-text-secondary">
          {c.f.rejectReason}: {c.reasons[l.rejectReason]}
          {l.rejectNote && ` — ${l.rejectNote}`}
          {!l.replacementRequired && ' · ✕ ' + c.f.replacement}
        </p>
      )}
      {l.allocations.length > 0 && (
        <ul className="grid gap-1 text-caption" data-allocations>
          {l.allocations.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 text-text-secondary">
              <span className="font-mono text-text-primary">{a.location.code}</span>
              {a.lotNumber && (
                <span>
                  {c.f.lot} <span className="font-mono text-text-primary">{a.lotNumber}</span>
                </span>
              )}
              {a.expiryDate && (
                <span>
                  {c.f.expiry} {a.expiryDate}
                </span>
              )}
              <span className="tabular-nums">
                {a.quantity} {l.unit.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Row {
  key: number;
  locationId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: string;
}

/** One line: accepted / rejected, then location · lot · expiry rows that add up to the accepted quantity. */
function LineEditor({
  line: l,
  locations,
  defaultLocationId,
  onSave,
  onCancel,
}: {
  line: ReceiptLine;
  locations: WarehouseContext['locations'];
  defaultLocationId: string;
  onSave: (body: Parameters<typeof whApi.saveLine>[2]) => Promise<void>;
  onCancel: () => void;
}) {
  const c = useCopy(WH_COPY);
  const base = useId();
  const row = (key: number, over: Partial<Row> = {}): Row => ({
    key,
    locationId: defaultLocationId,
    lotNumber: '',
    expiryDate: '',
    quantity: '',
    ...over,
  });
  const [accepted, setAccepted] = useState(l.acceptedQuantity === '0' ? '' : l.acceptedQuantity);
  const [rejected, setRejected] = useState(l.rejectedQuantity === '0' ? '' : l.rejectedQuantity);
  const [reason, setReason] = useState<RejectReason | ''>(l.rejectReason ?? '');
  const [rejectNote, setRejectNote] = useState(l.rejectNote ?? '');
  const [replacement, setReplacement] = useState(l.replacementRequired);
  const [rows, setRows] = useState<Row[]>(() =>
    l.allocations.length
      ? l.allocations.map((a, i) =>
          row(i, {
            locationId: a.location.id,
            lotNumber: a.lotNumber ?? '',
            expiryDate: a.expiryDate ?? '',
            quantity: a.quantity,
          }),
        )
      : [row(0)],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lots = l.item.lotTracking !== 'NONE';
  const expiry = l.item.expiryTracking !== 'NONE';
  const acc = accepted.trim() || '0';
  const rej = rejected.trim() || '0';
  const filled = rows.filter((x) => x.quantity.trim());
  const allocated = filled.reduce(
    (s, x) => (QTY.test(x.quantity.trim()) ? s + scaled(x.quantity) : s),
    0n,
  );
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const quantities = [acc, rej, ...filled.map((x) => x.quantity.trim())];
    let problem: string | null = null;
    if (quantities.some((q) => !QTY.test(q))) problem = c.invalidNumber;
    else if (quantities.some((q) => decimals(q) > l.unit.precision))
      problem = c.errors.QUANTITY_PRECISION!;
    else if (scaled(acc) + scaled(rej) > scaled(l.remaining))
      problem = c.errors.PO_LINE_OVER_RECEIVED!;
    else if (scaled(rej) > 0n && !reason) problem = c.errors.REJECT_REASON_REQUIRED!;
    else if (scaled(acc) > 0n && allocated !== scaled(acc)) problem = c.errors.ALLOCATION_MISMATCH!;
    else if (l.item.lotTracking === 'REQUIRED' && filled.some((x) => !x.lotNumber.trim()))
      problem = c.errors.LOT_REQUIRED!;
    else if (
      l.item.expiryTracking === 'REQUIRED' &&
      filled.some((x) => x.lotNumber.trim() && !x.expiryDate)
    )
      problem = c.errors.EXPIRY_REQUIRED!;
    setError(problem);
    if (problem) return;
    setBusy(true);
    await onSave({
      acceptedQuantity: acc,
      rejectedQuantity: rej,
      rejectReason: scaled(rej) > 0n ? (reason as RejectReason) : null,
      rejectNote: scaled(rej) > 0n ? rejectNote.trim() || null : null,
      replacementRequired: replacement,
      allocations:
        scaled(acc) > 0n
          ? filled.map((x) => ({
              locationId: x.locationId,
              lotNumber: lots ? x.lotNumber.trim() || null : null,
              expiryDate: lots && expiry ? x.expiryDate || null : null,
              quantity: x.quantity.trim(),
            }))
          : [],
    });
    setBusy(false);
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-4" data-line-editor>
      <div>
        <p className="text-label break-words text-text-primary">
          <span className="font-mono">{l.item.code}</span> · {l.item.name}
        </p>
        <TrackingNote lot={l.item.lotTracking} expiry={l.item.expiryTracking} />
        <p className="mt-1 text-caption text-text-secondary tabular-nums">
          {c.f.ordered} {l.ordered} · {c.f.received} {l.receivedElsewhere} · {c.f.remaining}{' '}
          <strong className="text-text-primary">{l.remaining}</strong> {l.unit.code}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${base}-acc`}
          label={`${c.f.acceptNow} (${l.unit.code})`}
          inputMode="decimal"
          autoComplete="off"
          maxLength={19}
          value={accepted}
          onChange={(e) => setAccepted(e.target.value)}
          autoFocus
        />
        <TextField
          id={`${base}-rej`}
          label={`${c.f.rejectNow} (${l.unit.code})`}
          inputMode="decimal"
          autoComplete="off"
          maxLength={19}
          value={rejected}
          onChange={(e) => setRejected(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setAccepted(l.remaining);
          if (rows.length === 1) update(rows[0]!.key, { quantity: l.remaining });
        }}
        className={buttonClasses('ghost', 'md', 'w-fit px-3')}
      >
        {c.useRemaining}
      </button>
      {scaled(rej) > 0n && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id={`${base}-reason`}
            label={c.f.rejectReason}
            value={reason}
            onChange={(e) => setReason(e.target.value as RejectReason)}
          >
            <option value="">—</option>
            {REJECT_REASONS.map((x) => (
              <option key={x} value={x}>
                {c.reasons[x]}
              </option>
            ))}
          </SelectField>
          <TextField
            id={`${base}-rnote`}
            label={c.f.rejectNote}
            value={rejectNote}
            maxLength={300}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <label className="flex min-h-11 items-center gap-2 text-label text-text-primary sm:col-span-2">
            <input
              type="checkbox"
              checked={replacement}
              onChange={(e) => setReplacement(e.target.checked)}
              className="size-4 accent-[var(--color-brand-primary)]"
            />
            {c.f.replacement}
          </label>
        </div>
      )}
      {scaled(acc) > 0n && (
        <fieldset className="grid gap-3" data-allocation-rows>
          <legend className="mb-2 text-label font-medium text-text-primary">
            {c.allocations}{' '}
            <span className="font-normal text-text-muted tabular-nums">
              · {c.allocated(unscaled(allocated), acc)}
            </span>
          </legend>
          {rows.map((x, i) => (
            <div
              key={x.key}
              className={cn(
                'grid grid-cols-1 gap-3 rounded-lg bg-white/[0.02] p-3 sm:grid-cols-2',
                lots && expiry
                  ? 'lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]'
                  : lots
                    ? 'lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]'
                    : 'lg:grid-cols-[repeat(2,minmax(0,1fr))_auto]',
              )}
              data-allocation={i + 1}
            >
              <SelectField
                id={`${base}-loc-${x.key}`}
                label={`${c.f.location} #${i + 1}`}
                value={x.locationId}
                onChange={(e) => update(x.key, { locationId: e.target.value })}
              >
                {locations.map((o) => (
                  <option key={o.id} value={o.id}>{`${o.code} · ${o.name}`}</option>
                ))}
              </SelectField>
              {lots && (
                <TextField
                  id={`${base}-lot-${x.key}`}
                  label={`${c.f.lotNumber}${l.item.lotTracking === 'REQUIRED' ? ' *' : ''}`}
                  value={x.lotNumber}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(e) => update(x.key, { lotNumber: e.target.value })}
                />
              )}
              {lots && expiry && (
                <TextField
                  id={`${base}-exp-${x.key}`}
                  type="date"
                  label={`${c.f.expiryDate}${l.item.expiryTracking === 'REQUIRED' ? ' *' : ''}`}
                  value={x.expiryDate}
                  onChange={(e) => update(x.key, { expiryDate: e.target.value })}
                />
              )}
              <TextField
                id={`${base}-qty-${x.key}`}
                label={`${c.f.quantity} (${l.unit.code})`}
                inputMode="decimal"
                autoComplete="off"
                maxLength={19}
                value={x.quantity}
                onChange={(e) => update(x.key, { quantity: e.target.value })}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((y) => y.key !== x.key))}
                  className={buttonClasses('ghost', 'md', 'self-end px-3')}
                  aria-label={`${c.removeAllocation} #${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, row(Math.max(...rs.map((x) => x.key)) + 1)])}
            className={buttonClasses('ghost', 'md', 'w-fit px-3')}
            data-add-allocation
          >
            + {c.addAllocation}
          </button>
        </fieldset>
      )}
      <div aria-live="polite">{error && <Notice tone="error">{error}</Notice>}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className={buttonClasses('primary', 'md')}
          aria-label={`${c.save} #${l.lineNo}`}
          data-save-line
        >
          {busy ? c.saving : c.save}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.close}
        </button>
      </div>
    </form>
  );
}
