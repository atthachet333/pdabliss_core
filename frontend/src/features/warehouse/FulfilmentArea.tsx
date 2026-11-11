import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { AreaLink, Fact, Facts, Pill, Section } from '@/features/company-center/parts';
import { DOC_COPY, type LineSummary } from '@/features/company-center/docModel';
import { LineSummaryText } from '@/features/company-center/docContext';
import { useCopy } from '@/i18n/useCopy';
import type { Localized } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import {
  ctlApi,
  DELIVERY_EXCEPTIONS,
  DISCREPANCIES,
  type Detail,
  type DeliveryException,
  type Discrepancy,
  type Pack,
  type Pick,
  type Shipment,
} from './ctlApi';
import { CARD, DocArea, DocList, DocPage, type Step } from './ctlParts';
import { useCtl, useOpenDoc } from './ctlModel';
import { WH } from './whModel';
import { ExpiryPill } from './whParts';

/*
 * /core/warehouse/picks · /packs · /shipments (EP35) — one lazy chunk for the
 * three fulfilment documents (docs/SALES_FULFILLMENT.md). Picks are created from
 * Pending Pick, packs from a picked pick, shipments from a pack. Only DISPATCH
 * deducts stock; delivery and exceptions are evidence. Every quantity, lot and
 * location is the server's; these screens show only what the server allows
 * (`actions`). Nothing commercial exists here — no price, total or tax.
 */

type FKind = 'picks' | 'packs' | 'shipments';

const th = {
  f: {
    order: 'คำสั่งขาย',
    item: 'สินค้า',
    from: 'ตำแหน่ง · ล็อต',
    planned: 'กำหนดหยิบ',
    picked: 'หยิบได้',
    toPack: 'รอแพ็ก',
    packed: 'แพ็กแล้ว',
    dispatched: 'ส่งออกแล้ว',
    quantity: 'จำนวน',
    delivered: 'ส่งถึงแล้ว',
    outstanding: 'ค้างส่งถึง',
    discrepancy: 'สาเหตุที่ได้ไม่ครบ',
    discrepancyNote: 'รายละเอียด',
    packages: 'จำนวนกล่อง',
    packageRef: 'เลขอ้างอิงกล่อง',
    shipment: 'การจัดส่ง',
    packs: 'แพ็ก',
    shipTo: 'ผู้รับปลายทาง',
    shipToHint: 'เว้นว่าง = ชื่อลูกค้าในคำสั่งขาย',
    address: 'ที่อยู่จัดส่ง',
    carrier: 'ผู้ขนส่ง',
    tracking: 'เลขติดตามพัสดุ',
    handedOverTo: 'ส่งมอบให้',
    dispatchedAt: 'ส่งออกเมื่อ',
    deliveredAt: 'ส่งถึงเมื่อ',
    recipient: 'ผู้รับสินค้า',
    reference: 'เลขอ้างอิงการส่งถึง',
    note: 'หมายเหตุ',
    reason: 'สาเหตุ',
    started: 'เริ่มหยิบ',
    pickedBy: 'ยืนยันการหยิบ',
    packedBy: 'ยืนยันการแพ็ก',
  },
  discrepancy: {
    SHORT_PICKED: 'หยิบได้ไม่ครบ',
    DAMAGED: 'สินค้าชำรุด',
    MISSING: 'ไม่พบสินค้า',
    WRONG_ITEM: 'สินค้าไม่ตรง',
    OTHER: 'อื่น ๆ (ระบุรายละเอียด)',
  } satisfies Record<Discrepancy, string>,
  exception: {
    FAILED_ATTEMPT: 'ส่งไม่สำเร็จ',
    RECIPIENT_UNAVAILABLE: 'ไม่มีผู้รับ',
    ADDRESS_ISSUE: 'ที่อยู่มีปัญหา',
    DAMAGED_IN_TRANSIT: 'เสียหายระหว่างขนส่ง',
    LOST_IN_TRANSIT: 'สูญหายระหว่างขนส่ง',
    PARTIAL_DELIVERY: 'ส่งถึงบางส่วน',
    OTHER: 'อื่น ๆ (ระบุหมายเหตุ)',
  } satisfies Record<DeliveryException, string>,
  events: {
    DELIVERED: 'ส่งถึงครบ',
    PARTIALLY_DELIVERED: 'ส่งถึงบางส่วน',
    EXCEPTION: 'ส่งไม่สำเร็จ',
  },
  act: {
    start: 'เริ่มหยิบ',
    confirmPick: 'ยืนยันการหยิบ',
    cancel: 'ยกเลิก',
    pack: 'แพ็กสินค้าที่หยิบแล้ว',
    confirmPack: 'ยืนยันการแพ็ก',
    ship: 'สร้างการจัดส่ง',
    dispatch: 'ยืนยันการส่งออก',
    deliver: 'บันทึกการส่งถึง',
    exception: 'บันทึกส่งไม่สำเร็จ',
  },
  ask: {
    start: 'เริ่มหยิบใบนี้?',
    cancel: 'ยกเลิก? ไม่มีผลกับสต็อก การจองยังอยู่',
    cancelPicked: 'ยกเลิกการหยิบ? สินค้ากลับเข้าที่เดิม การจองยังอยู่',
    confirmPack: 'ยืนยันการแพ็ก?',
    dispatch:
      'การส่งออกจะตัดสต็อกและใช้การจองที่ตรงกัน การกระทำนี้ย้อนกลับด้วยการแก้ไขการจัดส่งไม่ได้',
  },
  pickHint:
    'หยิบจากตำแหน่งและล็อตที่ระบุเท่านั้น ถ้าได้น้อยกว่ากำหนดให้ระบุสาเหตุ — การจองยังคงอยู่',
  reservationOk: 'การจองครบทุกรายการ พร้อมส่งออก',
  reservationBad: 'การจองบางรายการไม่ครบ — ส่งออกไม่ได้',
  deliveryHint: 'บันทึกการส่งถึงไม่เปลี่ยนสต็อก ส่วนที่ยังไม่ถึงจะค้างไว้เป็นยอดค้างส่ง',
  exceptionHint: 'ไม่คืนสต็อกอัตโนมัติ — การรับคืนจะเปิดในเฟสถัดไป',
  history: 'ประวัติการส่งถึง',
  save: 'บันทึก',
};
type FulCopy = typeof th;

const FUL_COPY: Localized<FulCopy> = {
  th,
  en: {
    f: {
      order: 'Sales order',
      item: 'Item',
      from: 'Location · lot',
      planned: 'Planned',
      picked: 'Picked',
      toPack: 'To pack',
      packed: 'Packed',
      dispatched: 'Dispatched',
      quantity: 'Quantity',
      delivered: 'Delivered',
      outstanding: 'Not delivered',
      discrepancy: 'Why short',
      discrepancyNote: 'Details',
      packages: 'Packages',
      packageRef: 'Package reference',
      shipment: 'Shipment',
      packs: 'Packs',
      shipTo: 'Ship to',
      shipToHint: 'Blank = the customer name on the sales order',
      address: 'Delivery address',
      carrier: 'Carrier',
      tracking: 'Tracking reference',
      handedOverTo: 'Handed over to',
      dispatchedAt: 'Dispatched',
      deliveredAt: 'Delivered',
      recipient: 'Received by',
      reference: 'Delivery reference',
      note: 'Note',
      reason: 'Reason',
      started: 'Started',
      pickedBy: 'Pick confirmed',
      packedBy: 'Pack confirmed',
    },
    discrepancy: {
      SHORT_PICKED: 'Short picked',
      DAMAGED: 'Damaged',
      MISSING: 'Missing',
      WRONG_ITEM: 'Wrong item',
      OTHER: 'Other (add details)',
    },
    exception: {
      FAILED_ATTEMPT: 'Failed attempt',
      RECIPIENT_UNAVAILABLE: 'Recipient unavailable',
      ADDRESS_ISSUE: 'Address issue',
      DAMAGED_IN_TRANSIT: 'Damaged in transit',
      LOST_IN_TRANSIT: 'Lost in transit',
      PARTIAL_DELIVERY: 'Partly delivered',
      OTHER: 'Other (add a note)',
    },
    events: {
      DELIVERED: 'Delivered',
      PARTIALLY_DELIVERED: 'Partly delivered',
      EXCEPTION: 'Exception',
    },
    act: {
      start: 'Start picking',
      confirmPick: 'Confirm pick',
      cancel: 'Cancel',
      pack: 'Pack picked goods',
      confirmPack: 'Confirm pack',
      ship: 'Create shipment',
      dispatch: 'Confirm dispatch',
      deliver: 'Record delivery',
      exception: 'Record exception',
    },
    ask: {
      start: 'Start this pick?',
      cancel: 'Cancel? No stock effect; the reservation stays.',
      cancelPicked: 'Cancel the pick? Goods go back to their place; the reservation stays.',
      confirmPack: 'Confirm this pack?',
      dispatch:
        'Dispatching will deduct stock and consume the corresponding reservation. This action cannot be undone by editing the shipment.',
    },
    pickHint:
      'Pick only from the location and lot shown. If you get less than planned, say why — the reservation stays.',
    reservationOk: 'Every line is reserved — ready to dispatch.',
    reservationBad: 'A line is no longer fully reserved — it cannot be dispatched.',
    deliveryHint:
      'Recording delivery does not change stock. Anything not delivered stays outstanding.',
    exceptionHint: 'Stock is not restored automatically — returns arrive in a later phase.',
    history: 'Delivery history',
    save: 'Save',
  },
  'zh-CN': {
    f: {
      order: '销售订单',
      item: '物料',
      from: '库位 · 批次',
      planned: '计划',
      picked: '已拣',
      toPack: '待包装',
      packed: '已包装',
      dispatched: '已发运',
      quantity: '数量',
      delivered: '已送达',
      outstanding: '未送达',
      discrepancy: '短缺原因',
      discrepancyNote: '详情',
      packages: '包裹数',
      packageRef: '包裹编号',
      shipment: '发运',
      packs: '包裹',
      shipTo: '收货方',
      shipToHint: '留空 = 销售订单上的客户名称',
      address: '送货地址',
      carrier: '承运人',
      tracking: '运单号',
      handedOverTo: '交接给',
      dispatchedAt: '发运时间',
      deliveredAt: '送达时间',
      recipient: '签收人',
      reference: '送达凭证号',
      note: '备注',
      reason: '原因',
      started: '开始拣货',
      pickedBy: '确认拣货',
      packedBy: '确认包装',
    },
    discrepancy: {
      SHORT_PICKED: '拣货不足',
      DAMAGED: '货物损坏',
      MISSING: '找不到货物',
      WRONG_ITEM: '货物不符',
      OTHER: '其他（填写详情）',
    },
    exception: {
      FAILED_ATTEMPT: '投递失败',
      RECIPIENT_UNAVAILABLE: '收货人不在',
      ADDRESS_ISSUE: '地址问题',
      DAMAGED_IN_TRANSIT: '运输途中损坏',
      LOST_IN_TRANSIT: '运输途中丢失',
      PARTIAL_DELIVERY: '部分送达',
      OTHER: '其他（填写备注）',
    },
    events: { DELIVERED: '全部送达', PARTIALLY_DELIVERED: '部分送达', EXCEPTION: '送达异常' },
    act: {
      start: '开始拣货',
      confirmPick: '确认拣货',
      cancel: '取消',
      pack: '包装已拣货物',
      confirmPack: '确认包装',
      ship: '创建发运',
      dispatch: '确认发运',
      deliver: '记录送达',
      exception: '记录异常',
    },
    ask: {
      start: '开始此拣货单？',
      cancel: '取消？不影响库存，预留保留。',
      cancelPicked: '取消拣货？货物放回原位，预留保留。',
      confirmPack: '确认此包裹？',
      dispatch: '发运将扣减库存并消耗对应的预留。此操作无法通过编辑发运来撤销。',
    },
    pickHint: '只从所示库位和批次拣货。如少于计划，请说明原因——预留保留。',
    reservationOk: '每一行均已预留——可以发运。',
    reservationBad: '某行的预留已不完整——无法发运。',
    deliveryHint: '记录送达不改变库存。未送达的部分保留为未完成数量。',
    exceptionHint: '不会自动恢复库存——退货将在后续阶段推出。',
    history: '送达记录',
    save: '保存',
  },
};

const NUM = 'tabular-nums';
const lt = (a: string, b: string) => Number(a) < Number(b);
const where = (l: { location: { code: string }; lot: { lotNumber: string } | null }) =>
  `${l.location.code}${l.lot ? ` · ${l.lot.lotNumber}` : ''}`;

export default function FulfilmentArea({ kind }: { kind: FKind }) {
  const F = useCopy(FUL_COPY);
  const d = useCopy(DOC_COPY);
  return (
    <DocArea
      kind={kind}
      list={(ctx) => (
        <DocList
          kind={kind}
          ctx={ctx}
          canCreate={false}
          statuses={
            kind === 'picks'
              ? ['DRAFT', 'IN_PROGRESS', 'PICKED', 'CANCELLED']
              : kind === 'packs'
                ? ['DRAFT', 'PACKED', 'DISPATCHED', 'CANCELLED']
                : ['READY', 'DISPATCHED', 'DELIVERED', 'DELIVERY_EXCEPTION', 'CANCELLED']
          }
          columns={[
            {
              head: F.f.order,
              cell: (r) => <span className="font-mono whitespace-nowrap">{r.order.number}</span>,
            },
            // EP42.3: what the pick holds (first item, planned quantity, "+N more").
            ...(kind === 'picks'
              ? [
                  {
                    head: d.items,
                    cell: (r: object) => (
                      <LineSummaryText s={'summary' in r ? (r.summary as LineSummary) : null} />
                    ),
                  },
                ]
              : []),
            ...(kind === 'shipments'
              ? [
                  {
                    head: F.f.shipTo,
                    cell: (r: object) => ('shipToName' in r ? `${r.shipToName as string}` : ''),
                  },
                ]
              : []),
          ]}
        />
      )}
      create={null}
      page={(id) =>
        kind === 'picks' ? (
          <PickPage id={id} />
        ) : kind === 'packs' ? (
          <PackPage id={id} />
        ) : (
          <ShipmentPage id={id} />
        )
      }
    />
  );
}

/** Shared facts of the three documents: order, branch, who created it. */
function Common({ d, children }: { d: Pick | Pack | Shipment; children?: ReactNode }) {
  const { c } = useCtl();
  const F = useCopy(FUL_COPY);
  return (
    <Facts>
      <Fact term={F.f.order}>
        <span className="font-mono">{d.order.number}</span>
      </Fact>
      <Fact term={c.f.branch}>{`${d.branch.code} · ${d.branch.name}`}</Fact>
      <Fact term={c.f.by}>{d.createdBy?.name ?? '—'}</Fact>
      {children}
      {d.note && <Fact term={F.f.note}>{d.note}</Fact>}
      {d.cancellationReason && <Fact term={c.f.reason}>{d.cancellationReason}</Fact>}
    </Facts>
  );
}

/** A form inside a document page: its fields, then one submit (the server checks again). */
function Form({
  label,
  busy,
  onSubmit,
  children,
  hint,
  data,
}: {
  label: string;
  busy: boolean;
  onSubmit: () => void;
  children: ReactNode;
  hint?: string;
  data: string;
}) {
  return (
    <form
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn(CARD, 'grid grid-cols-1 gap-4 sm:grid-cols-2')}
      data-form={data}
    >
      {hint && <p className="text-caption text-text-muted sm:col-span-2">{hint}</p>}
      {children}
      <button
        type="submit"
        disabled={busy}
        className={buttonClasses('primary', 'md', 'w-fit sm:col-span-2')}
      >
        {label}
      </button>
    </form>
  );
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    go: async (work: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await work();
      } finally {
        setBusy(false);
      }
    },
  };
}

// ---------------------------------------------------------------- picks

function PickPage({ id }: { id: string }) {
  const { c, k } = useCtl();
  const F = useCopy(FUL_COPY);
  const { dateTime } = useDateFormat();
  return (
    <DocPage
      kind="picks"
      id={id}
      steps={(p) => [
        ...(p.actions.includes('start')
          ? [{ action: 'start', label: F.act.start, ask: F.ask.start, primary: true }]
          : []),
        ...(p.actions.includes('cancel')
          ? [
              p.status === 'PICKED'
                ? {
                    action: 'cancel',
                    label: F.act.cancel,
                    ask: F.ask.cancelPicked,
                    reason: 'required' as const,
                  }
                : { action: 'cancel', label: F.act.cancel, ask: F.ask.cancel },
            ]
          : []),
      ]}
    >
      {(p, run) => (
        <>
          <Section id="pick-facts" title={k.title.picks}>
            <Common d={p}>
              {p.startedAt && (
                <Fact
                  term={F.f.started}
                >{`${dateTime(p.startedAt)} · ${p.startedBy?.name ?? ''}`}</Fact>
              )}
              {p.pickedAt && (
                <Fact
                  term={F.f.pickedBy}
                >{`${dateTime(p.pickedAt)} · ${p.pickedBy?.name ?? ''}`}</Fact>
              )}
            </Common>
          </Section>
          <Section id="pick-lines" title={`${c.f.lines} · ${p.lines.length}`}>
            {p.actions.includes('confirm') ? (
              <ConfirmPick key={p.updatedAt} p={p} run={run} />
            ) : (
              <PickLines p={p} />
            )}
          </Section>
          {p.actions.includes('pack') && <PackForm p={p} />}
        </>
      )}
    </DocPage>
  );
}

function LineHead({ l }: { l: Pick['lines'][number] }) {
  return (
    <span className="min-w-0 break-words">
      <span className="font-mono text-caption text-text-muted">#{l.lineNo}</span>{' '}
      <span className="font-mono">{l.item.code}</span> · {l.item.name}
      <span className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
        <span className="font-mono">{where(l)}</span>
        {l.lot?.expiryDate && <ExpiryPill state={l.expiryState} />}
      </span>
    </span>
  );
}

/** Read-only pick lines: planned, picked (and why short), packed, dispatched. */
function PickLines({ p }: { p: Pick }) {
  const F = useCopy(FUL_COPY);
  return (
    <ol className="grid gap-2" data-lines>
      {p.lines.map((l) => (
        <li key={l.id} className={cn(CARD, 'grid gap-2 text-label')}>
          <LineHead l={l} />
          <dl className="grid grid-cols-2 gap-2 text-caption sm:grid-cols-4">
            {(
              [
                [F.f.planned, l.planned],
                [F.f.picked, l.picked ?? '—'],
                [F.f.packed, l.packed],
                [F.f.dispatched, l.dispatched],
              ] as const
            ).map(([t, v]) => (
              <div key={t}>
                <dt className="text-text-muted">{t}</dt>
                <dd className={cn(NUM, 'font-semibold text-text-primary')}>
                  {v} <span className="font-normal text-text-muted">{l.unit.code}</span>
                </dd>
              </div>
            ))}
          </dl>
          {l.discrepancy && (
            <p className="text-caption text-[#f3cf8a]" data-discrepancy={l.discrepancy}>
              {F.discrepancy[l.discrepancy]}
              {l.discrepancyNote ? ` — ${l.discrepancyNote}` : ''}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

type Entry = { picked: string; discrepancy: Discrepancy | ''; note: string };

/** Confirming a pick: what was taken per line; a short line names why. */
function ConfirmPick({
  p,
  run,
}: {
  p: Pick;
  run: (work: () => Promise<Detail<'picks'>>) => Promise<boolean>;
}) {
  const F = useCopy(FUL_COPY);
  const base = useId();
  const { busy, go } = useBusy();
  const [rows, setRows] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      p.lines.map((l) => [l.id, { picked: l.planned, discrepancy: '', note: '' }]),
    ),
  );
  const set = (lineId: string, patch: Partial<Entry>) =>
    setRows((r) => ({ ...r, [lineId]: { ...r[lineId]!, ...patch } }));
  return (
    <Form
      label={F.act.confirmPick}
      busy={busy}
      hint={F.pickHint}
      data="confirm-pick"
      onSubmit={() =>
        void go(() =>
          run(() =>
            ctlApi.act('picks', p.id, 'confirm', undefined, {
              lines: p.lines.map((l) => {
                const r = rows[l.id]!;
                const short = lt(r.picked.trim(), l.planned);
                return {
                  lineId: l.id,
                  pickedQuantity: r.picked.trim(),
                  ...(short && r.discrepancy ? { discrepancy: r.discrepancy } : {}),
                  ...(short && r.note.trim() ? { discrepancyNote: r.note.trim() } : {}),
                };
              }),
            }),
          ),
        )
      }
    >
      <ol className="grid gap-3 sm:col-span-2" data-lines>
        {p.lines.map((l) => {
          const r = rows[l.id]!;
          const short = lt(r.picked.trim(), l.planned);
          return (
            <li
              key={l.id}
              className="grid gap-3 border-t border-white/[0.06] pt-3 text-label sm:grid-cols-2"
            >
              <span className="sm:col-span-2">
                <LineHead l={l} />
                <span className="mt-1 block text-caption text-text-secondary">
                  {F.f.planned} <span className={NUM}>{l.planned}</span> {l.unit.code}
                </span>
              </span>
              <TextField
                id={`${base}-${l.id}-q`}
                label={`${F.f.picked} (${l.unit.code})`}
                value={r.picked}
                inputMode="decimal"
                onChange={(e) => set(l.id, { picked: e.target.value })}
              />
              {short && (
                <SelectField
                  id={`${base}-${l.id}-d`}
                  label={F.f.discrepancy}
                  value={r.discrepancy}
                  onChange={(e) => set(l.id, { discrepancy: e.target.value as Discrepancy })}
                >
                  <option value="">—</option>
                  {DISCREPANCIES.map((d) => (
                    <option key={d} value={d}>
                      {F.discrepancy[d]}
                    </option>
                  ))}
                </SelectField>
              )}
              {short && r.discrepancy && (
                <TextField
                  id={`${base}-${l.id}-n`}
                  label={F.f.discrepancyNote}
                  value={r.note}
                  maxLength={300}
                  onChange={(e) => set(l.id, { note: e.target.value })}
                  className="sm:col-span-2"
                />
              )}
            </li>
          );
        })}
      </ol>
    </Form>
  );
}

/** Packs what this pick has picked and not yet packed. */
function PackForm({ p }: { p: Pick }) {
  const F = useCopy(FUL_COPY);
  const { err } = useCtl();
  const base = useId();
  const open = useOpenDoc('packs');
  const { busy, go } = useBusy();
  const [count, setCount] = useState('1');
  const [ref, setRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Section id="pick-pack" title={F.act.pack}>
      {error && <Notice tone="error">{error}</Notice>}
      <Form
        label={F.act.pack}
        busy={busy}
        data="pack"
        onSubmit={() =>
          void go(async () => {
            setError(null);
            try {
              const d = await ctlApi.create('packs', {
                salesOrderId: p.order.id,
                lines: p.lines
                  .filter((l) => l.toPack !== '0')
                  .map((l) => ({ pickLineId: l.id, quantity: l.toPack })),
                packageCount: Math.max(1, Number.parseInt(count, 10) || 1),
                packageReference: ref.trim() || null,
              });
              open(d.pack.id);
            } catch (x) {
              setError(err(x));
            }
          })
        }
      >
        <ul className="grid gap-1 text-caption text-text-secondary sm:col-span-2">
          {p.lines
            .filter((l) => l.toPack !== '0')
            .map((l) => (
              <li key={l.id}>
                <span className="font-mono">{l.item.code}</span> · {where(l)} —{' '}
                <span className={cn(NUM, 'font-semibold text-text-primary')}>{l.toPack}</span>{' '}
                {l.unit.code}
              </li>
            ))}
        </ul>
        <TextField
          id={`${base}-c`}
          label={F.f.packages}
          value={count}
          inputMode="numeric"
          onChange={(e) => setCount(e.target.value)}
        />
        <TextField
          id={`${base}-r`}
          label={F.f.packageRef}
          value={ref}
          maxLength={60}
          onChange={(e) => setRef(e.target.value)}
        />
      </Form>
    </Section>
  );
}

// ---------------------------------------------------------------- packs

function PackPage({ id }: { id: string }) {
  const { c, k } = useCtl();
  const F = useCopy(FUL_COPY);
  const { dateTime } = useDateFormat();
  return (
    <DocPage
      kind="packs"
      id={id}
      steps={(p) => [
        ...(p.actions.includes('confirm')
          ? [{ action: 'confirm', label: F.act.confirmPack, ask: F.ask.confirmPack, primary: true }]
          : []),
        ...(p.actions.includes('cancel')
          ? [{ action: 'cancel', label: F.act.cancel, ask: F.ask.cancel }]
          : []),
      ]}
    >
      {(p) => (
        <>
          <Section id="pack-facts" title={k.title.packs}>
            <Common d={p}>
              <Fact term={F.f.packages}>
                {p.packageCount}
                {p.packageReference ? ` · ${p.packageReference}` : ''}
              </Fact>
              {p.packedAt && (
                <Fact
                  term={F.f.packedBy}
                >{`${dateTime(p.packedAt)} · ${p.packedBy?.name ?? ''}`}</Fact>
              )}
              {p.shipment && (
                <Fact term={F.f.shipment}>
                  <DocLink kind="shipments" d={p.shipment} />
                </Fact>
              )}
            </Common>
          </Section>
          <Section id="pack-lines" title={`${c.f.lines} · ${p.lines.length}`}>
            <QtyLines rows={p.lines.map((l) => ({ ...l, cells: [[F.f.quantity, l.quantity]] }))} />
          </Section>
          {p.actions.includes('ship') && <ShipForm p={p} />}
        </>
      )}
    </DocPage>
  );
}

function DocLink({ kind, d }: { kind: FKind; d: { id: string; number: string } }) {
  return (
    <AreaLink
      to={`${WH}/${kind}/${encodeURIComponent(d.id)}`}
      className="inline-flex min-h-8 items-center font-mono font-semibold text-brand-soft hover:underline"
    >
      {d.number}
    </AreaLink>
  );
}

/** Lines with their stock identity and a few quantities. */
function QtyLines({
  rows,
}: {
  rows: {
    id: string;
    lineNo: number;
    item: { code: string; name: string };
    unit: { code: string };
    location: { code: string };
    lot: { lotNumber: string } | null;
    cells: [string, string][];
  }[];
}) {
  return (
    <ol className="grid gap-2" data-lines>
      {rows.map((l) => (
        <li
          key={l.id}
          className={cn(CARD, 'grid gap-2 text-label sm:grid-cols-[minmax(0,1fr)_auto]')}
        >
          <span className="min-w-0 break-words">
            <span className="font-mono text-caption text-text-muted">#{l.lineNo}</span>{' '}
            <span className="font-mono">{l.item.code}</span> · {l.item.name}
            <span className="block font-mono text-caption text-text-secondary">{where(l)}</span>
          </span>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-caption sm:justify-end">
            {l.cells.map(([t, v]) => (
              <div key={t}>
                <dt className="text-text-muted">{t}</dt>
                <dd className={cn(NUM, 'font-semibold text-text-primary')}>
                  {v} <span className="font-normal text-text-muted">{l.unit.code}</span>
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}

/** A shipment for this pack (ship-to, carrier, tracking — the customer name by default). */
function ShipForm({ p }: { p: Pack }) {
  const F = useCopy(FUL_COPY);
  const { err } = useCtl();
  const base = useId();
  const open = useOpenDoc('shipments');
  const { busy, go } = useBusy();
  const [v, setV] = useState({
    shipToName: '',
    shipToAddress: '',
    carrier: '',
    trackingReference: '',
  });
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof typeof v, label: string, max: number, hint?: string) => (
    <TextField
      id={`${base}-${key}`}
      label={label}
      hint={hint}
      value={v[key]}
      maxLength={max}
      onChange={(e) => setV((x) => ({ ...x, [key]: e.target.value }))}
    />
  );
  return (
    <Section id="pack-ship" title={F.act.ship}>
      {error && <Notice tone="error">{error}</Notice>}
      <Form
        label={F.act.ship}
        busy={busy}
        data="ship"
        onSubmit={() =>
          void go(async () => {
            setError(null);
            try {
              const body = Object.fromEntries(
                Object.entries(v).map(([key, x]) => [key, x.trim() || null]),
              );
              const d = await ctlApi.create('shipments', {
                salesOrderId: p.order.id,
                packIds: [p.id],
                ...body,
              });
              open(d.shipment.id);
            } catch (x) {
              setError(err(x));
            }
          })
        }
      >
        {field('shipToName', F.f.shipTo, 200, F.f.shipToHint)}
        {field('shipToAddress', F.f.address, 500)}
        {field('carrier', F.f.carrier, 100)}
        {field('trackingReference', F.f.tracking, 100)}
      </Form>
    </Section>
  );
}

// ---------------------------------------------------------------- shipments

function ShipmentPage({ id }: { id: string }) {
  const { c, k } = useCtl();
  const F = useCopy(FUL_COPY);
  const { dateTime } = useDateFormat();
  return (
    <DocPage
      kind="shipments"
      id={id}
      steps={(s): Step[] => [
        ...(s.actions.includes('dispatch') && s.reservationOk !== false
          ? [{ action: 'dispatch', label: F.act.dispatch, ask: F.ask.dispatch, primary: true }]
          : []),
        ...(s.actions.includes('cancel')
          ? [{ action: 'cancel', label: F.act.cancel, ask: F.ask.cancel }]
          : []),
      ]}
    >
      {(s, run) => (
        <>
          <Section id="shp-facts" title={k.title.shipments}>
            <Common d={s}>
              <Fact term={F.f.shipTo}>{s.shipToName}</Fact>
              {s.shipToAddress && <Fact term={F.f.address}>{s.shipToAddress}</Fact>}
              {s.carrier && <Fact term={F.f.carrier}>{s.carrier}</Fact>}
              {s.trackingReference && <Fact term={F.f.tracking}>{s.trackingReference}</Fact>}
              <Fact term={F.f.packs}>
                <span className="flex flex-wrap gap-x-3">
                  {s.packs.map((p) => (
                    <DocLink key={p.id} kind="packs" d={p} />
                  ))}
                </span>
              </Fact>
              {s.dispatchedAt && (
                <Fact term={F.f.dispatchedAt}>
                  {`${dateTime(s.dispatchedAt)} · ${s.dispatchedBy?.name ?? ''}`}
                  {s.handedOverTo ? ` → ${s.handedOverTo}` : ''}
                </Fact>
              )}
              {s.deliveredAt && <Fact term={F.f.deliveredAt}>{dateTime(s.deliveredAt)}</Fact>}
            </Common>
          </Section>
          {s.reservationOk !== null && (
            <p
              role="status"
              className={cn(
                'rounded-lg px-3 py-2 text-label',
                s.reservationOk
                  ? 'bg-brand-primary/[0.08] text-text-secondary'
                  : 'bg-warning/[0.08] text-[#f3cf8a]',
              )}
              data-reservation-ok={s.reservationOk}
            >
              {s.reservationOk ? F.reservationOk : F.reservationBad}
            </p>
          )}
          <Section id="shp-lines" title={`${c.f.lines} · ${s.lines.length}`}>
            <QtyLines
              rows={s.lines.map((l) => ({
                ...l,
                cells: [
                  [F.f.quantity, l.quantity],
                  ...(s.dispatchedAt
                    ? ([
                        [F.f.delivered, l.delivered],
                        [F.f.outstanding, l.outstanding],
                      ] as [string, string][])
                    : []),
                ],
              }))}
            />
          </Section>
          {s.events.length > 0 && (
            <Section id="shp-events" title={F.history}>
              <ol className="grid gap-2" data-events>
                {s.events.map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3 text-label">
                    <Pill tone={e.type === 'DELIVERED' ? 'teal' : 'warning'}>
                      {F.events[e.type]}
                    </Pill>
                    {e.reason && <span>{F.exception[e.reason]}</span>}
                    {e.recipientName && <span>{`${F.f.recipient}: ${e.recipientName}`}</span>}
                    {e.reference && <span className="font-mono">{e.reference}</span>}
                    {e.note && <span className="text-text-secondary">{e.note}</span>}
                    <span className="text-caption text-text-muted">
                      {`${dateTime(e.occurredAt)} · ${e.recordedBy?.name ?? ''}`}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {s.actions.includes('deliver') && <DeliverForm key={`d${s.updatedAt}`} s={s} run={run} />}
          {s.actions.includes('exception') && (
            <ExceptionForm key={`e${s.updatedAt}`} s={s} run={run} />
          )}
        </>
      )}
    </DocPage>
  );
}

type RunShipment = (work: () => Promise<Detail<'shipments'>>) => Promise<boolean>;

/** Delivered now: what is outstanding by default, editable per line. */
function DeliverForm({ s, run }: { s: Shipment; run: RunShipment }) {
  const F = useCopy(FUL_COPY);
  const base = useId();
  const { busy, go } = useBusy();
  const open = s.lines.filter((l) => l.outstanding !== '0');
  const [q, setQ] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((l) => [l.id, l.outstanding])),
  );
  const [v, setV] = useState({ recipientName: '', reference: '', note: '' });
  return (
    <Section id="shp-deliver" title={F.act.deliver}>
      <Form
        label={F.act.deliver}
        busy={busy}
        hint={F.deliveryHint}
        data="deliver"
        onSubmit={() =>
          void go(() =>
            run(() =>
              ctlApi.act('shipments', s.id, 'deliver', undefined, {
                lines: open
                  .filter((l) => Number(q[l.id]) > 0)
                  .map((l) => ({ lineId: l.id, quantity: q[l.id]!.trim() })),
                ...Object.fromEntries(Object.entries(v).map(([key, x]) => [key, x.trim() || null])),
              }),
            ),
          )
        }
      >
        {open.map((l) => (
          <TextField
            key={l.id}
            id={`${base}-${l.id}`}
            label={`${l.item.code} · ${where(l)} (${l.unit.code})`}
            hint={`${F.f.outstanding} ${l.outstanding}`}
            value={q[l.id] ?? ''}
            inputMode="decimal"
            onChange={(e) => setQ((x) => ({ ...x, [l.id]: e.target.value }))}
          />
        ))}
        {(['recipientName', 'reference', 'note'] as const).map((key) => (
          <TextField
            key={key}
            id={`${base}-${key}`}
            label={
              key === 'recipientName'
                ? F.f.recipient
                : key === 'reference'
                  ? F.f.reference
                  : F.f.note
            }
            value={v[key]}
            maxLength={key === 'note' ? 1000 : 200}
            onChange={(e) => setV((x) => ({ ...x, [key]: e.target.value }))}
          />
        ))}
      </Form>
    </Section>
  );
}

function ExceptionForm({ s, run }: { s: Shipment; run: RunShipment }) {
  const F = useCopy(FUL_COPY);
  const base = useId();
  const { busy, go } = useBusy();
  const [reason, setReason] = useState<DeliveryException | ''>('');
  const [note, setNote] = useState('');
  return (
    <Section id="shp-exception" title={F.act.exception}>
      <Form
        label={F.act.exception}
        busy={busy || !reason}
        hint={F.exceptionHint}
        data="exception"
        onSubmit={() =>
          void go(() =>
            run(() =>
              ctlApi.act('shipments', s.id, 'exception', undefined, {
                reason,
                ...(note.trim() ? { note: note.trim() } : {}),
              }),
            ),
          )
        }
      >
        <SelectField
          id={`${base}-r`}
          label={F.f.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value as DeliveryException)}
        >
          <option value="">—</option>
          {DELIVERY_EXCEPTIONS.map((r) => (
            <option key={r} value={r}>
              {F.exception[r]}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${base}-n`}
          label={F.f.note}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Form>
    </Section>
  );
}
