import { FilePlus2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { BranchCode, FieldGroup } from '@/features/company-center/adminParts';
import { CELL, useDateFormat, useDepartmentName, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Section,
} from '@/features/company-center/parts';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import {
  AMOUNT,
  decimals,
  PO_STATUSES,
  poApi,
  PRICE,
  QTY,
  RATE,
  scaled,
  type DepositType,
  type ExecutiveOrder,
  type LineFields,
  type OrderDetail,
  type Page,
  type OrderRow,
  type PoContext,
  type PurchaseOrder,
  type PurchasingLine,
  type SourceLine,
  type SourceRequest,
  type SupplierOption,
} from './orderApi';
import { ORDER_COPY, poError, useMoney } from './orderCopy';
import { ConfirmBox, DepositPill, LineIdentity, PoStatusPill } from './orderParts';

/*
 * /core/purchasing/orders/* — purchase orders (EP30), a lazy chunk of its own
 * inside the Purchasing area. List, create from an APPROVED request (lines
 * and quantities; nothing beyond what remains), and one order: a DRAFT is
 * edited in place (supplier, terms, lines, prices, deposit); issue and cancel
 * are confirmed in place. Every amount on screen is the server's — the page
 * never totals anything itself. An Executive gets a read-only summary.
 */

const BASE = '/core/purchasing/orders';
const CURRENCIES = ['THB', 'USD', 'EUR', 'CNY', 'JPY', 'SGD'];
const link =
  'font-semibold text-brand-soft underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export default function OrdersArea() {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(poApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const ctx = state.data;
  return (
    <Routes>
      <Route index element={<OrderList ctx={ctx} />} />
      <Route path="new" element={<CreateOrder ctx={ctx} />} />
      <Route path=":id" element={<OrderRoute />} />
      <Route path="*" element={<Navigate to={BASE} replace />} />
    </Routes>
  );
}

function OrderRoute() {
  const { id } = useParams();
  return <OrderPage key={id} id={id!} />;
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <AreaLink
      to={to}
      className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
    >
      ← {label}
    </AreaLink>
  );
}

// ------------------------------------------------------------------ list

function OrderList({ ctx }: { ctx: PoContext }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const money = useMoney();
  const { date } = useDateFormat();
  const base = useId();
  const [initial] = useSearchParams();
  const [view, setView] = useState<'all' | 'open'>(initial.get('view') === 'open' ? 'open' : 'all');
  const [status, setStatus] = useState(initial.get('status') ?? '');
  const [branchId, setBranchId] = useState(ctx.selectedBranch?.id ?? '');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<Page<OrderRow> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const load = async (page: number) => {
    const n = ++request.current;
    const next = await poApi.list({ view, status, branchId, q: debounced, page, pageSize: 25 });
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next,
    );
    setError(null);
  };
  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, status, branchId, debounced]);

  const create = ctx.orders.create && (
    <AreaLink to={`${BASE}/new`} className={buttonClasses('primary', 'md')} data-create-order>
      <FilePlus2 aria-hidden className="size-4" />
      {c.newOrder}
    </AreaLink>
  );
  return (
    <>
      <BackLink to="/core/purchasing" label={c.toWorkspace} />
      <PageTitle title={c.orders} lead={c.ordersLead} action={create || undefined} />
      <nav
        aria-label={c.orders}
        className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-white/[0.07]"
      >
        {(['all', 'open'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              view === v
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
            data-view={v}
          >
            {c.views[v]}
          </button>
        ))}
      </nav>
      {!ctx.orders.create && (
        <Notice tone="info">{ctx.executive ? c.executiveNote : c.readOnly}</Notice>
      )}
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))] lg:items-end"
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
          {PO_STATUSES.filter((s) => !(ctx.executive && s === 'DRAFT')).map((s) => (
            <option key={s} value={s}>
              {c.statuses[s]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${base}-branch`}
          label={c.f.branch}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          data-filter="branchId"
        >
          <option value="">{c.f.allBranches}</option>
          {ctx.branches.map((b) => (
            <option key={b.id} value={b.id}>{`${b.code} · ${b.name}`}</option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{poError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <div className="grid justify-items-start gap-3 py-6" data-empty>
          <p className="text-label text-text-secondary">{c.empty}</p>
          {create}
        </div>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-orders>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {[c.f.number, c.f.status, c.f.branch, c.f.requests, c.f.grandTotal, c.f.expected].map(
                (h) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      'px-3 pb-2 font-medium first:pl-4',
                      h === c.f.grandTotal && 'text-right',
                      h === c.f.expected && 'md:max-lg:hidden',
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((o) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(CELL, extra)}>
                  {content}
                </td>
              );
              return (
                <tr
                  key={o.id}
                  className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                  data-order={o.number}
                >
                  {cell(
                    c.f.number,
                    <>
                      <AreaLink
                        to={`${BASE}/${encodeURIComponent(o.id)}`}
                        className="inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-0"
                      >
                        {o.number}
                      </AreaLink>
                      <span className="block max-w-40 truncate text-caption text-text-muted lg:max-w-72">
                        {o.supplier?.name ?? c.noSupplier}
                      </span>
                    </>,
                    'max-md:before:hidden',
                  )}
                  {cell(
                    c.f.status,
                    <span className="flex flex-wrap gap-1.5">
                      <PoStatusPill status={o.status} />
                      {o.deposit.status !== 'NOT_REQUIRED' && (
                        <DepositPill status={o.deposit.status} />
                      )}
                    </span>,
                  )}
                  {cell(
                    c.f.branch,
                    <BranchCode code={o.branch.code} head={o.branch.code === '00000'} />,
                  )}
                  {cell(
                    c.f.requests,
                    <span className="font-mono text-caption">
                      {o.requests.map((r) => r.number).join(', ')}
                    </span>,
                  )}
                  {cell(
                    c.f.grandTotal,
                    <span className="tabular-nums">{money(o.grandTotal, o.currency)}</span>,
                    'md:text-right md:whitespace-nowrap',
                  )}
                  {cell(
                    c.f.expected,
                    o.expectedDate ? date(o.expectedDate) : '—',
                    'md:max-lg:hidden',
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={() => {
            setMore(true);
            load(data.page + 1)
              .catch((e: unknown) => setError(e))
              .finally(() => setMore(false));
          }}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
    </>
  );
}

// ------------------------------------------------------------------ create

function CreateOrder({ ctx }: { ctx: PoContext }) {
  const c = useCopy(ORDER_COPY);
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const requestId = params.get('request');
  if (!ctx.orders.create) return <Notice tone="info">{c.readOnly}</Notice>;
  return (
    <>
      <BackLink to={BASE} label={c.back} />
      <PageTitle title={c.newOrder} lead={c.newOrderLead} />
      {requestId ? (
        <FromRequest key={requestId} requestId={requestId} />
      ) : (
        // The language travels in router state, like every other in-app navigation.
        <PickRequest onPick={(id) => setParams({ request: id }, { state: { locale } })} />
      )}
    </>
  );
}

function PickRequest({ onPick }: { onPick: (id: string) => void }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const deptName = useDepartmentName();
  const base = useId();
  const [q, setQ] = useState('');
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: unknown }
    | { status: 'ready'; rows: Awaited<ReturnType<typeof poApi.sourceRequests>>['requests'] }
  >({ status: 'loading' });
  useEffect(() => {
    const t = setTimeout(() => {
      poApi.sourceRequests(q.trim()).then(
        (r) => setState({ status: 'ready', rows: r.requests }),
        (error: unknown) => setState({ status: 'error', error }),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Section id="po-pick" title={c.pickRequest}>
      <div className="grid max-w-xl grid-cols-1 gap-4">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.requestHint}
          describedBy={`${base}-status`}
        />
      </div>
      <p id={`${base}-status`} role="status" className="sr-only">
        {state.status === 'ready' ? c.requestsCount(state.rows.length) : ''}
      </p>
      {state.status === 'loading' ? (
        <Loading label={c.loading} />
      ) : state.status === 'error' ? (
        <Notice tone="error">{poError(state.error, c, cc)}</Notice>
      ) : state.rows.length === 0 ? (
        <p className="mt-4 text-label text-text-secondary">{c.noOpenRequests}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-2" data-source-requests>
          {state.rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.02] p-4"
              data-source-request={r.number}
            >
              <span className="min-w-0">
                <span className="block font-mono font-semibold text-text-primary">{r.number}</span>
                <span className="block text-caption text-text-secondary">
                  {deptName(r.department)} · {r.branch.code} · {c.linesCount(r.openLines)}
                </span>
                {r.purpose && (
                  <span className="block max-w-xl truncate text-caption text-text-muted">
                    {r.purpose}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onPick(r.id)}
                className={buttonClasses('secondary', 'md')}
                aria-label={`${c.f.select} ${r.number}`}
              >
                {c.f.select}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Chooses lines (default: everything that remains) and optionally a supplier → a DRAFT. */
function FromRequest({ requestId }: { requestId: string }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const navigate = useNavigate();
  const { locale } = useLocale();
  const base = useId();
  const { state } = useLoad(() => poApi.sourceRequest(requestId));
  const [picked, setPicked] = useState<Record<string, { on: boolean; qty: string }>>({});
  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const r: SourceRequest = state.data.request;
  const open = r.lines.filter((l) => scaled(l.remaining) > 0n);
  const choice = (l: SourceLine) => picked[l.id] ?? { on: true, qty: l.remaining };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const lines = open
      .filter((l) => choice(l).on)
      .map((l) => {
        const qty = choice(l).qty.trim();
        if (!QTY.test(qty) || !/[1-9]/.test(qty)) found[l.id] = c.invalidNumber;
        else if (scaled(qty) > scaled(l.remaining))
          found[l.id] = c.errors.PO_QUANTITY_EXCEEDS_REMAINING!;
        else if (decimals(qty) > l.precision) found[l.id] = c.errors.QUANTITY_PRECISION!;
        return { purchaseRequestLineId: l.id, quantity: qty };
      });
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${base}-${first}`)?.focus();
      return;
    }
    if (!lines.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await poApi.create({
        purchaseRequestId: r.id,
        supplierId: supplier?.id ?? null,
        lines,
      });
      void navigate(`${BASE}/${encodeURIComponent(created.order.id)}`, { state: { locale } });
    } catch (err) {
      setMessage(poError(err, c, cc));
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid grid-cols-1 gap-6"
      data-from-request={r.number}
    >
      <Section id="po-source" title={`${c.f.request} ${r.number}`}>
        <p className="mb-3 text-caption text-text-muted">
          {r.branch.code} · {r.branch.name}
        </p>
        {open.length === 0 ? (
          <Notice tone="info">{c.errors.PR_FULLY_ORDERED}</Notice>
        ) : (
          <ol className="grid grid-cols-1 gap-2">
            {open.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl bg-white/[0.02] p-3 sm:grid-cols-[auto_minmax(0,1fr)_12rem]"
                data-source-line={l.lineNo}
              >
                <input
                  type="checkbox"
                  checked={choice(l).on}
                  onChange={(e) =>
                    setPicked((p) => ({ ...p, [l.id]: { ...choice(l), on: e.target.checked } }))
                  }
                  aria-label={`#${l.lineNo} ${l.item ? `${l.item.code} · ${l.item.name}` : (l.description ?? '')}`}
                  className="mt-1 size-4 accent-[var(--color-brand-primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-label break-words text-text-primary">
                    #{l.lineNo} {l.item ? `${l.item.code} · ${l.item.name}` : l.description}
                  </span>
                  <span className="block text-caption text-text-secondary tabular-nums">
                    {c.f.requested} {l.requested} · {c.f.ordered} {l.ordered}
                    {scaled(l.inDraft) > 0n && ` · ${c.f.inDraft} ${l.inDraft}`} · {c.f.remaining}{' '}
                    <strong className="text-text-primary">{l.remaining}</strong>{' '}
                    {l.unit?.code ?? l.unit?.name ?? ''}
                  </span>
                </span>
                <div className="col-start-2 sm:col-start-auto">
                  <TextField
                    id={`${base}-${l.id}`}
                    label={`${c.f.quantity}${l.unit?.code ? ` (${l.unit.code})` : ''}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={choice(l).qty}
                    maxLength={19}
                    disabled={!choice(l).on}
                    error={errors[l.id]}
                    onChange={(e) =>
                      setPicked((p) => ({ ...p, [l.id]: { ...choice(l), qty: e.target.value } }))
                    }
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section id="po-supplier-pick" title={c.f.supplier}>
        <SupplierPicker value={supplier} onChange={setSupplier} />
      </Section>
      <div aria-live="polite">{message && <Notice tone="error">{message}</Notice>}</div>
      <button
        type="submit"
        disabled={busy || open.length === 0 || !open.some((l) => choice(l).on)}
        className={buttonClasses('primary', 'md', 'w-fit')}
        data-create-draft
      >
        {busy ? c.saving : c.createDraft}
      </button>
    </form>
  );
}

function SupplierPicker({
  value,
  onChange,
}: {
  value: SupplierOption | null;
  onChange: (s: SupplierOption | null) => void;
}) {
  const c = useCopy(ORDER_COPY);
  const base = useId();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<SupplierOption[]>([]);
  useEffect(() => {
    const t = setTimeout(() => {
      poApi.suppliers(q.trim()).then(
        (r) => setOptions(r.suppliers),
        () => setOptions([]),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = value && !options.some((o) => o.id === value.id) ? [value, ...options] : options;
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        id={`${base}-q`}
        type="search"
        label={c.f.supplierSearch}
        placeholder={c.f.supplierHint}
        value={q}
        maxLength={100}
        onChange={(e) => setQ(e.target.value)}
      />
      <SelectField
        id={`${base}-supplier`}
        label={c.f.supplier}
        value={value?.id ?? ''}
        onChange={(e) => onChange(list.find((o) => o.id === e.target.value) ?? null)}
        data-supplier-select
      >
        <option value="">—</option>
        {list.map((o) => (
          <option key={o.id} value={o.id}>{`${o.code} · ${o.name}`}</option>
        ))}
      </SelectField>
    </div>
  );
}

// ------------------------------------------------------------------ one order

function OrderPage({ id }: { id: string }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state, set } = useLoad(() => poApi.get(id));
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const d = state.data;
  return d.view === 'executive' ? (
    <ExecutiveSummary o={d.order} />
  ) : (
    <PurchasingOrder d={d} set={set} />
  );
}

function ExecutiveSummary({ o }: { o: ExecutiveOrder }) {
  const c = useCopy(ORDER_COPY);
  const money = useMoney();
  const { date } = useDateFormat();
  return (
    <div className="grid grid-cols-1 gap-6" data-order={o.number} data-view="executive">
      <BackLink to={BASE} label={c.back} />
      <div>
        <PageTitle title={o.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PoStatusPill status={o.status} />
          {o.deposit.status !== 'NOT_REQUIRED' && <DepositPill status={o.deposit.status} />}
        </div>
      </div>
      <Notice tone="info">{c.executiveNote}</Notice>
      <Section id="po-exec" title={c.details}>
        <Facts>
          <Fact term={c.f.supplier}>{o.supplier.name ?? '—'}</Fact>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.requests}>{o.requests.map((r) => r.number).join(', ')}</Fact>
          <Fact term={c.f.orderDate}>{date(o.orderDate)}</Fact>
          <Fact term={c.f.expected}>{o.expectedDate ? date(o.expectedDate) : '—'}</Fact>
          <Fact term={c.f.lines}>{c.linesCount(o.lineCount)}</Fact>
          <Fact term={c.f.grandTotal}>
            <span className="font-semibold tabular-nums">{money(o.grandTotal, o.currency)}</span>
          </Fact>
          {o.deposit.amount && (
            <Fact term={c.f.depositAmount}>
              <span className="tabular-nums">{money(o.deposit.amount, o.currency)}</span>
            </Fact>
          )}
        </Facts>
      </Section>
    </div>
  );
}

type Detail = Extract<OrderDetail, { view: 'purchasing' }>;

function PurchasingOrder({ d, set }: { d: Detail; set: (d: OrderDetail) => void }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const money = useMoney();
  const { date, dateTime } = useDateFormat();
  const o = d.order;
  const editable = o.actions.includes('edit');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<'issue' | 'cancel' | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const run = async (work: () => Promise<OrderDetail>, text = c.saved) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: poError(e, c, cc) });
      return false;
    }
  };
  const cur = o.currency;

  return (
    <div className="grid grid-cols-1 gap-6" data-order={o.number} data-status={o.status}>
      <BackLink to={BASE} label={c.back} />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={o.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PoStatusPill status={o.status} />
          {o.deposit.status !== 'NOT_REQUIRED' && <DepositPill status={o.deposit.status} />}
          <span className="text-caption text-text-muted">{c.orders}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      <Section id="po-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.requests}>
            <span className="flex flex-wrap gap-x-3">
              {o.requests.map((r) => (
                <AreaLink
                  key={r.id}
                  to={`/core/purchasing/requests/${encodeURIComponent(r.id)}`}
                  className={cn(link, 'font-mono')}
                >
                  {r.number}
                </AreaLink>
              ))}
            </span>
          </Fact>
          <Fact term={c.f.orderDate}>{date(o.orderDate)}</Fact>
          <Fact term={c.f.createdBy}>{o.createdBy?.name ?? '—'}</Fact>
          {o.issuedAt && (
            <Fact term={c.f.issued}>{`${dateTime(o.issuedAt)} · ${o.issuedBy?.name ?? ''}`}</Fact>
          )}
          {o.cancellationReason && (
            <Fact term={c.f.reason}>
              <span className="whitespace-pre-line">{o.cancellationReason}</span>
            </Fact>
          )}
        </Facts>
      </Section>

      <Section id="po-supplier" title={c.supplierSection}>
        <Facts>
          <Fact term={c.f.supplier}>
            {o.supplier ? (
              <>
                <span className="font-mono">{o.supplier.code}</span> · {o.supplier.name}
                {!o.supplier.active && <span className="text-text-muted"> ({c.inactive})</span>}
              </>
            ) : (
              c.noSupplier
            )}
          </Fact>
          {o.supplier?.taxId && <Fact term={c.f.taxId}>{o.supplier.taxId}</Fact>}
          {o.supplier?.contactName && (
            <Fact term={c.f.contact}>
              {[o.supplier.contactName, o.supplier.phone, o.supplier.email]
                .filter(Boolean)
                .join(' · ')}
            </Fact>
          )}
          <Fact term={c.f.currency}>{cur}</Fact>
          <Fact term={c.f.expected}>{o.expectedDate ? date(o.expectedDate) : '—'}</Fact>
          <Fact term={c.f.terms}>
            <span className="whitespace-pre-line">{o.paymentTerms ?? '—'}</span>
          </Fact>
          <Fact term={c.f.note}>
            <span className="whitespace-pre-line">{o.note ?? '—'}</span>
          </Fact>
        </Facts>
        {editable && (
          <div className="mt-6">
            <HeaderEditor o={o} onSave={(body) => run(() => poApi.update(o.id, body))} />
          </div>
        )}
      </Section>

      <Section id="po-lines" title={`${c.f.lines} · ${c.linesCount(o.lines.length)}`}>
        {editable && <p className="mb-3 text-caption text-text-muted">{c.draftNote}</p>}
        <ol className="grid grid-cols-1 gap-2" data-lines>
          {o.lines.map((l) =>
            editing === l.id ? (
              <li key={l.id}>
                <LineEditor
                  line={l}
                  onCancel={() => setEditing(null)}
                  onSave={async (body) => {
                    if (await run(() => poApi.updateLine(o.id, l.id, body))) setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={l.id}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl bg-white/[0.02] p-3 lg:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,22rem)_auto]"
                data-line={l.lineNo}
              >
                <span className="font-mono text-caption text-text-muted tabular-nums">
                  #{l.lineNo}
                </span>
                <span className="min-w-0">
                  <LineIdentity line={l} />
                  {editable && (
                    <span className="block text-caption text-text-muted tabular-nums">
                      {c.f.requested} {l.request.requested} · {c.f.ordered}{' '}
                      {l.request.orderedElsewhere} · {c.f.remaining} {l.request.remaining}
                    </span>
                  )}
                  {l.note && (
                    <span className="block text-caption whitespace-pre-line text-text-muted">
                      {l.note}
                    </span>
                  )}
                </span>
                <dl className="col-start-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-caption sm:grid-cols-4 lg:col-start-auto">
                  {(
                    [
                      [c.f.unitPrice, money(l.unitPrice)],
                      [c.f.discount, money(l.discountAmount)],
                      [c.f.taxRate, `${l.taxRate}%`],
                      [c.f.lineTotal, money(l.lineTotal)],
                    ] as const
                  ).map(([t, v]) => (
                    <div key={t} className="min-w-0">
                      <dt className="text-text-muted">{t}</dt>
                      <dd className="text-text-primary tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                {editable && (
                  <span className="col-start-2 flex gap-1 lg:col-start-auto">
                    <button
                      type="button"
                      onClick={() => setEditing(l.id)}
                      className={buttonClasses('ghost', 'md', 'px-3')}
                      aria-label={`${c.edit} #${l.lineNo}`}
                    >
                      {c.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => void run(() => poApi.removeLine(o.id, l.id))}
                      className={buttonClasses('ghost', 'md', 'px-3')}
                      aria-label={`${c.remove} #${l.lineNo}`}
                    >
                      {c.remove}
                    </button>
                  </span>
                )}
              </li>
            ),
          )}
        </ol>
        {editable &&
          (editing === 'new' ? (
            <AddLine
              o={o}
              onCancel={() => setEditing(null)}
              onSave={async (body) => {
                if (await run(() => poApi.addLine(o.id, body))) setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className={buttonClasses('secondary', 'md', 'mt-3 w-fit')}
              data-add-line
            >
              + {c.addLine}
            </button>
          ))}
      </Section>

      <Section id="po-amounts" title={c.totals}>
        <Facts>
          <Fact term={c.f.subtotal}>
            <span className="tabular-nums">{money(o.totals.subtotal, cur)}</span>
          </Fact>
          <Fact term={c.f.discountTotal}>
            <span className="tabular-nums">{money(o.totals.discountTotal, cur)}</span>
          </Fact>
          <Fact term={c.f.taxTotal}>
            <span className="tabular-nums">{money(o.totals.taxTotal, cur)}</span>
          </Fact>
          <Fact term={c.f.grandTotal}>
            <span className="font-semibold tabular-nums" data-grand-total>
              {money(o.totals.grandTotal, cur)}
            </span>
          </Fact>
          <Fact term={c.f.deposit}>
            {o.deposit.type === 'NONE'
              ? c.depositTypes.NONE
              : `${money(o.deposit.amount, cur)}${o.deposit.type === 'PERCENT' ? ` (${o.deposit.value}%)` : ''}`}
          </Fact>
          {o.deposit.dueDate && <Fact term={c.f.dueDate}>{date(o.deposit.dueDate)}</Fact>}
          {o.deposit.type !== 'NONE' && (
            <Fact term={c.f.status}>
              <DepositPill status={o.deposit.status} />
              {o.deposit.reference && (
                <span className="ml-2 text-caption">{o.deposit.reference}</span>
              )}
              {o.deposit.waiveReason && (
                <span className="ml-2 text-caption whitespace-pre-line">
                  {o.deposit.waiveReason}
                </span>
              )}
            </Fact>
          )}
        </Facts>
        <p className="mt-3 text-caption text-text-muted">{c.totalsNote}</p>
        {editable && (
          <div className="mt-6">
            <DepositEditor o={o} onSave={(deposit) => run(() => poApi.update(o.id, { deposit }))} />
          </div>
        )}
      </Section>

      {o.actions.some((a) => a === 'issue' || a === 'cancel') && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {confirm ? (
            <ConfirmBox
              question={c.confirm[confirm]}
              goLabel={c.actions[confirm]}
              reason={
                confirm === 'cancel' ? (o.status === 'DRAFT' ? 'optional' : 'required') : undefined
              }
              onCancel={() => setConfirm(null)}
              onConfirm={async (reason) => {
                const ok = await run(
                  () => (confirm === 'issue' ? poApi.issue(o.id) : poApi.cancel(o.id, reason)),
                  confirm === 'issue' ? c.statuses.ISSUED : c.statuses.CANCELLED,
                );
                if (ok) {
                  setConfirm(null);
                  heading.current?.focus();
                }
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(['issue', 'cancel'] as const)
                .filter((a) => o.actions.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setConfirm(a)}
                    className={buttonClasses(a === 'issue' ? 'primary' : 'secondary', 'md')}
                    data-action={a}
                  >
                    {c.actions[a]}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <Section id="po-timeline" title={c.timeline}>
        <ol className="grid gap-2" data-timeline>
          {d.timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 text-label">
              <span className="font-semibold text-text-primary">
                {c.timelineTypes[t.type.replace('PURCHASE_ORDER_', '')] ?? t.type}
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

function Actions({ busy, onCancel }: { busy: boolean; onCancel?: () => void }) {
  const c = useCopy(ORDER_COPY);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={busy}
        className={buttonClasses(onCancel ? 'primary' : 'secondary', 'md')}
      >
        {busy ? c.saving : c.save}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.cancel}
        </button>
      )}
    </div>
  );
}

/** Supplier, currency, expected date, terms and note of a DRAFT (only changes are sent). */
function HeaderEditor({
  o,
  onSave,
}: {
  o: PurchaseOrder;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const c = useCopy(ORDER_COPY);
  const base = useId();
  const [supplier, setSupplier] = useState<SupplierOption | null>(
    o.supplier
      ? { id: o.supplier.id, code: o.supplier.code ?? '', name: o.supplier.name ?? '' }
      : null,
  );
  const [currency, setCurrency] = useState(o.currency);
  const [expected, setExpected] = useState(o.expectedDate ?? '');
  const [terms, setTerms] = useState(o.paymentTerms ?? '');
  const [note, setNote] = useState(o.note ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if ((supplier?.id ?? null) !== (o.supplier?.id ?? null)) body.supplierId = supplier?.id ?? null;
    if (currency !== o.currency) body.currency = currency;
    if (expected !== (o.expectedDate ?? '')) body.expectedDate = expected;
    if (terms.trim() !== (o.paymentTerms ?? '')) body.paymentTerms = terms.trim();
    if (note.trim() !== (o.note ?? '')) body.note = note.trim();
    if (!Object.keys(body).length) return;
    setBusy(true);
    await onSave(body);
    setBusy(false);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid max-w-3xl grid-cols-1 gap-4"
      data-header-editor
    >
      <SupplierPicker value={supplier} onChange={setSupplier} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id={`${base}-cur`}
          label={c.f.currency}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {(CURRENCIES.includes(o.currency) ? CURRENCIES : [o.currency, ...CURRENCIES]).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${base}-exp`}
          type="date"
          label={c.f.expected}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </div>
      <TextField
        id={`${base}-terms`}
        label={c.f.terms}
        value={terms}
        maxLength={300}
        onChange={(e) => setTerms(e.target.value)}
      />
      <TextField
        id={`${base}-note`}
        label={c.f.note}
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
      />
      <Actions busy={busy} />
    </form>
  );
}

/** Commercial fields of one line; validated for shape here, computed on the server. */
function useLineFields(initial: Partial<Record<keyof LineFields, string>>) {
  const c = useCopy(ORDER_COPY);
  const [v, setV] = useState({
    quantity: initial.quantity ?? '',
    unitPrice: initial.unitPrice ?? '0',
    discountAmount: initial.discountAmount ?? '0',
    taxRate: initial.taxRate ?? '0',
    note: initial.note ?? '',
  });
  const check = (remaining?: string) => {
    const e: Record<string, string> = {};
    const q = v.quantity.trim();
    if (!QTY.test(q) || !/[1-9]/.test(q)) e.quantity = c.invalidNumber;
    else if (remaining !== undefined && scaled(q) > scaled(remaining))
      e.quantity = c.errors.PO_QUANTITY_EXCEEDS_REMAINING!;
    if (!PRICE.test(v.unitPrice.trim())) e.unitPrice = c.invalidNumber;
    if (!AMOUNT.test(v.discountAmount.trim())) e.discountAmount = c.invalidNumber;
    const t = v.taxRate.trim();
    if (!RATE.test(t) || scaled(t) > scaled('100')) e.taxRate = c.invalidNumber;
    return e;
  };
  const body = (): Required<Omit<LineFields, 'note'>> & { note: string | null } => ({
    quantity: v.quantity.trim(),
    unitPrice: v.unitPrice.trim(),
    discountAmount: v.discountAmount.trim(),
    taxRate: v.taxRate.trim(),
    note: v.note.trim() || null,
  });
  return { v, setV, check, body };
}

function LineFieldsGrid({
  base,
  f,
  errors,
  unit,
}: {
  base: string;
  f: ReturnType<typeof useLineFields>;
  errors: Record<string, string>;
  unit?: string | null;
}) {
  const c = useCopy(ORDER_COPY);
  const field = (key: 'quantity' | 'unitPrice' | 'discountAmount' | 'taxRate', label: string) => (
    <TextField
      id={`${base}-${key}`}
      label={label}
      inputMode="decimal"
      autoComplete="off"
      value={f.v[key]}
      maxLength={19}
      error={errors[key]}
      onChange={(e) => f.setV((s) => ({ ...s, [key]: e.target.value }))}
      data-field={key}
    />
  );
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {field('quantity', unit ? `${c.f.quantity} (${unit})` : c.f.quantity)}
        {field('unitPrice', c.f.unitPrice)}
        {field('discountAmount', c.f.discount)}
        {field('taxRate', c.f.taxRate)}
      </div>
      <TextField
        id={`${base}-note`}
        label={c.f.lineNote}
        value={f.v.note}
        maxLength={500}
        onChange={(e) => f.setV((s) => ({ ...s, note: e.target.value }))}
      />
    </>
  );
}

const formBox =
  'grid grid-cols-1 gap-4 rounded-xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)]';

function LineEditor({
  line,
  onSave,
  onCancel,
}: {
  line: PurchasingLine;
  onSave: (body: LineFields) => Promise<void>;
  onCancel: () => void;
}) {
  const base = useId();
  const f = useLineFields({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxRate: line.taxRate,
    note: line.note ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = f.check(line.request.remaining);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${base}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    await onSave(f.body());
    setBusy(false);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className={formBox}
      data-line-editor={line.lineNo}
    >
      <LineIdentity line={line} />
      <LineFieldsGrid base={base} f={f} errors={errors} unit={line.unit?.code} />
      <Actions busy={busy} onCancel={onCancel} />
    </form>
  );
}

/** Adds a line from one of the order's requests (lines not on it yet, with something left). */
function AddLine({
  o,
  onSave,
  onCancel,
}: {
  o: PurchaseOrder;
  onSave: (body: { purchaseRequestLineId: string; quantity: string } & LineFields) => Promise<void>;
  onCancel: () => void;
}) {
  const c = useCopy(ORDER_COPY);
  const base = useId();
  const [lines, setLines] = useState<(SourceLine & { request: string })[] | null>(null);
  const [lineId, setLineId] = useState('');
  const f = useLineFields({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all(o.requests.map((r) => poApi.sourceRequest(r.id))).then(
      (all) =>
        setLines(
          all.flatMap(({ request }) =>
            request.lines
              .filter(
                (l) =>
                  scaled(l.remaining) > 0n &&
                  !o.lines.some(
                    (x) => x.request.lineNo === l.lineNo && x.request.id === request.id,
                  ),
              )
              .map((l) => ({ ...l, request: request.number })),
          ),
        ),
      () => setLines([]),
    );
  }, [o]);
  const chosen = lines?.find((l) => l.id === lineId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = f.check(chosen?.remaining);
    if (!chosen) found.line = c.chooseLine;
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${base}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    await onSave({ purchaseRequestLineId: chosen!.id, ...f.body() });
    setBusy(false);
  };
  if (lines === null) return <Loading label={c.loading} />;
  if (lines.length === 0) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-label text-text-secondary">{c.noLinesLeft}</p>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.cancel}
        </button>
      </div>
    );
  }
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className={cn(formBox, 'mt-3')}
      data-add-line-form
    >
      <FieldGroup legend={c.addLine}>
        <SelectField
          id={`${base}-line`}
          label={c.f.item}
          value={lineId}
          error={errors.line}
          onChange={(e) => {
            setLineId(e.target.value);
            const l = lines.find((x) => x.id === e.target.value);
            if (l) f.setV((s) => ({ ...s, quantity: l.remaining }));
          }}
        >
          <option value="">—</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {`${l.request} #${l.lineNo} · ${l.item ? `${l.item.code} ${l.item.name}` : l.description} · ${c.f.remaining} ${l.remaining}`}
            </option>
          ))}
        </SelectField>
      </FieldGroup>
      <LineFieldsGrid base={base} f={f} errors={errors} unit={chosen?.unit?.code} />
      <Actions busy={busy} onCancel={onCancel} />
    </form>
  );
}

/** None / fixed amount / percent of the total; the server stores the explicit amount. */
function DepositEditor({
  o,
  onSave,
}: {
  o: PurchaseOrder;
  onSave: (deposit: Record<string, unknown>) => Promise<boolean>;
}) {
  const c = useCopy(ORDER_COPY);
  const base = useId();
  const [type, setType] = useState<DepositType>(o.deposit.type);
  const [value, setValue] = useState(o.deposit.value ?? '');
  const [due, setDue] = useState(o.deposit.dueDate ?? '');
  const [note, setNote] = useState(o.deposit.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    const ok =
      type === 'NONE' ||
      (/[1-9]/.test(v) &&
        (type === 'AMOUNT' ? AMOUNT.test(v) : RATE.test(v) && scaled(v) <= scaled('100')));
    if (!ok) {
      setError(c.invalidNumber);
      document.getElementById(`${base}-value`)?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    await onSave(
      type === 'NONE'
        ? { type }
        : { type, value: v, dueDate: due || null, note: note.trim() || null },
    );
    setBusy(false);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid max-w-3xl grid-cols-1 gap-4"
      data-deposit-editor
    >
      <FieldGroup legend={c.f.depositType}>
        <div className="flex flex-wrap gap-2">
          {(['NONE', 'AMOUNT', 'PERCENT'] as const).map((t) => (
            <label
              key={t}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
                type === t &&
                  'bg-brand-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]',
              )}
            >
              <input
                type="radio"
                name={`${base}-type`}
                checked={type === t}
                onChange={() => setType(t)}
                className="size-4 accent-[var(--color-brand-primary)]"
                data-deposit-type={t}
              />
              {c.depositTypes[t]}
            </label>
          ))}
        </div>
      </FieldGroup>
      {type !== 'NONE' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id={`${base}-value`}
            label={
              type === 'PERCENT' ? `${c.f.depositValue} (%)` : `${c.f.depositValue} (${o.currency})`
            }
            inputMode="decimal"
            autoComplete="off"
            value={value}
            maxLength={16}
            error={error}
            onChange={(e) => setValue(e.target.value)}
          />
          <TextField
            id={`${base}-due`}
            type="date"
            label={c.f.dueDate}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <TextField
            id={`${base}-note`}
            label={c.f.depositNote}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      )}
      <Actions busy={busy} />
    </form>
  );
}
