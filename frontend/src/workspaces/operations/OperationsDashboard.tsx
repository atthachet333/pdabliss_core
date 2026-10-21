import { ClipboardList } from 'lucide-react';
import { Panel, ProgressBar, SampleTag, WorkspaceHero } from '@/components/app/primitives';
import { cn } from '@/lib/cn';
import { WORKSPACES } from '../registry';

/* Minimal sample content for UX review only. */

interface Card {
  id: string;
  title: string;
  forOrder: string;
  progress: number;
  late?: boolean;
}

const BOARD: { column: string; cards: Card[] }[] = [
  { column: 'งานใหม่', cards: [] },
  {
    column: 'วางแผนแล้ว',
    cards: [{ id: 'WO-1', title: 'ใบสั่งงานตัวอย่าง 1', forOrder: 'สำหรับใบสั่งขาย', progress: 0 }],
  },
  {
    column: 'กำลังดำเนินการ',
    cards: [
      {
        id: 'WO-2',
        title: 'ใบสั่งงานตัวอย่าง 2',
        forOrder: 'สำหรับใบสั่งขาย',
        progress: 45,
        late: true,
      },
    ],
  },
  { column: 'รอส่งต่อคลัง', cards: [] },
];

const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const TODAY = 1;

export default function OperationsDashboard() {
  const ws = WORKSPACES.operations;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="ใบสั่งงานและแผนงาน"
        subtitle={ws.tagline}
        motif={ws.motif}
      />

      <section aria-labelledby="ops-board" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="ops-board" className="text-body font-semibold text-text-primary">
            ใบสั่งงาน
          </h2>
          <SampleTag />
        </div>
        <ol className="-mx-4 no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {BOARD.map((col) => (
            <li
              key={col.column}
              className="w-[78vw] max-w-xs shrink-0 snap-start rounded-panel border border-border-soft bg-surface-base p-4 sm:w-auto sm:max-w-none"
            >
              <p className="flex items-center justify-between px-1 text-label text-text-secondary">
                {col.column}
                <span className="text-caption text-text-muted tabular">{col.cards.length}</span>
              </p>
              {col.cards.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-border-soft px-3 py-6 text-center text-caption text-text-muted">
                  ไม่มีงาน
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {col.cards.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-border-soft bg-surface-raised/60 p-4"
                    >
                      <p className="flex items-center gap-2 text-label font-medium text-text-primary">
                        <ClipboardList className="size-4 text-[var(--ws-accent)]" aria-hidden />
                        {c.title}
                      </p>
                      <p className="mt-1 text-caption text-text-muted">{c.forOrder}</p>
                      <div className="mt-4 flex items-center gap-3">
                        <ProgressBar
                          value={c.progress}
                          tone={c.late ? 'warning' : 'accent'}
                          label={`${c.title} ความคืบหน้า`}
                        />
                        <span className="w-9 text-right text-caption text-text-secondary tabular">
                          {c.progress}%
                        </span>
                      </div>
                      {c.late && <p className="mt-2 text-caption text-warning">เสี่ยงล่าช้า</p>}
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
        subtitle="จัดลำดับตามกำหนดส่ง และตรวจความพร้อมวัตถุดิบก่อนเริ่ม"
      >
        <ol className="grid grid-cols-7 gap-2" aria-label="ตารางงานรายวัน">
          {DAYS.map((d, i) => (
            <li
              key={d}
              aria-current={i === TODAY ? 'date' : undefined}
              className={cn(
                'flex min-h-28 flex-col rounded-xl border p-2.5 sm:p-3',
                i === TODAY
                  ? 'border-[color-mix(in_oklab,var(--ws-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_6%,transparent)]'
                  : 'border-border-soft',
              )}
            >
              <span
                className={cn(
                  'text-caption',
                  i === TODAY ? 'font-semibold text-[var(--ws-accent)]' : 'text-text-muted',
                )}
              >
                {d}
              </span>
              {i === TODAY && (
                <span className="mt-auto hidden text-[0.75rem] text-text-muted sm:block">
                  วันนี้
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-caption text-text-muted">
          ยังไม่มีงานที่ลงตาราง — ลากใบสั่งงานมาวางในวันที่ต้องการ (เร็ว ๆ นี้)
        </p>
      </Panel>
    </>
  );
}
