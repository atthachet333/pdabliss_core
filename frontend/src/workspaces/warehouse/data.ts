import type { WorkflowStep } from '@/components/core';

/*
 * Warehouse workspace — minimal sample content for UX review only.
 *
 * PRIVACY RULE: warehouse types contain NO commercial or financial fields
 * (cost, price, supplier payment, accounting amounts). The backend warehouse
 * contract (backend/src/domain/inventory/stock-item.ts) omits them from the
 * payload; these client types mirror it so pricing cannot even be referenced
 * in warehouse UI code.
 */

export interface WarehouseTask {
  id: 'receiving' | 'stock' | 'expiry' | 'stock-count';
  label: string;
  count: number;
  unit: string;
  note: string;
}

export const TODAY: readonly WarehouseTask[] = [
  {
    id: 'receiving',
    label: 'รับสินค้า',
    count: 2,
    unit: 'รายการรอรับ',
    note: 'ตาม PO ที่ถึงกำหนดวันนี้',
  },
  {
    id: 'stock',
    label: 'สต็อกสินค้า',
    count: 1,
    unit: 'รายการต่ำกว่าจุดสั่งซื้อ',
    note: 'แสดงเฉพาะปริมาณ',
  },
  {
    id: 'expiry',
    label: 'วันหมดอายุ',
    count: 1,
    unit: 'Lot ใกล้หมดอายุ',
    note: 'จ่ายตามหลัก FEFO',
  },
  {
    id: 'stock-count',
    label: 'ตรวจนับ',
    count: 0,
    unit: 'งานตรวจนับ',
    note: 'ยังไม่มีงานที่มอบหมาย',
  },
];

export interface LotExpiry {
  lot: string;
  item: string;
  quantity: string;
  daysLeft: number;
  expires: string;
  location: string;
  received: string;
}

/** Sorted first-expiry, first-out. Quantities and dates only. */
export const FEFO_SAMPLE: readonly LotExpiry[] = [
  {
    lot: 'LOT-A',
    item: 'วัตถุดิบตัวอย่าง A',
    quantity: '12 หน่วย',
    daysLeft: 18,
    expires: '9 พ.ย.',
    location: 'A-02-1',
    received: '2 ก.ย.',
  },
  {
    lot: 'LOT-B',
    item: 'วัตถุดิบตัวอย่าง B',
    quantity: '40 หน่วย',
    daysLeft: 64,
    expires: '25 ธ.ค.',
    location: 'B-01-3',
    received: '18 ก.ย.',
  },
  {
    lot: 'LOT-C',
    item: 'วัตถุดิบตัวอย่าง A',
    quantity: '30 หน่วย',
    daysLeft: 121,
    expires: '20 ก.พ.',
    location: 'A-03-2',
    received: '10 ต.ค.',
  },
];

export const LOT_STEPS: readonly WorkflowStep[] = [
  { label: 'รับเข้า', state: 'completed' },
  { label: 'ตรวจ QC', state: 'completed' },
  { label: 'จัดเก็บ', state: 'current' },
  { label: 'จ่ายออก', state: 'upcoming' },
];
