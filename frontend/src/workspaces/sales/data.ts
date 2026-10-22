import type { Status, Task, WorkflowStep } from '@/components/core';

/* Sales workspace — a few clearly-labelled samples for UX review only. */

export interface SalesOrderSample {
  no: string;
  status: Status;
  statusLabel?: string;
  customer: string;
  due: string;
  customerPo: string;
  steps: WorkflowStep[];
}

const steps = (current: number): WorkflowStep[] =>
  ['รับออเดอร์', 'ตรวจ Stock', 'Operations', 'พร้อมส่ง', 'จัดส่ง'].map((label, i) => ({
    label,
    state: i < current ? 'completed' : i === current ? 'current' : 'upcoming',
  }));

export const SALES_ORDERS: readonly SalesOrderSample[] = [
  {
    no: 'SO-ตัวอย่าง-001',
    status: 'processing',
    customer: 'ลูกค้าตัวอย่าง ก',
    due: '28 ต.ค.',
    customerPo: 'CPO-ตัวอย่าง-118',
    steps: steps(2),
  },
  {
    no: 'SO-ตัวอย่าง-002',
    status: 'warning',
    statusLabel: 'ใกล้กำหนดส่ง',
    customer: 'ลูกค้าตัวอย่าง ข',
    due: '24 ต.ค.',
    customerPo: 'CPO-ตัวอย่าง-121',
    steps: steps(2),
  },
  {
    no: 'SO-ตัวอย่าง-003',
    status: 'partial',
    statusLabel: 'ส่งบางส่วน',
    customer: 'ลูกค้าตัวอย่าง ก',
    due: '30 ต.ค.',
    customerPo: 'CPO-ตัวอย่าง-124',
    steps: steps(4),
  },
];

export const SALES_TASKS: readonly Task[] = [
  {
    id: 't1',
    title: 'ยืนยันกำหนดส่งกับลูกค้า',
    reference: 'SO-ตัวอย่าง-002',
    department: 'ฝ่ายขาย',
    priority: 'high',
    due: '24 ต.ค.',
    status: 'pending',
    nextAction: 'ติดต่อลูกค้า',
  },
  {
    id: 't2',
    title: 'แปลง Customer PO เป็น Sales Order',
    reference: 'CPO-ตัวอย่าง-126',
    department: 'ฝ่ายขาย',
    priority: 'normal',
    due: '25 ต.ค.',
    status: 'draft',
    nextAction: 'สร้าง SO',
  },
];
