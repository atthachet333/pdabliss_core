import { ClipboardList, PackageCheck, Truck } from 'lucide-react';
import {
  EmptyState,
  Panel,
  SampleTag,
  StageFlow,
  WorkspaceHero,
} from '@/components/app/primitives';
import { WORKSPACES } from '../registry';

/* Minimal sample content for UX review only. */

const FLOW = [
  { label: 'Customer PO', count: 2, hint: 'รับจากลูกค้า' },
  { label: 'ใบสั่งขาย', count: 3, hint: 'ยืนยันแล้ว' },
  { label: 'ตรวจสอบสินค้า', count: 1, hint: 'พร้อมส่ง / ส่งผลิต' },
  { label: 'จัดส่ง', count: 3, hint: 'อยู่ระหว่างส่ง' },
  { label: 'ปิดงาน', count: 0, hint: 'ส่งครบแล้ว' },
] as const;

const DELIVERY = [
  { label: 'รอจัดส่ง', value: 2, icon: PackageCheck },
  { label: 'ส่งบางส่วน', value: 1, icon: Truck },
  { label: 'ส่งครบ', value: 0, icon: Truck },
];

export default function SalesDashboard() {
  const ws = WORKSPACES.sales;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="คำสั่งซื้อและการจัดส่ง"
        subtitle={ws.tagline}
        motif={ws.motif}
      />

      <section aria-labelledby="sales-flow" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="sales-flow" className="text-body font-semibold text-text-primary">
            เส้นทางงานขาย
          </h2>
          <SampleTag />
        </div>
        <StageFlow stages={FLOW} label="ขั้นตอนงานขาย" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="คำสั่งซื้อ" subtitle="ใบสั่งขายที่เปิดอยู่จะแสดงที่นี่">
          <EmptyState
            icon={ClipboardList}
            title="ยังไม่มีคำสั่งซื้อ"
            description="เมื่อบันทึก Customer PO ระบบจะสร้างใบสั่งขายและตรวจสอบความพร้อมของสินค้าให้อัตโนมัติ"
            action="บันทึก Customer PO"
          />
        </Panel>

        <Panel title="สถานะการจัดส่ง" action={<SampleTag />}>
          <ul className="space-y-3">
            {DELIVERY.map(({ label, value, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface-raised/50 px-5 py-4"
              >
                <span className="flex items-center gap-3 text-label text-text-secondary">
                  <Icon className="size-4.5 text-[var(--ws-accent)]" aria-hidden />
                  {label}
                </span>
                <span className="text-h3 text-text-primary tabular">{value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
