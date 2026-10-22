import { ExternalLink, FileInput, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  ActivityFeed,
  Button,
  DataTable,
  Drawer,
  LinkButton,
  PageHeader,
  Panel,
  RelatedDocuments,
  SampleTag,
  SectionHeader,
  StageCounts,
  StatusBadge,
  SummaryList,
  TaskList,
  WorkflowTimeline,
  type Column,
} from '@/components/core';
import { workspacePath } from '../registry';
import { SALES_ORDERS, SALES_TASKS, type SalesOrderSample } from './data';

const FLOW = [
  { label: 'Customer PO', count: 2, hint: 'รับจากลูกค้า' },
  { label: 'Sales Order', count: 3, hint: 'ยืนยันแล้ว' },
  { label: 'ตรวจ Stock', count: 1, hint: 'พร้อมส่ง / ส่งผลิต' },
  { label: 'จัดส่ง', count: 1, hint: 'อยู่ระหว่างส่ง' },
  { label: 'ปิดงาน', count: 0, hint: 'ส่งครบแล้ว' },
];

const COLUMNS: Column<SalesOrderSample>[] = [
  {
    id: 'no',
    header: 'เลขที่ SO',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap tabular">{r.no}</span>,
  },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.statusLabel} size="sm" />,
  },
  { id: 'customer', header: 'ลูกค้า', cell: (r) => r.customer },
  { id: 'due', header: 'กำหนดส่ง', cell: (r) => r.due },
  {
    id: 'step',
    header: 'ขั้นตอน',
    priority: 'medium',
    cell: (r) => r.steps.find((s) => s.state === 'current')?.label ?? '—',
  },
  {
    id: 'cpo',
    header: 'Customer PO',
    priority: 'low',
    cell: (r) => <span className="whitespace-nowrap tabular">{r.customerPo}</span>,
  },
];

export default function SalesDashboard() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState<SalesOrderSample | null>(null);

  return (
    <>
      <PageHeader
        title="คำสั่งซื้อและการส่งมอบ"
        description="จากคำสั่งซื้อลูกค้า ถึงวันส่งมอบ — ทุกขั้นเห็นสถานะเดียวกันทั้งบริษัท"
        actions={
          <>
            <LinkButton to={workspacePath('sales', 'customer-po')} icon={FileInput}>
              Customer PO
            </LinkButton>
            <Button variant="primary" icon={Plus} soon>
              สร้าง Sales Order
            </Button>
          </>
        }
      />

      <section aria-labelledby="sales-flow" className="mb-10">
        <SectionHeader id="sales-flow" title="เส้นทางงานขาย" aside={<SampleTag />} />
        <StageCounts stages={FLOW} label="จำนวนเอกสารในแต่ละขั้นของงานขาย" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel
          flush
          title="Sales Order ที่ต้องติดตาม"
          description="เลือกแถวเพื่อดูรายละเอียดและขั้นตอน"
          actions={<SampleTag />}
        >
          <DataTable
            label="Sales Order ที่ต้องติดตาม"
            columns={COLUMNS}
            rows={SALES_ORDERS}
            getRowId={(r) => r.no}
            onRowClick={setOpen}
            selection={{ selected, onChange: setSelected }}
            bulkActions={
              <Button size="sm" soon>
                ส่งออก
              </Button>
            }
            rowActions={(r) => [
              { label: 'ดูรายละเอียด', onSelect: () => setOpen(r) },
              { label: 'พิมพ์ใบสั่งขาย', disabled: true, hint: 'เร็ว ๆ นี้' },
              'separator',
              { label: 'ยกเลิก SO', disabled: true, danger: true, hint: 'เร็ว ๆ นี้' },
            ]}
          />
        </Panel>

        <Panel
          flush
          title="งานของฉัน"
          description="สิ่งที่ต้องทำต่อ เรียงตามความสำคัญ"
          actions={<SampleTag />}
        >
          <div className="border-t border-line">
            <TaskList tasks={SALES_TASKS} label="งานของฉันในฝ่ายขาย" />
          </div>
        </Panel>
      </div>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        subtitle="Sales Order"
        title={open?.no ?? ''}
        headerExtra={open && <StatusBadge status={open.status} label={open.statusLabel} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              ปิด
            </Button>
            <Button icon={ExternalLink} soon>
              เปิดหน้าเอกสาร
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-8">
            <SummaryList
              columns={1}
              items={[
                { label: 'ลูกค้า', value: open.customer },
                { label: 'กำหนดส่ง', value: open.due },
                { label: 'Customer PO', value: open.customerPo },
              ]}
            />
            <section>
              <h3 className="mb-4 text-section text-fg-primary">ขั้นตอน</h3>
              <WorkflowTimeline
                orientation="vertical"
                label={`ขั้นตอนของ ${open.no}`}
                steps={open.steps}
              />
            </section>
            <section>
              <h3 className="mb-3 text-section text-fg-primary">เอกสารที่เกี่ยวข้อง</h3>
              <RelatedDocuments
                docs={[
                  {
                    type: 'Customer PO',
                    number: open.customerPo,
                    status: <StatusBadge status="closed" size="sm" />,
                  },
                  {
                    type: 'Work Order',
                    number: 'WO-ตัวอย่าง-002',
                    status: <StatusBadge status="processing" size="sm" />,
                  },
                ]}
              />
            </section>
            <section>
              <h3 className="mb-3 text-section text-fg-primary">ความเคลื่อนไหว</h3>
              <ActivityFeed
                entries={[
                  { who: 'ฝ่ายปฏิบัติการ', what: 'เริ่ม Work Order', when: 'วันนี้ 09:10' },
                  { who: 'ระบบ', what: 'ตรวจ Stock — ต้องผลิตเพิ่ม', when: 'เมื่อวาน 16:42' },
                  {
                    who: 'ฝ่ายขาย',
                    what: 'สร้าง Sales Order จาก Customer PO',
                    when: 'เมื่อวาน 15:05',
                  },
                ]}
              />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
