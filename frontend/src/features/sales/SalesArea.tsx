import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { CELL, useDateFormat, useLoad } from '@/features/company-center/model';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageError,
  PageTitle,
  Pill,
  Section,
} from '@/features/company-center/parts';
import { DOC_COPY, usePreviewCache } from '@/features/company-center/docModel';
import { LineSummaryText, NextStep, Previewable } from '@/features/company-center/docContext';
import { SearchBox } from '@/features/company-center/SearchBox';
import type { DepartmentCode } from '@/features/company/api';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useDebounced, usePaged } from '@/features/warehouse/whModel';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import {
  AMOUNT,
  decimals,
  PRICE,
  QTY,
  RATE,
  salesApi,
  type Availability,
  type CustomerOption,
  type SalesContext,
  type SalesOrder,
  type SoDetail,
  type SoItem,
  type SoLineInput,
  type SoRow,
  type SoStatus,
} from './salesApi';
import { SALES_COPY, salesError, useMoney } from './salesCopy';

/*
 * /core/sales/* (EP33) — the Sales workspace, its own lazy chunk:
 *   index          counts (my drafts, awaiting confirmation, confirmed, short of
 *                  stock) and the server-paged order list with filters
 *   orders/new     a DRAFT: customer, dates, reference, note
 *   orders/:id     the order — header and lines editable while DRAFT (by its
 *                  creator), then submit / confirm / cancel as the server allows
 * Money is shown as the server computed it; the line inputs are checked for
 * shape only. Availability is labelled information, never a reservation.
 * Every action not listed in the order's `actions` is simply not offered.
 */

const BASE = '/core/sales';
const LINK =
  'inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-7';
/** EP34: the allocation of a confirmed order — its own lazy chunk. */
const AllocationSection = lazy(() => import('./AllocationSection'));

const ROW =
  'border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4';
const CARD = 'rounded-xl bg-white/[0.02] p-4';

function useSales() {
  const c = useCopy(SALES_COPY);
  const cc = useCopy(CONTROL_COPY);
  return { c, cc, err: (e: unknown) => salesError(e, c, cc) };
}

export default function SalesArea() {
  const { c, err } = useSales();
  const { state } = useLoad(salesApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return <PageError error={state.error}>{err(state.error)}</PageError>;
  const ctx = state.data;
  return (
    <div className="grid grid-cols-1 gap-6" data-sales>
      <Routes>
        <Route index element={<SalesHome ctx={ctx} />} />
        {ctx.orders.create && <Route path="orders/new" element={<NewOrder ctx={ctx} />} />}
        <Route path="orders/:id" element={<ById />} />
      </Routes>
    </div>
  );
}

function ById() {
  const { id } = useParams();
  return <OrderPage key={id} id={id!} />;
}

const STATUS_TONE: Record<SoStatus, 'neutral' | 'teal' | 'muted' | 'warning'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  CONFIRMED: 'teal',
  CANCELLED: 'muted',
};

function SoStatusPill({ status }: { status: SoStatus }) {
  const { c } = useSales();
  return (
    <Pill
      tone={STATUS_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-so-status={status}
    >
      {c.statuses[status]}
    </Pill>
  );
}

/** Text first, tone second — never colour alone. */
function AvailabilityPill({ state }: { state: Availability }) {
  const { c } = useSales();
  return (
    <Pill
      tone={state === 'AVAILABLE' ? 'teal' : state === 'NOT_STOCK_TRACKED' ? 'muted' : 'warning'}
      data-availability={state}
    >
      {c.avail[state]}
    </Pill>
  );
}

/**
 * EP42.3: who the order waits on — the transitions the server enforces (presentation only).
 * Draft / submitted → Sales (submit, confirm); confirmed with nothing reserved → Sales
 * (the manager allocates); anything reserved and not yet delivered → Warehouse.
 */
function soNext(r: SoRow): DepartmentCode | null {
  if (r.status === 'DRAFT' || r.status === 'SUBMITTED') return 'SALES';
  if (r.status !== 'CONFIRMED' || r.fulfilmentState === 'DELIVERED' || !r.allocationState)
    return null;
  return r.allocationState === 'NOT_ALLOCATED' &&
    (r.fulfilmentState ?? 'NOT_STARTED') === 'NOT_STARTED'
    ? 'SALES'
    : 'WAREHOUSE';
}

function BackLink() {
  const { c } = useSales();
  return (
    <AreaLink
      to={BASE}
      className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
    >
      ← {c.back}
    </AreaLink>
  );
}

// ------------------------------------------------------------------ home + list

function SalesHome({ ctx }: { ctx: SalesContext }) {
  const { c, err } = useSales();
  const money = useMoney();
  const { date } = useDateFormat();
  const base = useId();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const shortage = params.get('availability') === 'SHORTAGE';
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) =>
      salesApi.list({
        status,
        availability: shortage ? 'SHORTAGE' : undefined,
        q: debounced,
        page,
        pageSize: 25,
      }),
    [status, shortage, debounced],
  );
  const { locale } = useLocale();
  const d = useCopy(DOC_COPY);
  // EP42.3: a row's preview reads the order once (lines with what is still to deliver).
  const preview = usePreviewCache((id: string) =>
    salesApi.get(id).then(({ order }) =>
      order.lines.map((l) => ({
        key: l.id,
        code: l.item.code,
        name: l.item.name,
        quantity: l.quantity,
        unit: l.unit.code,
        extra:
          l.progress.toDeliver && l.progress.toDeliver !== '0' && order.status === 'CONFIRMED'
            ? d.left(`${l.progress.toDeliver} ${l.unit.code}`)
            : undefined,
      })),
    ),
  );
  // Filters live in the URL (shareable, back button); other params and the language stay.
  const filter = (next: { status?: string; availability?: string }) => {
    const p = new URLSearchParams(params);
    for (const k of ['status', 'availability'] as const) {
      if (next[k]) p.set(k, next[k]);
      else p.delete(k);
    }
    setParams(p, { replace: true, state: { locale } });
  };
  const tiles: [keyof SalesContext['counts'], { status?: string; availability?: string }][] = [
    ['myDrafts', { status: 'DRAFT' }],
    ['awaitingConfirmation', { status: 'SUBMITTED' }],
    ['confirmed', { status: 'CONFIRMED' }],
    ['withShortage', { availability: 'SHORTAGE' }],
  ];
  const cols: {
    head: string;
    minor?: boolean;
    /** EP42.3: secondary columns shown only on wide screens (≥ 1536 px). */
    wide?: boolean;
    end?: boolean;
    cell: (r: NonNullable<typeof data>['items'][number]) => ReactNode;
  }[] = [
    {
      head: c.f.number,
      cell: (r) => (
        <AreaLink to={`${BASE}/orders/${encodeURIComponent(r.id)}`} className={LINK}>
          {r.number}
        </AreaLink>
      ),
    },
    {
      head: c.f.status,
      cell: (r) => (
        <>
          <SoStatusPill status={r.status} />
          <NextStep dept={soNext(r)} />
        </>
      ),
    },
    {
      head: c.f.customer,
      cell: (r) => (
        <span className="break-words">
          <span className="font-mono text-caption text-text-muted">{r.customer.code}</span>{' '}
          {r.customer.name}
        </span>
      ),
    },
    { head: d.items, cell: (r) => <LineSummaryText s={r.summary} /> },
    {
      head: c.f.availability,
      // EP34: a confirmed order shows how much is reserved; before that, what stock exists.
      // EP39: once Warehouse has started, how far it got (picked … delivered) instead.
      cell: (r) =>
        r.fulfilmentState && r.fulfilmentState !== 'NOT_STARTED' ? (
          <Pill
            tone={
              r.fulfilmentState === 'DELIVERED'
                ? 'teal'
                : r.fulfilmentState === 'EXCEPTION'
                  ? 'warning'
                  : 'muted'
            }
            data-fulfilment-state={r.fulfilmentState}
          >
            {c.ful.states[r.fulfilmentState]}
          </Pill>
        ) : r.allocationState ? (
          <Pill
            tone={r.allocationState === 'FULLY_ALLOCATED' ? 'teal' : 'warning'}
            data-allocation-state={r.allocationState}
          >
            {c.alloc.states[r.allocationState]}
          </Pill>
        ) : r.availability ? (
          <AvailabilityPill state={r.availability} />
        ) : (
          '—'
        ),
    },
    {
      head: c.f.grandTotal,
      end: true,
      cell: (r) => (
        <span className="font-semibold whitespace-nowrap tabular-nums">
          {money(r.grandTotal, r.currency)}
        </span>
      ),
    },
    {
      head: c.f.requestedDate,
      minor: true,
      cell: (r) => (r.requestedDate ? date(r.requestedDate) : '—'),
    },
    { head: c.f.createdBy, wide: true, cell: (r) => r.createdBy?.name ?? '—' },
    { head: c.f.updated, wide: true, cell: (r) => date(r.updatedAt) },
  ];
  return (
    <>
      <PageTitle
        title={c.title}
        lead={c.lead}
        action={
          ctx.orders.create ? (
            <AreaLink to={`${BASE}/orders/new`} className={buttonClasses('primary', 'md')} data-new>
              {c.newOrder}
            </AreaLink>
          ) : undefined
        }
      />
      {ctx.selectedBranch && (
        <p className="text-caption text-text-muted">
          {c.f.branch}: {`${ctx.selectedBranch.code} · ${ctx.selectedBranch.name}`}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-sales-counts>
        {tiles.map(([key, f]) => {
          const active = f.status ? status === f.status && !shortage : shortage && !status;
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => filter(active ? {} : f)}
                className={cn(
                  'grid min-h-11 w-full gap-1 rounded-xl p-4 text-left shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  active
                    ? 'bg-brand-primary/[0.08] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                    : 'hover:bg-white/[0.03]',
                )}
                data-count={key}
              >
                <span className="text-caption text-text-muted">{c.counts[key]}</span>
                <span className="text-[1.5rem] font-semibold text-text-primary tabular-nums">
                  {ctx.counts[key]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end"
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
          onChange={(e) =>
            filter({ status: e.target.value, availability: shortage ? 'SHORTAGE' : '' })
          }
          data-filter="status"
        >
          <option value="">{c.f.any}</option>
          {(['DRAFT', 'SUBMITTED', 'CONFIRMED', 'CANCELLED'] as const).map((s) => (
            <option key={s} value={s}>
              {c.statuses[s]}
            </option>
          ))}
        </SelectField>
        {/* EP39: the whole row is the target; the box itself is 24 px (WCAG 2.5.8). */}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-label text-text-primary">
          <input
            type="checkbox"
            checked={shortage}
            onChange={(e) => filter({ status, availability: e.target.checked ? 'SHORTAGE' : '' })}
            className="size-6 shrink-0 cursor-pointer accent-[var(--color-brand-primary)]"
            data-filter="shortage"
          />
          {c.shortageOnly}
        </label>
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.noOrders}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-so-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {cols.map((col) => (
                <th
                  key={col.head}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    col.minor && 'md:max-xl:hidden',
                    col.wide && 'max-md:hidden! md:max-2xl:hidden',
                    col.end && 'md:text-right',
                  )}
                >
                  {col.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((r) => (
              <Previewable
                key={r.id}
                load={() => preview(r.id)}
                href={`${BASE}/orders/${encodeURIComponent(r.id)}`}
                label={r.number}
                colSpan={cols.length}
                row={(toggle) => (
                  <tr className={ROW} data-so={r.number}>
                    {cols.map((col, i) => (
                      <td
                        key={col.head}
                        data-label={col.head}
                        className={cn(
                          CELL,
                          // The number heads the card on a phone (its label is redundant there).
                          i === 0 && 'max-md:before:hidden',
                          col.minor && 'md:max-xl:hidden',
                          col.wide && 'max-md:hidden! md:max-2xl:hidden',
                          col.end && 'md:text-right',
                        )}
                      >
                        {i === 0 ? (
                          <span className="inline-flex items-center">
                            {col.cell(r)}
                            {toggle}
                          </span>
                        ) : (
                          col.cell(r)
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              />
            ))}
          </tbody>
        </table>
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
          data-show-more
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
      <p className="text-caption text-text-muted">{c.availNote}</p>
    </>
  );
}

// ------------------------------------------------------------------ customer + header

const customerLabel = (o: CustomerOption) => `${o.code} · ${o.name}`;

/**
 * One searchable customer field (EP38.4): an ARIA 1.2 combobox with a listbox
 * popup. The server searches (code, name or tax ID — the member's company
 * only); arrow keys move, Enter chooses, Escape closes, typing again clears the
 * choice (a customer is always one the server listed, never free text).
 */
function CustomerPicker({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: CustomerOption | null;
  onChange: (v: CustomerOption | null) => void;
  className?: string;
}) {
  const { c } = useSales();
  const k = c.compose;
  const [text, setText] = useState(value ? customerLabel(value) : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // While the field shows the chosen customer, the list offers everyone again.
  const term = value && text === customerLabel(value) ? '' : text.trim();
  const debounced = useDebounced(term);
  const [options, setOptions] = useState<CustomerOption[]>([]);
  // The query the shown options answer: while it differs from the current one, a search runs.
  const [answered, setAnswered] = useState<string | null>(null);
  const searching = answered !== debounced;
  useEffect(() => {
    let live = true;
    salesApi.customers(debounced).then(
      (r) => {
        if (!live) return;
        setOptions(r.items);
        setAnswered(debounced);
      },
      () => {
        if (!live) return;
        setOptions([]);
        setAnswered(debounced);
      },
    );
    return () => {
      live = false;
    };
  }, [debounced]);
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-o${i}`;
  const choose = (o: CustomerOption) => {
    onChange(o);
    setText(customerLabel(o));
    setOpen(false);
    setActive(-1);
  };
  const status = searching
    ? k.searching
    : debounced && !options.length
      ? k.noMatch
      : debounced
        ? k.matches(options.length)
        : '';
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && active >= 0 && options[active]) {
      e.preventDefault(); // choose — never submit the form from the list
      choose(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };
  return (
    <div className={cn('relative min-w-0', className)} data-customer-combobox>
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {c.f.customer}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-describedby={`${id}-status`}
        placeholder={c.f.customerHint}
        maxLength={100}
        value={text}
        className={controlClass(false)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        data-customer-input
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={c.f.customer}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl bg-surface-raised p-1 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7),inset_0_0_0_1px_rgb(190_235_222/0.14)]"
      >
        {searching ? (
          <li role="presentation" className="px-3 py-2.5 text-label text-text-muted">
            {k.searching}
          </li>
        ) : options.length === 0 ? (
          <li role="presentation" className="px-3 py-2.5 text-label text-text-muted">
            {k.noMatch}
          </li>
        ) : (
          options.map((o, i) => (
            <li
              key={o.id}
              id={optionId(i)}
              role="option"
              aria-selected={value?.id === o.id}
              // Keep the focus in the field: choosing happens on click, not on blur.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              className={cn(
                'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-label',
                i === active ? 'bg-brand-primary/[0.16] text-text-primary' : 'text-text-secondary',
                value?.id === o.id && 'font-semibold text-text-primary',
              )}
            >
              <span className="font-mono text-brand-glow">{o.code}</span>
              <span className="min-w-0 truncate">{o.name}</span>
            </li>
          ))
        )}
      </ul>
      <p
        id={`${id}-status`}
        role="status"
        className="mt-1.5 text-caption text-text-muted empty:hidden"
        data-customer-status
      >
        {status}
      </p>
    </div>
  );
}

interface HeaderValues {
  customer: CustomerOption | null;
  orderDate: string;
  requestedDate: string;
  reference: string;
  note: string;
}

function HeaderFields({
  v,
  set,
}: {
  v: HeaderValues;
  set: (f: (v: HeaderValues) => HeaderValues) => void;
}) {
  const { c } = useSales();
  const base = useId();
  return (
    <>
      <CustomerPicker
        id={`${base}-customer`}
        value={v.customer}
        onChange={(customer) => set((x) => ({ ...x, customer }))}
      />
      <TextField
        id={`${base}-od`}
        type="date"
        label={c.f.orderDate}
        value={v.orderDate}
        onChange={(e) => set((x) => ({ ...x, orderDate: e.target.value }))}
      />
      <TextField
        id={`${base}-rd`}
        type="date"
        label={c.f.requestedDate}
        value={v.requestedDate}
        min={v.orderDate || undefined}
        onChange={(e) => set((x) => ({ ...x, requestedDate: e.target.value }))}
      />
      <TextField
        id={`${base}-ref`}
        label={c.f.reference}
        value={v.reference}
        maxLength={60}
        onChange={(e) => set((x) => ({ ...x, reference: e.target.value }))}
      />
      <TextField
        id={`${base}-note`}
        label={c.f.note}
        value={v.note}
        maxLength={1000}
        onChange={(e) => set((x) => ({ ...x, note: e.target.value }))}
      />
    </>
  );
}

/** The document surface: a hairline frame, a quiet fill — no glow, no extra borders. */
const DOC = 'rounded-2xl bg-white/[0.015] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]';
/** A label above its value (summary facts). */
function SummaryFact({
  term,
  value,
  empty,
}: {
  term: string;
  value: string | null;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-text-muted">{term}</dt>
      <dd
        className={cn(
          'mt-0.5 text-label break-words',
          value ? 'text-text-primary' : 'text-text-muted',
        )}
      >
        {value ?? empty}
      </dd>
    </div>
  );
}

function NewOrder({ ctx }: { ctx: SalesContext }) {
  const { c, cc, err } = useSales();
  const k = c.compose;
  const { date } = useDateFormat();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const base = useId();
  const [v, setV] = useState<HeaderValues>({
    customer: null,
    orderDate: ctx.today,
    requestedDate: '',
    reference: '',
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dateBad = !!v.requestedDate && !!v.orderDate && v.requestedDate < v.orderDate;
  const ready = !!v.customer && !dateBad;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.customer || dateBad) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await salesApi.create({
        customerId: v.customer.id,
        orderDate: v.orderDate || undefined,
        requestedDate: v.requestedDate || null,
        customerReference: v.reference.trim() || null,
        note: v.note.trim() || null,
      });
      void navigate(`${BASE}/orders/${encodeURIComponent(order.id)}`, { state: { locale } });
    } catch (x) {
      setError(err(x));
      setBusy(false);
    }
  };
  const branch = ctx.selectedBranch;
  const branchText = branch ? `${branch.code} · ${branch.name}` : null;
  return (
    <div className="grid grid-cols-1 gap-5" data-new-order-page>
      <BackLink />
      <header className="grid gap-2">
        <p className="text-caption font-semibold tracking-[0.14em] text-brand-glow uppercase">
          {k.eyebrow}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[clamp(1.375rem,1.15rem+0.8vw,1.875rem)] font-semibold tracking-tight text-text-primary">
            {c.newOrder}
          </h1>
          <Pill tone="neutral">{c.statuses.DRAFT}</Pill>
        </div>
        <p className="max-w-3xl text-label leading-relaxed text-text-secondary">{k.lead}</p>
        <p className="text-caption text-text-muted" data-document-number>
          {`${k.number}: ${k.numberPending}`}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_21rem]">
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          aria-labelledby={`${base}-head`}
          aria-busy={busy}
          className={cn(DOC, 'min-w-0')}
          data-new-order
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <h2 id={`${base}-head`} className="text-body font-semibold text-text-primary">
              {k.headerTitle}
            </h2>
            <p className="text-caption text-text-muted">{k.headerHint}</p>
          </div>
          <div aria-live="polite">
            {error && (
              <div className="px-5 pt-5 sm:px-6">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
            {/* The order is created in the working branch — said here, changed only explicitly. */}
            <div className="min-w-0 sm:col-span-2 xl:col-span-1" data-order-branch>
              <p id={`${base}-br`} className="mb-2 text-label font-medium text-text-primary">
                {c.f.branch}
              </p>
              <div
                aria-labelledby={`${base}-br`}
                aria-describedby={`${base}-br-hint`}
                role="group"
                className="flex h-12 items-center justify-between gap-3 rounded-control bg-brand-primary/[0.06] px-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22)]"
              >
                <span className="min-w-0 truncate text-label text-text-primary">
                  {branchText ?? '—'}
                </span>
                {ctx.branches.length > 1 && (
                  <AreaLink
                    to="/core/branch"
                    aria-label={cc.core.changeBranch}
                    className="inline-flex h-8 shrink-0 items-center rounded-md px-2 text-label font-medium text-brand-glow underline-offset-4 hover:underline"
                    data-change-branch
                  >
                    {k.change}
                  </AreaLink>
                )}
              </div>
              <p id={`${base}-br-hint`} className="mt-1.5 text-caption text-text-muted">
                {k.branchHint}
              </p>
            </div>
            <CustomerPicker
              id={`${base}-customer`}
              value={v.customer}
              onChange={(customer) => setV((x) => ({ ...x, customer }))}
              className="sm:col-span-2"
            />
            <TextField
              id={`${base}-od`}
              type="date"
              label={c.f.orderDate}
              value={v.orderDate}
              onChange={(e) => setV((x) => ({ ...x, orderDate: e.target.value }))}
            />
            <TextField
              id={`${base}-rd`}
              type="date"
              label={c.f.requestedDate}
              value={v.requestedDate}
              min={v.orderDate || undefined}
              error={dateBad ? k.dateError : null}
              onChange={(e) => setV((x) => ({ ...x, requestedDate: e.target.value }))}
            />
            <TextField
              id={`${base}-ref`}
              label={c.f.reference}
              value={v.reference}
              maxLength={60}
              onChange={(e) => setV((x) => ({ ...x, reference: e.target.value }))}
            />
            <TextField
              id={`${base}-note`}
              label={c.f.note}
              value={v.note}
              maxLength={1000}
              className="xl:col-span-3"
              onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p
              id={`${base}-why`}
              className={cn('text-caption', ready ? 'text-text-secondary' : 'text-text-muted')}
              data-create-hint
            >
              {!v.customer ? k.needCustomer : dateBad ? k.dateError : k.ready}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <AreaLink to={BASE} className={buttonClasses('ghost', 'md')}>
                {k.cancel}
              </AreaLink>
              <button
                type="submit"
                disabled={busy || !ready}
                aria-describedby={`${base}-why`}
                className={buttonClasses('primary', 'md', 'min-w-36')}
              >
                {busy ? c.saving : c.create}
              </button>
            </div>
          </div>
        </form>

        <aside
          aria-labelledby={`${base}-sum`}
          className={cn(DOC, 'min-w-0 md:grid md:grid-cols-2 lg:sticky lg:top-6 lg:block')}
          data-order-summary
        >
          <h2
            id={`${base}-sum`}
            className="border-b border-white/[0.07] px-5 py-4 text-body font-semibold text-text-primary md:col-span-2"
          >
            {k.summary}
          </h2>
          <div className="grid content-start gap-4 px-5 py-4 md:row-span-2 md:border-r md:border-white/[0.07] lg:border-r-0">
            <div>
              <p className="text-caption text-text-muted">{c.f.customer}</p>
              <p
                className={cn(
                  'mt-0.5 text-body font-semibold break-words',
                  v.customer ? 'text-text-primary' : 'text-text-muted',
                )}
                data-summary-customer
              >
                {v.customer ? (
                  <>
                    <span className="font-mono text-label text-brand-glow">{v.customer.code}</span>
                    <span className="block">{v.customer.name}</span>
                  </>
                ) : (
                  k.noCustomer
                )}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <SummaryFact
                term={c.f.orderDate}
                value={v.orderDate ? date(v.orderDate) : null}
                empty={k.notSet}
              />
              <SummaryFact
                term={c.f.requestedDate}
                value={v.requestedDate ? date(v.requestedDate) : null}
                empty={k.notSet}
              />
              <div className="col-span-2">
                <SummaryFact term={c.f.branch} value={branchText} empty={k.notSet} />
              </div>
              <div className="col-span-2">
                <SummaryFact
                  term={c.f.reference}
                  value={v.reference.trim() || null}
                  empty={k.notSet}
                />
              </div>
            </dl>
          </div>
          <div className="border-t border-white/[0.07] px-5 py-4 md:border-t-0 lg:border-t">
            <h3 className="text-label font-semibold text-text-primary">{k.linesTitle}</h3>
            <p className="mt-1.5 text-caption leading-relaxed text-text-muted">{k.linesNote}</p>
          </div>
          <div className="border-t border-white/[0.07] px-5 py-4">
            <h3 className="text-label font-semibold text-text-primary">{k.workflow}</h3>
            <ol className="mt-3 grid gap-2" data-workflow>
              {k.steps.map((step, i) => (
                <li
                  key={step}
                  aria-current={i === 0 ? 'step' : undefined}
                  className="flex items-start gap-2.5 text-caption leading-relaxed"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-px grid size-[1.125rem] shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold tabular-nums',
                      i === 0
                        ? 'bg-brand-primary/20 text-brand-glow shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)]'
                        : 'text-text-muted shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)]',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={i === 0 ? 'font-medium text-text-primary' : 'text-text-secondary'}
                  >
                    {step}
                    {i === 0 && <span className="sr-only">{` (${k.current})`}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** A DRAFT's header: only what changed is sent. */
function HeaderEditor({ o, save }: { o: SalesOrder; save: (body: object) => Promise<boolean> }) {
  const { c } = useSales();
  const [v, setV] = useState<HeaderValues>({
    customer: { id: o.customer.id, code: o.customer.code, name: o.customer.name, status: 'ACTIVE' },
    orderDate: o.orderDate,
    requestedDate: o.requestedDate ?? '',
    reference: o.customerReference ?? '',
    note: o.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, string | null> = {};
    if (v.customer && v.customer.id !== o.customer.id) body.customerId = v.customer.id;
    if (v.orderDate && v.orderDate !== o.orderDate) body.orderDate = v.orderDate;
    if (v.requestedDate !== (o.requestedDate ?? '')) body.requestedDate = v.requestedDate || null;
    if (v.reference.trim() !== (o.customerReference ?? ''))
      body.customerReference = v.reference.trim() || null;
    if (v.note.trim() !== (o.note ?? '')) body.note = v.note.trim() || null;
    if (!Object.keys(body).length) return;
    setBusy(true);
    await save(body);
    setBusy(false);
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
      data-header-editor
    >
      <HeaderFields v={v} set={setV} />
      <button
        type="submit"
        disabled={busy || !v.customer}
        className={buttonClasses('secondary', 'md', 'w-fit sm:col-span-2')}
      >
        {busy ? c.saving : c.save}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ one order

type Step = 'submit' | 'confirm' | 'cancel';

function OrderPage({ id }: { id: string }) {
  const { c, err } = useSales();
  const money = useMoney();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => salesApi.get(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Step | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return (
      <PageError error={state.error} back={<BackLink />}>
        {err(state.error)}
      </PageError>
    );
  const { order: o, timeline, fulfilment } = state.data;
  const run = async (work: () => Promise<SoDetail>, text: string | (() => string) = c.saved) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text: typeof text === 'function' ? text() : text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: err(e) });
      return false;
    }
  };
  const editable = o.actions.includes('edit');
  const steps = (['submit', 'confirm', 'cancel'] as const).filter((a) => o.actions.includes(a));
  const label = (s: Step) => (s === 'cancel' && o.status === 'DRAFT' ? c.act.discard : c.act[s]);
  const ask = (s: Step) => (s === 'cancel' && o.status === 'DRAFT' ? c.ask.discard : c.ask[s]);
  const cur = o.currency;
  return (
    <div className="grid grid-cols-1 gap-6" data-order={o.number} data-status={o.status}>
      <BackLink />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={o.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SoStatusPill status={o.status} />
          {o.availability && <AvailabilityPill state={o.availability} />}
          <span className="text-caption text-text-muted">{c.title}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      {!editable && !steps.length && o.status !== 'CANCELLED' && (
        <p className="text-caption text-text-muted" data-read-only>
          {c.readOnly}
        </p>
      )}

      <Section id="so-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.customer}>
            <span className="font-mono">{o.customer.code}</span> · {o.customer.name}
          </Fact>
          {o.customer.taxId && (
            <Fact term={c.f.taxId}>
              {o.customer.taxId}
              {o.customer.taxBranch ? ` (${o.customer.taxBranch})` : ''}
            </Fact>
          )}
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.orderDate}>{date(o.orderDate)}</Fact>
          <Fact term={c.f.requestedDate}>{o.requestedDate ? date(o.requestedDate) : '—'}</Fact>
          <Fact term={c.f.reference}>{o.customerReference ?? '—'}</Fact>
          <Fact term={c.f.createdBy}>{o.createdBy?.name ?? '—'}</Fact>
          {o.submittedAt && (
            <Fact
              term={c.f.submitted}
            >{`${dateTime(o.submittedAt)} · ${o.submittedBy?.name ?? ''}`}</Fact>
          )}
          {o.confirmedAt && (
            <Fact
              term={c.f.confirmed}
            >{`${dateTime(o.confirmedAt)} · ${o.confirmedBy?.name ?? ''}`}</Fact>
          )}
          {o.cancelledAt && (
            <Fact
              term={c.f.cancelled}
            >{`${dateTime(o.cancelledAt)} · ${o.cancelledBy?.name ?? ''}`}</Fact>
          )}
          {o.cancellationReason && (
            <Fact term={c.f.reason}>
              <span className="whitespace-pre-line">{o.cancellationReason}</span>
            </Fact>
          )}
          {o.note && (
            <Fact term={c.f.note}>
              <span className="whitespace-pre-line">{o.note}</span>
            </Fact>
          )}
        </Facts>
        {editable && (
          <HeaderEditor
            key={o.updatedAt}
            o={o}
            save={(body) => run(() => salesApi.update(o.id, body))}
          />
        )}
      </Section>

      <Section id="so-lines" title={`${c.f.lines} · ${o.lines.length}`}>
        {editable ? (
          <LinesEditor
            key={o.updatedAt}
            o={o}
            save={(lines) => run(() => salesApi.lines(o.id, lines))}
          />
        ) : (
          <ol className="grid grid-cols-1 gap-2" data-lines>
            {o.lines.map((l) => (
              <li
                key={l.id}
                className={cn(CARD, 'grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]')}
                data-line={l.lineNo}
              >
                <span className="min-w-0 text-label">
                  <span className="block break-words text-text-primary">
                    <span className="font-mono text-caption text-text-muted">#{l.lineNo}</span>{' '}
                    <span className="font-mono">{l.item.code}</span> · {l.item.name}
                  </span>
                  <span className="block text-caption text-text-secondary tabular-nums">
                    {c.f.ordered} <span className="font-semibold">{l.quantity}</span> {l.unit.code}
                  </span>
                  {l.availability && (
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-muted tabular-nums">
                      <AvailabilityPill state={l.availability.state} />
                      {l.availability.available !== null &&
                        `${c.f.available} ${l.availability.available} · ${c.f.onHand} ${l.availability.onHand}`}
                      {l.availability.shortage && l.availability.shortage !== '0' && (
                        <span className="text-[#f3cf8a]">{`${c.f.shortage} ${l.availability.shortage}`}</span>
                      )}
                    </span>
                  )}
                  {l.note && (
                    <span className="block text-caption whitespace-pre-line text-text-muted">
                      {l.note}
                    </span>
                  )}
                </span>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-caption sm:grid-cols-4">
                  {(
                    [
                      [c.f.unitPrice, money(l.unitPrice, undefined, true)],
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
              </li>
            ))}
          </ol>
        )}
        {o.status !== 'DRAFT' && (
          <p className="mt-3 text-caption text-text-muted">{c.progressNote}</p>
        )}
      </Section>

      {o.status === 'CONFIRMED' && (
        <Suspense fallback={<Loading label={c.loading} />}>
          <AllocationSection o={o} ful={fulfilment} run={run} />
        </Suspense>
      )}

      <Section id="so-totals" title={c.totals}>
        <Facts>
          <Fact term={c.f.subtotal}>
            <span className="tabular-nums">{money(o.subtotal, cur)}</span>
          </Fact>
          <Fact term={c.f.discountTotal}>
            <span className="tabular-nums">{money(o.discountTotal, cur)}</span>
          </Fact>
          <Fact term={c.f.taxTotal}>
            <span className="tabular-nums">{money(o.taxTotal, cur)}</span>
          </Fact>
          <Fact term={c.f.grandTotal}>
            <span className="font-semibold tabular-nums" data-grand-total>
              {money(o.grandTotal, cur)}
            </span>
          </Fact>
        </Facts>
        <p className="mt-3 text-caption text-text-muted">{c.taxNote}</p>
        {o.availability && <p className="mt-1 text-caption text-text-muted">{c.availNote}</p>}
      </Section>

      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={ask(open)}
              goLabel={label(open)}
              reason={
                open === 'cancel' ? (o.status === 'DRAFT' ? 'optional' : 'required') : undefined
              }
              onCancel={() => {
                setOpen(null);
                heading.current?.focus();
              }}
              onConfirm={async (reason) => {
                const target = {
                  submit: 'SUBMITTED',
                  confirm: 'CONFIRMED',
                  cancel: 'CANCELLED',
                } as const;
                if (await run(() => salesApi.act(o.id, open, reason), c.statuses[target[open]])) {
                  setOpen(null);
                  heading.current?.focus();
                }
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s === 'cancel' ? 'ghost' : 'primary', 'md')}
                  data-action={s}
                >
                  {label(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Section id="so-timeline" title={c.timeline}>
        <ol className="grid gap-2" data-timeline>
          {timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 text-label">
              <span className="font-semibold text-text-primary">
                {c.timelineTypes[t.type.replace('SALES_ORDER_', '')] ?? t.type}
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

// ------------------------------------------------------------------ draft lines

interface DraftLine {
  itemId: string;
  label: string;
  unit: string;
  precision: number;
  available: string | null;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  note: string;
}

type FieldKey = 'quantity' | 'unitPrice' | 'discountAmount' | 'taxRate';

/** The draft's lines, replaced whole on save. Shape is checked here; amounts are the server's. */
function LinesEditor({
  o,
  save,
}: {
  o: SalesOrder;
  save: (lines: SoLineInput[]) => Promise<boolean>;
}) {
  const { c } = useSales();
  const money = useMoney();
  const base = useId();
  const initial = () =>
    o.lines.map((l): DraftLine => ({
      itemId: l.item.id,
      label: `${l.item.code} · ${l.item.name}`,
      unit: l.unit.code,
      precision: l.unit.precision,
      available: l.availability?.available ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      taxRate: l.taxRate,
      note: l.note ?? '',
    }));
  const [lines, setLines] = useState<DraftLine[]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(lines) !== JSON.stringify(initial());
  const check = () => {
    const e: Record<string, string> = {};
    lines.forEach((l, i) => {
      const q = l.quantity.trim();
      if (!QTY.test(q) || !/[1-9]/.test(q)) e[`${i}-quantity`] = c.invalidNumber;
      else if (decimals(q) > l.precision)
        e[`${i}-quantity`] = l.precision ? c.places(l.precision) : c.wholeNumber;
      if (!PRICE.test(l.unitPrice.trim())) e[`${i}-unitPrice`] = c.invalidNumber;
      if (!AMOUNT.test(l.discountAmount.trim())) e[`${i}-discountAmount`] = c.invalidNumber;
      const t = l.taxRate.trim();
      if (!RATE.test(t) || Number(t) > 100) e[`${i}-taxRate`] = c.invalidNumber;
    });
    return e;
  };
  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (item: SoItem) =>
    setLines((ls) => [
      ...ls,
      {
        itemId: item.id,
        label: `${item.code} · ${item.name}`,
        unit: item.unit.code,
        precision: item.unit.precision,
        available: item.available,
        quantity: '1',
        unitPrice: '0',
        discountAmount: '0',
        taxRate: '7',
        note: '',
      },
    ]);
  const onSave = async () => {
    const found = check();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${base}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    await save(
      lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity.trim(),
        unitPrice: l.unitPrice.trim(),
        discountAmount: l.discountAmount.trim(),
        taxRate: l.taxRate.trim(),
        note: l.note.trim() || null,
      })),
    );
    setBusy(false);
  };
  const field = (i: number, key: FieldKey, label: string) => (
    <TextField
      id={`${base}-${i}-${key}`}
      label={label}
      inputMode="decimal"
      autoComplete="off"
      maxLength={19}
      value={lines[i]![key]}
      error={errors[`${i}-${key}`]}
      onChange={(e) => update(i, { [key]: e.target.value })}
      data-field={key}
    />
  );
  return (
    <div className="grid gap-4" data-lines-editor>
      <p className="text-caption text-text-muted">{lines.length ? c.draftNote : c.noLines}</p>
      <ol className="grid gap-2">
        {lines.map((l, i) => {
          const server = o.lines[i]?.item.id === l.itemId ? o.lines[i] : undefined;
          return (
            <li key={`${l.itemId}-${i}`} className={cn(CARD, 'grid gap-3')} data-draft-line={i + 1}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 text-label break-words">
                  <span className="font-mono text-caption text-text-muted">#{i + 1}</span>{' '}
                  <span className="font-mono">{l.label}</span>
                  {l.available !== null && (
                    <span className="block text-caption text-text-muted tabular-nums">
                      {c.f.available} {l.available} {l.unit}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {server?.availability && <AvailabilityPill state={server.availability.state} />}
                  {server && (
                    <span className="text-caption text-text-secondary tabular-nums">
                      {c.f.lineTotal} {money(server.lineTotal)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className={buttonClasses('ghost', 'md', 'px-3')}
                    aria-label={`${c.remove} #${i + 1} ${l.label}`}
                  >
                    {c.remove}
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {field(i, 'quantity', `${c.f.quantity} (${l.unit})`)}
                {field(i, 'unitPrice', c.f.unitPrice)}
                {field(i, 'discountAmount', c.f.discount)}
                {field(i, 'taxRate', c.f.taxRate)}
              </div>
              <TextField
                id={`${base}-${i}-note`}
                label={c.f.lineNote}
                value={l.note}
                maxLength={500}
                onChange={(e) => update(i, { note: e.target.value })}
              />
            </li>
          );
        })}
      </ol>
      {lines.length < 100 && <ItemSearch onPick={add} />}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void onSave()}
          className={buttonClasses('secondary', 'md', 'w-fit')}
          data-save-lines
        >
          {busy ? c.saving : c.saveLines}
        </button>
        {dirty && (
          <span role="status" className="text-caption text-[#f3cf8a]" data-unsaved>
            {c.unsaved}
          </span>
        )}
      </div>
    </div>
  );
}

/** Active items (server search, 2+ characters) with the branch's available quantity. */
function ItemSearch({ onPick }: { onPick: (i: SoItem) => void }) {
  const { c } = useSales();
  const id = useId();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [got, setGot] = useState<{ q: string; items: SoItem[] } | null>(null);
  const items = debounced.length >= 2 && got?.q === debounced ? got.items : [];
  useEffect(() => {
    let live = true;
    if (debounced.length >= 2) {
      salesApi.items(debounced).then(
        (r) => live && setGot({ q: debounced, items: r.items }),
        () => live && setGot({ q: debounced, items: [] }),
      );
    }
    return () => {
      live = false;
    };
  }, [debounced]);
  // ↓ / ↑ move between the search and its results, like the customer field above
  // (EP42.1); Tab and Enter keep working as before.
  const onArrow = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('li > button')];
    if (!list.length) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, list.length - 1) : at - 1;
    e.preventDefault();
    (next < 0 ? e.currentTarget.querySelector('input') : list[next])?.focus();
  };
  return (
    <div className="grid gap-2" data-item-search onKeyDown={onArrow}>
      <SearchBox
        id={id}
        label={c.addItem}
        value={q}
        onChange={setQ}
        placeholder={c.itemHint}
        describedBy={`${id}-n`}
      />
      <span id={`${id}-n`} className="sr-only" role="status">
        {items.length ? c.count(items.length) : ''}
      </span>
      {items.length > 0 && (
        <ul className="grid gap-1">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(i);
                  setQ('');
                }}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 text-left text-label hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span>
                  <span className="font-mono">{i.code}</span> · {i.name}
                </span>
                <span className="text-caption text-text-muted tabular-nums">
                  {i.available === null
                    ? c.avail.NOT_STOCK_TRACKED
                    : `${c.f.available} ${i.available} ${i.unit.code}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
