import { Bell, Check, CircleDashed, Search } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import {
  DataTable,
  ExceptionList,
  ProgressBar,
  StatusBadge,
  TaskList,
  WorkflowTimeline,
  type Column,
  type ExceptionRecord,
  type Status,
} from '@/components/core';
import { cn } from '@/lib/cn';
import { DEPARTMENT_SUMMARY } from '@/workspaces/executive/data';
import { FOLLOW_UP, PURCHASING_TASKS, type FollowUpSample } from '@/workspaces/purchasing/data';
import { WORKSPACES, type WorkspaceId } from '@/workspaces/registry';
import { SALES_ORDERS, type SalesOrderSample } from '@/workspaces/sales/data';
import { FEFO_SAMPLE, TODAY, type LotExpiry } from '@/workspaces/warehouse/data';

/*
 * Real product previews for the homepage — the same EP02 design-system parts
 * (components/core), workspace registry and sample data the signed-in app
 * uses. No screenshots, no invented dashboards. Lazy-loaded.
 * Warehouse shows quantities and dates only; Accounting shows documents and
 * states, not amounts; Executive shows qualitative states, not company figures.
 */

function Window({
  ws,
  sidebar = true,
  children,
}: {
  ws: WorkspaceId;
  sidebar?: boolean;
  children: ReactNode;
}) {
  const w = WORKSPACES[ws];
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line-strong bg-canvas text-left shadow-overlay"
      style={{ '--ws-accent': w.accent } as CSSProperties}
    >
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-nav px-4">
        <LogoMark className="size-5" />
        <span className="hidden text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-primary sm:block">
          PDA BLISS <span className="text-brand-glow">CORE</span>
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-line-strong sm:block" />
        <span className="flex items-center gap-1.5 text-caption font-medium text-fg-primary">
          <w.icon className="size-3.5 text-[var(--ws-accent)]" aria-hidden />
          {w.shortTh}
        </span>
        <span className="ml-auto hidden h-7 w-36 items-center gap-2 rounded-control border border-line-strong bg-panel px-2.5 text-[0.75rem] text-fg-muted md:flex">
          <Search className="size-3.5" aria-hidden />
          ค้นหา…
        </span>
        <Bell className="ml-auto size-4 text-fg-secondary md:ml-0" aria-hidden />
        <span className="flex size-6 items-center justify-center rounded-full border border-line-strong bg-panel-raised text-[0.625rem] font-semibold text-fg-secondary">
          US
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <nav
            aria-hidden
            className="hidden w-44 shrink-0 border-r border-line bg-nav p-2.5 md:block"
          >
            <ul className="space-y-0.5">
              {w.nav.slice(0, 7).map((item, i) => (
                <li
                  key={item.path}
                  className={cn(
                    'relative flex h-8 items-center gap-2 rounded-control px-2 text-[0.75rem]',
                    i === 0 ? 'bg-fill-active font-medium text-fg-primary' : 'text-fg-secondary',
                  )}
                >
                  {i === 0 && (
                    <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-[var(--ws-accent)]" />
                  )}
                  <item.icon
                    className={cn(
                      'size-3.5',
                      i === 0 ? 'text-[var(--ws-accent)]' : 'text-fg-muted',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)] p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function Header({ title, sub, action }: { title: string; sub: string; action?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-section text-fg-primary">{title}</p>
        <p className="mt-0.5 text-caption text-fg-secondary">{sub}</p>
      </div>
      {action && (
        <span className="hidden shrink-0 items-center rounded-control bg-brand-primary px-3 py-1.5 text-caption font-medium text-text-inverse sm:inline-flex">
          {action}
        </span>
      )}
    </div>
  );
}

function Box({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-panel border border-line bg-panel', className)}>
      <p className="px-4 pt-3 pb-2 text-caption font-medium text-fg-secondary">{title}</p>
      {children}
    </div>
  );
}

/* ---------- Sales ---------- */
const SO_COLS: Column<SalesOrderSample>[] = [
  {
    id: 'no',
    header: 'เลขที่ SO',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap">{r.no}</span>,
  },
  {
    id: 's',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.statusLabel} size="sm" />,
  },
  { id: 'c', header: 'ลูกค้า', cell: (r) => r.customer },
  { id: 'd', header: 'กำหนดส่ง', priority: 'medium', cell: (r) => r.due },
];
function SalesPreview() {
  return (
    <Window ws="sales">
      <Header
        title="คำสั่งซื้อและการส่งมอบ"
        sub="จากคำสั่งซื้อลูกค้า ถึงวันส่งมอบ"
        action="สร้าง Sales Order"
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Box title="Sales Order ที่ต้องติดตาม">
          <DataTable
            label="Sales Order (ตัวอย่าง)"
            columns={SO_COLS}
            rows={SALES_ORDERS}
            getRowId={(r) => r.no}
          />
        </Box>
        <Box title="SO-ตัวอย่าง-002" className="hidden p-0 lg:block">
          <div className="px-4 pb-4">
            <WorkflowTimeline
              orientation="vertical"
              label="ขั้นตอน (ตัวอย่าง)"
              steps={SALES_ORDERS[1]!.steps}
            />
          </div>
        </Box>
      </div>
    </Window>
  );
}

/* ---------- Operations ---------- */
const WORK = [
  {
    id: 'WO-ตัวอย่าง-001',
    so: 'SO-ตัวอย่าง-001',
    progress: 20,
    status: 'processing' as Status,
    label: undefined,
    due: '27 ต.ค.',
  },
  {
    id: 'WO-ตัวอย่าง-002',
    so: 'SO-ตัวอย่าง-002',
    progress: 45,
    status: 'warning' as Status,
    label: 'เสี่ยงล่าช้า',
    due: '24 ต.ค.',
  },
  {
    id: 'WO-ตัวอย่าง-003',
    so: 'SO-ตัวอย่าง-003',
    progress: 100,
    status: 'completed' as Status,
    label: 'ส่งต่อคลังแล้ว',
    due: '21 ต.ค.',
  },
];
function OperationsPreview() {
  const days = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'];
  return (
    <Window ws="operations">
      <Header
        title="Work Order และแผนงาน"
        sub="วางแผน ลงมือ ส่งต่อ — ตามจังหวะงานจริง"
        action="สร้าง Work Order"
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Box title="ความคืบหน้า">
          <ul className="divide-y divide-line">
            {WORK.map((w) => (
              <li key={w.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label font-medium whitespace-nowrap text-fg-primary">
                    {w.id}
                  </span>
                  <StatusBadge status={w.status} label={w.label} size="sm" />
                </div>
                <p className="mt-0.5 text-caption text-fg-muted">
                  {w.so} · กำหนด {w.due}
                </p>
                <div className="mt-2">
                  <ProgressBar
                    value={w.progress}
                    label={`${w.id} ความคืบหน้า`}
                    tone={w.status === 'warning' ? 'warning' : 'accent'}
                    showValue
                  />
                </div>
              </li>
            ))}
          </ul>
        </Box>
        <Box title="แผนงานสัปดาห์นี้" className="hidden lg:block">
          <div className="space-y-2 px-4 pb-4">
            {days.map((d, i) => (
              <div key={d} className="flex items-center gap-3">
                <span
                  className={cn(
                    'w-6 text-caption',
                    i === 2 ? 'font-semibold text-fg-primary' : 'text-fg-muted',
                  )}
                >
                  {d}
                </span>
                <span
                  className="h-5 rounded-full bg-[color-mix(in_oklab,var(--ws-accent)_25%,transparent)]"
                  style={{ width: `${[60, 80, 45, 70, 30][i]}%` }}
                />
              </div>
            ))}
          </div>
        </Box>
      </div>
    </Window>
  );
}

/* ---------- Warehouse ---------- */
const LOT_COLS: Column<LotExpiry>[] = [
  {
    id: 'lot',
    header: 'Lot',
    priority: 'primary',
    cell: (l) => <span className="whitespace-nowrap">{l.lot}</span>,
  },
  {
    id: 's',
    header: 'สถานะ',
    priority: 'status',
    cell: (l) =>
      l.daysLeft <= 30 ? (
        <StatusBadge status="warning" label={`เหลือ ${l.daysLeft} วัน`} size="sm" />
      ) : (
        <StatusBadge status="completed" label="พร้อมใช้" size="sm" />
      ),
  },
  { id: 'i', header: 'สินค้า', cell: (l) => l.item },
  { id: 'q', header: 'จำนวน', align: 'end', cell: (l) => l.quantity },
];
function WarehousePreview() {
  return (
    <Window ws="warehouse">
      <Header
        title="งานคลังวันนี้"
        sub="รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุก Lot"
        action="รับสินค้า"
      />
      <ul className="mb-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {TODAY.map((t) => (
          <li key={t.id} className="rounded-panel border border-line bg-panel p-3">
            <p className="truncate text-caption text-fg-secondary">{t.label}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={cn('text-metric tabular', t.count ? 'text-fg-primary' : 'text-fg-muted')}
              >
                {t.count}
              </span>
              <span className="truncate text-[0.6875rem] text-fg-muted">{t.unit}</span>
            </p>
          </li>
        ))}
      </ul>
      <Box title="Lot ตามลำดับ FEFO">
        <DataTable
          label="Lot ตามลำดับ FEFO (ตัวอย่าง)"
          columns={LOT_COLS}
          rows={FEFO_SAMPLE}
          getRowId={(l) => l.lot}
        />
      </Box>
    </Window>
  );
}

/* ---------- Purchasing ---------- */
const PO_COLS: Column<FollowUpSample>[] = [
  {
    id: 'po',
    header: 'PO',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap">{r.po}</span>,
  },
  {
    id: 's',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.statusLabel} size="sm" />,
  },
  { id: 'sup', header: 'Supplier', cell: (r) => r.supplier },
  {
    id: 'rcv',
    header: 'รับแล้ว',
    priority: 'medium',
    width: 'w-32',
    cell: (r) => (
      <ProgressBar
        value={r.received}
        label={`${r.po} รับแล้ว`}
        tone={r.status === 'overdue' ? 'danger' : 'accent'}
        showValue
      />
    ),
  },
];
function PurchasingPreview() {
  return (
    <Window ws="purchasing">
      <Header
        title="ใบขอซื้อถึงการรับของ"
        sub="จากความต้องการ ถึงรับของครบ"
        action="สร้างใบขอซื้อ"
      />
      <div className="grid gap-3">
        <Box title="ติดตามการรับ">
          <DataTable
            label="PO ที่ต้องติดตาม (ตัวอย่าง)"
            columns={PO_COLS}
            rows={FOLLOW_UP}
            getRowId={(r) => r.po}
          />
        </Box>
        <Box title="งานของฉัน" className="hidden sm:block">
          <TaskList tasks={PURCHASING_TASKS.slice(0, 1)} label="งานของฉัน (ตัวอย่าง)" />
        </Box>
      </div>
    </Window>
  );
}

/* ---------- Accounting (documents & states — no amounts) ---------- */
const PAY = [
  {
    no: 'PAY-ตัวอย่าง-07',
    kind: 'มัดจำ',
    ref: 'PO-ตัวอย่าง-015',
    status: 'pending' as Status,
    label: 'รออนุมัติ',
  },
  {
    no: 'PAY-ตัวอย่าง-08',
    kind: 'ส่วนที่เหลือ',
    ref: 'PO-ตัวอย่าง-011',
    status: 'warning' as Status,
    label: 'เอกสารไม่ครบ',
  },
  {
    no: 'PAY-ตัวอย่าง-05',
    kind: 'ส่วนที่เหลือ',
    ref: 'PO-ตัวอย่าง-009',
    status: 'completed' as Status,
    label: 'จ่ายแล้ว',
  },
];
type Pay = (typeof PAY)[number];
const PAY_COLS: Column<Pay>[] = [
  {
    id: 'no',
    header: 'คำขอจ่าย',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap">{r.no}</span>,
  },
  {
    id: 's',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.label} size="sm" />,
  },
  { id: 'k', header: 'ประเภท', cell: (r) => r.kind },
  { id: 'r', header: 'อ้างอิง', priority: 'medium', cell: (r) => r.ref },
];
function AccountingPreview() {
  const docs = [
    { name: 'ใบสั่งซื้อ (PO) อนุมัติแล้ว', ok: true },
    { name: 'ใบรับสินค้า (GR) จากคลัง', ok: true },
    { name: 'ใบแจ้งหนี้จาก Supplier', ok: false },
  ];
  return (
    <Window ws="accounting">
      <Header title="การจ่ายเงิน" sub="จ่ายถูกต้อง เมื่อเอกสารครบ" action="สร้างคำขอจ่าย" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Box title="คำขอจ่าย">
          <DataTable
            label="คำขอจ่าย (ตัวอย่าง)"
            columns={PAY_COLS}
            rows={PAY}
            getRowId={(r) => r.no}
          />
        </Box>
        <Box title="เงื่อนไขก่อนจ่าย" className="hidden lg:block">
          <ul className="space-y-2.5 px-4 pb-4">
            {docs.map((d) => (
              <li key={d.name} className="flex items-center gap-2.5 text-caption">
                {d.ok ? (
                  <Check className="size-4 text-success" aria-hidden />
                ) : (
                  <CircleDashed className="size-4 text-fg-muted" aria-hidden />
                )}
                <span className={d.ok ? 'text-fg-primary' : 'text-fg-muted'}>{d.name}</span>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </Window>
  );
}

/* ---------- Executive (qualitative states only) ---------- */
const EXCEPTIONS: ExceptionRecord[] = [
  {
    id: 'e1',
    severity: 'high',
    title: 'PO ส่งล่าช้า',
    reference: 'PO-ตัวอย่าง-014',
    department: 'จัดซื้อ',
    time: 'เลยกำหนด 1 วัน',
    reason: 'กระทบ Work Order ที่รอวัตถุดิบ',
    actionLabel: 'ดู',
  },
  {
    id: 'e2',
    severity: 'medium',
    title: 'LOT ใกล้หมดอายุ',
    reference: 'LOT-A',
    department: 'คลังสินค้า',
    time: 'เหลือ 18 วัน',
    reason: 'ควรจ่ายออกก่อนตามหลัก FEFO',
    actionLabel: 'ดู',
  },
];
export function ExecutivePreview({ compact = false }: { compact?: boolean }) {
  return (
    <Window ws="executive" sidebar={compact}>
      <Header title="ภาพรวมองค์กร" sub="ทุกแผนกบนข้อมูลชุดเดียวกัน — ตัดสินใจจากข้อยกเว้น" />
      <div className={cn('grid gap-3', !compact && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]')}>
        <Box title="สถานะรายแผนก">
          <ul className="divide-y divide-line">
            {DEPARTMENT_SUMMARY.map((d) => {
              const w = WORKSPACES[d.id];
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                  style={{ '--ws-accent': w.accent } as CSSProperties}
                >
                  <w.icon className="size-3.5 shrink-0 text-[var(--ws-accent)]" aria-hidden />
                  <span className="flex-1 truncate text-caption text-fg-primary">{w.shortTh}</span>
                  <StatusBadge status={d.status} label={d.statusLabel} size="sm" />
                </li>
              );
            })}
          </ul>
        </Box>
        <Box title="ข้อยกเว้นที่ต้องตัดสินใจ" className={compact ? 'hidden sm:block' : undefined}>
          <div className="border-t border-line">
            <ExceptionList items={EXCEPTIONS} label="ข้อยกเว้น (ตัวอย่าง)" />
          </div>
        </Box>
      </div>
    </Window>
  );
}

const PREVIEWS = {
  sales: SalesPreview,
  operations: OperationsPreview,
  warehouse: WarehousePreview,
  purchasing: PurchasingPreview,
  accounting: AccountingPreview,
  executive: () => <ExecutivePreview compact />,
} as const;

export default function WorldPreview({ id }: { id: keyof typeof PREVIEWS }) {
  const P = PREVIEWS[id];
  return <P />;
}
