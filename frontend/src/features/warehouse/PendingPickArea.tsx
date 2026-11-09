import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import { Loading, PageError, PageTitle, Pill } from '@/features/company-center/parts';
import { SearchBox } from '@/features/company-center/SearchBox';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';
import { whApi, type PickOrder, type WarehouseContext } from './whApi';
import { WH_COPY, whError } from './whCopy';
import { WH, useDebounced, usePaged } from './whModel';
import { ExpiryPill, ShowMore, WarehouseNav } from './whParts';

/*
 * /core/warehouse/pending-pick (EP34) — confirmed sales orders with stock
 * reserved in the member's branches: what to prepare and WHERE it is
 * (location, lot, expiry). Read-only: picking, packing and delivery arrive in
 * EP35. The API sends no customer, price, discount, tax or total — there is
 * nothing commercial here to hide.
 */

const th = {
  title: 'รอหยิบสินค้า',
  lead: 'คำสั่งขายที่ยืนยันแล้วและจองสต็อกไว้ — สร้างใบหยิบ แล้วหยิบจากตำแหน่งและล็อตที่ระบุ',
  readiness: 'ความพร้อม',
  ready: { NOT_READY: 'ยังไม่พร้อม', PARTIALLY_READY: 'พร้อมบางส่วน', READY: 'พร้อมหยิบ' },
  searchHint: 'เลขที่คำสั่งขาย หรือรหัสสินค้า',
  requested: 'วันที่ลูกค้าต้องการ',
  ordered: 'สั่ง',
  reserved: 'จองแล้ว',
  short: 'ขาด',
  none: 'ไม่มีคำสั่งขายที่รอหยิบ',
  noPick: 'ยังไม่มีสต็อกจองไว้สำหรับรายการนี้',
  count: (n: number) => `${n} คำสั่งขาย`,
  createPick: 'สร้างใบหยิบ',
  toPick: 'รอหยิบ',
};
type PickCopy = typeof th;
const PICK_COPY: Localized<PickCopy> = {
  th,
  en: {
    title: 'Pending pick',
    lead: 'Confirmed sales orders with stock reserved — create a pick, then pick from the location and lot shown.',
    readiness: 'Readiness',
    ready: { NOT_READY: 'Not ready', PARTIALLY_READY: 'Partly ready', READY: 'Ready to pick' },
    searchHint: 'Sales order number or item code',
    requested: 'Requested date',
    ordered: 'Ordered',
    reserved: 'Reserved',
    short: 'Short',
    none: 'No sales orders are waiting to be picked.',
    noPick: 'No stock is reserved for this line yet.',
    count: (n: number) => `${n} ${n === 1 ? 'sales order' : 'sales orders'}`,
    createPick: 'Create pick',
    toPick: 'To pick',
  },
  'zh-CN': {
    title: '待拣货',
    lead: '已确认且已预留库存的销售订单 — 创建拣货单，按所示库位和批次拣货。',
    readiness: '就绪状态',
    ready: { NOT_READY: '未就绪', PARTIALLY_READY: '部分就绪', READY: '可拣货' },
    searchHint: '销售订单号或物料代码',
    requested: '客户要求日期',
    ordered: '订购',
    reserved: '已预留',
    short: '短缺',
    none: '没有待拣货的销售订单。',
    noPick: '此行尚未预留库存。',
    count: (n: number) => `${n} 张销售订单`,
    createPick: '创建拣货单',
    toPick: '待拣',
  },
};

export default function PendingPickArea() {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return <PageError error={state.error}>{whError(state.error, c, cc)}</PageError>;
  return <PickList ctx={state.data} />;
}

function PickList({ ctx }: { ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const p = useCopy(PICK_COPY);
  const cc = useCopy(CONTROL_COPY);
  const base = useId();
  const [readiness, setReadiness] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) => whApi.pendingPick({ readiness, q: debounced, page, pageSize: 20 }),
    [readiness, debounced],
  );
  return (
    <div className="grid grid-cols-1 gap-6" data-pending-pick>
      <PageTitle title={p.title} lead={p.lead} />
      <WarehouseNav ctx={ctx} />
      <div role="search" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={p.searchHint}
          describedBy={`${base}-count`}
        />
        <SelectField
          id={`${base}-r`}
          label={p.readiness}
          value={readiness}
          onChange={(e) => setReadiness(e.target.value)}
          data-filter="readiness"
        >
          <option value="">{c.f.any}</option>
          <option value="READY">{p.ready.READY}</option>
          <option value="PARTIALLY_READY">{p.ready.PARTIALLY_READY}</option>
        </SelectField>
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? p.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{whError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {p.none}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3" data-pick-orders>
          {data.items.map((o) => (
            <PickCard key={o.id} o={o} canPick={ctx.fulfilment.pick} />
          ))}
        </ul>
      )}
      <ShowMore visible={!!data?.hasMore} busy={more} onClick={showMore} />
    </div>
  );
}

function PickCard({ o, canPick }: { o: PickOrder; canPick: boolean }) {
  const p = useCopy(PICK_COPY);
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { date } = useDateFormat();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = o.lines.some((l) => l.picks.some((x) => x.toPick !== '0'));
  // EP35: a pick of everything reserved and not yet claimed (the server decides lines, FEFO).
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await apiRequest<{ pick: { id: string } }>('POST', '/api/v1/warehouse/picks', {
        salesOrderId: o.id,
      });
      void navigate(`${WH}/picks/${encodeURIComponent(d.pick.id)}`, { state: { locale } });
    } catch (e) {
      setError(whError(e, c, cc));
      setBusy(false);
    }
  };
  return (
    <li
      className="grid gap-3 rounded-xl bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
      data-pick-order={o.number}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-label font-semibold text-text-primary">{o.number}</h2>
        <Pill tone={o.readiness === 'READY' ? 'teal' : 'warning'} data-readiness={o.readiness}>
          {p.ready[o.readiness]}
        </Pill>
      </div>
      <p className="text-caption text-text-muted">
        {`${o.branch.code} · ${o.branch.name}`} · {p.requested}:{' '}
        {o.requestedDate ? date(o.requestedDate) : '—'}
      </p>
      <ol className="grid gap-2">
        {o.lines.map((l) => (
          <li key={l.lineNo} className="grid gap-1.5 border-t border-white/[0.06] pt-2 text-label">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="min-w-0 break-words">
                <span className="font-mono">{l.item.code}</span> · {l.item.name}
              </span>
              <span className="text-caption text-text-secondary tabular-nums">
                {p.ordered} {l.ordered} · {p.reserved} {l.allocated} {l.unit.code}
                {l.shortage !== '0' && (
                  <span className="text-[#f3cf8a]">{` · ${p.short} ${l.shortage}`}</span>
                )}
              </span>
            </span>
            {l.picks.length ? (
              <ul className="grid gap-1" data-picks>
                {l.picks.map((x, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/[0.03] px-3 py-2 text-caption',
                    )}
                  >
                    <span>
                      <span className="text-text-muted">{c.f.location} </span>
                      <span className="font-mono text-text-primary">{x.location.code}</span>
                    </span>
                    {x.lot && (
                      <span>
                        <span className="text-text-muted">{c.f.lot} </span>
                        <span className="font-mono text-text-primary">{x.lot.lotNumber}</span>
                      </span>
                    )}
                    {x.lot?.expiryDate && <ExpiryPill state={x.expiryState} />}
                    <span className="ml-auto font-semibold text-text-primary tabular-nums">
                      {x.quantity} {l.unit.code}
                      {x.toPick !== x.quantity && (
                        <span className="font-normal text-text-muted">{` · ${p.toPick} ${x.toPick}`}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-caption text-text-muted">{p.noPick}</span>
            )}
          </li>
        ))}
      </ol>
      {error && <Notice tone="error">{error}</Notice>}
      {canPick && open && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className={buttonClasses('primary', 'md', 'w-fit')}
          data-create-pick
        >
          {p.createPick}
        </button>
      )}
    </li>
  );
}
