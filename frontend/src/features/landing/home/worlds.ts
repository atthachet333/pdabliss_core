import type { DepartmentId } from '@/config/departments';
import { useLocale } from '@/i18n/useLocale';
import type { Localized } from '@/i18n/useCopy';

/** The six operational perspectives on the homepage (Reports is shared, not a world). */
export type WorldId = Extract<
  DepartmentId,
  'sales' | 'operations' | 'warehouse' | 'purchasing' | 'accounting' | 'executive'
>;

interface WorldText {
  name: string;
  /** Visual mood of the environment. */
  mood: string;
  message: string;
  responsibilities: readonly string[];
}

export interface World extends WorldText {
  id: WorldId;
  nameEn: string;
  /** Restrained light tint for the environment (EP02 workspace accent token). */
  accent: string;
}

const META: readonly Omit<World, keyof WorldText>[] = [
  { id: 'sales', nameEn: 'Sales', accent: 'var(--color-ws-sales)' },
  { id: 'operations', nameEn: 'Operations', accent: 'var(--color-ws-operations)' },
  { id: 'warehouse', nameEn: 'Warehouse', accent: 'var(--color-ws-warehouse)' },
  { id: 'purchasing', nameEn: 'Purchasing', accent: 'var(--color-ws-purchasing)' },
  { id: 'accounting', nameEn: 'Accounting', accent: 'var(--color-ws-accounting)' },
  { id: 'executive', nameEn: 'Executive', accent: 'var(--color-ws-executive)' },
];

export const WORLD_TEXT: Localized<Record<WorldId, WorldText>> = {
  th: {
    sales: {
      name: 'ฝ่ายขาย',
      mood: 'ความเคลื่อนไหว · ความต้องการของลูกค้า · เส้นทางส่งมอบ',
      message: 'ฝ่ายขายเห็นสิ่งที่ต้องทำต่อ โดยไม่ต้องไล่ถามสถานะจากทุกแผนก',
      responsibilities: [
        'Customer PO',
        'Sales Order',
        'ความพร้อมของสินค้า',
        'การส่งมอบ',
        'สถานะที่บอกลูกค้าได้',
      ],
    },
    operations: {
      name: 'ปฏิบัติการ',
      mood: 'ลำดับเวลา · กำลังการผลิต · ความคืบหน้า',
      message: 'ฝ่ายปฏิบัติการมองเห็นงาน ลำดับความสำคัญ และจุดที่ติดขัด',
      responsibilities: [
        'Work Order',
        'แผนงาน',
        'ความคืบหน้า',
        'งานล่าช้า',
        'งานเสร็จ',
        'ส่งต่อคลังสินค้า',
      ],
    },
    warehouse: {
      name: 'คลังสินค้า',
      mood: 'ความแม่นยำ · ตำแหน่งจัดเก็บ · โครงสร้าง Lot',
      message: 'คลังควบคุมสินค้าและอายุสินค้า โดยไม่ต้องเข้าถึงข้อมูลที่ไม่เกี่ยวข้องกับหน้าที่',
      responsibilities: [
        'รับสินค้า',
        'สต็อก',
        'Lot / Batch',
        'วันหมดอายุ',
        'การเคลื่อนไหว',
        'ตรวจนับ',
      ],
    },
    purchasing: {
      name: 'จัดซื้อ',
      mood: 'เครือข่าย Supplier · เส้นทางอนุมัติ · กำหนดส่ง',
      message: 'จัดซื้อเห็นทุกคำขอ ทุกใบสั่งซื้อ และรู้ทันทีเมื่อของมาไม่ตรงกำหนด',
      responsibilities: [
        'ใบขอซื้อ (PR)',
        'ใบเสนอราคา',
        'ใบสั่งซื้อ (PO)',
        'Supplier',
        'ติดตามการรับของ',
        'ผลการส่งของ Supplier',
      ],
    },
    accounting: {
      name: 'บัญชีและการเงิน',
      mood: 'การตรวจสอบ · ลำดับการจ่าย · ความครบถ้วนของเอกสาร',
      message: 'การเงินจ่ายเมื่อเอกสารครบและได้รับอนุมัติ — ทุกการจ่ายย้อนกลับไปถึงต้นทางได้',
      responsibilities: ['คำขอจ่าย', 'มัดจำ', 'ยอดค้าง', 'เอกสารประกอบ', 'การจ่ายเงิน', 'เจ้าหนี้'],
    },
    executive: {
      name: 'ผู้บริหาร',
      mood: 'จุดชมวิว · ศูนย์ควบคุม · ภาพรวมที่ชัดเจน',
      message: 'ผู้บริหารเห็นทั้งองค์กรในภาพเดียว และลงรายละเอียดได้เมื่อจำเป็น',
      responsibilities: [
        'Business Pulse',
        'ภาพรวมรายแผนก',
        'ข้อยกเว้น',
        'ความเสี่ยง',
        'การอนุมัติ',
        'เจาะลึกรายแผนก',
      ],
    },
  },
  en: {
    sales: {
      name: 'Sales',
      mood: 'Movement · customer demand · delivery routes',
      message: 'Sales sees what to do next, without chasing status from every department.',
      responsibilities: [
        'Customer PO',
        'Sales Order',
        'Stock readiness',
        'Delivery',
        'Status customers can rely on',
      ],
    },
    operations: {
      name: 'Operations',
      mood: 'Sequence · capacity · progress',
      message: 'Operations sees the work, its priorities and where it is stuck.',
      responsibilities: [
        'Work Order',
        'Work plan',
        'Progress',
        'Delayed work',
        'Completed work',
        'Warehouse handoff',
      ],
    },
    warehouse: {
      name: 'Warehouse',
      mood: 'Precision · storage locations · lot structure',
      message:
        'The warehouse controls stock and shelf life without access to data unrelated to its job.',
      responsibilities: [
        'Goods receipt',
        'Stock',
        'Lot / Batch',
        'Expiry dates',
        'Movements',
        'Stock counts',
      ],
    },
    purchasing: {
      name: 'Purchasing',
      mood: 'Supplier network · approval paths · due dates',
      message:
        'Purchasing sees every request and every order, and knows at once when goods arrive off schedule.',
      responsibilities: [
        'Purchase request (PR)',
        'Quotations',
        'Purchase order (PO)',
        'Supplier',
        'Receipt tracking',
        'Supplier delivery performance',
      ],
    },
    accounting: {
      name: 'Accounting & Finance',
      mood: 'Verification · payment sequence · complete documents',
      message:
        'Finance pays when documents are complete and approved — every payment traces back to its source.',
      responsibilities: [
        'Payment requests',
        'Deposits',
        'Outstanding balances',
        'Supporting documents',
        'Payments',
        'Payables',
      ],
    },
    executive: {
      name: 'Executive',
      mood: 'Vantage point · control centre · a clear overview',
      message: 'Leaders see the whole organization in one view, and drill down when needed.',
      responsibilities: [
        'Business Pulse',
        'Department overview',
        'Exceptions',
        'Risks',
        'Approvals',
        'Department drill-down',
      ],
    },
  },
  'zh-CN': {
    sales: {
      name: '销售部',
      mood: '动态 · 客户需求 · 交付路线',
      message: '销售部清楚下一步该做什么，无需向各部门追问状态。',
      responsibilities: ['客户采购单', '销售订单', '备货情况', '交付', '可告知客户的状态'],
    },
    operations: {
      name: '运营部',
      mood: '时序 · 产能 · 进度',
      message: '运营部看得见工作、优先级以及卡住的环节。',
      responsibilities: ['工单', '工作计划', '进度', '延迟的工作', '已完成的工作', '交接仓库'],
    },
    warehouse: {
      name: '仓库',
      mood: '精准 · 库位 · 批次结构',
      message: '仓库管控库存与保质期，无需接触与岗位无关的数据。',
      responsibilities: ['收货', '库存', '批次 / Batch', '保质期', '库存移动', '盘点'],
    },
    purchasing: {
      name: '采购部',
      mood: '供应商网络 · 审批路径 · 交货期',
      message: '采购部看得到每一份请购与采购订单，到货不符时立即知晓。',
      responsibilities: [
        '请购单（PR）',
        '报价单',
        '采购订单（PO）',
        '供应商',
        '到货跟踪',
        '供应商交货表现',
      ],
    },
    accounting: {
      name: '财务会计',
      mood: '核对 · 付款顺序 · 单据完整',
      message: '单据齐全且获批后才付款——每一笔付款都能追溯到源头。',
      responsibilities: ['付款申请', '定金', '未结余额', '附件单据', '付款', '应付账款'],
    },
    executive: {
      name: '管理层',
      mood: '制高点 · 控制中心 · 清晰全局',
      message: '管理层在一个画面中看清整个组织，需要时再深入细节。',
      responsibilities: ['业务脉搏', '部门概览', '例外事项', '风险', '审批', '部门深入查看'],
    },
  },
};

export function worldsFor(locale: keyof typeof WORLD_TEXT): World[] {
  return META.map((m) => ({ ...m, ...WORLD_TEXT[locale][m.id] }));
}

const BY_LOCALE = { th: worldsFor('th'), en: worldsFor('en'), 'zh-CN': worldsFor('zh-CN') };

/** Thai list for code without a locale (tests). */
export const WORLDS: readonly World[] = BY_LOCALE.th;

/** Worlds in the current locale (stable references per locale). */
export function useWorlds(): World[] {
  return BY_LOCALE[useLocale().locale];
}
