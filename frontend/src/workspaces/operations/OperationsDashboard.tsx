import { ArrowRightLeft, CheckCheck, CirclePlay, Inbox, TimerOff } from 'lucide-react';
import {
  KpiTile,
  PageTitle,
  Panel,
  ProgressBar,
  StatusPill,
  type Tone,
} from '@/components/app/primitives';
import { cn } from '@/lib/cn';

/* EP00 mock data — Operations workspace. No pricing is shown here. */

interface WorkOrder {
  wo: string;
  product: string;
  forSo: string;
  qty: string;
  progress: number;
  step: string;
  state: { tone: Tone; label: string };
  start: number;
  span: number;
}

const WORK_ORDERS: WorkOrder[] = [
  {
    wo: 'WO-1182',
    product: 'ชุดโครงอะลูมิเนียม AF-20',
    forSo: 'SO-2419',
    qty: '120 ชุด',
    progress: 72,
    step: 'ประกอบ',
    state: { tone: 'brand', label: 'ตามแผน' },
    start: 0,
    span: 3,
  },
  {
    wo: 'WO-1185',
    product: 'แผงเคลือบผิว RC-8',
    forSo: 'SO-2423',
    qty: '60 แผง',
    progress: 30,
    step: 'รอวัตถุดิบ',
    state: { tone: 'danger', label: 'ล่าช้า 1 วัน' },
    start: 1,
    span: 4,
  },
  {
    wo: 'WO-1187',
    product: 'กล่องบรรจุพิเศษ PK-X',
    forSo: 'SO-2427',
    qty: '800 ใบ',
    progress: 55,
    step: 'ขึ้นรูป',
    state: { tone: 'brand', label: 'ตามแผน' },
    start: 2,
    span: 2,
  },
  {
    wo: 'WO-1190',
    product: 'ชุดโครงอะลูมิเนียม AF-32',
    forSo: 'SO-2431',
    qty: '40 ชุด',
    progress: 0,
    step: 'ตรวจความพร้อม',
    state: { tone: 'neutral', label: 'งานใหม่' },
    start: 4,
    span: 3,
  },
];

const DAYS = ['จ. 20', 'อ. 21', 'พ. 22', 'พฤ. 23', 'ศ. 24', 'ส. 25', 'อา. 26'];
const TODAY_INDEX = 1;

const HANDOFFS = [
  {
    wo: 'WO-1179',
    product: 'ชุดโครงอะลูมิเนียม AF-20',
    qty: '60 ชุด',
    to: 'WH-MAIN · โซน F',
    ready: '13:00',
  },
  {
    wo: 'WO-1180',
    product: 'แผงเคลือบผิว RC-6',
    qty: '25 แผง',
    to: 'WH-MAIN · โซน F',
    ready: '15:00',
  },
  {
    wo: 'WO-1176',
    product: 'กล่องบรรจุพิเศษ PK-S',
    qty: '1,200 ใบ',
    to: 'WH-MAIN · โซน E',
    ready: 'พร้อมแล้ว',
  },
];

export default function OperationsDashboard() {
  return (
    <>
      <PageTitle title="แผนงานและความคืบหน้า" subtitle="ใบสั่งงานที่เชื่อมกับคำสั่งซื้อของลูกค้า" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="งานใหม่" value="6" icon={Inbox} tone="brand" />
        <KpiTile label="กำลังดำเนินการ" value="9" icon={CirclePlay} />
        <KpiTile label="ล่าช้า" value="2" icon={TimerOff} tone="danger" />
        <KpiTile label="เสร็จวันนี้" value="3" icon={CheckCheck} tone="success" />
        <KpiTile label="รอส่งต่อคลัง" value="3" icon={ArrowRightLeft} tone="warning" />
      </div>

      <Panel
        title="ตารางงานสัปดาห์นี้"
        subtitle="20–26 ต.ค. · แถบสีแดงคืองานที่เสี่ยงล่าช้า"
        className="mt-6"
      >
        <div
          className="-mx-5 overflow-x-auto px-5"
          role="region"
          aria-label="ตารางงานรายวัน"
          tabIndex={0}
        >
          <div className="min-w-[44rem]">
            <div className="grid grid-cols-[9rem_repeat(7,minmax(0,1fr))] gap-1.5 text-center text-caption text-text-muted">
              <span />
              {DAYS.map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    'rounded-md py-1',
                    i === TODAY_INDEX && 'bg-brand-primary/12 font-medium text-brand-soft',
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
            <ul className="mt-2 space-y-2">
              {WORK_ORDERS.map((w) => (
                <li
                  key={w.wo}
                  className="grid grid-cols-[9rem_repeat(7,minmax(0,1fr))] items-center gap-1.5"
                >
                  <span className="truncate text-label text-text-primary">
                    {w.wo} <span className="text-caption text-text-muted">· {w.forSo}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-8 items-center rounded-lg px-2.5 text-caption font-medium',
                      w.state.tone === 'danger'
                        ? 'bg-danger/20 text-danger'
                        : w.state.tone === 'neutral'
                          ? 'border border-dashed border-border-strong text-text-muted'
                          : 'bg-brand-primary/20 text-brand-soft',
                    )}
                    style={{ gridColumn: `${w.start + 2} / span ${w.span}` }}
                  >
                    <span className="truncate">{w.step}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="ใบสั่งงานที่กำลังดำเนินการ" bodyClassName="p-0">
          <ul className="divide-y divide-border-soft">
            {WORK_ORDERS.map((w) => (
              <li key={w.wo} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-label font-semibold text-text-primary">
                      {w.wo} · {w.product}
                    </p>
                    <p className="text-caption text-text-muted">
                      สำหรับ {w.forSo} · {w.qty} · ขั้นตอน: {w.step}
                    </p>
                  </div>
                  <StatusPill tone={w.state.tone}>{w.state.label}</StatusPill>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar
                    value={w.progress}
                    tone={w.state.tone === 'danger' ? 'danger' : 'brand'}
                    label={`${w.wo} ความคืบหน้า`}
                  />
                  <span className="w-10 text-right text-caption text-text-secondary tabular">
                    {w.progress}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="รอส่งต่อให้คลังสินค้า"
          subtitle="คลังเห็นรายการนี้ในคิวรับเข้าทันที"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border-soft">
            {HANDOFFS.map((h) => (
              <li key={h.wo} className="flex items-center gap-3 px-5 py-4">
                <ArrowRightLeft className="size-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-medium text-text-primary">{h.product}</p>
                  <p className="text-caption text-text-muted">
                    {h.wo} · {h.qty} → {h.to}
                  </p>
                </div>
                <span className="shrink-0 text-caption text-text-secondary">{h.ready}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
