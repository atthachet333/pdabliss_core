import {
  ArrowUpRight,
  Boxes,
  Hourglass,
  ListChecks,
  Lock,
  PackageCheck,
  ScanBarcode,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  EmptyState,
  Panel,
  SampleTag,
  StatusPill,
  WorkspaceHero,
} from '@/components/app/primitives';
import { WORKSPACES } from '../registry';
import { FEFO_SAMPLE, TODAY, type WarehouseTask } from './data';

const TASK_ICON: Record<WarehouseTask['id'], typeof Boxes> = {
  receiving: PackageCheck,
  stock: Boxes,
  lots: Hourglass,
  'stock-count': ListChecks,
};

export default function WarehouseDashboard() {
  const ws = WORKSPACES.warehouse;
  return (
    <>
      <WorkspaceHero
        icon={ws.icon}
        eyebrow={ws.nameEn}
        title="งานคลังวันนี้"
        subtitle={ws.tagline}
        motif={ws.motif}
        actions={
          <button
            type="button"
            disabled
            title="การสแกนบาร์โค้ดจะเปิดใช้ในรอบพัฒนาถัดไป"
            className="hidden h-11 items-center gap-2 rounded-full border border-border-strong px-5 text-label text-text-secondary disabled:opacity-70 sm:inline-flex"
          >
            <ScanBarcode className="size-4" aria-hidden />
            สแกนบาร์โค้ด · เร็ว ๆ นี้
          </button>
        }
      />

      <p className="mb-8 flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--ws-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_6%,transparent)] px-5 py-4 text-label text-text-secondary">
        <Lock className="mt-0.5 size-4 shrink-0 text-[var(--ws-accent)]" aria-hidden />
        <span>
          พื้นที่ทำงานนี้แสดงเฉพาะจำนวน ล็อต และวันที่ —{' '}
          <strong className="font-semibold text-text-primary">
            ข้อมูลต้นทุนและราคาไม่ถูกส่งมาจากเซิร์ฟเวอร์
          </strong>
        </span>
      </p>

      {/* Task-first: four large, thumb-sized entry points */}
      <section aria-labelledby="wh-today" className="mb-12">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="wh-today" className="text-body font-semibold text-text-primary">
            สิ่งที่ต้องทำ
          </h2>
          <SampleTag />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {TODAY.map((task) => {
            const Icon = TASK_ICON[task.id];
            return (
              <li key={task.id}>
                <Link
                  to={`/app/warehouse/${task.id}`}
                  className="group flex h-full items-center gap-4 rounded-panel border border-border-soft bg-surface-base p-5 transition-colors hover:border-[color-mix(in_oklab,var(--ws-accent)_45%,transparent)] sm:gap-5 sm:p-6"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--ws-accent)_12%,transparent)]">
                    <Icon className="size-6 text-[var(--ws-accent)]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label text-text-secondary">{task.label}</span>
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[2.25rem] leading-none font-semibold text-text-primary tabular">
                        {task.count}
                      </span>
                      <span className="text-caption text-text-muted">{task.unit}</span>
                    </span>
                    <span className="mt-1.5 block text-caption text-text-muted">{task.note}</span>
                  </span>
                  <ArrowUpRight
                    className="size-5 shrink-0 text-text-muted transition-colors group-hover:text-[var(--ws-accent)]"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="รับสินค้าวันนี้" subtitle="ระบบไม่อนุญาตให้รับเกินจำนวนในใบสั่งซื้อ">
          <EmptyState
            icon={PackageCheck}
            title="ยังไม่มีรายการเข้าคลัง"
            description="เมื่อฝ่ายจัดซื้อออก PO รายการที่ถึงกำหนดรับจะปรากฏที่นี่ พร้อมขั้นตอนตรวจ QC"
            action="เริ่มรับสินค้า"
            compact
          />
        </Panel>

        <Panel title="ล็อตตามลำดับ FEFO" subtitle="หมดอายุก่อน จ่ายออกก่อน" action={<SampleTag />}>
          <ul className="space-y-3">
            {FEFO_SAMPLE.map((l) => (
              <li
                key={l.lot}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface-raised/50 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-label font-medium text-text-primary">{l.item}</p>
                  <p className="mt-0.5 text-caption text-text-muted">
                    {l.lot} · {l.quantity}
                  </p>
                </div>
                <StatusPill tone={l.daysLeft <= 30 ? 'warning' : 'success'}>
                  เหลือ {l.daysLeft} วัน
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Mobile: floor staff reach scanning with one thumb */}
      <button
        type="button"
        disabled
        aria-label="สแกนบาร์โค้ด (จะเปิดใช้ในรอบพัฒนาถัดไป)"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-[var(--ws-accent)] text-text-inverse shadow-glow-md disabled:opacity-90 sm:hidden"
      >
        <ScanBarcode className="size-6" aria-hidden />
      </button>
    </>
  );
}
