import { CircleCheck, CircleDashed, Plus, Receipt, Wallet } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  SampleTag,
  SectionHeader,
  StatusBadge,
  type Column,
  type Status,
} from '@/components/core';

/* Minimal sample content for UX review only. Amounts are illustrative. */

interface PendingPayment {
  no: string;
  kind: string;
  ref: string;
  amount: string;
  due: string;
  status: Status;
  statusLabel?: string;
}

const PENDING: PendingPayment[] = [
  {
    no: 'PAY-ตัวอย่าง-07',
    kind: 'มัดจำ',
    ref: 'PO-ตัวอย่าง-015',
    amount: '฿ 25,000',
    due: 'วันนี้',
    status: 'pending',
    statusLabel: 'ครบกำหนดวันนี้',
  },
  {
    no: 'PAY-ตัวอย่าง-08',
    kind: 'ส่วนที่เหลือ',
    ref: 'PO-ตัวอย่าง-011',
    amount: '฿ 48,500',
    due: '27 ต.ค.',
    status: 'warning',
    statusLabel: 'เอกสารไม่ครบ',
  },
];

const COLUMNS: Column<PendingPayment>[] = [
  {
    id: 'no',
    header: 'เลขที่',
    priority: 'primary',
    cell: (r) => <span className="whitespace-nowrap tabular">{r.no}</span>,
  },
  {
    id: 'status',
    header: 'สถานะ',
    priority: 'status',
    cell: (r) => <StatusBadge status={r.status} label={r.statusLabel} size="sm" />,
  },
  { id: 'kind', header: 'ประเภท', cell: (r) => r.kind },
  {
    id: 'amount',
    header: 'ยอดเงิน',
    align: 'end',
    cell: (r) => <span className="text-fg-primary">{r.amount}</span>,
  },
  { id: 'ref', header: 'อ้างอิง', priority: 'medium', cell: (r) => r.ref },
  { id: 'due', header: 'กำหนดชำระ', priority: 'low', cell: (r) => r.due },
];

const REQUIRED_DOCS = [
  { name: 'ใบสั่งซื้อ (PO) ได้รับอนุมัติ', ready: true },
  { name: 'ใบรับสินค้า (GR) จากคลัง', ready: true },
  { name: 'ใบแจ้งหนี้จาก Supplier', ready: false },
];

export default function AccountingDashboard() {
  return (
    <>
      <PageHeader
        title="การจ่ายเงิน"
        description="จ่ายถูกต้อง เมื่อเอกสารครบ — ทุกการจ่ายผูกกับ PO และใบรับสินค้า"
        actions={
          <Button variant="primary" icon={Plus} soon>
            สร้างคำขอจ่าย
          </Button>
        }
      />

      <section aria-labelledby="acc-summary" className="mb-10">
        <SectionHeader id="acc-summary" title="สรุป" aside={<SampleTag />} />
        <KpiGrid columns={3}>
          <Kpi variant="primary" label="ยอดค้างจ่าย" value="฿ 73,500" supporting="Supplier 2 ราย" />
          <Kpi
            label="รอชำระ"
            value={2}
            unit="รายการ"
            icon={Wallet}
            supporting="มัดจำ 1 · ส่วนที่เหลือ 1"
          />
          <Kpi
            label="คำขอจ่ายรอตรวจ"
            value={0}
            unit="รายการ"
            icon={Receipt}
            supporting="ไม่มีรายการค้าง"
          />
        </KpiGrid>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Panel flush title="รอชำระ" actions={<SampleTag />}>
            <DataTable
              label="รายการรอชำระ"
              columns={COLUMNS}
              rows={PENDING}
              getRowId={(r) => r.no}
            />
          </Panel>
          <Panel
            title="คำขอจ่าย"
            description="จ่ายได้เมื่อได้รับอนุมัติและเอกสารอ้างอิงครบเท่านั้น"
          >
            <EmptyState
              layout="inline"
              kind="clear"
              title="ไม่มีรายการค้าง"
              description="คำขอจ่ายที่ผูกกับใบสั่งซื้อและใบรับสินค้าจะเข้ามาที่นี่"
            />
          </Panel>
        </div>

        <Panel title="เงื่อนไขก่อนจ่าย" description="ระบบตรวจเอกสารที่เชื่อมโยงกันให้อัตโนมัติ">
          <ul className="space-y-3.5">
            {REQUIRED_DOCS.map((d) => (
              <li key={d.name} className="flex items-center gap-3 text-label">
                {d.ready ? (
                  <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDashed className="size-5 shrink-0 text-fg-muted" aria-hidden />
                )}
                <span className={d.ready ? 'text-fg-primary' : 'text-fg-muted'}>{d.name}</span>
                <span className="ml-auto text-caption text-fg-muted">
                  {d.ready ? 'ครบ' : 'ยังไม่มี'}
                </span>
              </li>
            ))}
          </ul>
          <Button block disabled className="mt-7">
            บันทึกการจ่าย — รอเอกสารครบ
          </Button>
          <p className="mt-3 text-caption text-fg-muted">
            ตัวอย่างการป้องกันความผิดพลาด: ปุ่มจ่ายจะเปิดเมื่อเอกสารครบทุกใบ
          </p>
        </Panel>
      </div>
    </>
  );
}
