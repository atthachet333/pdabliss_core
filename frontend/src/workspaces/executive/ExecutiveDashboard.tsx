import { BarChart3, Eye, Stamp, UserPlus } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  ExceptionList,
  Kpi,
  KpiGrid,
  LinkButton,
  PageHeader,
  Panel,
  PrototypeTag,
  SampleTag,
  SectionHeader,
  SummaryList,
  WorkflowTimeline,
  type ExceptionRecord,
} from '@/components/core';
import { workspacePath } from '../registry';
import { DepartmentGrid } from './DepartmentGrid';

/* Minimal sample content for UX review only. */
const EXCEPTIONS: ExceptionRecord[] = [
  {
    id: 'ex1',
    severity: 'high',
    title: 'PO ส่งล่าช้า',
    reference: 'PO-ตัวอย่าง-014',
    department: 'จัดซื้อ',
    time: 'เลยกำหนด 1 วัน',
    reason: 'Supplier ยังไม่ส่งของ — กระทบ Work Order ที่รอวัตถุดิบ',
    actionLabel: 'ดูรายละเอียด',
  },
  {
    id: 'ex2',
    severity: 'medium',
    title: 'LOT ใกล้หมดอายุ',
    reference: 'LOT-A',
    department: 'คลังสินค้า',
    time: 'เหลือ 18 วัน',
    reason: 'ควรจ่ายออกก่อนตามหลัก FEFO หรือวางแผนใช้',
    actionLabel: 'ดูรายละเอียด',
  },
  {
    id: 'ex3',
    severity: 'medium',
    title: 'SO ใกล้กำหนดส่ง',
    reference: 'SO-ตัวอย่าง-002',
    department: 'ฝ่ายขาย',
    time: 'ครบกำหนดใน 2 วัน',
    reason: 'งานผลิตยังอยู่ระหว่างดำเนินการ ความคืบหน้า 45%',
    actionLabel: 'ดูรายละเอียด',
  },
];

export default function ExecutiveDashboard() {
  const [open, setOpen] = useState<ExceptionRecord | null>(null);

  return (
    <>
      <PageHeader
        title="ภาพรวมองค์กร"
        description="ทุกแผนกบนข้อมูลชุดเดียวกัน — ดูภาพรวม และตัดสินใจจากข้อยกเว้น"
        status={
          <Badge tone="outline" icon={Eye}>
            มุมมองอ่านเป็นหลัก
          </Badge>
        }
        actions={
          <LinkButton to={workspacePath('executive', 'reports')} icon={BarChart3}>
            รายงาน
          </LinkButton>
        }
      />

      <section aria-labelledby="exec-today" className="mb-10">
        <SectionHeader id="exec-today" title="สรุปวันนี้" aside={<SampleTag />} />
        <KpiGrid columns={3}>
          <Kpi
            variant="alert"
            label="Exception ที่ต้องตัดสินใจ"
            value={3}
            unit="เรื่อง"
            supporting="สูง 1 · ปานกลาง 2"
          />
          <Kpi
            label="งานเสี่ยงล่าช้า"
            value={1}
            unit="งาน"
            supporting="ปฏิบัติการ"
            trend={{ direction: 'flat', label: 'เท่าเมื่อวาน' }}
          />
          <Kpi
            label="รอการอนุมัติ"
            value={0}
            unit="รายการ"
            supporting="ขั้นตอนอนุมัติจะเปิดใช้ภายหลัง"
          />
        </KpiGrid>
      </section>

      <section aria-labelledby="exec-departments" className="mb-10">
        <SectionHeader
          id="exec-departments"
          title="แผนก"
          description="เลือกแผนกเพื่อเข้าดูพื้นที่ทำงาน — ลิงก์นี้ใช้สำหรับตรวจต้นแบบ สิทธิ์จริงกำหนดภายหลัง"
          aside={<SampleTag />}
        />
        <DepartmentGrid />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          flush
          title="Exception ที่ต้องตัดสินใจ"
          description="ยกขึ้นมาเฉพาะสิ่งที่ผิดไปจากแผน เรียงตามความรุนแรง"
          actions={<SampleTag />}
        >
          <div className="border-t border-line">
            <ExceptionList
              items={EXCEPTIONS}
              label="Exception ที่ต้องตัดสินใจ"
              onAction={setOpen}
            />
          </div>
        </Panel>

        <Panel title="การอนุมัติ" actions={<PrototypeTag>เร็ว ๆ นี้</PrototypeTag>}>
          <EmptyState
            kind="clear"
            layout="compact"
            icon={Stamp}
            title="ไม่มีรายการรออนุมัติ"
            description="เอกสารที่ต้องให้ผู้บริหารอนุมัติตามวงเงินจะรวมไว้ที่นี่"
          />
        </Panel>
      </div>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        subtitle={open ? `${open.department} · ${open.reference}` : undefined}
        title={open?.title ?? ''}
        headerExtra={<SampleTag />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              ปิด
            </Button>
            <Button variant="primary" icon={UserPlus} soon>
              มอบหมายผู้รับผิดชอบ
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-8">
            <p className="text-label text-fg-secondary">{open.reason}</p>
            <SummaryList
              columns={1}
              items={[
                { label: 'อ้างอิง', value: open.reference },
                { label: 'แผนก', value: open.department },
                { label: 'เวลา', value: open.time },
                { label: 'ผู้รับผิดชอบ', value: 'ยังไม่ได้มอบหมาย' },
              ]}
            />
            <section>
              <h3 className="mb-4 text-section text-fg-primary">การติดตาม</h3>
              <WorkflowTimeline
                orientation="vertical"
                label="ขั้นตอนการจัดการ Exception"
                steps={[
                  { label: 'ตรวจพบ', state: 'completed', meta: 'ระบบ' },
                  { label: 'มอบหมายผู้รับผิดชอบ', state: 'current' },
                  { label: 'แก้ไข', state: 'upcoming' },
                  { label: 'ปิดเรื่อง', state: 'upcoming' },
                ]}
              />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
