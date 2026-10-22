import { ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Drawer,
  PageHeader,
  Panel,
  ProgressBar,
  SampleTag,
  SectionHeader,
  StatusBadge,
  SummaryList,
  WorkflowTimeline,
  type Status,
  type WorkflowStep,
} from '@/components/core';
import { cn } from '@/lib/cn';

/* Minimal sample content for UX review only. */

interface WorkOrderCard {
  id: string;
  title: string;
  so: string;
  progress: number;
  status: Status;
  statusLabel?: string;
  owner: string;
  due: string;
  steps: WorkflowStep[];
}

const ORDER_STEPS = (current: number, blocked = false): WorkflowStep[] =>
  ['รับออเดอร์', 'ตรวจ Stock', 'Operations', 'พร้อมส่ง', 'จัดส่ง'].map((label, i) => ({
    label,
    state:
      i < current ? 'completed' : i === current ? (blocked ? 'blocked' : 'current') : 'upcoming',
    note: i === current && blocked ? 'รอวัตถุดิบจาก PO ที่ส่งล่าช้า' : undefined,
  }));

const BOARD: { column: string; cards: WorkOrderCard[] }[] = [
  { column: 'งานใหม่', cards: [] },
  {
    column: 'วางแผนแล้ว',
    cards: [
      {
        id: 'WO-ตัวอย่าง-001',
        title: 'ผลิตตามใบสั่งขาย',
        so: 'SO-ตัวอย่าง-001',
        progress: 0,
        status: 'pending',
        statusLabel: 'รอเริ่ม',
        owner: 'ทีม A',
        due: '27 ต.ค.',
        steps: ORDER_STEPS(2),
      },
    ],
  },
  {
    column: 'กำลังดำเนินการ',
    cards: [
      {
        id: 'WO-ตัวอย่าง-002',
        title: 'ผลิตตามใบสั่งขาย',
        so: 'SO-ตัวอย่าง-002',
        progress: 45,
        status: 'warning',
        statusLabel: 'เสี่ยงล่าช้า',
        owner: 'ทีม B',
        due: '24 ต.ค.',
        steps: ORDER_STEPS(2, true),
      },
    ],
  },
  { column: 'รอส่งต่อคลัง', cards: [] },
];

const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const TODAY = 2;

export default function OperationsDashboard() {
  const [open, setOpen] = useState<WorkOrderCard | null>(null);

  return (
    <>
      <PageHeader
        title="Work Order และแผนงาน"
        description="วางแผน ลงมือ ส่งต่อ — ตามจังหวะงานจริง"
        actions={
          <Button variant="primary" icon={Plus} soon>
            สร้าง Work Order
          </Button>
        }
      />

      <section aria-labelledby="ops-board" className="mb-10">
        <SectionHeader id="ops-board" title="Work Order" aside={<SampleTag />} />
        {/* Board on tablet/desktop; stacked stage list on phones (no sideways scroll). */}
        <ol className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {BOARD.map((col) => (
            <li
              key={col.column}
              className={cn(
                'rounded-panel border border-line bg-panel p-3 md:p-4',
                col.cards.length === 0 && 'max-md:py-2.5',
              )}
            >
              <h3 className="flex items-center justify-between px-1 text-label text-fg-secondary">
                {col.column}
                <span className="rounded-full bg-fill-muted px-2 text-caption text-fg-secondary tabular">
                  {col.cards.length}
                </span>
              </h3>
              {col.cards.length === 0 ? (
                <p className="mt-3 rounded-control border border-dashed border-line px-3 py-5 text-center text-caption text-fg-muted max-md:hidden">
                  ไม่มีงาน
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {col.cards.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(c)}
                        className="w-full rounded-control border border-line bg-panel-raised p-4 text-left transition-colors hover:border-line-strong"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-label font-medium text-fg-primary">
                            <ClipboardList
                              className="size-4 shrink-0 text-[var(--ws-accent)]"
                              aria-hidden
                            />
                            <span className="truncate tabular">{c.id}</span>
                          </span>
                        </span>
                        <span className="mt-1 block text-caption text-fg-muted">
                          {c.title} · {c.so}
                        </span>
                        <span className="mt-3 block">
                          <ProgressBar
                            value={c.progress}
                            tone={c.status === 'warning' ? 'warning' : 'accent'}
                            label={`${c.id} ความคืบหน้า`}
                            showValue
                          />
                        </span>
                        <span className="mt-3 flex items-center justify-between gap-2">
                          <StatusBadge status={c.status} label={c.statusLabel} size="sm" />
                          <span className="text-caption text-fg-muted">กำหนด {c.due}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      <Panel
        title="แผนงานสัปดาห์นี้"
        description="จัดลำดับตามกำหนดส่ง และตรวจความพร้อมวัตถุดิบก่อนเริ่ม"
      >
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="ตารางงานรายวัน">
          {DAYS.map((d, i) => (
            <li
              key={d}
              aria-current={i === TODAY ? 'date' : undefined}
              className={cn(
                'flex min-h-16 flex-col items-center rounded-control border p-1.5 sm:min-h-24 sm:items-start sm:p-3',
                i === TODAY
                  ? 'border-[color-mix(in_oklab,var(--ws-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_6%,transparent)]'
                  : 'border-line',
              )}
            >
              <span
                className={cn(
                  'text-caption',
                  i === TODAY ? 'font-semibold text-fg-primary' : 'text-fg-muted',
                )}
              >
                {d}
              </span>
              {i === TODAY && (
                <span className="mt-auto hidden text-[0.75rem] text-fg-muted sm:block">วันนี้</span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-caption text-fg-muted">
          ยังไม่มีงานที่ลงตาราง — ลาก Work Order มาวางในวันที่ต้องการ (เร็ว ๆ นี้)
        </p>
      </Panel>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        subtitle="Work Order"
        title={open?.id ?? ''}
        headerExtra={open && <StatusBadge status={open.status} label={open.statusLabel} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              ปิด
            </Button>
            <Button variant="primary" soon>
              อัปเดตความคืบหน้า
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-8">
            <SummaryList
              columns={1}
              items={[
                { label: 'Sales Order', value: open.so },
                { label: 'ผู้รับผิดชอบ', value: open.owner },
                { label: 'กำหนดเสร็จ', value: open.due },
                {
                  label: 'ความคืบหน้า',
                  value: <ProgressBar value={open.progress} label="ความคืบหน้า" showValue />,
                },
              ]}
            />
            <section>
              <h3 className="mb-4 text-section text-fg-primary">ขั้นตอนของคำสั่งซื้อ</h3>
              <WorkflowTimeline
                orientation="vertical"
                label={`ขั้นตอนของ ${open.so}`}
                steps={open.steps}
              />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
