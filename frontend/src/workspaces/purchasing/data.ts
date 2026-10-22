import type { Status, Task } from '@/components/core';

/* Purchasing workspace — a few clearly-labelled samples for UX review only. */

export interface FollowUpSample {
  po: string;
  supplier: string;
  due: string;
  received: number;
  status: Status;
  statusLabel?: string;
  pr: string;
}

export const FOLLOW_UP: readonly FollowUpSample[] = [
  {
    po: 'PO-ตัวอย่าง-014',
    supplier: 'Supplier ตัวอย่าง A',
    due: 'เลยกำหนด 1 วัน',
    received: 40,
    status: 'overdue',
    pr: 'PR-ตัวอย่าง-031',
  },
  {
    po: 'PO-ตัวอย่าง-015',
    supplier: 'Supplier ตัวอย่าง B',
    due: '25 ต.ค.',
    received: 0,
    status: 'pending',
    statusLabel: 'รอส่ง',
    pr: 'PR-ตัวอย่าง-033',
  },
  {
    po: 'PO-ตัวอย่าง-011',
    supplier: 'Supplier ตัวอย่าง A',
    due: '29 ต.ค.',
    received: 60,
    status: 'partial',
    statusLabel: 'รับบางส่วน',
    pr: 'PR-ตัวอย่าง-027',
  },
];

export const PURCHASING_TASKS: readonly Task[] = [
  {
    id: 'p1',
    title: 'ตรวจสอบใบขอซื้อจากคลังสินค้า',
    reference: 'PR-ตัวอย่าง-034',
    department: 'คลังสินค้า',
    priority: 'normal',
    due: '24 ต.ค.',
    status: 'pending',
    statusLabel: 'รออนุมัติ',
    nextAction: 'ตรวจสอบ',
  },
  {
    id: 'p2',
    title: 'ติดตาม Supplier ที่ส่งล่าช้า',
    reference: 'PO-ตัวอย่าง-014',
    department: 'จัดซื้อ',
    priority: 'high',
    due: '22 ต.ค.',
    overdue: true,
    status: 'overdue',
    nextAction: 'ติดต่อ Supplier',
  },
];
