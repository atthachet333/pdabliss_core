import { CalendarClock, FileText } from 'lucide-react';
import {
  EmptyState,
  Panel,
  ProgressBar,
  SampleTag,
  StageFlow,
  StatusPill,
  WorkspaceHero,
} from '@/components/app/primitives';
import { WORKSPACES } from '../registry';

/* Minimal sample content for UX review only. */

const PIPELINE = [
  { label: 'PR ใหม่', count: 1, hint: 'จากคลัง / ปฏิบัติการ' },
  { label: 'รออนุมัติ', count: 2, hint: 'ผู้ขออนุมัติเองไม่ได้' },
  { label: 'PO เปิดอยู่', count: 3, hint: 'รอซัพพลายเออร์ส่ง' },
  { label: 'รับของแล้ว', count: 0, hint: 'ปิด PO ได้' },
] as const;

const FOLLOW_UP = [
  {
    supplier: 'ซัพพลายเออร์ A',
    po: 'PO ตัวอย่าง 1',
    due: 'เลยกำหนด 1 วัน',
    received: 40,
    late: true,
  },
  {
    supplier: 'ซัพพลายเออร์ B',
    po: 'PO ตัวอย่าง 2',
    due: 'ครบกำหนดใน 3 วัน',
    received: 0,
    late: false,
  },
];

export default function PurchasingDashboard() {
  const ws = WORKSPACES.purchasing;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="ใบขอซื้อถึงการรับของ"
        subtitle={ws.tagline}
        motif={ws.motif}
      />

      <section aria-labelledby="pur-flow" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="pur-flow" className="text-body font-semibold text-text-primary">
            PR → PO
          </h2>
          <SampleTag />
        </div>
        <StageFlow stages={PIPELINE} label="ขั้นตอนเอกสารจัดซื้อ" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="PR รออนุมัติ" subtitle="ผู้ขอไม่สามารถอนุมัติรายการของตัวเองได้">
          <EmptyState
            icon={FileText}
            title="ไม่มีใบขอซื้อที่รอคุณ"
            description="ใบขอซื้อจากคลังสินค้าและฝ่ายปฏิบัติการจะเข้ามาที่นี่เพื่อตรวจสอบและอนุมัติ"
            action="สร้างใบขอซื้อ"
            compact
          />
        </Panel>

        <Panel
          title="ติดตามซัพพลายเออร์"
          subtitle="อัปเดตจากการรับของของคลังโดยอัตโนมัติ"
          action={<SampleTag />}
        >
          <ul className="space-y-3">
            {FOLLOW_UP.map((f) => (
              <li
                key={f.po}
                className="rounded-2xl border border-border-soft bg-surface-raised/50 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-label font-medium text-text-primary">
                      {f.supplier}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-caption text-text-muted">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {f.po} · {f.due}
                    </p>
                  </div>
                  <StatusPill tone={f.late ? 'danger' : 'neutral'}>
                    {f.late ? 'ล่าช้า' : 'รอส่ง'}
                  </StatusPill>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar
                    value={f.received}
                    tone={f.late ? 'danger' : 'accent'}
                    label={`${f.po} รับแล้ว ${f.received}%`}
                  />
                  <span className="w-10 text-right text-caption text-text-secondary tabular">
                    {f.received}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
