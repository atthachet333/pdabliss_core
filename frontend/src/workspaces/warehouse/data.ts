/*
 * EP00 mock data — Warehouse workspace.
 *
 * PRIVACY RULE: warehouse types contain NO commercial or financial fields
 * (cost, price, supplier payment, accounting amounts). The backend's
 * warehouse contract omits them from the payload; these client types mirror
 * that contract so pricing cannot even be referenced in warehouse UI code.
 */

/** Mirrors backend `StockItemWarehouseView` (backend/src/domain/inventory/stock-item.ts). */
export interface WarehouseStockItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  warehouseCode: string;
  lotNo: string | null;
  manufacturedOn: string | null;
  expiresOn: string | null;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
}

export interface WarehouseStockResponse {
  workspace: 'warehouse';
  items: WarehouseStockItem[];
}

/** Offline fallback when the demo API is not running — same warehouse-safe shape. */
export const FALLBACK_STOCK: WarehouseStockItem[] = [
  {
    id: 'stk_001',
    sku: 'RM-ALU-6063',
    name: 'อะลูมิเนียมโปรไฟล์ 6063',
    unit: 'เส้น',
    warehouseCode: 'WH-MAIN',
    lotNo: 'L2610-014',
    manufacturedOn: '2026-10-02',
    expiresOn: null,
    onHand: 420,
    reserved: 120,
    available: 300,
    reorderPoint: 200,
  },
  {
    id: 'stk_002',
    sku: 'CH-RES-A12',
    name: 'เรซินเคลือบผิว A12',
    unit: 'ถัง',
    warehouseCode: 'WH-CHEM',
    lotNo: 'L2608-221',
    manufacturedOn: '2026-08-11',
    expiresOn: '2026-11-08',
    onHand: 36,
    reserved: 8,
    available: 28,
    reorderPoint: 40,
  },
  {
    id: 'stk_003',
    sku: 'PK-BOX-L',
    name: 'กล่องบรรจุภัณฑ์ ขนาด L',
    unit: 'ใบ',
    warehouseCode: 'WH-MAIN',
    lotNo: null,
    manufacturedOn: null,
    expiresOn: null,
    onHand: 1850,
    reserved: 600,
    available: 1250,
    reorderPoint: 1000,
  },
  {
    id: 'stk_004',
    sku: 'CH-ADH-77',
    name: 'กาวอุตสาหกรรม 77',
    unit: 'แกลลอน',
    warehouseCode: 'WH-CHEM',
    lotNo: 'L2604-090',
    manufacturedOn: '2026-04-20',
    expiresOn: '2026-10-15',
    onHand: 12,
    reserved: 0,
    available: 12,
    reorderPoint: 20,
  },
];

export const TODAY_TASKS = {
  waitingReceipts: 6,
  pendingQc: 3,
  lowStock: 5,
  expiringLots: 4,
  expiredLots: 1,
  countTasks: 2,
};

export interface IncomingReceipt {
  po: string;
  supplier: string;
  item: string;
  expected: number;
  unit: string;
  eta: string;
  dock: string;
  stage: 'arriving' | 'unloading' | 'qc';
}

export const INCOMING: IncomingReceipt[] = [
  {
    po: 'PO-0922',
    supplier: 'Siam Metal Supply',
    item: 'อะลูมิเนียมโปรไฟล์ 6063',
    expected: 100,
    unit: 'เส้น',
    eta: '10:30',
    dock: 'Dock 2',
    stage: 'unloading',
  },
  {
    po: 'PO-0918',
    supplier: 'Chem Partner Asia',
    item: 'เรซินเคลือบผิว A12',
    expected: 24,
    unit: 'ถัง',
    eta: '11:00',
    dock: 'Dock 1',
    stage: 'qc',
  },
  {
    po: 'PO-0925',
    supplier: 'Bangkok Packaging',
    item: 'กล่องบรรจุภัณฑ์ ขนาด L',
    expected: 2000,
    unit: 'ใบ',
    eta: '14:00',
    dock: 'Dock 3',
    stage: 'arriving',
  },
  {
    po: 'PO-0927',
    supplier: 'Thai Fastener Co.',
    item: 'สกรูสแตนเลส M6',
    expected: 5000,
    unit: 'ตัว',
    eta: '15:30',
    dock: 'Dock 2',
    stage: 'arriving',
  },
];

export interface LotExpiry {
  lot: string;
  item: string;
  location: string;
  quantity: string;
  expiresOn: string;
  daysLeft: number;
}

/** Sorted FEFO: first-expiry, first-out. */
export const FEFO_LOTS: LotExpiry[] = [
  {
    lot: 'L2604-090',
    item: 'กาวอุตสาหกรรม 77',
    location: 'C-02-1',
    quantity: '12 แกลลอน',
    expiresOn: '2026-10-15',
    daysLeft: -6,
  },
  {
    lot: 'L2608-221',
    item: 'เรซินเคลือบผิว A12',
    location: 'C-01-3',
    quantity: '36 ถัง',
    expiresOn: '2026-11-08',
    daysLeft: 18,
  },
  {
    lot: 'L2609-114',
    item: 'น้ำยาทำความสะอาด B',
    location: 'C-04-2',
    quantity: '48 ขวด',
    expiresOn: '2026-12-01',
    daysLeft: 41,
  },
  {
    lot: 'L2609-130',
    item: 'สีรองพื้น P3',
    location: 'C-03-1',
    quantity: '20 ถัง',
    expiresOn: '2026-12-20',
    daysLeft: 60,
  },
];

export const COUNT_TASKS = [
  { id: 'SC-0105', zone: 'โซน A · วัตถุดิบโลหะ', counted: 38, total: 52, due: 'วันนี้' },
  { id: 'SC-0106', zone: 'โซน C · สารเคมี', counted: 0, total: 24, due: 'พรุ่งนี้' },
];
