import { useLocale } from '@/i18n/useLocale';
import type { Localized } from '@/i18n/useCopy';
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

type FlowId = 'sale' | 'purchase' | 'receive' | 'deliver' | 'pay';

/** Route structure: which department each step happens in. */
const ROUTES: Record<FlowId, readonly WorldId[]> = {
  sale: ['sales', 'warehouse', 'operations', 'sales', 'executive'],
  purchase: ['operations', 'purchasing', 'executive', 'purchasing', 'accounting'],
  receive: ['purchasing', 'warehouse', 'purchasing', 'accounting'],
  deliver: ['operations', 'warehouse', 'sales', 'accounting'],
  pay: ['purchasing', 'accounting', 'executive', 'accounting', 'purchasing'],
};

type FlowText = { label: string; summary: string; steps: readonly string[] };

export const FLOW_TEXT: Localized<Record<FlowId, FlowText>> = {
  th: {
    sale: {
      label: 'การขาย',
      summary: 'จากคำสั่งซื้อของลูกค้า ถึงกำหนดส่งที่ทุกแผนกยืนยันร่วมกัน',
      steps: [
        'รับ Customer PO และสร้าง Sales Order',
        'ตรวจความพร้อมของสินค้าและ Lot ที่ใช้ได้',
        'วางแผน Work Order สำหรับส่วนที่ต้องผลิตหรือเตรียม',
        'ยืนยันกำหนดส่งกับลูกค้าจากสถานะจริง',
        'ผู้บริหารเห็นคำสั่งซื้อที่เสี่ยงล่าช้า',
      ],
    },
    purchase: {
      label: 'การจัดซื้อ',
      summary: 'จากความต้องการของหน้างาน ถึงใบสั่งซื้อที่ผ่านการอนุมัติ',
      steps: [
        'แจ้งความต้องการวัตถุดิบตามแผนงาน',
        'สร้างใบขอซื้อ (PR) และเปรียบเทียบใบเสนอราคา',
        'อนุมัติตามลำดับขั้นที่องค์กรกำหนด',
        'ออกใบสั่งซื้อ (PO) ถึง Supplier',
        'เตรียมมัดจำ เมื่อเงื่อนไขกำหนดไว้',
      ],
    },
    receive: {
      label: 'การรับสินค้า',
      summary: 'ของเข้าคลังพร้อมข้อมูล Lot และวันหมดอายุ ตั้งแต่วินาทีแรก',
      steps: [
        'PO รอรับ พร้อมกำหนดส่งจาก Supplier',
        'รับสินค้า ตรวจจำนวน บันทึก Lot และวันหมดอายุ',
        'เห็นยอดรับจริง และติดตามส่วนที่ยังขาด',
        'เอกสารรับสินค้าพร้อมสำหรับการตรวจก่อนจ่าย',
      ],
    },
    deliver: {
      label: 'การส่งมอบ',
      summary: 'จากงานที่เสร็จ ถึงสินค้าที่ออกจากคลังไปหาลูกค้า',
      steps: [
        'งานเสร็จ ส่งต่อให้คลังสินค้า',
        'จัดเตรียมและจ่ายออกตามลำดับ FEFO',
        'ยืนยันการส่งมอบกับลูกค้า',
        'เอกสารส่งมอบพร้อมสำหรับขั้นตอนบัญชี',
      ],
    },
    pay: {
      label: 'การจ่ายเงิน',
      summary: 'จ่ายเมื่อเอกสารครบ อนุมัติแล้ว และย้อนกลับไปถึงต้นทางได้',
      steps: [
        'PO และใบรับสินค้า (GR) ครบ',
        'ตรวจเอกสาร และสร้างคำขอจ่าย',
        'อนุมัติตามลำดับขั้นที่องค์กรกำหนด',
        'จ่ายเงิน และบันทึกการจ่าย',
        'สถานะ PO และ Supplier อัปเดตตาม',
      ],
    },
  },
  en: {
    sale: {
      label: 'Sales',
      summary: 'From a customer order to a delivery date every department confirms together.',
      steps: [
        'Receive the Customer PO and create a Sales Order',
        'Check stock readiness and usable lots',
        'Plan Work Orders for anything to produce or prepare',
        'Confirm the delivery date with the customer from real status',
        'Leaders see orders at risk of running late',
      ],
    },
    purchase: {
      label: 'Purchasing',
      summary: 'From a need on the floor to an approved purchase order.',
      steps: [
        'Raise material needs from the work plan',
        'Create a purchase request (PR) and compare quotations',
        'Approve through the organization’s own approval levels',
        'Issue the purchase order (PO) to the supplier',
        'Prepare a deposit when the terms require one',
      ],
    },
    receive: {
      label: 'Receiving',
      summary: 'Goods enter the warehouse with lot and expiry data from the very first moment.',
      steps: [
        'PO awaiting receipt, with the supplier’s delivery date',
        'Receive goods, check quantities, record lots and expiry dates',
        'See actual received quantities and follow up what is missing',
        'Receipt documents are ready for checking before payment',
      ],
    },
    deliver: {
      label: 'Delivery',
      summary: 'From finished work to goods leaving the warehouse for the customer.',
      steps: [
        'Work is finished and handed to the warehouse',
        'Pick and dispatch in FEFO order',
        'Confirm delivery with the customer',
        'Delivery documents are ready for accounting',
      ],
    },
    pay: {
      label: 'Payment',
      summary: 'Pay when documents are complete and approved — and traceable to their source.',
      steps: [
        'PO and goods receipt (GR) are complete',
        'Check documents and create a payment request',
        'Approve through the organization’s own approval levels',
        'Pay and record the payment',
        'PO and supplier status update automatically',
      ],
    },
  },
  'zh-CN': {
    sale: {
      label: '销售',
      summary: '从客户订单，到各部门共同确认的交期。',
      steps: [
        '接收客户采购单并创建销售订单',
        '检查备货情况与可用批次',
        '为需要生产或准备的部分计划工单',
        '根据真实状态与客户确认交期',
        '管理层看到有延迟风险的订单',
      ],
    },
    purchase: {
      label: '采购',
      summary: '从现场需求，到获批的采购订单。',
      steps: [
        '根据工作计划提出物料需求',
        '创建请购单（PR）并比较报价',
        '按企业设定的层级进行审批',
        '向供应商发出采购订单（PO）',
        '按条款要求准备定金',
      ],
    },
    receive: {
      label: '收货',
      summary: '货物入库时即带有批次与有效期信息。',
      steps: [
        '待收货的采购单，附供应商交期',
        '收货、核对数量，记录批次与有效期',
        '查看实际到货量，跟进短缺部分',
        '收货单据已备好，供付款前核对',
      ],
    },
    deliver: {
      label: '交付',
      summary: '从完成的工作，到货物出库送达客户。',
      steps: [
        '工作完成，交接给仓库',
        '按 FEFO 顺序备货出库',
        '与客户确认交付',
        '交付单据已备好，进入财务流程',
      ],
    },
    pay: {
      label: '付款',
      summary: '单据齐全、审批通过后付款，并可追溯到源头。',
      steps: [
        '采购单与收货单（GR）齐全',
        '核对单据并创建付款申请',
        '按企业设定的层级进行审批',
        '付款并记录',
        '采购单与供应商状态随之更新',
      ],
    },
  },
};

const ORDER: readonly FlowId[] = ['sale', 'purchase', 'receive', 'deliver', 'pay'];

export function flowsFor(locale: keyof typeof FLOW_TEXT): Flow[] {
  return ORDER.map((id) => {
    const t = FLOW_TEXT[locale][id];
    return {
      id,
      label: t.label,
      summary: t.summary,
      steps: ROUTES[id].map((at, i) => ({ at, text: t.steps[i]! })),
    };
  });
}

const BY_LOCALE = {
  th: flowsFor('th'),
  en: flowsFor('en'),
  'zh-CN': flowsFor('zh-CN'),
};

/** Thai flows for code without a locale (tests). */
export const FLOWS: readonly Flow[] = BY_LOCALE.th;

/** Flows in the current locale (stable references per locale). */
export function useFlows(): Flow[] {
  return BY_LOCALE[useLocale().locale];
}

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
