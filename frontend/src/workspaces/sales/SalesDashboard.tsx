import { AlarmClock, Factory, FilePlus2, PackageSearch, Truck } from 'lucide-react';
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

/* EP00 mock data — Sales workspace. Sales is cleared for sales prices, not purchase cost. */

interface OrderCard {
  so: string;
  customer: string;
  due: string;
  value: number;
  fulfilled: number;
  overdue?: boolean;
}

const PIPELINE: { stage: string; hint: string; orders: OrderCard[] }[] = [
  {
    stage: 'คำสั่งซื้อใหม่',
    hint: 'รอตรวจสอบและยืนยัน',
    orders: [
      {
        so: 'SO-2431',
        customer: 'บจก. ไทยพาร์ทโปร',
        due: '2026-11-04',
        value: 186_400,
        fulfilled: 0,
      },
      {
        so: 'SO-2432',
        customer: 'หจก. เอ็มพีเทรดดิ้ง',
        due: '2026-11-07',
        value: 64_200,
        fulfilled: 0,
      },
    ],
  },
  {
    stage: 'รอสินค้า',
    hint: 'จองสต็อกได้บางส่วน',
    orders: [
      {
        so: 'SO-2427',
        customer: 'บจก. นอร์ทแพ็ค',
        due: '2026-10-28',
        value: 92_750,
        fulfilled: 40,
      },
    ],
  },
  {
    stage: 'รอผลิต',
    hint: 'ส่งต่อฝ่ายปฏิบัติการแล้ว',
    orders: [
      {
        so: 'SO-2419',
        customer: 'บจก. สยามโฮมเทค',
        due: '2026-10-25',
        value: 248_000,
        fulfilled: 55,
      },
      {
        so: 'SO-2423',
        customer: 'บจก. อีสเทิร์นซัพพลาย',
        due: '2026-10-30',
        value: 133_900,
        fulfilled: 20,
      },
    ],
  },
  {
    stage: 'รอจัดส่ง',
    hint: 'คลังเตรียมสินค้าแล้ว',
    orders: [
      {
        so: 'SO-2410',
        customer: 'บจก. สยามโฮมเทค',
        due: '2026-10-19',
        value: 310_500,
        fulfilled: 100,
        overdue: true,
      },
    ],
  },
];

const RECENT = [
  { po: 'CPO-7781', customer: 'บจก. ไทยพาร์ทโปร', so: 'SO-2431', received: '2026-10-21', lines: 6 },
  {
    po: 'CPO-7779',
    customer: 'หจก. เอ็มพีเทรดดิ้ง',
    so: 'SO-2432',
    received: '2026-10-21',
    lines: 2,
  },
  { po: 'CPO-7770', customer: 'บจก. นอร์ทแพ็ค', so: 'SO-2427', received: '2026-10-18', lines: 4 },
];

export default function SalesDashboard() {
  return (
    <>
      <PageTitle
        title="สถานะคำสั่งซื้อลูกค้า"
        subtitle="ทุกใบสั่งขายเชื่อมกับสต็อก งานผลิต และการจัดส่งแบบเรียลไทม์"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="คำสั่งซื้อใหม่" value="2" icon={FilePlus2} tone="brand" hint="วันนี้" />
        <KpiTile label="รอสินค้า" value="1" icon={PackageSearch} hint="จองได้บางส่วน" />
        <KpiTile label="รอผลิต" value="2" icon={Factory} hint="ส่งต่อปฏิบัติการ" />
        <KpiTile label="รอจัดส่ง" value="1" icon={Truck} />
        <KpiTile label="เลยกำหนดส่ง" value="1" icon={AlarmClock} tone="danger" hint="SO-2410" />
      </div>

      <section aria-labelledby="pipeline-title" className="mt-6">
        <h2 id="pipeline-title" className="mb-3 text-body font-semibold text-text-primary">
          เส้นทางคำสั่งซื้อ
        </h2>
        <ol className="-mx-4 no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {PIPELINE.map((col) => (
            <li
              key={col.stage}
              className="w-[80vw] max-w-xs shrink-0 snap-start rounded-panel border border-border-soft bg-surface-base p-3 sm:w-auto sm:max-w-none"
            >
              <div className="flex items-center justify-between px-1.5 pt-1">
                <p className="text-label font-semibold text-text-primary">{col.stage}</p>
                <span className="rounded-full bg-surface-overlay px-2 text-caption text-text-secondary tabular">
                  {col.orders.length}
                </span>
              </div>
              <p className="px-1.5 text-caption text-text-muted">{col.hint}</p>
              <ul className="mt-3 space-y-2">
                {col.orders.map((o) => (
                  <li
                    key={o.so}
                    className={cn(
                      'rounded-xl border bg-surface-raised p-3',
                      o.overdue ? 'border-danger/40' : 'border-border-soft',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-label font-semibold text-text-primary">{o.so}</p>
                      {o.overdue && <StatusPill tone="danger">เลยกำหนด</StatusPill>}
                    </div>
                    <p className="truncate text-caption text-text-secondary">{o.customer}</p>
                    <div className="mt-2.5 flex justify-between text-caption text-text-muted">
                      <span>กำหนดส่ง {formatShortDate(o.due)}</span>
                      <span className="tabular">{formatBaht(o.value)}</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        value={o.fulfilled}
                        tone={o.overdue ? 'danger' : 'brand'}
                        label={`${o.so} ความพร้อมส่ง`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <Panel
        title="Customer PO ล่าสุด"
        subtitle="ทุกใบผูกกับใบสั่งขาย และตรวจเลขที่ซ้ำอัตโนมัติ"
        className="mt-6"
      >
        <TableWrap label="ตาราง Customer PO ล่าสุด">
          <table className="w-full min-w-[36rem]">
            <thead>
              <tr className="border-b border-border-soft">
                <th scope="col" className={th}>
                  Customer PO
                </th>
                <th scope="col" className={th}>
                  ลูกค้า
                </th>
                <th scope="col" className={th}>
                  ใบสั่งขาย
                </th>
                <th scope="col" className={th}>
                  วันที่รับ
                </th>
                <th scope="col" className={cn(th, 'text-right')}>
                  รายการ
                </th>
              </tr>
            </thead>
            <tbody>
              {RECENT.map((r) => (
                <tr key={r.po} className="border-b border-border-soft last:border-0">
                  <td className={cn(td, 'font-medium')}>{r.po}</td>
                  <td className={td}>{r.customer}</td>
                  <td className={cn(td, 'text-brand-soft')}>{r.so}</td>
                  <td className={cn(td, 'text-text-secondary')}>{formatShortDate(r.received)}</td>
                  <td className={cn(td, 'text-right tabular')}>{r.lines}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>
    </>
  );
}
