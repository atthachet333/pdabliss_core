import type { ExceptionRecord, Status, Task, WorkflowStep } from '@/components/core';

/* Design Lab sample content — illustrative only, never shown in workspaces. */

export interface LabDoc {
  no: string;
  title: string;
  dept: string;
  due: string;
  owner: string;
  status: Status;
}

export const LAB_DOCS: readonly LabDoc[] = [
  {
    no: 'DOC-001',
    title: 'เอกสารตัวอย่าง',
    dept: 'จัดซื้อ',
    due: '24 ต.ค.',
    owner: 'ทีม A',
    status: 'processing',
  },
  {
    no: 'DOC-002',
    title: 'ใบขอซื้อวัตถุดิบ',
    dept: 'คลังสินค้า',
    due: '25 ต.ค.',
    owner: 'ทีม B',
    status: 'pending',
  },
  {
    no: 'DOC-003',
    title: 'ใบสั่งขายตัวอย่าง',
    dept: 'ฝ่ายขาย',
    due: '22 ต.ค.',
    owner: 'ทีม A',
    status: 'overdue',
  },
  {
    no: 'DOC-004',
    title: 'รับสินค้าบางส่วน',
    dept: 'คลังสินค้า',
    due: '27 ต.ค.',
    owner: 'ทีม C',
    status: 'partial',
  },
  {
    no: 'DOC-005',
    title: 'งานผลิตตัวอย่าง',
    dept: 'ปฏิบัติการ',
    due: '20 ต.ค.',
    owner: 'ทีม B',
    status: 'completed',
  },
  {
    no: 'DOC-006',
    title: 'คำขอที่ถูกยกเลิก',
    dept: 'จัดซื้อ',
    due: '18 ต.ค.',
    owner: 'ทีม A',
    status: 'cancelled',
  },
];

export const LAB_STEPS: readonly WorkflowStep[] = [
  { label: 'รับออเดอร์', state: 'completed', meta: 'ฝ่ายขาย' },
  { label: 'ตรวจ Stock', state: 'completed', meta: 'คลังสินค้า' },
  { label: 'Operations', state: 'current' },
  { label: 'พร้อมส่ง', state: 'upcoming' },
  { label: 'จัดส่ง', state: 'upcoming' },
];

export const LAB_TASKS: readonly Task[] = [
  {
    id: 'l1',
    title: 'อนุมัติใบขอซื้อ',
    reference: 'PR-000088',
    department: 'จัดซื้อ',
    priority: 'high',
    due: 'วันนี้',
    status: 'pending',
    nextAction: 'ตรวจสอบ',
  },
  {
    id: 'l2',
    title: 'ยืนยันกำหนดส่ง',
    reference: 'SO-000412',
    department: 'ฝ่ายขาย',
    priority: 'normal',
    due: '20 ต.ค.',
    overdue: true,
    status: 'overdue',
    nextAction: 'ติดต่อลูกค้า',
  },
  {
    id: 'l3',
    title: 'ตรวจนับพื้นที่ A',
    reference: 'CNT-000021',
    department: 'คลังสินค้า',
    priority: 'low',
    due: '30 ต.ค.',
    status: 'draft',
    nextAction: 'เริ่มนับ',
  },
];

export const LAB_EXCEPTIONS: readonly ExceptionRecord[] = [
  {
    id: 'e1',
    severity: 'critical',
    title: 'จ่ายซ้ำถูกบล็อก',
    reference: 'PAY-000071',
    department: 'บัญชี',
    time: '10 นาทีที่แล้ว',
    reason: 'คำขอจ่ายอ้างอิง GR ที่จ่ายไปแล้ว',
    actionLabel: 'ตรวจสอบ',
  },
  {
    id: 'e2',
    severity: 'high',
    title: 'PO ส่งล่าช้า',
    reference: 'PO-000123',
    department: 'จัดซื้อ',
    time: 'เลยกำหนด 1 วัน',
    reason: 'กระทบ Work Order ที่รอวัตถุดิบ',
    actionLabel: 'ดูรายละเอียด',
  },
  {
    id: 'e3',
    severity: 'medium',
    title: 'LOT ใกล้หมดอายุ',
    reference: 'LOT-A',
    department: 'คลังสินค้า',
    time: 'เหลือ 18 วัน',
    reason: 'ควรจ่ายออกก่อนตามหลัก FEFO',
    actionLabel: 'วางแผนใช้',
  },
  {
    id: 'e4',
    severity: 'low',
    title: 'ข้อมูลลูกค้าไม่ครบ',
    reference: 'CUS-002',
    department: 'ฝ่ายขาย',
    time: 'เมื่อวาน',
    reason: 'ยังไม่มีผู้ติดต่อหลัก',
    actionLabel: 'เพิ่มข้อมูล',
  },
];
