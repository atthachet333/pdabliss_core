import { Bell, PackageCheck, Search } from 'lucide-react';
import type { CSSProperties } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { DataTable, Panel, StatusBadge, WorkflowTimeline, type Column } from '@/components/core';
import { cn } from '@/lib/cn';
import { FEFO_SAMPLE, LOT_STEPS, TODAY, type LotExpiry } from '@/workspaces/warehouse/data';
import { WORKSPACES } from '@/workspaces/registry';

/*
 * The real product, not a mock-up: the Warehouse workspace assembled from the
 * same EP02 design-system parts (components/core) and registry the signed-in
 * app uses. Quantities and dates only — Warehouse never shows prices. This
 * module is lazy-loaded so the internal UI kit doesn't weigh on first paint.
 */

const ws = WORKSPACES.warehouse;

const COLUMNS: Column<LotExpiry>[] = [
  { id: 'lot', header: 'Lot', priority: 'primary', cell: (l) => l.lot },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: (l) =>
      l.daysLeft <= 30 ? (
        <StatusBadge status="warning" label={`เหลือ ${l.daysLeft} วัน`} size="sm" />
      ) : (
        <StatusBadge status="completed" label="พร้อมใช้" size="sm" />
      ),
  },
  { id: 'item', header: 'สินค้า', cell: (l) => l.item },
  { id: 'qty', header: 'จำนวน', align: 'end', cell: (l) => l.quantity },
  { id: 'exp', header: 'วันหมดอายุ', priority: 'medium', cell: (l) => l.expires },
];

export default function ProductWindow() {
  return (
    <div
      className="overflow-hidden rounded-[1.375rem] border border-line-strong bg-canvas text-left shadow-overlay"
      style={{ '--ws-accent': ws.accent } as CSSProperties}
    >
      {/* Top bar — as in AppShell */}
      <div className="flex h-12 items-center gap-3 border-b border-line bg-nav px-4">
        <LogoMark className="size-6" />
        <span className="hidden text-[0.75rem] font-semibold tracking-[0.12em] text-fg-primary sm:block">
          PDA BLISS <span className="text-brand-glow">CORE</span>
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-line-strong sm:block" />
        <span className="flex items-center gap-1.5 text-caption font-medium text-fg-primary">
          <ws.icon className="size-3.5 text-[var(--ws-accent)]" aria-hidden />
          {ws.shortTh}
        </span>
        <span className="ml-auto hidden h-8 w-44 items-center gap-2 rounded-control border border-line-strong bg-panel px-2.5 text-[0.75rem] text-fg-muted md:flex">
          <Search className="size-3.5" aria-hidden />
          ค้นหา…
        </span>
        <Bell className="ml-auto size-4 text-fg-secondary md:ml-0" aria-hidden />
        <span className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-panel-raised text-[0.6875rem] font-semibold text-fg-secondary">
          US
        </span>
      </div>

      <div className="flex">
        {/* Sidebar — this department's real navigation */}
        <nav
          aria-label="ตัวอย่างเมนูคลังสินค้า"
          className="hidden w-52 shrink-0 border-r border-line bg-nav p-3 md:block"
        >
          <ul className="space-y-0.5">
            {ws.nav.map((item, i) => (
              <li
                key={item.path}
                className={cn(
                  'relative flex h-9 items-center gap-2.5 rounded-control px-2.5 text-caption',
                  i === 0 ? 'bg-fill-active font-medium text-fg-primary' : 'text-fg-secondary',
                )}
              >
                {i === 0 && (
                  <span
                    aria-hidden
                    className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-[var(--ws-accent)]"
                  />
                )}
                <item.icon
                  className={cn('size-4', i === 0 ? 'text-[var(--ws-accent)]' : 'text-fg-muted')}
                  aria-hidden
                />
                {item.label}
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {/* PageHeader layout (components/core), with an h3: this preview sits inside the homepage. */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-page text-fg-primary">งานคลังวันนี้</h3>
              <p className="mt-1.5 text-label text-fg-secondary">
                รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุก Lot
              </p>
            </div>
            <span className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-control bg-brand-primary px-3.5 text-caption font-medium text-text-inverse">
              <PackageCheck className="size-4" aria-hidden />
              รับสินค้า
            </span>
          </div>
          <ul className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {TODAY.map((t) => (
              <li key={t.id} className="rounded-panel border border-line bg-panel p-3.5">
                <p className="text-caption text-fg-secondary">{t.label}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'text-metric tabular',
                      t.count ? 'text-fg-primary' : 'text-fg-muted',
                    )}
                  >
                    {t.count}
                  </span>
                  <span className="truncate text-[0.75rem] text-fg-muted">{t.unit}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel
              flush
              headingLevel={3}
              title="Lot ตามลำดับ FEFO"
              description="หมดอายุก่อน จ่ายออกก่อน"
            >
              <DataTable
                label="Lot ตามลำดับ FEFO (ตัวอย่าง)"
                columns={COLUMNS}
                rows={FEFO_SAMPLE}
                getRowId={(l) => l.lot}
              />
            </Panel>
            <Panel headingLevel={3} title="เส้นทางของ LOT-A">
              <WorkflowTimeline
                orientation="vertical"
                label="เส้นทางของ LOT-A (ตัวอย่าง)"
                steps={LOT_STEPS}
              />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
