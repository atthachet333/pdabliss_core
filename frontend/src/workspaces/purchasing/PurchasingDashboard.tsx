import { ExternalLink, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  ActivityFeed,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  RelatedDocuments,
  SampleTag,
  SectionHeader,
  StageCounts,
  StatusBadge,
  SummaryList,
  Tabs,
  TaskList,
  WorkflowTimeline,
  type Column,
} from '@/components/core';
import { FOLLOW_UP, PURCHASING_TASKS, type FollowUpSample } from './data';

const PIPELINE = [
  { label: 'PR ใหม่', count: 1, hint: 'จากคลัง / ปฏิบัติการ' },
  { label: 'รออนุมัติ', count: 2, hint: 'ผู้ขออนุมัติเองไม่ได้' },
  { label: 'PO เปิดอยู่', count: 3, hint: 'รอ Supplier ส่ง' },
  { label: 'รับครบ', count: 0, hint: 'ปิด PO ได้' },
];

const COLUMNS: Column<FollowUpSample>[] = [
  {
    id: 'po',
    header: 'PO',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap tabular">{r.po}</span>,
  },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.statusLabel} size="sm" />,
  },
  { id: 'supplier', header: 'Supplier', cell: (r) => r.supplier },
  { id: 'due', header: 'กำหนดส่ง', cell: (r) => r.due },
  {
    id: 'received',
    header: 'รับแล้ว',
    priority: 'medium',
    width: 'w-40',
    cell: (r) => (
      <ProgressBar
        value={r.received}
        label={`${r.po} รับแล้ว ${r.received}%`}
        tone={r.status === 'overdue' ? 'danger' : 'accent'}
        showValue
      />
    ),
  },
];

const PO_TABS = [
  { id: 'detail', label: 'รายละเอียด' },
  { id: 'lines', label: 'รายการ' },
  { id: 'receipts', label: 'การรับสินค้า' },
  { id: 'payments', label: 'การจ่ายเงิน' },
  { id: 'history', label: 'ประวัติ' },
];

export default function PurchasingDashboard() {
  const [open, setOpen] = useState<FollowUpSample | null>(null);
  const [tab, setTab] = useState('detail');

  return (
    <>
      <PageHeader
        title="ใบขอซื้อถึงการรับของ"
        description="จากความต้องการ ถึงรับของครบ — ติดตามทุก PO จนปิด"
        actions={
          <Button variant="primary" icon={Plus} soon>
            สร้างใบขอซื้อ
          </Button>
        }
      />

      <section aria-labelledby="pur-flow" className="mb-10">
        <SectionHeader id="pur-flow" title="PR → PO" aside={<SampleTag />} />
        <StageCounts stages={PIPELINE} label="จำนวนเอกสารในแต่ละขั้นของงานจัดซื้อ" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          flush
          title="ติดตามการรับ"
          description="อัปเดตจากการรับของของคลังโดยอัตโนมัติ"
          actions={<SampleTag />}
        >
          <DataTable
            label="PO ที่ต้องติดตามการรับ"
            columns={COLUMNS}
            rows={FOLLOW_UP}
            getRowId={(r) => r.po}
            onRowClick={(r) => {
              setTab('detail');
              setOpen(r);
            }}
          />
        </Panel>

        <Panel flush title="งานของฉัน" actions={<SampleTag />}>
          <div className="border-t border-line">
            <TaskList tasks={PURCHASING_TASKS} label="งานของฉันในงานจัดซื้อ" />
          </div>
        </Panel>
      </div>

      {/* Generic record-detail template (no PO business logic). */}
      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        size="lg"
        subtitle="ใบสั่งซื้อ (PO)"
        title={open?.po ?? ''}
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
          <Tabs label="ส่วนของเอกสาร" tabs={PO_TABS} value={tab} onChange={setTab}>
            {tab === 'detail' && (
              <div className="space-y-8">
                <SummaryList
                  items={[
                    { label: 'Supplier', value: open.supplier },
                    { label: 'กำหนดส่ง', value: open.due },
                    { label: 'PR อ้างอิง', value: open.pr },
                    { label: 'รับแล้ว', value: `${open.received}%` },
                  ]}
                />
                <WorkflowTimeline
                  orientation="vertical"
                  label={`ขั้นตอนของ ${open.po}`}
                  steps={[
                    { label: 'PR อนุมัติ', state: 'completed' },
                    { label: 'ออก PO', state: 'completed' },
                    {
                      label: 'รับสินค้า',
                      state: open.status === 'overdue' ? 'blocked' : 'current',
                      note: open.status === 'overdue' ? 'Supplier ส่งล่าช้า' : undefined,
                    },
                    { label: 'ปิด PO', state: 'upcoming' },
                  ]}
                />
                <RelatedDocuments
                  docs={[
                    {
                      type: 'ใบขอซื้อ (PR)',
                      number: open.pr,
                      status: <StatusBadge status="completed" size="sm" />,
                    },
                  ]}
                />
              </div>
            )}
            {tab === 'lines' && (
              <EmptyState
                layout="compact"
                title="รายการสินค้าจะแสดงเมื่อเชื่อมข้อมูล"
                description="แต่ละบรรทัดจะมีจำนวนสั่ง จำนวนรับแล้ว และคงค้าง"
              />
            )}
            {tab === 'receipts' && (
              <EmptyState
                layout="compact"
                title="ยังไม่มีใบรับสินค้า (GR)"
                description="ใบรับสินค้าจากคลังจะผูกกับ PO นี้โดยอัตโนมัติ"
              />
            )}
            {tab === 'payments' && (
              <EmptyState
                layout="compact"
                title="ยังไม่มีการจ่ายเงิน"
                description="คำขอจ่ายและการจ่ายเงินที่อ้างอิง PO นี้จะแสดงที่นี่"
              />
            )}
            {tab === 'history' && (
              <ActivityFeed
                entries={[
                  {
                    who: 'คลังสินค้า',
                    what: `รับสินค้าแล้ว ${open.received}%`,
                    when: 'วันนี้ 10:20',
                  },
                  { who: 'จัดซื้อ', what: 'ออก PO', when: '15 ต.ค.' },
                  { who: 'ผู้อนุมัติ', what: 'อนุมัติ PR', when: '14 ต.ค.' },
                ]}
              />
            )}
          </Tabs>
        )}
      </Drawer>
    </>
  );
}
