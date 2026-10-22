import type { WorldId } from './worlds';

/**
 * Illustrative cross-department routes for the Connected Flow chapter.
 * Each is one common path through CORE — real organizations configure their
 * own steps, approvals and parallel work; none of this is a single fixed line.
 */
export interface FlowStep {
  at: WorldId;
  text: string;
}

export interface Flow {
  id: string;
  label: string;
  summary: string;
  steps: readonly FlowStep[];
}

export const FLOWS: readonly Flow[] = [
  {
    id: 'sale',
    label: 'การขาย',
    summary: 'จากคำสั่งซื้อของลูกค้า ถึงกำหนดส่งที่ทุกแผนกยืนยันร่วมกัน',
    steps: [
      { at: 'sales', text: 'รับ Customer PO และสร้าง Sales Order' },
      { at: 'warehouse', text: 'ตรวจความพร้อมของสินค้าและ Lot ที่ใช้ได้' },
      { at: 'operations', text: 'วางแผน Work Order สำหรับส่วนที่ต้องผลิตหรือเตรียม' },
      { at: 'sales', text: 'ยืนยันกำหนดส่งกับลูกค้าจากสถานะจริง' },
      { at: 'executive', text: 'ผู้บริหารเห็นคำสั่งซื้อที่เสี่ยงล่าช้า' },
    ],
  },
  {
    id: 'purchase',
    label: 'การจัดซื้อ',
    summary: 'จากความต้องการของหน้างาน ถึงใบสั่งซื้อที่ผ่านการอนุมัติ',
    steps: [
      { at: 'operations', text: 'แจ้งความต้องการวัตถุดิบตามแผนงาน' },
      { at: 'purchasing', text: 'สร้างใบขอซื้อ (PR) และเปรียบเทียบใบเสนอราคา' },
      { at: 'executive', text: 'อนุมัติตามลำดับขั้นที่องค์กรกำหนด' },
      { at: 'purchasing', text: 'ออกใบสั่งซื้อ (PO) ถึง Supplier' },
      { at: 'accounting', text: 'เตรียมมัดจำ เมื่อเงื่อนไขกำหนดไว้' },
    ],
  },
  {
    id: 'receive',
    label: 'การรับสินค้า',
    summary: 'ของเข้าคลังพร้อมข้อมูล Lot และวันหมดอายุ ตั้งแต่วินาทีแรก',
    steps: [
      { at: 'purchasing', text: 'PO รอรับ พร้อมกำหนดส่งจาก Supplier' },
      { at: 'warehouse', text: 'รับสินค้า ตรวจจำนวน บันทึก Lot และวันหมดอายุ' },
      { at: 'purchasing', text: 'เห็นยอดรับจริง และติดตามส่วนที่ยังขาด' },
      { at: 'accounting', text: 'เอกสารรับสินค้าพร้อมสำหรับการตรวจก่อนจ่าย' },
    ],
  },
  {
    id: 'deliver',
    label: 'การส่งมอบ',
    summary: 'จากงานที่เสร็จ ถึงสินค้าที่ออกจากคลังไปหาลูกค้า',
    steps: [
      { at: 'operations', text: 'งานเสร็จ ส่งต่อให้คลังสินค้า' },
      { at: 'warehouse', text: 'จัดเตรียมและจ่ายออกตามลำดับ FEFO' },
      { at: 'sales', text: 'ยืนยันการส่งมอบกับลูกค้า' },
      { at: 'accounting', text: 'เอกสารส่งมอบพร้อมสำหรับขั้นตอนบัญชี' },
    ],
  },
  {
    id: 'pay',
    label: 'การจ่ายเงิน',
    summary: 'จ่ายเมื่อเอกสารครบ อนุมัติแล้ว และย้อนกลับไปถึงต้นทางได้',
    steps: [
      { at: 'purchasing', text: 'PO และใบรับสินค้า (GR) ครบ' },
      { at: 'accounting', text: 'ตรวจเอกสาร และสร้างคำขอจ่าย' },
      { at: 'executive', text: 'อนุมัติตามลำดับขั้นที่องค์กรกำหนด' },
      { at: 'accounting', text: 'จ่ายเงิน และบันทึกการจ่าย' },
      { at: 'purchasing', text: 'สถานะ PO และ Supplier อัปเดตตาม' },
    ],
  },
];

/** Station positions on the route map (viewBox 1000×600), around CORE at the centre. */
export const STATIONS: Record<WorldId, { x: number; y: number }> = {
  sales: { x: 150, y: 170 },
  operations: { x: 500, y: 70 },
  warehouse: { x: 850, y: 170 },
  purchasing: { x: 850, y: 430 },
  accounting: { x: 500, y: 530 },
  executive: { x: 150, y: 430 },
};

export const CORE_POINT = { x: 500, y: 300 };

type P = { x: number; y: number };

/**
 * Every hop passes through CORE — the shared data layer, not a direct
 * handover. Each half of a hop bows slightly so overlapping hops stay legible.
 */
function bow(a: P, b: P, k: number): P {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx - (dy / len) * k, y: my + (dx / len) * k };
}

function quadLength(a: P, c: P, b: P) {
  let len = 0;
  let prev = a;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const p = {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

const f = (n: number) => n.toFixed(1);

/** SVG path for a flow plus the relative distance (0–100) of each step along it. */
export function routeFor(flow: Flow): { d: string; at: number[] } {
  const pts = flow.steps.map((s) => STATIONS[s.at]);
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const k = 26 + (i % 2) * 14;
    const c1 = bow(a, CORE_POINT, k);
    const c2 = bow(CORE_POINT, b, k);
    d += ` Q ${f(c1.x)} ${f(c1.y)} ${CORE_POINT.x} ${CORE_POINT.y} Q ${f(c2.x)} ${f(c2.y)} ${b.x} ${b.y}`;
    cum.push(cum[i - 1]! + quadLength(a, c1, CORE_POINT) + quadLength(CORE_POINT, c2, b));
  }
  const total = cum[cum.length - 1] || 1;
  return { d, at: cum.map((l) => (l / total) * 100) };
}
