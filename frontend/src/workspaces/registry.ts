import {
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  ClipboardList,
  Crown,
  Factory,
  FileClock,
  FileText,
  Hourglass,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  Receipt,
  Route as RouteIcon,
  Settings,
  ShoppingCart,
  Truck,
  TriangleAlert,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export type WorkspaceId =
  'executive' | 'sales' | 'warehouse' | 'purchasing' | 'operations' | 'accounting' | 'admin';

export interface WorkspaceNavItem {
  /** Path segment relative to the workspace root; '' is the overview. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** What this module will do — shown on module pages until it is built. */
  summary?: string;
  planned?: readonly string[];
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  nameTh: string;
  nameEn: string;
  /** Short name for compact UI (switcher, mobile header). */
  shortTh: string;
  icon: LucideIcon;
  tagline: string;
  /** CSS colour token giving each workspace its own restrained accent. */
  accent: string;
  /** Abstract motif from /public/departments, used faintly in the workspace hero. */
  motif?: string;
  nav: readonly WorkspaceNavItem[];
}

/**
 * Navigation per workspace. This shapes the UI only — it is NOT access control.
 * Authorization will be enforced by the backend for every request.
 */
export const WORKSPACES: Record<WorkspaceId, WorkspaceDefinition> = {
  executive: {
    id: 'executive',
    nameTh: 'ศูนย์ควบคุมผู้บริหาร',
    nameEn: 'Executive Control Center',
    shortTh: 'ผู้บริหาร',
    icon: Crown,
    tagline: 'เห็นทุกแผนกในภาพเดียว ตัดสินใจจากข้อยกเว้น',
    accent: 'var(--color-ws-executive)',
    motif: '/departments/executive.webp',
    nav: [
      { path: '', label: 'ภาพรวมองค์กร', icon: LayoutDashboard },
      {
        path: 'exceptions',
        label: 'ข้อยกเว้น',
        icon: TriangleAlert,
        summary: 'รวมเหตุการณ์ที่ผิดไปจากแผนจากทุกแผนก จัดลำดับตามความรุนแรงและอายุของปัญหา',
        planned: ['แจ้งเตือนตามกฎของแต่ละแผนก', 'มอบหมายผู้รับผิดชอบ', 'ติดตามจนปิดเรื่อง'],
      },
      {
        path: 'departments',
        label: 'รายแผนก',
        icon: Layers,
        summary: 'ดูข้อมูลของแต่ละแผนกในมุมมองอ่านอย่างเดียว จากข้อมูลชุดเดียวกับที่แผนกใช้งานจริง',
        planned: ['สรุปรายแผนก', 'แนวโน้มรายสัปดาห์', 'ลิงก์ไปยังเอกสารต้นทาง'],
      },
    ],
  },
  sales: {
    id: 'sales',
    nameTh: 'พื้นที่ทำงานฝ่ายขาย',
    nameEn: 'Sales Workspace',
    shortTh: 'ฝ่ายขาย',
    icon: ShoppingCart,
    tagline: 'จากคำสั่งซื้อลูกค้า ถึงวันส่งมอบ',
    accent: 'var(--color-ws-sales)',
    motif: '/departments/sales.webp',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'orders',
        label: 'คำสั่งซื้อ',
        icon: ClipboardList,
        summary: 'รับ Customer PO และแปลงเป็นใบสั่งขาย พร้อมตรวจสอบความพร้อมของสินค้า',
        planned: ['บันทึก Customer PO', 'สร้างใบสั่งขาย', 'ตรวจสอบสต็อกอัตโนมัติ'],
      },
      {
        path: 'delivery',
        label: 'สถานะการจัดส่ง',
        icon: Truck,
        summary: 'ติดตามการจัดส่งบางส่วนและครบจำนวน จนปิดใบสั่งขายได้',
        planned: ['ส่งบางส่วน', 'ยืนยันการรับ', 'แจ้งเตือนใกล้ครบกำหนด'],
      },
      {
        path: 'customers',
        label: 'ลูกค้า',
        icon: Users,
        summary: 'ข้อมูลลูกค้าที่ทุกแผนกอ้างอิงจากแหล่งเดียวกัน',
        planned: ['ข้อมูลลูกค้า', 'ผู้ติดต่อ', 'ประวัติคำสั่งซื้อ'],
      },
    ],
  },
  warehouse: {
    id: 'warehouse',
    nameTh: 'พื้นที่ทำงานคลังสินค้า',
    nameEn: 'Warehouse Workspace',
    shortTh: 'คลังสินค้า',
    icon: Warehouse,
    tagline: 'รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุกล็อต',
    accent: 'var(--color-ws-warehouse)',
    motif: '/departments/warehouse.webp',
    nav: [
      { path: '', label: 'งานวันนี้', icon: LayoutDashboard },
      {
        path: 'receiving',
        label: 'รับสินค้า',
        icon: PackageCheck,
        summary: 'รับสินค้าตาม PO โดยระบบไม่ยอมให้รับเกินจำนวนที่สั่ง และบันทึกผล QC ทุกครั้ง',
        planned: ['สแกนบาร์โค้ด', 'ตรวจ QC / ปฏิเสธพร้อมเหตุผล', 'บันทึกล็อตและวันหมดอายุ'],
      },
      {
        path: 'stock',
        label: 'สต็อก',
        icon: Boxes,
        summary: 'ยอดคงเหลือ ยอดจอง และพร้อมใช้ แยกตามคลังและตำแหน่งจัดเก็บ — แสดงเฉพาะปริมาณ',
        planned: ['ยอดตามตำแหน่ง', 'จุดสั่งซื้อซ้ำ', 'ค้นหาด้วยบาร์โค้ด'],
      },
      {
        path: 'lots',
        label: 'ล็อต / วันหมดอายุ',
        icon: Hourglass,
        summary: 'ติดตามทุกล็อต จ่ายตามหลัก FEFO และไม่อนุญาตให้จ่ายล็อตที่หมดอายุแล้ว',
        planned: ['ประวัติล็อต', 'แจ้งเตือนล่วงหน้า', 'บล็อกล็อตหมดอายุ'],
      },
      {
        path: 'stock-count',
        label: 'ตรวจนับ',
        icon: ListChecks,
        summary: 'งานตรวจนับแบบรอบหรือทั้งคลัง ผลต่างต้องได้รับการอนุมัติก่อนปรับยอด',
        planned: ['นับด้วยมือถือ', 'นับซ้ำเมื่อผลต่างสูง', 'อนุมัติผลต่าง'],
      },
    ],
  },
  purchasing: {
    id: 'purchasing',
    nameTh: 'พื้นที่ทำงานจัดซื้อ',
    nameEn: 'Purchasing Workspace',
    shortTh: 'จัดซื้อ',
    icon: Truck,
    tagline: 'จากความต้องการ ถึงรับของครบ',
    accent: 'var(--color-ws-purchasing)',
    motif: '/departments/purchasing.webp',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'purchase-requests',
        label: 'ใบขอซื้อ (PR)',
        icon: FileText,
        summary: 'รับคำขอซื้อจากคลังและฝ่ายปฏิบัติการ ผ่านขั้นตอนอนุมัติที่ผู้ขออนุมัติเองไม่ได้',
        planned: ['รวม PR หลายใบ', 'อนุมัติตามวงเงิน', 'แปลงเป็น PO'],
      },
      {
        path: 'purchase-orders',
        label: 'ใบสั่งซื้อ (PO)',
        icon: ClipboardList,
        summary: 'ใบสั่งซื้อที่ผูกกับ PR ต้นทาง ติดตามการรับของบางส่วนจนปิด PO',
        planned: ['เงื่อนไขมัดจำ', 'ติดตามการรับของ', 'ปิด PO อัตโนมัติ'],
      },
      {
        path: 'suppliers',
        label: 'ติดตามซัพพลายเออร์',
        icon: Building2,
        summary: 'ติดตามกำหนดส่งของซัพพลายเออร์ และเห็นผลการรับของจากคลังทันที',
        planned: ['กำหนดส่ง', 'ส่งล่าช้า', 'ประวัติการส่งตรงเวลา'],
      },
    ],
  },
  operations: {
    id: 'operations',
    nameTh: 'พื้นที่ทำงานปฏิบัติการ',
    nameEn: 'Operations Workspace',
    shortTh: 'ปฏิบัติการ',
    icon: Factory,
    tagline: 'วางแผน ลงมือ ส่งต่อ — ตามจังหวะงานจริง',
    accent: 'var(--color-ws-operations)',
    motif: '/departments/operations.webp',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'work-orders',
        label: 'ใบสั่งงาน',
        icon: ClipboardList,
        summary: 'ใบสั่งงานที่เกิดจากความต้องการของฝ่ายขายหรือแผนงาน พร้อมสถานะของแต่ละขั้น',
        planned: ['สร้างจากใบสั่งขาย', 'กำหนดผู้รับผิดชอบ', 'ขั้นตอนการทำงาน'],
      },
      {
        path: 'planning',
        label: 'วางแผน',
        icon: CalendarClock,
        summary: 'จัดลำดับงานตามกำหนดส่ง และตรวจความพร้อมวัตถุดิบก่อนเริ่มงาน',
        planned: ['ตารางงาน', 'ตรวจความพร้อม', 'ปรับลำดับงาน'],
      },
      {
        path: 'progress',
        label: 'ความคืบหน้า',
        icon: RouteIcon,
        summary: 'อัปเดตความคืบหน้าจากหน้างาน และส่งต่อให้คลังเมื่อเสร็จ',
        planned: ['อัปเดตจากหน้างาน', 'งานเสี่ยงล่าช้า', 'ส่งต่อคลังสินค้า'],
      },
    ],
  },
  accounting: {
    id: 'accounting',
    nameTh: 'พื้นที่ทำงานบัญชีและการเงิน',
    nameEn: 'Accounting Workspace',
    shortTh: 'บัญชี',
    icon: Calculator,
    tagline: 'จ่ายถูกต้อง เมื่อเอกสารครบ',
    accent: 'var(--color-ws-accounting)',
    motif: '/departments/accounting.webp',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'payment-requests',
        label: 'คำขอจ่ายเงิน',
        icon: Receipt,
        summary:
          'คำขอจ่ายเงินที่ผูกกับ PO และใบรับสินค้า จ่ายได้เมื่อได้รับอนุมัติและเอกสารครบเท่านั้น',
        planned: ['ตรวจเอกสารครบอัตโนมัติ', 'อนุมัติตามวงเงิน', 'ป้องกันการจ่ายซ้ำ'],
      },
      {
        path: 'pending',
        label: 'รอชำระ',
        icon: FileClock,
        summary: 'มัดจำและยอดส่วนที่เหลือที่ถึงกำหนดชำระ',
        planned: ['มัดจำ', 'ส่วนที่เหลือ', 'กำหนดชำระ'],
      },
      {
        path: 'outstanding',
        label: 'ยอดค้างจ่าย',
        icon: Wallet,
        summary: 'ยอดค้างจ่ายซัพพลายเออร์แยกตามอายุหนี้',
        planned: ['อายุหนี้', 'สรุปรายซัพพลายเออร์', 'ส่งออกรายงาน'],
      },
    ],
  },
  admin: {
    id: 'admin',
    nameTh: 'ผู้ดูแลระบบ',
    nameEn: 'System Admin',
    shortTh: 'ผู้ดูแลระบบ',
    icon: Settings,
    tagline: 'ผู้ใช้ แผนก และบทบาทของบริษัทในพื้นที่ทำงานนี้',
    accent: 'var(--color-ws-admin)',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'users',
        label: 'ผู้ใช้งาน',
        icon: Users,
        summary: 'เชิญ ระงับ และกำหนดแผนกหลักของผู้ใช้แต่ละคน',
        planned: ['เชิญผู้ใช้', 'ระงับการเข้าใช้', 'กำหนดแผนกหลัก'],
      },
      {
        path: 'departments',
        label: 'แผนก',
        icon: Building2,
        summary: 'แผนกมาตรฐานของ CORE — รหัสแผนกใช้เป็นตัวระบุภายใน ไม่ใช่ชื่อที่แสดง',
        planned: ['เปิด/ปิดแผนก', 'ชื่อที่แสดง', 'ผู้รับผิดชอบ'],
      },
      {
        path: 'roles',
        label: 'บทบาท',
        icon: KeyRound,
        summary: 'บทบาทของบัญชีผู้ใช้ — สิทธิ์ละเอียดจะกำหนดในรอบพัฒนาถัดไป',
        planned: ['บทบาทมาตรฐาน', 'สิทธิ์ระดับการกระทำ', 'สิทธิ์ระดับข้อมูล'],
      },
    ],
  },
};

export const WORKSPACE_ORDER: readonly WorkspaceId[] = [
  'executive',
  'sales',
  'warehouse',
  'purchasing',
  'operations',
  'accounting',
  'admin',
];
