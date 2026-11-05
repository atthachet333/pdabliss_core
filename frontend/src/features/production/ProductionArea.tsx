import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Pill,
  Section,
} from '@/features/company-center/parts';
import { SearchBox } from '@/features/company-center/SearchBox';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useDebounced, usePaged } from '@/features/warehouse/whModel';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import {
  places,
  productionApi,
  QTY,
  type Bom,
  type BomAction,
  type BomDetail,
  type DemandRow,
  type Mo,
  type MoAction,
  type MoDetail,
  type Preview,
  type Priority,
  type ProductionContext,
  type ProductionItem,
} from './productionApi';
import {
  AvailPill,
  BackLink,
  BomStatusPill,
  ItemCell,
  ItemSearch,
  LINK,
  MaterialsTable,
  MaterialStatePill,
  MoStatusPill,
  PROD,
  ProductionNav,
  Table,
  TimelineList,
} from './prodParts';
import { useProd } from './productionCopy';

/*
 * /core/production/* (EP36) — Production planning in the Operations department,
 * one lazy chunk:
 *   index            overview counts (real facts only) and notes
 *   orders           server-paged list with filters (status, source, materials, dates, search)
 *   orders/new       a DRAFT: manual (finished item, branch) or from a sales demand line;
 *                    the active BOM revision and a server preview of the requirements
 *   orders/:id       the order: facts, demand, materials vs availability, draft editor,
 *                    submit / approve / reject / release / cancel as the server allows
 *   boms, boms/new, boms/:id   BOM revisions: list, draft editor, activate / retire / revise
 *   requirements     the branch's material requirements against available stock
 *   demand           confirmed sales demand eligible for production (read-only queue)
 * Requirements, availability and shortages are always the server's; availability is a
 * snapshot — production reserves and issues nothing.
 */

const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
/** EP37: the execution part of an order page and the material issues — their own lazy chunks. */
const ExecutionPanel = lazy(() => import('./ExecutionPanel'));
const IssuesArea = lazy(() => import('./IssuesArea'));
const OutputArea = lazy(() => import('./OutputArea'));
const OutputPanel = lazy(() => import('./OutputPanel'));
const EXECUTING: readonly string[] = ['APPROVED', 'READY', 'IN_PRODUCTION', 'PAUSED'];
const CARD = 'rounded-xl bg-white/[0.02] p-4';

export default function ProductionArea() {
  const { c, err } = useProd();
  const { state } = useLoad(productionApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{err(state.error)}</Notice>;
  const ctx = state.data;
  return (
    <div className="grid grid-cols-1 gap-6" data-production>
      <ProductionNav ctx={ctx} />
      <Routes>
        <Route index element={<Overview ctx={ctx} />} />
        <Route path="orders" element={<OrderList ctx={ctx} />} />
        <Route path="reservations" element={<OrderList key="r" ctx={ctx} stage="RESERVATION" />} />
        <Route path="execution" element={<OrderList key="e" ctx={ctx} stage="EXECUTION" />} />
        <Route
          path="output/*"
          element={
            <Suspense fallback={<Loading label={c.loading} />}>
              <OutputArea ctx={ctx} />
            </Suspense>
          }
        />
        <Route
          path="issues/*"
          element={
            <Suspense fallback={<Loading label={c.loading} />}>
              <IssuesArea />
            </Suspense>
          }
        />
        {ctx.orders.create && <Route path="orders/new" element={<NewOrder ctx={ctx} />} />}
        <Route path="orders/:id" element={<ById kind="order" />} />
        {ctx.bom.view && <Route path="boms" element={<BomList ctx={ctx} />} />}
        {ctx.bom.manage && <Route path="boms/new" element={<NewBom />} />}
        {ctx.bom.view && <Route path="boms/:id" element={<ById kind="bom" />} />}
        <Route path="requirements" element={<Requirements ctx={ctx} />} />
        <Route path="demand" element={<Demand ctx={ctx} />} />
      </Routes>
    </div>
  );
}

function ById({ kind }: { kind: 'order' | 'bom' }) {
  const { id } = useParams();
  return kind === 'order' ? <OrderPage key={id} id={id!} /> : <BomPage key={id} id={id!} />;
}

function useGo() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  return (to: string, state: object = {}) => void navigate(to, { state: { locale, ...state } });
}

// ------------------------------------------------------------------ overview

function Overview({ ctx }: { ctx: ProductionContext }) {
  const { c } = useProd();
  const tiles: [keyof ProductionContext['counts'], string][] = [
    ['myDrafts', `${PROD}/orders?status=DRAFT`],
    ['awaitingApproval', `${PROD}/orders?status=SUBMITTED`],
    ['approved', `${PROD}/orders?status=APPROVED`],
    ['ready', `${PROD}/orders?status=READY`],
    ['materialsShort', `${PROD}/orders?materials=SHORT`],
    ['demandToReview', `${PROD}/demand`],
    ['sourceCancelled', `${PROD}/orders`],
    ['inProduction', `${PROD}/execution`],
    ['paused', `${PROD}/orders?status=PAUSED`],
    ['draftIssues', `${PROD}/issues`],
    ['outputToReview', `${PROD}/output?status=SUBMITTED`],
    ['inReview', `${PROD}/orders?status=COMPLETION_REVIEW`],
  ];
  return (
    <>
      <PageTitle
        title={c.title}
        lead={c.lead}
        action={
          ctx.orders.create ? (
            <AreaLink to={`${PROD}/orders/new`} className={buttonClasses('primary', 'md')} data-new>
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
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-production-counts>
        {tiles.map(([key, to]) => (
          <li key={key}>
            <AreaLink
              to={to}
              className="grid min-h-11 w-full gap-1 rounded-xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-count={key}
            >
              <span className="text-caption text-text-muted">{c.counts[key]}</span>
              <span className="text-[1.5rem] font-semibold text-text-primary tabular-nums">
                {ctx.counts[key]}
              </span>
            </AreaLink>
          </li>
        ))}
      </ul>
      <p className="text-caption text-text-muted">{c.planningNote}</p>
      <p className="text-caption text-text-muted">{c.noStockNote}</p>
    </>
  );
}

// ------------------------------------------------------------------ order list

function OrderList({
  ctx,
  stage,
}: {
  ctx: ProductionContext;
  stage?: 'RESERVATION' | 'EXECUTION';
}) {
  const { c, err } = useProd();
  const { date } = useDateFormat();
  const base = useId();
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const keys = ['status', 'source', 'materials', 'branchId', 'from', 'to'] as const;
  const { data, error, more, showMore } = usePaged(
    (page) =>
      productionApi.list({
        ...Object.fromEntries(keys.map((k) => [k, get(k) || undefined])),
        q: debounced || undefined,
        stage,
        page,
        pageSize: 25,
      }),
    [...keys.map(get), debounced, stage],
  );
  const filter = (k: (typeof keys)[number], v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true, state: { locale } });
  };
  const select = (k: (typeof keys)[number], label: string, options: [string, string][]) => (
    <SelectField
      id={`${base}-${k}`}
      label={label}
      value={get(k)}
      onChange={(e) => filter(k, e.target.value)}
      data-filter={k}
    >
      <option value="">{c.f.any}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </SelectField>
  );
  return (
    <>
      <PageTitle
        title={
          stage === 'RESERVATION'
            ? c.nav.reservations
            : stage === 'EXECUTION'
              ? c.nav.execution
              : c.nav.orders
        }
        lead={c.ordersLead}
        action={
          ctx.orders.create ? (
            <AreaLink to={`${PROD}/orders/new`} className={buttonClasses('primary', 'md')} data-new>
              {c.newOrder}
            </AreaLink>
          ) : undefined
        }
      />
      <div role="search" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-count`}
        />
        {select('status', c.f.status, Object.entries(c.statuses))}
        {select('source', c.f.source, Object.entries(c.sources))}
        {select('materials', c.f.materials, [
          ['SHORT', c.materialStates.MATERIALS_SHORT],
          ['AVAILABLE', c.materialStates.MATERIALS_AVAILABLE],
        ])}
        {ctx.branches.length > 1 &&
          select(
            'branchId',
            c.f.branch,
            ctx.branches.map((b) => [b.id, `${b.code} · ${b.name}`]),
          )}
        <TextField
          id={`${base}-from`}
          type="date"
          label={c.f.from}
          value={get('from')}
          onChange={(e) => filter('from', e.target.value)}
        />
        <TextField
          id={`${base}-to`}
          type="date"
          label={c.f.to}
          value={get('to')}
          onChange={(e) => filter('to', e.target.value)}
        />
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
          {c.none}
        </p>
      ) : (
        <Table
          wide
          data="orders"
          rows={data.items}
          rowKey={(r) => r.number}
          cols={[
            {
              head: c.f.number,
              cell: (r) => (
                <AreaLink to={`${PROD}/orders/${encodeURIComponent(r.id)}`} className={LINK}>
                  {r.number}
                </AreaLink>
              ),
            },
            { head: c.f.item, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
            {
              head: c.f.quantity,
              end: true,
              cell: (r) => (
                <span className="whitespace-nowrap">{`${r.quantity} ${r.unit.code}`}</span>
              ),
            },
            { head: c.f.status, cell: (r) => <MoStatusPill status={r.status} /> },
            {
              head: c.f.availability,
              cell: (r) => (
                <span className="flex flex-wrap gap-1">
                  <MaterialStatePill state={r.materialState} />
                  {r.reservationState && (
                    <Pill tone="muted" data-reservation-state={r.reservationState}>
                      {c.reservationStates[r.reservationState]}
                    </Pill>
                  )}
                  {r.attention && (
                    <Pill tone="warning">{c.warnings.SOURCE_CANCELLED.split('—')[0]}</Pill>
                  )}
                </span>
              ),
            },
            {
              head: c.f.source,
              minor: true,
              cell: (r) =>
                r.salesOrder
                  ? `${r.salesOrder.number} #${r.salesOrder.lineNo}`
                  : c.sources[r.source],
            },
            { head: c.f.branch, minor: true, cell: (r) => r.branch.code },
            {
              head: c.f.start,
              minor: true,
              cell: (r) => (r.plannedStartDate ? date(r.plannedStartDate) : '—'),
            },
            { head: c.f.required, cell: (r) => (r.requiredDate ? date(r.requiredDate) : '—') },
          ]}
        />
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
      <p className="text-caption text-text-muted">{c.planningNote}</p>
    </>
  );
}

// ------------------------------------------------------------------ new order

interface PlanValues {
  quantity: string;
  start: string;
  required: string;
  priority: Priority;
  note: string;
}

function PlanFields({
  v,
  set,
  unit,
}: {
  v: PlanValues;
  set: (f: (v: PlanValues) => PlanValues) => void;
  unit?: { code: string; precision: number };
}) {
  const { c } = useProd();
  const base = useId();
  const bad =
    !!v.quantity && (!QTY.test(v.quantity) || (unit ? places(v.quantity) > unit.precision : false));
  return (
    <>
      <TextField
        id={`${base}-qty`}
        label={unit ? `${c.f.quantity} (${unit.code})` : c.f.quantity}
        inputMode="decimal"
        required
        value={v.quantity}
        onChange={(e) => set((x) => ({ ...x, quantity: e.target.value.trim() }))}
        error={bad ? c.errors.QUANTITY_PRECISION : undefined}
        data-field="quantity"
      />
      <SelectField
        id={`${base}-pr`}
        label={c.f.priority}
        value={v.priority}
        onChange={(e) => set((x) => ({ ...x, priority: e.target.value as Priority }))}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {c.priorities[p]}
          </option>
        ))}
      </SelectField>
      <TextField
        id={`${base}-st`}
        type="date"
        label={c.f.start}
        value={v.start}
        onChange={(e) => set((x) => ({ ...x, start: e.target.value }))}
      />
      <TextField
        id={`${base}-rq`}
        type="date"
        label={c.f.required}
        value={v.required}
        min={v.start || undefined}
        onChange={(e) => set((x) => ({ ...x, required: e.target.value }))}
      />
      <TextField
        id={`${base}-note`}
        label={c.f.note}
        value={v.note}
        maxLength={1000}
        className="sm:col-span-2"
        onChange={(e) => set((x) => ({ ...x, note: e.target.value }))}
      />
    </>
  );
}

const validQty = (q: string, precision: number) =>
  QTY.test(q) && /[1-9]/.test(q) && places(q) <= precision;

/** The server's requirements for a quantity of an active BOM — computed, never saved here. */
function RequirementsPreview({
  bomId,
  quantity,
  branchId,
  precision,
}: {
  bomId: string;
  quantity: string;
  branchId?: string;
  precision: number;
}) {
  const { c, err } = useProd();
  const debounced = useDebounced(quantity);
  const [got, setGot] = useState<{ key: string; p: Preview | null; e: unknown }>({
    key: '',
    p: null,
    e: null,
  });
  const key = `${bomId}/${debounced}/${branchId ?? ''}`;
  const ok = validQty(debounced, precision);
  useEffect(() => {
    let live = true;
    if (ok) {
      productionApi.preview({ bomId, quantity: debounced, branchId }).then(
        (p) => live && setGot({ key, p, e: null }),
        (e: unknown) => live && setGot({ key, p: null, e }),
      );
    }
    return () => {
      live = false;
    };
  }, [bomId, debounced, branchId, key, ok]);
  if (!ok || got.key !== key) return null;
  return (
    <Section id="mo-preview" title={c.preview} className="sm:col-span-2">
      {got.e ? (
        <Notice tone="error">{err(got.e)}</Notice>
      ) : got.p ? (
        <div className="grid gap-3" data-preview>
          <MaterialStatePill state={got.p.materialState} />
          <MaterialsTable materials={got.p.materials} />
          <p className="text-caption text-text-muted">{c.planningNote}</p>
        </div>
      ) : null}
    </Section>
  );
}

function NewOrder({ ctx }: { ctx: ProductionContext }) {
  const { c, err } = useProd();
  const go = useGo();
  const base = useId();
  const demand = (useLocation().state as { demand?: DemandRow } | null)?.demand ?? null;
  const [item, setItem] = useState<ProductionItem | null>(null);
  const [branchId, setBranchId] = useState(ctx.selectedBranch?.id ?? ctx.branches[0]?.id ?? '');
  const [v, setV] = useState<PlanValues>({
    quantity: demand && demand.suggested !== '0' ? demand.suggested : '',
    start: '',
    required: '',
    priority: 'NORMAL',
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unit = demand
    ? demand.unit
    : item
      ? { code: item.unit.code, precision: item.unit.precision }
      : undefined;
  const bom = demand ? demand.activeBom : (item?.activeBom ?? null);
  const ready =
    !!unit &&
    !!bom &&
    validQty(v.quantity, unit.precision) &&
    (!v.start || !v.required || v.required >= v.start);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await productionApi.create({
        ...(demand ? { salesOrderLineId: demand.lineId } : { itemId: item!.id, branchId }),
        bomId: bom!.id,
        quantity: v.quantity,
        plannedStartDate: v.start || null,
        requiredDate: v.required || null,
        priority: v.priority,
        note: v.note.trim() || null,
      });
      go(`${PROD}/orders/${encodeURIComponent(order.id)}`);
    } catch (x) {
      setError(err(x));
      setBusy(false);
    }
  };
  return (
    <>
      <BackLink to={demand ? `${PROD}/demand` : `${PROD}/orders`} />
      <PageTitle title={c.newOrder} lead={c.noStockNote} />
      {error && <Notice tone="error">{error}</Notice>}
      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
        data-new-order
      >
        {demand ? (
          <div className={cn(CARD, 'sm:col-span-2')} data-from-demand>
            <Facts>
              <Fact term={c.f.salesOrder}>{`${demand.salesOrder.number} #${demand.lineNo}`}</Fact>
              <Fact term={c.f.item}>
                <ItemCell code={demand.item.code} name={demand.item.name} />
              </Fact>
              <Fact term={c.f.branch}>{`${demand.branch.code} · ${demand.branch.name}`}</Fact>
              <Fact term={c.f.uncovered}>{`${demand.uncovered} ${demand.unit.code}`}</Fact>
              <Fact term={c.f.planned}>{`${demand.planned} ${demand.unit.code}`}</Fact>
            </Facts>
            {demand.planned !== '0' && (
              <p className="mt-3 text-caption text-[#f3cf8a]">
                {c.warnings.DEMAND_ALREADY_PLANNED}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:col-span-2">
            {item ? (
              <p
                className={cn(CARD, 'flex flex-wrap items-center justify-between gap-2 text-label')}
                data-picked={item.code}
              >
                <ItemCell code={item.code} name={item.name} />
                <button
                  type="button"
                  onClick={() => setItem(null)}
                  className={buttonClasses('ghost', 'md')}
                >
                  {c.remove(item.code)}
                </button>
              </p>
            ) : (
              <ItemSearch role="OUTPUT" label={c.pickItem} hint={c.itemHint} onPick={setItem} />
            )}
            {ctx.branches.length > 1 && (
              <SelectField
                id={`${base}-br`}
                label={c.f.branch}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {ctx.branches.map((b) => (
                  <option key={b.id} value={b.id}>{`${b.code} · ${b.name}`}</option>
                ))}
              </SelectField>
            )}
          </div>
        )}
        {(item || demand) && (
          <p className="text-label text-text-primary sm:col-span-2" data-bom-choice>
            <span className="text-text-muted">{c.f.bom}: </span>
            {bom ? (
              c.activeBom(bom.code, bom.revision)
            ) : (
              <span className="text-[#f3cf8a]">{c.noActiveBom}</span>
            )}
          </p>
        )}
        <PlanFields v={v} set={setV} unit={unit} />
        {bom && unit && (
          <RequirementsPreview
            bomId={bom.id}
            quantity={v.quantity}
            branchId={demand ? demand.branch.id : branchId || undefined}
            precision={unit.precision}
          />
        )}
        <button
          type="submit"
          disabled={busy || !ready}
          className={buttonClasses('primary', 'md', 'w-fit sm:col-span-2')}
        >
          {busy ? c.saving : c.create}
        </button>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ order page

/** The EP36 document steps (EP37 material and execution actions live in ExecutionPanel). */
type Step = Extract<MoAction, 'submit' | 'approve' | 'reject' | 'release' | 'cancel'>;

function OrderPage({ id }: { id: string }) {
  const { c, err } = useProd();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => productionApi.get(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Step | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return (
      <>
        <BackLink to={`${PROD}/orders`} />
        <Notice tone="error">{err(state.error)}</Notice>
      </>
    );
  const { order: o, timeline } = state.data;
  const run = async (work: () => Promise<MoDetail>, text: string = c.saved) => {
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
  const editable = o.actions.includes('edit');
  const steps = (['submit', 'approve', 'release', 'reject', 'cancel'] as const).filter((a) =>
    o.actions.includes(a),
  );
  const label = (s: Step) => (s === 'cancel' && o.status === 'DRAFT' ? c.act.discard : c.act[s]);
  const ask = (s: Step) => (s === 'cancel' && o.status === 'DRAFT' ? c.ask.discard : c.ask[s]);
  const close = () => {
    setOpen(null);
    heading.current?.focus();
  };
  const target: Record<Step, keyof typeof c.statuses> = {
    submit: 'SUBMITTED',
    approve: 'APPROVED',
    release: 'READY',
    reject: 'REJECTED',
    cancel: 'CANCELLED',
  };
  const who = (at: string | null, p: { name: string } | null) =>
    at ? `${dateTime(at)} · ${p?.name ?? ''}` : null;
  return (
    <div className="grid grid-cols-1 gap-6" data-order={o.number} data-status={o.status}>
      <BackLink to={`${PROD}/orders`} />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={o.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MoStatusPill status={o.status} />
          <MaterialStatePill state={o.materialState} />
          <Pill tone="muted">{c.sources[o.source]}</Pill>
          <span className="text-caption text-text-muted">{c.title}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      {o.warnings.map((w) => (
        <Notice key={w} tone="error">
          <span data-warning={w}>{c.warnings[w]}</span>
        </Notice>
      ))}
      {!editable && !steps.length && !['CANCELLED', 'REJECTED'].includes(o.status) && (
        <p className="text-caption text-text-muted" data-read-only>
          {c.readOnly}
        </p>
      )}

      <Section id="mo-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.item}>
            <ItemCell code={o.item.code} name={o.item.name} />
          </Fact>
          <Fact term={c.f.quantity}>
            <span className="font-semibold tabular-nums">{`${o.quantity} ${o.unit.code}`}</span>
          </Fact>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.bom}>
            {o.bom
              ? `${o.bom.code} · ${c.f.revision} ${o.bom.revision}${o.bomOutputQuantity ? ` · ${c.f.output} ${o.bomOutputQuantity} ${o.unit.code}` : ''}`
              : '—'}
          </Fact>
          <Fact term={c.f.priority}>{c.priorities[o.priority]}</Fact>
          <Fact term={c.f.start}>{o.plannedStartDate ? date(o.plannedStartDate) : '—'}</Fact>
          <Fact term={c.f.required}>{o.requiredDate ? date(o.requiredDate) : '—'}</Fact>
          {o.salesOrder && (
            <Fact term={c.f.salesOrder}>
              {`${o.salesOrder.number} #${o.salesOrder.lineNo}`}
              {o.salesOrder.requestedDate &&
                ` · ${c.f.requestedDate} ${date(o.salesOrder.requestedDate)}`}
            </Fact>
          )}
          <Fact term={c.f.createdBy}>{o.createdBy?.name ?? '—'}</Fact>
          {(
            [
              [c.f.submitted, who(o.submittedAt, o.submittedBy)],
              [c.f.approved, who(o.approvedAt, o.approvedBy)],
              [c.f.released, who(o.releasedAt, o.releasedBy)],
              [c.f.rejected, who(o.rejectedAt, o.rejectedBy)],
              [c.f.cancelled, who(o.cancelledAt, o.cancelledBy)],
            ] as const
          ).map(
            ([t, v]) =>
              v && (
                <Fact key={t} term={t}>
                  {v}
                </Fact>
              ),
          )}
          {(o.rejectionReason ?? o.cancellationReason) && (
            <Fact term={c.f.reason}>
              <span className="whitespace-pre-line">
                {o.rejectionReason ?? o.cancellationReason}
              </span>
            </Fact>
          )}
          {o.note && (
            <Fact term={c.f.note}>
              <span className="whitespace-pre-line">{o.note}</span>
            </Fact>
          )}
        </Facts>
        {editable && (
          <PlanEditor
            key={o.updatedAt}
            o={o}
            save={(body) => run(() => productionApi.update(o.id, body))}
          />
        )}
      </Section>

      {o.demand && (
        <Section id="mo-demand" title={c.nav.demand}>
          <dl
            className="grid grid-cols-2 gap-3 text-label sm:grid-cols-3 lg:grid-cols-6"
            data-demand
          >
            {(
              [
                [c.f.ordered, o.demand.ordered],
                [c.f.reserved, o.demand.reserved],
                [c.f.dispatched, o.demand.dispatched],
                [c.f.open, o.demand.open],
                [c.f.plannedElsewhere, o.demand.plannedElsewhere],
              ] as const
            ).map(([t, v]) => (
              <div key={t} className={CARD}>
                <dt className="text-caption text-text-muted">{t}</dt>
                <dd className="font-semibold tabular-nums">{`${v} ${o.unit.code}`}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section id="mo-materials" title={`${c.f.materials} · ${o.materials.length}`}>
        {o.materials.length ? (
          <MaterialsTable materials={o.materials} />
        ) : (
          <p className="text-label text-text-secondary">{c.errors.BOM_REQUIRED}</p>
        )}
        <p className="mt-3 text-caption text-text-muted">
          {o.frozen ? c.frozenNote : c.planningNote}
        </p>
      </Section>

      {(EXECUTING.includes(o.status) || o.reservations.length > 0 || o.issues.length > 0) && (
        <Suspense fallback={<Loading label={c.loading} />}>
          <ExecutionPanel o={o} run={run} focusHeading={() => heading.current?.focus()} />
        </Suspense>
      )}

      {o.output && (
        <Suspense fallback={<Loading label={c.loading} />}>
          <OutputPanel o={o} run={run} focusHeading={() => heading.current?.focus()} />
        </Suspense>
      )}

      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={ask(open)}
              goLabel={label(open)}
              reason={
                open === 'reject' || (open === 'cancel' && o.status !== 'DRAFT')
                  ? 'required'
                  : open === 'cancel'
                    ? 'optional'
                    : undefined
              }
              onCancel={close}
              onConfirm={async (reason) => {
                if (
                  await run(() => productionApi.act(o.id, open, reason), c.statuses[target[open]])
                )
                  close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(
                    s === 'cancel' || s === 'reject' ? 'ghost' : 'primary',
                    'md',
                  )}
                  data-action={s}
                >
                  {label(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Section id="mo-timeline" title={c.timeline}>
        <TimelineList items={timeline} date={dateTime} />
      </Section>
    </div>
  );
}

/** A DRAFT's plan: only what changed is sent; the server recalculates the requirements. */
function PlanEditor({ o, save }: { o: Mo; save: (body: object) => Promise<boolean> }) {
  const { c } = useProd();
  const initial: PlanValues = {
    quantity: o.quantity,
    start: o.plannedStartDate ?? '',
    required: o.requiredDate ?? '',
    priority: o.priority,
    note: o.note ?? '',
  };
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const body: Record<string, unknown> = {};
  if (v.quantity !== initial.quantity) body.quantity = v.quantity;
  if (v.start !== initial.start) body.plannedStartDate = v.start || null;
  if (v.required !== initial.required) body.requiredDate = v.required || null;
  if (v.priority !== initial.priority) body.priority = v.priority;
  if (v.note !== initial.note) body.note = v.note.trim() || null;
  const dirty = Object.keys(body).length > 0;
  return (
    <form
      noValidate
      className="mt-5 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || !validQty(v.quantity, o.unit.precision)) return;
        setBusy(true);
        void save(body).finally(() => setBusy(false));
      }}
      data-plan-editor
    >
      <PlanFields v={v} set={setV} unit={o.unit} />
      <button
        type="submit"
        disabled={busy || !dirty}
        className={buttonClasses('secondary', 'md', 'w-fit')}
      >
        {busy ? c.saving : c.save}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ BOMs

function BomList({ ctx }: { ctx: ProductionContext }) {
  const { c, err } = useProd();
  const { date } = useDateFormat();
  const base = useId();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) =>
      productionApi.boms({
        status: status || undefined,
        q: debounced || undefined,
        page,
        pageSize: 25,
      }),
    [status, debounced],
  );
  return (
    <>
      <PageTitle
        title={c.nav.boms}
        lead={c.bomLead}
        action={
          ctx.bom.manage ? (
            <AreaLink
              to={`${PROD}/boms/new`}
              className={buttonClasses('primary', 'md')}
              data-new-bom
            >
              {c.newBom}
            </AreaLink>
          ) : undefined
        }
      />
      <div role="search" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-n`}
        />
        <SelectField
          id={`${base}-s`}
          label={c.f.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-filter="bom-status"
        >
          <option value="">{c.f.any}</option>
          {Object.entries(c.bomStatuses).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-n`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.none}
        </p>
      ) : (
        <Table
          data="boms"
          rows={data.items}
          rowKey={(b) => b.id}
          cols={[
            {
              head: c.f.bom,
              cell: (b) => (
                <AreaLink to={`${PROD}/boms/${encodeURIComponent(b.id)}`} className={LINK}>
                  {`${b.code} · ${c.f.revision} ${b.revision}`}
                </AreaLink>
              ),
            },
            { head: c.f.item, cell: (b) => <ItemCell code={b.item.code} name={b.item.name} /> },
            { head: c.f.status, cell: (b) => <BomStatusPill status={b.status} /> },
            { head: c.f.output, end: true, cell: (b) => `${b.outputQuantity} ${b.unit.code}` },
            { head: c.f.lines, end: true, minor: true, cell: (b) => b.lineCount },
            {
              head: c.f.activatedAt,
              minor: true,
              cell: (b) => (b.activatedAt ? date(b.activatedAt) : '—'),
            },
          ]}
        />
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
    </>
  );
}

interface DraftLine {
  itemId: string;
  code: string;
  name: string;
  unit: { code: string; precision: number };
  quantity: string;
}

/** BOM output quantity and materials: shape checked here, validated by the server. */
function BomEditor({
  outputUnit,
  initial,
  submitLabel,
  onSave,
  busy,
}: {
  outputUnit: { code: string; precision: number } | null;
  initial: { output: string; lines: DraftLine[]; note: string };
  submitLabel: string;
  onSave: (v: {
    outputQuantity: string;
    note: string | null;
    lines: { itemId: string; quantity: string }[];
  }) => void;
  busy: boolean;
}) {
  const { c } = useProd();
  const base = useId();
  const [output, setOutput] = useState(initial.output);
  const [note, setNote] = useState(initial.note);
  const [lines, setLines] = useState(initial.lines);
  const okOut = !!outputUnit && validQty(output, outputUnit.precision);
  const ok = okOut && lines.every((l) => validQty(l.quantity, l.unit.precision));
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok)
          onSave({
            outputQuantity: output,
            note: note.trim() || null,
            lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
          });
      }}
      data-bom-editor
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${base}-out`}
          label={outputUnit ? `${c.f.output} (${outputUnit.code})` : c.f.output}
          inputMode="decimal"
          value={output}
          onChange={(e) => setOutput(e.target.value.trim())}
          error={output && !okOut ? c.errors.QUANTITY_PRECISION : undefined}
          data-field="output"
        />
        <TextField
          id={`${base}-note`}
          label={c.f.note}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-label font-medium text-text-primary">{c.f.lines}</legend>
        <ol className="grid gap-2" data-bom-lines>
          {lines.map((l, i) => (
            <li
              key={l.itemId}
              className={cn(CARD, 'grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]')}
              data-line={l.code}
            >
              <span className="min-w-0 text-label">
                <span className="font-mono text-caption text-text-muted">#{i + 1}</span>{' '}
                <ItemCell code={l.code} name={l.name} />
              </span>
              <TextField
                id={`${base}-q${i}`}
                label={`${c.f.requiredQty} (${l.unit.code})`}
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) =>
                  setLines((xs) =>
                    xs.map((x, j) => (j === i ? { ...x, quantity: e.target.value.trim() } : x)),
                  )
                }
                error={
                  l.quantity && !validQty(l.quantity, l.unit.precision)
                    ? c.errors.QUANTITY_PRECISION
                    : undefined
                }
              />
              <button
                type="button"
                onClick={() => setLines((xs) => xs.filter((_, j) => j !== i))}
                className={buttonClasses('ghost', 'md')}
              >
                {c.remove(l.code)}
              </button>
            </li>
          ))}
        </ol>
        <ItemSearch
          role="MATERIAL"
          label={c.addMaterial}
          hint={c.materialHint}
          onPick={(m) =>
            setLines((xs) =>
              xs.some((x) => x.itemId === m.id)
                ? xs
                : [
                    ...xs,
                    {
                      itemId: m.id,
                      code: m.code,
                      name: m.name,
                      unit: { code: m.unit.code, precision: m.unit.precision },
                      quantity: '',
                    },
                  ],
            )
          }
        />
      </fieldset>
      <button
        type="submit"
        disabled={busy || !ok}
        className={buttonClasses('primary', 'md', 'w-fit')}
      >
        {busy ? c.saving : submitLabel}
      </button>
    </form>
  );
}

function NewBom() {
  const { c, err } = useProd();
  const go = useGo();
  const [item, setItem] = useState<ProductionItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <BackLink to={`${PROD}/boms`} />
      <PageTitle title={c.newBom} lead={c.bomLead} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid max-w-4xl gap-4" data-new-bom-form>
        {item ? (
          <p
            className={cn(CARD, 'flex flex-wrap items-center justify-between gap-2 text-label')}
            data-picked={item.code}
          >
            <ItemCell code={item.code} name={item.name} />
            <button
              type="button"
              onClick={() => setItem(null)}
              className={buttonClasses('ghost', 'md')}
            >
              {c.remove(item.code)}
            </button>
          </p>
        ) : (
          <ItemSearch role="OUTPUT" label={c.pickItem} hint={c.itemHint} onPick={setItem} />
        )}
        {item && (
          <BomEditor
            outputUnit={item.unit}
            initial={{ output: '1', lines: [], note: '' }}
            submitLabel={c.create}
            busy={busy}
            onSave={(v) => {
              setBusy(true);
              setError(null);
              productionApi.createBom({ itemId: item.id, ...v }).then(
                ({ bom }) => go(`${PROD}/boms/${encodeURIComponent(bom.id)}`),
                (x: unknown) => {
                  setError(err(x));
                  setBusy(false);
                },
              );
            }}
          />
        )}
      </div>
    </>
  );
}

function BomPage({ id }: { id: string }) {
  const { c, err } = useProd();
  const { date, dateTime } = useDateFormat();
  const go = useGo();
  const { state, set } = useLoad(() => productionApi.bom(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Exclude<BomAction, 'edit'> | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return (
      <>
        <BackLink to={`${PROD}/boms`} />
        <Notice tone="error">{err(state.error)}</Notice>
      </>
    );
  const { bom: b, timeline } = state.data;
  const run = async (work: () => Promise<BomDetail>, text: string = c.saved) => {
    setNotice(null);
    try {
      const d = await work();
      if (d.bom.id !== b.id) {
        go(`${PROD}/boms/${encodeURIComponent(d.bom.id)}`);
        return true;
      }
      set(d);
      setNotice({ tone: 'success', text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: err(e) });
      return false;
    }
  };
  const steps = (['activate', 'revise', 'retire'] as const).filter((a) => b.actions.includes(a));
  const close = () => {
    setOpen(null);
    heading.current?.focus();
  };
  return (
    <div
      className="grid grid-cols-1 gap-6"
      data-bom={`${b.code}/${b.revision}`}
      data-status={b.status}
    >
      <BackLink to={`${PROD}/boms`} />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={`${b.code} · ${c.f.revision} ${b.revision}`} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BomStatusPill status={b.status} />
          <span className="text-caption text-text-muted">{c.nav.boms}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      <Section id="bom-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.item}>
            <ItemCell code={b.item.code} name={b.item.name} />
          </Fact>
          <Fact term={c.f.output}>{`${b.outputQuantity} ${b.unit.code}`}</Fact>
          <Fact term={c.f.createdBy}>{b.createdBy?.name ?? '—'}</Fact>
          {b.activatedAt && (
            <Fact
              term={c.f.activatedAt}
            >{`${dateTime(b.activatedAt)} · ${b.activatedBy?.name ?? ''}`}</Fact>
          )}
          {b.retiredAt && (
            <Fact
              term={c.f.retiredAt}
            >{`${dateTime(b.retiredAt)} · ${b.retiredBy?.name ?? ''}`}</Fact>
          )}
          {b.retirementReason && <Fact term={c.f.reason}>{b.retirementReason}</Fact>}
          <Fact term={c.f.usedBy}>{b.orderCount}</Fact>
          {b.note && (
            <Fact term={c.f.note}>
              <span className="whitespace-pre-line">{b.note}</span>
            </Fact>
          )}
        </Facts>
      </Section>
      <Section id="bom-lines" title={`${c.f.lines} · ${b.lines.length}`}>
        {b.actions.includes('edit') ? (
          <BomEditor
            key={b.updatedAt}
            outputUnit={b.unit}
            initial={{
              output: b.outputQuantity,
              note: b.note ?? '',
              lines: b.lines.map((l) => ({
                itemId: l.item.id,
                code: l.item.code,
                name: l.item.name,
                unit: l.unit,
                quantity: l.quantity,
              })),
            }}
            submitLabel={c.save}
            busy={busy}
            onSave={(v) => {
              setBusy(true);
              void run(() => productionApi.updateBom(b.id, v)).finally(() => setBusy(false));
            }}
          />
        ) : (
          <BomLines b={b} />
        )}
      </Section>
      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={c.ask[open]}
              goLabel={c.act[open]}
              reason={
                open === 'retire' ? (b.status === 'ACTIVE' ? 'required' : 'optional') : undefined
              }
              onCancel={close}
              onConfirm={async (reason) => {
                if (await run(() => productionApi.bomAct(b.id, open, reason))) close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s === 'retire' ? 'ghost' : 'primary', 'md')}
                  data-action={s}
                >
                  {c.act[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Section id="bom-revisions" title={c.f.revisions}>
        <ol className="grid gap-1" data-revisions>
          {b.revisions.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 text-label">
              {r.id === b.id ? (
                <span className="font-mono font-semibold">{`${c.f.revision} ${r.revision}`}</span>
              ) : (
                <AreaLink to={`${PROD}/boms/${encodeURIComponent(r.id)}`} className={LINK}>
                  {`${c.f.revision} ${r.revision}`}
                </AreaLink>
              )}
              <BomStatusPill status={r.status} />
              <span className="text-caption text-text-muted">{date(r.updatedAt)}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section id="bom-timeline" title={c.timeline}>
        <TimelineList items={timeline} date={dateTime} />
      </Section>
    </div>
  );
}

function BomLines({ b }: { b: Bom }) {
  const { c } = useProd();
  return (
    <Table
      data="bom-lines"
      rows={b.lines}
      rowKey={(l) => String(l.lineNo)}
      cols={[
        { head: '#', cell: (l) => l.lineNo },
        { head: c.f.material, cell: (l) => <ItemCell code={l.item.code} name={l.item.name} /> },
        {
          head: `${c.f.perBase} ${b.outputQuantity} ${b.unit.code}`,
          end: true,
          cell: (l) => `${l.quantity} ${l.unit.code}`,
        },
      ]}
    />
  );
}

// ------------------------------------------------------------------ requirements + demand

function BranchPicker({
  ctx,
  value,
  onChange,
}: {
  ctx: ProductionContext;
  value: string;
  onChange: (v: string) => void;
}) {
  const { c } = useProd();
  const id = useId();
  if (ctx.branches.length < 2) return null;
  return (
    <SelectField
      id={id}
      label={c.f.branch}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-sm"
    >
      {ctx.branches.map((b) => (
        <option key={b.id} value={b.id}>{`${b.code} · ${b.name}`}</option>
      ))}
    </SelectField>
  );
}

function Requirements({ ctx }: { ctx: ProductionContext }) {
  const { c, err } = useProd();
  const { date } = useDateFormat();
  const [branchId, setBranchId] = useState(ctx.selectedBranch?.id ?? ctx.branches[0]?.id ?? '');
  const [shortOnly, setShortOnly] = useState(false);
  const [data, setData] = useState<{
    key: string;
    items: Awaited<ReturnType<typeof productionApi.requirements>>['items'];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let live = true;
    productionApi.requirements(branchId || undefined).then(
      (r) => live && setData({ key: branchId, items: r.items }),
      (e: unknown) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [branchId]);
  const rows =
    data?.key === branchId ? data.items.filter((r) => !shortOnly || r.shortage !== '0') : null;
  return (
    <>
      <PageTitle title={c.nav.requirements} lead={c.requirementsLead} />
      <div className="flex flex-wrap items-end gap-4">
        <BranchPicker ctx={ctx} value={branchId} onChange={setBranchId} />
        <label className="flex min-h-11 items-center gap-2 text-label text-text-primary">
          <input
            type="checkbox"
            checked={shortOnly}
            onChange={(e) => setShortOnly(e.target.checked)}
            className="size-6 accent-[var(--color-brand-primary)]"
            data-filter="short"
          />
          {c.f.shortOnly}
        </label>
      </div>
      {error && !rows ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !rows ? (
        <Loading label={c.loading} />
      ) : rows.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.none}
        </p>
      ) : (
        <Table
          data="requirements"
          rows={rows}
          rowKey={(r) => r.item.id}
          cols={[
            { head: c.f.material, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
            {
              head: c.f.requiredQty,
              end: true,
              cell: (r) => (
                <span className="font-semibold whitespace-nowrap">{`${r.required} ${r.unit.code}`}</span>
              ),
            },
            { head: c.f.available, end: true, cell: (r) => `${r.available} ${r.unit.code}` },
            {
              head: c.f.shortage,
              end: true,
              cell: (r) => (
                <span
                  className={cn(
                    'whitespace-nowrap',
                    r.shortage !== '0' && 'font-semibold text-[#f3cf8a]',
                  )}
                  data-shortage={r.shortage}
                >
                  {`${r.shortage} ${r.unit.code}`}
                </span>
              ),
            },
            { head: c.f.availability, cell: (r) => <AvailPill state={r.state} /> },
            { head: c.f.orders, end: true, minor: true, cell: (r) => r.orderCount },
            {
              head: c.f.earliest,
              minor: true,
              cell: (r) => (r.earliestRequiredDate ? date(r.earliestRequiredDate) : '—'),
            },
          ]}
        />
      )}
      <p className="text-caption text-text-muted">{c.planningNote}</p>
    </>
  );
}

function Demand({ ctx }: { ctx: ProductionContext }) {
  const { c, err } = useProd();
  const { date } = useDateFormat();
  const go = useGo();
  const base = useId();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) => productionApi.demand({ q: debounced || undefined, page, pageSize: 25 }),
    [debounced],
  );
  const qty = (v: string, r: DemandRow) => `${v} ${r.unit.code}`;
  const cols: {
    head: string;
    minor?: boolean;
    end?: boolean;
    cell: (r: DemandRow) => ReactNode;
  }[] = [
    {
      head: c.f.salesOrder,
      cell: (r) => (
        <span className="font-mono font-semibold whitespace-nowrap">{`${r.salesOrder.number} #${r.lineNo}`}</span>
      ),
    },
    { head: c.f.item, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
    {
      head: c.f.requestedDate,
      minor: true,
      cell: (r) => (r.salesOrder.requestedDate ? date(r.salesOrder.requestedDate) : '—'),
    },
    { head: c.f.ordered, end: true, cell: (r) => qty(r.ordered, r) },
    { head: c.f.reserved, end: true, minor: true, cell: (r) => qty(r.reserved, r) },
    { head: c.f.open, end: true, cell: (r) => qty(r.open, r) },
    { head: c.f.share, end: true, minor: true, cell: (r) => qty(r.availableShare, r) },
    { head: c.f.planned, end: true, cell: (r) => qty(r.planned, r) },
    {
      head: c.f.suggested,
      end: true,
      cell: (r) => (
        <span
          className={cn('font-semibold', r.suggested !== '0' && 'text-[#f3cf8a]')}
          data-suggested={r.suggested}
        >
          {qty(r.suggested, r)}
        </span>
      ),
    },
    {
      head: c.f.orders,
      cell: (r) => (
        <span className="flex flex-wrap gap-2">
          {r.orders.map((o) => (
            <AreaLink key={o.id} to={`${PROD}/orders/${encodeURIComponent(o.id)}`} className={LINK}>
              {o.number}
            </AreaLink>
          ))}
          {ctx.orders.create && r.activeBom && (
            <button
              type="button"
              className={buttonClasses('secondary', 'md')}
              onClick={() => go(`${PROD}/orders/new`, { demand: r })}
              data-create-from={r.lineId}
            >
              {c.createFromDemand}
            </button>
          )}
          {!r.activeBom && <span className="text-caption text-text-muted">{c.noActiveBom}</span>}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageTitle title={c.nav.demand} lead={c.demandLead} />
      <p className="text-caption text-text-muted">{c.demandFormula}</p>
      <div role="search" className="max-w-md">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-n`}
        />
      </div>
      <p id={`${base}-n`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.none}
        </p>
      ) : (
        <Table wide data="demand" rows={data.items} rowKey={(r) => r.lineId} cols={cols} />
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
    </>
  );
}
