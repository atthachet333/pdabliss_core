import {
  ArrowRight,
  ClipboardCheck,
  FileClock,
  FileText,
  PackageOpen,
  TimerOff,
  UserRoundCheck,
} from 'lucide-react';
import {
  KpiTile,
  PageTitle,
  Panel,
  ProgressBar,
  StatusPill,
  TableWrap,
  td,
  th,
} from '@/components/app/primitives';
import { cn } from '@/lib/cn';
import { formatBaht, formatShortDate } from '@/lib/format';

/* EP00 mock data — Purchasing workspace. */

const FLOW = [
  { label: 'PR ใหม่', value: 4, hint: 'จากคลัง / ปฏิบัติการ' },
  { label: 'PR รออนุมัติ', value: 3, hint: 'ผู้ขออนุมัติเองไม่ได้' },
  { label: 'PO รออนุมัติ', value: 2, hint: 'ตามวงเงิน' },
  { label: 'PO เปิดอยู่', value: 23, hint: 'รอซัพพลายเออร์ส่ง' },
  { label: 'รับบางส่วน', value: 5, hint: 'คลังรับแล้วบางส่วน' },
];

const APPROVALS = [
  {
    id: 'PR-0412',
    from: 'คลังสินค้า · คุณธนากร',
    item: 'เรซินเคลือบผิว A12 × 40 ถัง',
    amount: 83_600,
    waiting: '2 วัน',
  },
  {
    id: 'PR-0415',
    from: 'ปฏิบัติการ · คุณสุรเชษฐ์',
    item: 'ใบมีดตัด CNC × 12',
    amount: 27_480,
    waiting: '5 ชม.',
  },
  {
    id: 'PO-0931',
    from: 'จัดซื้อ · คุณณัฐวดี',
    item: 'อะลูมิเนียมโปรไฟล์ 6063 × 300',
    amount: 113_700,
    waiting: '1 ชม.',
  },
];

const DELIVERIES = [
  { po: 'PO-0918', supplier: 'Chem Partner Asia', due: '2026-10-18', received: 40, late: true },
  { po: 'PO-0921', supplier: 'Thai Fastener Co.', due: '2026-10-20', received: 0, late: true },
  { po: 'PO-0922', supplier: 'Siam Metal Supply', due: '2026-10-21', received: 75, late: false },
  { po: 'PO-0925', supplier: 'Bangkok Packaging', due: '2026-10-24', received: 10, late: false },
  { po: 'PO-0927', supplier: 'Thai Fastener Co.', due: '2026-10-27', received: 0, late: false },
];

export default function PurchasingDashboard() {
  return (
    <>
      <PageTitle
        title="จากความต้องการ ถึงรับของครบ"
        subtitle="ใบขอซื้อ ใบสั่งซื้อ และการส่งของของซัพพลายเออร์"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="PR รออนุมัติ" value="3" icon={FileClock} tone="warning" />
        <KpiTile label="PO รออนุมัติ" value="2" icon={ClipboardCheck} />
        <KpiTile label="PO เปิดอยู่" value="23" icon={FileText} tone="brand" />
        <KpiTile label="รับของบางส่วน" value="5" icon={PackageOpen} />
        <KpiTile label="ส่งล่าช้า" value="2" icon={TimerOff} tone="danger" />
      </div>

      <Panel title="เส้นทางเอกสารจัดซื้อ" subtitle="PR → อนุมัติ → PO → รับสินค้า" className="mt-6">
        <ol className="grid gap-2 sm:grid-cols-5">
          {FLOW.map((s, i) => (
            <li key={s.label} className="relative flex items-center gap-2 sm:block">
              <div className="flex-1 rounded-xl border border-border-soft bg-surface-raised p-3.5">
                <p className="text-caption text-text-muted">{s.label}</p>
                <p className="mt-1 text-kpi text-text-primary tabular">{s.value}</p>
                <p className="mt-1 text-caption text-text-muted">{s.hint}</p>
              </div>
              {i < FLOW.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 rotate-90 text-brand-primary sm:absolute sm:top-1/2 sm:-right-3 sm:z-10 sm:-translate-y-1/2 sm:rotate-0"
                />
              )}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Panel
          title="รออนุมัติ"
          subtitle="ระบบไม่อนุญาตให้ผู้ขออนุมัติรายการของตัวเอง"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border-soft">
            {APPROVALS.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label font-semibold text-text-primary">{a.id}</p>
                    <p className="truncate text-label text-text-secondary">{a.item}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-caption text-text-muted">
                      <UserRoundCheck className="size-3" aria-hidden />
                      {a.from} · รอ {a.waiting}
                    </p>
                  </div>
                  <p className="shrink-0 text-label font-semibold text-text-primary tabular">
                    {formatBaht(a.amount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="ติดตามการส่งของซัพพลายเออร์"
          subtitle="อัปเดตจากการรับสินค้าของคลังโดยอัตโนมัติ"
        >
          <TableWrap label="ตารางติดตามการส่งของ">
            <table className="w-full min-w-[34rem]">
              <thead>
                <tr className="border-b border-border-soft">
                  <th scope="col" className={th}>
                    PO
                  </th>
                  <th scope="col" className={th}>
                    ซัพพลายเออร์
                  </th>
                  <th scope="col" className={th}>
                    กำหนดส่ง
                  </th>
                  <th scope="col" className={cn(th, 'w-40')}>
                    รับแล้ว
                  </th>
                  <th scope="col" className={th}>
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody>
                {DELIVERIES.map((d) => (
                  <tr key={d.po} className="border-b border-border-soft last:border-0">
                    <td className={cn(td, 'font-medium')}>{d.po}</td>
                    <td className={td}>{d.supplier}</td>
                    <td className={cn(td, d.late ? 'text-danger' : 'text-text-secondary')}>
                      {formatShortDate(d.due)}
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={d.received}
                          tone={d.late ? 'danger' : 'brand'}
                          label={`${d.po} รับแล้ว ${d.received}%`}
                        />
                        <span className="w-9 text-right text-caption text-text-secondary tabular">
                          {d.received}%
                        </span>
                      </div>
                    </td>
                    <td className={td}>
                      {d.late ? (
                        <StatusPill tone="danger">ล่าช้า</StatusPill>
                      ) : d.received > 0 ? (
                        <StatusPill tone="brand">รับบางส่วน</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">รอส่ง</StatusPill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
