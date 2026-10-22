import {
  ArrowUpRight,
  Boxes,
  Hourglass,
  ListChecks,
  Lock,
  PackageCheck,
  ScanBarcode,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  ActivityFeed,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  SampleTag,
  SectionHeader,
  StatusBadge,
  SummaryList,
  WorkflowTimeline,
  type Column,
} from '@/components/core';
import { ScanDialog } from '@/components/shell/ScanDialog';
import { cn } from '@/lib/cn';
import { workspacePath } from '../registry';
import { FEFO_SAMPLE, LOT_STEPS, TODAY, type LotExpiry, type WarehouseTask } from './data';

const TASK_ICON: Record<WarehouseTask['id'], typeof Boxes> = {
  receiving: PackageCheck,
  stock: Boxes,
  expiry: Hourglass,
  'stock-count': ListChecks,
};

const lotStatus = (l: LotExpiry) =>
  l.daysLeft <= 30 ? (
    <StatusBadge status="warning" label={`เหลือ ${l.daysLeft} วัน`} size="sm" />
  ) : (
    <StatusBadge status="completed" label="พร้อมใช้" size="sm" />
  );

const LOT_COLUMNS: Column<LotExpiry>[] = [
  { id: 'lot', header: 'Lot', priority: 'primary', cell: (l) => l.lot },
  { id: 'status', header: 'สถานะ', priority: 'status', cell: lotStatus },
  { id: 'item', header: 'สินค้า', cell: (l) => l.item },
  { id: 'qty', header: 'จำนวน', align: 'end', cell: (l) => l.quantity },
  { id: 'exp', header: 'วันหมดอายุ', priority: 'medium', cell: (l) => l.expires },
  { id: 'loc', header: 'ตำแหน่ง', priority: 'low', cell: (l) => l.location },
];

export default function WarehouseDashboard() {
  const [scanOpen, setScanOpen] = useState(false);
  const [lot, setLot] = useState<LotExpiry | null>(null);

  return (
    <>
      <PageHeader
        title="งานคลังวันนี้"
        description="รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุก Lot"
        actions={
          <>
            <Button icon={ScanBarcode} onClick={() => setScanOpen(true)} className="max-md:hidden">
              สแกน
            </Button>
            <LinkButton
              to={workspacePath('warehouse', 'receiving')}
              variant="primary"
              icon={PackageCheck}
            >
              รับสินค้า
            </LinkButton>
          </>
        }
      />

      <p className="mb-8 flex items-start gap-3 rounded-panel border border-line bg-panel px-5 py-3.5 text-label text-fg-secondary">
        <Lock className="mt-1 size-4 shrink-0 text-[var(--ws-accent)]" aria-hidden />
        <span>
          พื้นที่ทำงานนี้แสดงเฉพาะจำนวน Lot และวันที่ —{' '}
          <strong className="font-semibold text-fg-primary">
            ข้อมูลต้นทุนและราคาไม่ถูกส่งมาจากเซิร์ฟเวอร์
          </strong>
        </span>
      </p>

      {/* Task-first: four large, thumb-sized entry points */}
      <section aria-labelledby="wh-today" className="mb-10">
        <SectionHeader id="wh-today" title="สิ่งที่ต้องทำ" aside={<SampleTag />} />
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {TODAY.map((task) => {
            const Icon = TASK_ICON[task.id];
            const idle = task.count === 0;
            return (
              <li key={task.id}>
                <Link
                  to={workspacePath('warehouse', task.id)}
                  className="group flex h-full min-h-24 items-center gap-4 rounded-panel border border-line bg-panel p-4 transition-colors hover:border-line-strong hover:bg-panel-raised sm:p-5"
                >
                  <span
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-control',
                      idle
                        ? 'bg-fill-muted'
                        : 'bg-[color-mix(in_oklab,var(--ws-accent)_12%,transparent)]',
                    )}
                  >
                    <Icon
                      className={cn('size-5.5', idle ? 'text-fg-muted' : 'text-[var(--ws-accent)]')}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label text-fg-secondary">{task.label}</span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={cn(
                          'text-metric tabular',
                          idle ? 'text-fg-muted' : 'text-fg-primary',
                        )}
                      >
                        {task.count}
                      </span>
                      <span className="text-caption text-fg-muted">{task.unit}</span>
                    </span>
                    <span className="block text-caption text-fg-muted">{task.note}</span>
                  </span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-fg-muted transition-colors group-hover:text-fg-primary"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          flush
          title="Lot ตามลำดับ FEFO"
          description="หมดอายุก่อน จ่ายออกก่อน"
          actions={<SampleTag />}
        >
          <DataTable
            label="Lot ตามลำดับ FEFO"
            columns={LOT_COLUMNS}
            rows={FEFO_SAMPLE}
            getRowId={(l) => l.lot}
            onRowClick={setLot}
          />
        </Panel>

        <Panel title="รับสินค้าวันนี้" description="ระบบไม่อนุญาตให้รับเกินจำนวนในใบสั่งซื้อ">
          <EmptyState
            layout="compact"
            icon={PackageCheck}
            title="ยังไม่มีรายการเข้าคลัง"
            description="เมื่อฝ่ายจัดซื้อออก PO รายการที่ถึงกำหนดรับจะปรากฏที่นี่ พร้อมขั้นตอนตรวจ QC"
            action={
              <Button size="sm" soon>
                เริ่มรับสินค้า
              </Button>
            }
          />
        </Panel>
      </div>

      <Drawer
        open={lot !== null}
        onClose={() => setLot(null)}
        subtitle="Lot / Batch"
        title={lot?.lot ?? ''}
        headerExtra={lot && lotStatus(lot)}
        footer={
          <Button variant="ghost" onClick={() => setLot(null)}>
            ปิด
          </Button>
        }
      >
        {lot && (
          <div className="space-y-8">
            <SummaryList
              columns={1}
              items={[
                { label: 'สินค้า', value: lot.item },
                { label: 'จำนวนคงเหลือ', value: lot.quantity },
                { label: 'ตำแหน่ง', value: lot.location },
                { label: 'วันที่รับเข้า', value: lot.received },
                { label: 'วันหมดอายุ', value: `${lot.expires} · เหลือ ${lot.daysLeft} วัน` },
              ]}
            />
            <section>
              <h3 className="mb-4 text-section text-fg-primary">เส้นทางของ Lot</h3>
              <WorkflowTimeline
                orientation="vertical"
                label={`เส้นทางของ ${lot.lot}`}
                steps={LOT_STEPS}
              />
            </section>
            <section>
              <h3 className="mb-3 text-section text-fg-primary">การเคลื่อนไหวล่าสุด</h3>
              <ActivityFeed
                entries={[
                  { who: 'ทีมคลัง', what: `จัดเก็บที่ ${lot.location}`, when: lot.received },
                  { who: 'QC', what: 'ผ่านการตรวจ', when: lot.received },
                  { who: 'ทีมคลัง', what: 'รับเข้าตาม PO', when: lot.received },
                ]}
              />
            </section>
          </div>
        )}
      </Drawer>

      <ScanDialog open={scanOpen} onClose={() => setScanOpen(false)} />
    </>
  );
}
