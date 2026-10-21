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
  id: 'receiving' | 'stock' | 'lots' | 'stock-count';
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
    label: 'สต็อก',
    count: 1,
    unit: 'รายการต่ำกว่าจุดสั่งซื้อ',
    note: 'แสดงเฉพาะปริมาณ',
  },
  {
    id: 'lots',
    label: 'ล็อต / วันหมดอายุ',
    count: 1,
    unit: 'ล็อตใกล้หมดอายุ',
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
}

/** Sorted first-expiry, first-out. Quantities and dates only. */
export const FEFO_SAMPLE: readonly LotExpiry[] = [
  { lot: 'LOT-A', item: 'วัตถุดิบตัวอย่าง A', quantity: '12 หน่วย', daysLeft: 18 },
  { lot: 'LOT-B', item: 'วัตถุดิบตัวอย่าง B', quantity: '40 หน่วย', daysLeft: 64 },
];
