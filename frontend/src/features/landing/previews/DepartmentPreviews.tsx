import {
  Calculator,
  CircleCheck,
  CircleDashed,
  Crown,
  Factory,
  Lock,
  ShoppingCart,
  Truck,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { MiniStat, PreviewFrame } from './PreviewFrame';

/* Illustrative mockups for the public website. Values are sample data. */

export function ExecutivePreview({ className }: { className?: string }) {
  const bars = [42, 55, 48, 62, 58, 71, 66, 78];
  return (
    <PreviewFrame
      className={className}
      icon={Crown}
      title="ผู้บริหาร"
      subtitle="ภาพรวมทั้งองค์กร"
      nav={['ภาพรวมองค์กร', 'Exception Center', 'รายการอนุมัติ', 'รายงาน']}
    >
      <div className="grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        <MiniStat label="คำสั่งซื้อเดือนนี้" value="128" />
        <MiniStat label="ส่งตรงเวลา" value="94%" tone="brand" />
        <MiniStat label="ข้อยกเว้น" value="7" tone="warning" />
        <MiniStat label="PO เปิดอยู่" value="23" />
      </div>
      <div className="mt-3 grid gap-3 @2xl:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-border-soft bg-surface-raised/50 p-3">
          <p className="text-[0.75rem] text-text-muted">คำสั่งซื้อรายสัปดาห์</p>
          <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden>
            {bars.map((h, i) => (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-t-[4px]',
                  i === bars.length - 1 ? 'bg-chart-1' : 'bg-chart-1/45',
                )}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <ul className="space-y-1.5">
          {[
            { t: 'SO-2410 เลยกำหนดส่ง 2 วัน', d: 'ฝ่ายขาย', tone: 'bg-danger' },
            { t: 'ซัพพลายเออร์ส่งล่าช้า PO-0918', d: 'จัดซื้อ', tone: 'bg-warning' },
            { t: 'ล็อต L2608-221 ใกล้หมดอายุ', d: 'คลังสินค้า', tone: 'bg-warning' },
          ].map((e) => (
            <li
              key={e.t}
              className="flex items-start gap-2 rounded-lg border border-border-soft bg-surface-raised/50 px-2.5 py-2"
            >
              <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', e.tone)} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[0.75rem] text-text-primary">{e.t}</span>
                <span className="text-[0.75rem] text-text-muted">{e.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PreviewFrame>
  );
}

export function SalesPreview({ className }: { className?: string }) {
  const columns = [
    { name: 'คำสั่งซื้อใหม่', items: ['SO-2431', 'SO-2432'] },
    { name: 'รอสินค้า', items: ['SO-2427'] },
    { name: 'รอผลิต', items: ['SO-2419', 'SO-2423'] },
    { name: 'รอจัดส่ง', items: ['SO-2410'] },
  ];
  return (
    <PreviewFrame
      className={className}
      icon={ShoppingCart}
      title="ฝ่ายขาย"
      subtitle="สถานะคำสั่งซื้อลูกค้า"
      nav={['ภาพรวม', 'Customer PO', 'Sales Orders', 'การจัดส่ง', 'ลูกค้า']}
    >
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        {columns.map((col) => (
          <div
            key={col.name}
            className="rounded-xl border border-border-soft bg-surface-raised/40 p-2"
          >
            <p className="flex items-center justify-between px-1 text-[0.75rem] text-text-muted">
              {col.name}
              <span className="text-text-secondary tabular">{col.items.length}</span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {col.items.map((so) => (
                <li
                  key={so}
                  className="rounded-lg border border-border-soft bg-surface-overlay px-2 py-1.5"
                >
                  <span className="block text-[0.75rem] font-medium text-text-primary">{so}</span>
                  <span
                    className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-highlight"
                    aria-hidden
                  >
                    <span className="block h-full w-2/3 rounded-full bg-brand-primary" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

export function WarehousePreview({ className }: { className?: string }) {
  const lots = [
    { lot: 'L2604-090', item: 'กาวอุตสาหกรรม 77', days: -6 },
    { lot: 'L2608-221', item: 'เรซินเคลือบผิว A12', days: 18 },
    { lot: 'L2609-114', item: 'น้ำยาทำความสะอาด B', days: 41 },
  ];
  return (
    <PreviewFrame
      className={className}
      icon={Warehouse}
      title="คลังสินค้า"
      subtitle="งานคลังวันนี้"
      nav={['ภาพรวม', 'รับสินค้า', 'สต็อก', 'ล็อต / แบตช์', 'วันหมดอายุ', 'ตรวจนับ']}
      badge={
        <span className="inline-flex items-center gap-1 rounded-full border border-border-brand bg-brand-primary/10 px-2 py-0.5 text-[0.75rem] text-brand-soft">
          <Lock className="size-3" aria-hidden />
          ไม่มีข้อมูลราคา
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="รอรับสินค้า" value="6" tone="brand" />
        <MiniStat label="รอ QC" value="3" />
        <MiniStat label="ล็อตหมดอายุ" value="1" tone="danger" />
      </div>
      <p className="mt-3 text-[0.75rem] text-text-muted">ล็อตตามลำดับ FEFO</p>
      <ul className="mt-1.5 space-y-1.5">
        {lots.map((l) => (
          <li
            key={l.lot}
            className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface-raised/50 px-2.5 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.75rem] font-medium text-text-primary">
                {l.item}
              </span>
              <span className="text-[0.75rem] text-text-muted">{l.lot}</span>
            </span>
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[0.75rem] font-medium tabular',
                l.days < 0
                  ? 'bg-danger/15 text-danger'
                  : l.days < 30
                    ? 'bg-warning/15 text-warning'
                    : 'bg-success/10 text-success',
              )}
            >
              {l.days < 0 ? `หมดอายุ ${-l.days} วัน` : `เหลือ ${l.days} วัน`}
            </span>
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

export function PurchasingPreview({ className }: { className?: string }) {
  const flow = [
    { label: 'PR ใหม่', n: 4 },
    { label: 'รออนุมัติ', n: 3 },
    { label: 'PO เปิด', n: 23 },
    { label: 'รับบางส่วน', n: 5 },
  ];
  return (
    <PreviewFrame
      className={className}
      icon={Truck}
      title="จัดซื้อ"
      subtitle="ใบขอซื้อถึงการรับของ"
      nav={['ภาพรวม', 'ใบขอซื้อ (PR)', 'ใบสั่งซื้อ (PO)', 'ซัพพลายเออร์', 'สถานะการรับ']}
    >
      <ol className="grid grid-cols-4 gap-1.5">
        {flow.map((s, i) => (
          <li
            key={s.label}
            className="relative rounded-xl border border-border-soft bg-surface-raised/60 p-2 text-center"
          >
            <p className="text-lg font-semibold text-text-primary tabular">{s.n}</p>
            <p className="truncate text-[0.75rem] text-text-muted">{s.label}</p>
            {i < flow.length - 1 && (
              <span
                aria-hidden
                className="absolute top-1/2 -right-1.5 z-10 h-px w-1.5 bg-brand-primary"
              />
            )}
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1.5">
        {[
          { po: 'PO-0918', s: 'Chem Partner Asia', p: 40, late: true },
          { po: 'PO-0922', s: 'Siam Metal Supply', p: 75, late: false },
          { po: 'PO-0925', s: 'Bangkok Packaging', p: 10, late: false },
        ].map((r) => (
          <li
            key={r.po}
            className="rounded-lg border border-border-soft bg-surface-raised/50 px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2 text-[0.75rem]">
              <span className="truncate text-text-primary">
                {r.po} · {r.s}
              </span>
              {r.late ? (
                <span className="shrink-0 text-danger">ล่าช้า</span>
              ) : (
                <span className="shrink-0 text-text-muted tabular">{r.p}%</span>
              )}
            </div>
            <span
              className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-highlight"
              aria-hidden
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  r.late ? 'bg-danger' : 'bg-brand-primary',
                )}
                style={{ width: `${r.p}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </PreviewFrame>
  );
}

export function OperationsPreview({ className }: { className?: string }) {
  const rows = [
    { wo: 'WO-1182', start: 0, span: 3, tone: 'bg-brand-primary' },
    { wo: 'WO-1185', start: 1, span: 4, tone: 'bg-danger' },
    { wo: 'WO-1187', start: 2, span: 2, tone: 'bg-brand-cool' },
    { wo: 'WO-1190', start: 4, span: 3, tone: 'bg-brand-primary/60' },
  ];
  const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  return (
    <PreviewFrame
      className={className}
      icon={Factory}
      title="ปฏิบัติการ"
      subtitle="แผนงานสัปดาห์นี้"
      nav={['ภาพรวม', 'ใบสั่งงาน', 'วางแผน', 'ความคืบหน้า', 'ปิดงาน / ส่งต่อ']}
    >
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="กำลังดำเนินการ" value="9" tone="brand" />
        <MiniStat label="ล่าช้า" value="2" tone="danger" />
        <MiniStat label="รอส่งต่อคลัง" value="3" />
      </div>
      <div className="mt-3 rounded-xl border border-border-soft bg-surface-raised/40 p-2.5">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] gap-1 text-center text-[0.75rem] text-text-muted">
          <span />
          {days.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((r) => (
            <li key={r.wo} className="grid grid-cols-[3.5rem_repeat(7,1fr)] items-center gap-1">
              <span className="text-[0.75rem] text-text-secondary tabular">{r.wo}</span>
              <span
                className={cn('h-3 rounded-full', r.tone)}
                style={{ gridColumn: `${r.start + 2} / span ${r.span}` }}
                aria-hidden
              />
            </li>
          ))}
        </ul>
      </div>
    </PreviewFrame>
  );
}

export function AccountingPreview({ className }: { className?: string }) {
  const requests = [
    { id: 'PAY-0331', ref: 'PO-0922', docs: [true, true, true], amount: '฿ 151,620' },
    { id: 'PAY-0334', ref: 'PO-0918', docs: [true, false, false], amount: '฿ 77,400' },
  ];
  const docNames = ['PO', 'GR', 'ใบแจ้งหนี้'];
  return (
    <PreviewFrame
      className={className}
      icon={Calculator}
      title="บัญชีและการเงิน"
      subtitle="คำขอจ่ายเงิน"
      nav={['ภาพรวม', 'คำขอจ่ายเงิน', 'การจ่ายเงิน', 'เจ้าหนี้', 'เอกสาร']}
    >
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="รอชำระมัดจำ" value="4" />
        <MiniStat label="เอกสารไม่ครบ" value="2" tone="warning" />
      </div>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => {
          const complete = r.docs.every(Boolean);
          return (
            <li
              key={r.id}
              className="rounded-xl border border-border-soft bg-surface-raised/50 p-2.5"
            >
              <div className="flex items-center justify-between text-[0.75rem]">
                <span className="text-text-primary">
                  {r.id} <span className="text-text-muted">· {r.ref}</span>
                </span>
                <span className="font-medium text-text-primary tabular">{r.amount}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {r.docs.map((ok, i) => (
                  <span
                    key={docNames[i]}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.75rem]',
                      ok ? 'bg-success/10 text-success' : 'bg-surface-highlight text-text-muted',
                    )}
                  >
                    {ok ? (
                      <CircleCheck className="size-3" aria-hidden />
                    ) : (
                      <CircleDashed className="size-3" aria-hidden />
                    )}
                    {docNames[i]}
                  </span>
                ))}
                <span
                  className={cn(
                    'ml-auto rounded-md px-2 py-0.5 text-[0.75rem] font-medium',
                    complete
                      ? 'bg-brand-primary text-text-inverse'
                      : 'bg-surface-highlight text-text-muted',
                  )}
                >
                  {complete ? 'พร้อมจ่าย' : 'รอเอกสาร'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </PreviewFrame>
  );
}
