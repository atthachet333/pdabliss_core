import {
  BarChart3,
  Calculator,
  Crown,
  Factory,
  ShoppingCart,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export type DepartmentId =
  'sales' | 'warehouse' | 'purchasing' | 'operations' | 'accounting' | 'reports' | 'executive';

export interface DepartmentInfo {
  id: DepartmentId;
  nameTh: string;
  nameEn: string;
  icon: LucideIcon;
  /** One-line purpose shown on cards. */
  purpose: string;
  /** What the department's workspace focuses on. */
  focus: readonly string[];
  /** Documents the department owns or touches. */
  documents: readonly string[];
  /** How data visibility is scoped for this department. */
  visibility: string;
  /** Workspace route, when the department has its own workspace. */
  workspace?: string;
}

export const DEPARTMENTS: readonly DepartmentInfo[] = [
  {
    id: 'sales',
    nameTh: 'ฝ่ายขาย',
    nameEn: 'Sales',
    icon: ShoppingCart,
    purpose: 'รับคำสั่งซื้อลูกค้า ติดตามความพร้อมสินค้า และสถานะการจัดส่งในที่เดียว',
    focus: ['คำสั่งซื้อใหม่', 'รอสินค้า / รอผลิต', 'กำหนดส่งที่ใกล้ถึง'],
    documents: ['Customer PO', 'Sales Order', 'Delivery'],
    visibility: 'เห็นราคาขายและสถานะคำสั่งซื้อ ไม่เห็นต้นทุนการจัดซื้อ',
    workspace: '/app/sales',
  },
  {
    id: 'warehouse',
    nameTh: 'คลังสินค้า',
    nameEn: 'Warehouse',
    icon: Warehouse,
    purpose: 'รับสินค้า ตรวจคุณภาพ ควบคุมล็อตและวันหมดอายุ ด้วยหน้าจอที่เน้นงานหน้างาน',
    focus: ['รอรับสินค้า / รอ QC', 'ล็อตใกล้หมดอายุ (FEFO)', 'งานตรวจนับสต็อก'],
    documents: ['Goods Receipt', 'Stock Movement', 'Stock Count'],
    visibility: 'เห็นเฉพาะจำนวน ล็อต และวันที่ — ไม่มีข้อมูลราคาส่งมาจากเซิร์ฟเวอร์',
    workspace: '/app/warehouse',
  },
  {
    id: 'purchasing',
    nameTh: 'จัดซื้อ',
    nameEn: 'Purchasing',
    icon: Truck,
    purpose: 'แปลงความต้องการเป็นใบขอซื้อและใบสั่งซื้อ ติดตามซัพพลายเออร์จนรับของครบ',
    focus: ['PR รออนุมัติ', 'PO เปิดอยู่ / รับบางส่วน', 'ซัพพลายเออร์ส่งล่าช้า'],
    documents: ['Purchase Request', 'Purchase Order', 'Supplier'],
    visibility: 'เห็นต้นทุนและเงื่อนไขซัพพลายเออร์ ไม่เห็นรายละเอียดการชำระเงินภายใน',
    workspace: '/app/purchasing',
  },
  {
    id: 'operations',
    nameTh: 'ปฏิบัติการ',
    nameEn: 'Operations',
    icon: Factory,
    purpose: 'วางแผนใบสั่งงาน ติดตามความคืบหน้า และส่งต่องานให้คลังอย่างเป็นขั้นตอน',
    focus: ['งานใหม่ / กำลังดำเนินการ', 'งานล่าช้า', 'รอส่งต่อคลังสินค้า'],
    documents: ['Work Order', 'Production Plan', 'Handoff'],
    visibility: 'เห็นงาน กำหนดการ และวัตถุดิบที่ต้องใช้ ไม่เห็นข้อมูลราคา',
    workspace: '/app/operations',
  },
  {
    id: 'accounting',
    nameTh: 'บัญชีและการเงิน',
    nameEn: 'Accounting',
    icon: Calculator,
    purpose: 'จัดการคำขอจ่ายเงิน มัดจำ และยอดค้างจ่าย โดยเชื่อมเอกสารต้นทางครบทุกใบ',
    focus: ['รอชำระมัดจำ / ส่วนที่เหลือ', 'คำขอจ่ายเงิน', 'เอกสารไม่ครบ'],
    documents: ['Payment Request', 'Payment', 'Payable'],
    visibility: 'เห็นยอดเงินและเอกสารอ้างอิงที่เกี่ยวข้องกับการชำระ',
    workspace: '/app/accounting',
  },
  {
    id: 'reports',
    nameTh: 'รายงาน',
    nameEn: 'Reports',
    icon: BarChart3,
    purpose: 'รายงานของแต่ละแผนกสร้างจากข้อมูลชุดเดียวกัน ตัวเลขจึงตรงกันทุกฝ่าย',
    focus: ['รายงานประจำแผนก', 'ตัวชี้วัดข้ามแผนก', 'ประวัติการทำงาน'],
    documents: ['Department Report', 'Audit Trail', 'KPI'],
    visibility: 'แต่ละคนเห็นรายงานตามสิทธิ์ของแผนกตนเอง',
  },
  {
    id: 'executive',
    nameTh: 'ผู้บริหาร',
    nameEn: 'Executive',
    icon: Crown,
    purpose: 'ศูนย์ควบคุมที่เห็นทุกแผนกในภาพเดียว พร้อมรายการข้อยกเว้นที่ต้องตัดสินใจ',
    focus: ['KPI ทั้งองค์กร', 'Exception Center', 'เจาะลึกรายแผนก'],
    documents: ['Company KPI', 'Exceptions', 'Approvals'],
    visibility: 'เห็นทุกแผนกในมุมมองอ่านเป็นหลัก และอนุมัติได้เมื่อได้รับสิทธิ์',
    workspace: '/app/executive',
  },
];

export function getDepartment(id: DepartmentId): DepartmentInfo {
  const found = DEPARTMENTS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown department: ${id}`);
  return found;
}

/** The six departments that orbit the CORE in the hero. */
export const ORBIT_DEPARTMENTS: readonly DepartmentId[] = [
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
  'reports',
];
