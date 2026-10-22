import type { Status } from '@/components/core';
import type { WorkspaceId } from '../registry';

/* Minimal sample content for UX review only. */
export const DEPARTMENT_SUMMARY: {
  id: Exclude<WorkspaceId, 'executive' | 'admin'>;
  status: Status;
  statusLabel: string;
  metrics: [string, string][];
}[] = [
  {
    id: 'sales',
    status: 'completed',
    statusLabel: 'ปกติ',
    metrics: [
      ['SO เปิดอยู่', '3'],
      ['ใกล้กำหนดส่ง', '1'],
    ],
  },
  {
    id: 'warehouse',
    status: 'completed',
    statusLabel: 'ปกติ',
    metrics: [
      ['รอรับเข้า', '2'],
      ['Lot ใกล้หมดอายุ', '1'],
    ],
  },
  {
    id: 'purchasing',
    status: 'warning',
    statusLabel: 'ต้องติดตาม',
    metrics: [
      ['PR รออนุมัติ', '2'],
      ['PO ส่งล่าช้า', '1'],
    ],
  },
  {
    id: 'operations',
    status: 'warning',
    statusLabel: 'ต้องติดตาม',
    metrics: [
      ['กำลังทำ', '2'],
      ['เสี่ยงล่าช้า', '1'],
    ],
  },
  {
    id: 'accounting',
    status: 'completed',
    statusLabel: 'ปกติ',
    metrics: [
      ['รอชำระ', '2'],
      ['เอกสารไม่ครบ', '1'],
    ],
  },
];
