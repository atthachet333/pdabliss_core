import {
  Boxes,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Crown,
  Factory,
  FileStack,
  FileText,
  GitBranch,
  Hourglass,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  PackageCheck,
  Receipt,
  Repeat,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Calculator,
  BarChart3,
  Building2,
  Route as RouteIcon,
  TriangleAlert,
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
  icon: LucideIcon;
  /** Demo persona shown in the top bar. */
  persona: { name: string; role: string };
  tagline: string;
  nav: readonly WorkspaceNavItem[];
}

/**
 * Navigation per workspace. This shapes the UI only — it is NOT access control.
 * Authorization is enforced by the backend for every request.
 */
export const WORKSPACES: Record<WorkspaceId, WorkspaceDefinition> = {
  executive: {
    id: 'executive',
    nameTh: 'ศูนย์ควบคุมผู้บริหาร',
    nameEn: 'Executive Control Center',
    icon: Crown,
    persona: { name: 'คุณวรเชษฐ์', role: 'กรรมการผู้จัดการ' },
    tagline: 'เห็นทุกแผนกในภาพเดียว ตัดสินใจจากข้อยกเว้น',
    nav: [
      { path: '', label: 'ภาพรวมองค์กร', icon: LayoutDashboard },
      {
        path: 'exceptions',
        label: 'Exception Center',
        icon: TriangleAlert,
        summary: 'รวมเหตุการณ์ที่ผิดไปจากแผนจากทุกแผนก จัดลำดับตามความรุนแรงและอายุของปัญหา',
        planned: ['กฎแจ้งเตือนต่อแผนก', 'มอบหมายผู้รับผิดชอบ', 'ติดตามจนปิดเรื่อง'],
      },
      {
        path: 'approvals',
        label: 'รายการอนุมัติ',
        icon: ClipboardCheck,
        summary: 'อนุมัติรายการที่เกินวงเงินหรือเงื่อนไขที่กำหนดให้ผู้บริหารเป็นผู้ตัดสิน',
        planned: ['อนุมัติ/ไม่อนุมัติพร้อมเหตุผล', 'ประวัติการอนุมัติ', 'วงเงินตามบทบาท'],
      },
      {
        path: 'departments',
        label: 'เจาะลึกรายแผนก',
        icon: Layers,
        summary: 'ดูข้อมูลของแต่ละแผนกในมุมมองอ่านอย่างเดียว จากข้อมูลชุดเดียวกับที่แผนกใช้งานจริง',
        planned: ['สรุปรายแผนก', 'แนวโน้มรายสัปดาห์', 'ลิงก์ไปยังเอกสารต้นทาง'],
      },
      {
        path: 'reports',
        label: 'รายงานผู้บริหาร',
        icon: BarChart3,
        summary: 'รายงานตัวชี้วัดข้ามแผนกที่คำนวณจากเอกสารจริงในระบบ',
        planned: ['KPI รายเดือน', 'เปรียบเทียบช่วงเวลา', 'ส่งออกรายงาน'],
      },
    ],
  },
  sales: {
    id: 'sales',
    nameTh: 'พื้นที่ทำงานฝ่ายขาย',
    nameEn: 'Sales Workspace',
    icon: ShoppingCart,
    persona: { name: 'คุณพิมพ์ชนก', role: 'เจ้าหน้าที่ฝ่ายขาย' },
    tagline: 'จากคำสั่งซื้อลูกค้า ถึงวันส่งมอบ',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'customer-po',
        label: 'Customer PO',
        icon: FileText,
        summary: 'บันทึกใบสั่งซื้อจากลูกค้า พร้อมแนบไฟล์ต้นฉบับ และตรวจสอบรายการซ้ำ',
        planned: ['แนบไฟล์ PO ลูกค้า', 'ตรวจจับเลขที่ซ้ำ', 'แปลงเป็น Sales Order'],
      },
      {
        path: 'sales-orders',
        label: 'Sales Orders',
        icon: ClipboardList,
        summary: 'ใบสั่งขายที่ตรวจสอบสต็อกอัตโนมัติ และส่งต่อไปผลิตเมื่อสินค้าไม่พอ',
        planned: ['ตรวจสอบความพร้อมสินค้า', 'จองสต็อก', 'ส่งต่อใบสั่งงาน'],
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
        summary: 'ข้อมูลลูกค้าและประวัติคำสั่งซื้อ ที่ทุกแผนกอ้างอิงจากแหล่งเดียวกัน',
        planned: ['ข้อมูลลูกค้า', 'ประวัติคำสั่งซื้อ', 'ผู้ติดต่อ'],
      },
      {
        path: 'reports',
        label: 'รายงาน',
        icon: BarChart3,
        summary: 'ยอดคำสั่งซื้อ การส่งตรงเวลา และงานค้างของฝ่ายขาย',
        planned: ['ยอดขายตามช่วงเวลา', 'อัตราการส่งตรงเวลา', 'คำสั่งซื้อค้าง'],
      },
    ],
  },
  warehouse: {
    id: 'warehouse',
    nameTh: 'พื้นที่ทำงานคลังสินค้า',
    nameEn: 'Warehouse Workspace',
    icon: Warehouse,
    persona: { name: 'คุณธนากร', role: 'หัวหน้าคลังสินค้า' },
    tagline: 'รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุกล็อต',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'goods-receipt',
        label: 'รับสินค้า',
        icon: PackageCheck,
        summary: 'รับสินค้าตาม PO โดยระบบไม่ยอมให้รับเกินจำนวนที่สั่ง และบันทึกผล QC ทุกครั้ง',
        planned: ['สแกนบาร์โค้ด', 'ตรวจ QC / ปฏิเสธพร้อมเหตุผล', 'บันทึกล็อตและวันหมดอายุ'],
      },
      {
        path: 'stock',
        label: 'สต็อก',
        icon: Boxes,
        summary: 'ยอดคงเหลือ ยอดจอง และพร้อมใช้ แยกตามคลังและตำแหน่งจัดเก็บ',
        planned: ['ยอดตามตำแหน่ง', 'จุดสั่งซื้อซ้ำ', 'ค้นหาด้วยบาร์โค้ด'],
      },
      {
        path: 'lots',
        label: 'ล็อต / แบตช์',
        icon: Layers,
        summary: 'ติดตามทุกล็อตตั้งแต่รับเข้าจนจ่ายออก เพื่อสอบย้อนกลับได้',
        planned: ['ประวัติล็อต', 'วันผลิต / อายุสินค้า', 'สอบย้อนกลับ'],
      },
      {
        path: 'expiry',
        label: 'วันหมดอายุ',
        icon: Hourglass,
        summary: 'ระบบจ่ายตามหลัก FEFO และไม่อนุญาตให้จ่ายล็อตที่หมดอายุแล้ว',
        planned: ['แจ้งเตือนล่วงหน้า', 'บล็อกล็อตหมดอายุ', 'แนะนำล็อตตาม FEFO'],
      },
      {
        path: 'movements',
        label: 'ความเคลื่อนไหว',
        icon: Repeat,
        summary: 'ทุกการรับ จ่าย โอน และปรับยอด ถูกบันทึกพร้อมผู้ทำรายการและเอกสารอ้างอิง',
        planned: ['รับ / จ่าย / โอน', 'ปรับยอดพร้อมเหตุผล', 'อ้างอิงเอกสาร'],
      },
      {
        path: 'stock-count',
        label: 'ตรวจนับสต็อก',
        icon: ListChecks,
        summary: 'งานตรวจนับแบบรอบหรือทั้งคลัง ผลต่างต้องได้รับการอนุมัติก่อนปรับยอด',
        planned: ['นับด้วยมือถือ', 'นับซ้ำเมื่อผลต่างสูง', 'อนุมัติผลต่าง'],
      },
      {
        path: 'reports',
        label: 'รายงาน',
        icon: BarChart3,
        summary: 'รายงานคลังที่แสดงเฉพาะปริมาณ ล็อต และวันที่ — ไม่มีมูลค่าเงิน',
        planned: ['สินค้าคงเหลือ', 'ล็อตใกล้หมดอายุ', 'ความแม่นยำการตรวจนับ'],
      },
    ],
  },
  purchasing: {
    id: 'purchasing',
    nameTh: 'พื้นที่ทำงานจัดซื้อ',
    nameEn: 'Purchasing Workspace',
    icon: Truck,
    persona: { name: 'คุณณัฐวดี', role: 'เจ้าหน้าที่จัดซื้อ' },
    tagline: 'จากความต้องการ ถึงรับของครบ',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'purchase-requests',
        label: 'ใบขอซื้อ (PR)',
        icon: FileText,
        summary:
          'รับคำขอซื้อจากคลังและฝ่ายปฏิบัติการ ผ่านขั้นตอนอนุมัติที่ผู้ขอไม่สามารถอนุมัติเองได้',
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
        label: 'ซัพพลายเออร์',
        icon: Building2,
        summary: 'ข้อมูลซัพพลายเออร์และประวัติการส่งของตรงเวลา',
        planned: ['ข้อมูลติดต่อ', 'ประวัติการส่ง', 'เงื่อนไขการค้า'],
      },
      {
        path: 'receiving',
        label: 'สถานะการรับของ',
        icon: PackageCheck,
        summary: 'เห็นผลการรับสินค้าจากคลังแบบเรียลไทม์ โดยไม่ต้องโทรถาม',
        planned: ['รับครบ / บางส่วน', 'ของถูกปฏิเสธจาก QC', 'แจ้งซัพพลายเออร์'],
      },
      {
        path: 'reports',
        label: 'รายงาน',
        icon: BarChart3,
        summary: 'ระยะเวลาจัดซื้อ การส่งตรงเวลาของซัพพลายเออร์ และ PO ค้าง',
        planned: ['Lead time', 'On-time delivery', 'PO ค้างรับ'],
      },
    ],
  },
  operations: {
    id: 'operations',
    nameTh: 'พื้นที่ทำงานปฏิบัติการ',
    nameEn: 'Operations Workspace',
    icon: Factory,
    persona: { name: 'คุณสุรเชษฐ์', role: 'หัวหน้าฝ่ายปฏิบัติการ' },
    tagline: 'วางแผน ลงมือ ส่งต่อ — ตามจังหวะงานจริง',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'work-orders',
        label: 'ใบสั่งงาน',
        icon: ClipboardList,
        summary: 'ใบสั่งงานที่เกิดจากความต้องการของฝ่ายขายหรือแผนการผลิต พร้อมสถานะของแต่ละขั้น',
        planned: ['สร้างจาก Sales Order', 'กำหนดผู้รับผิดชอบ', 'แนบขั้นตอนการทำงาน'],
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
        summary: 'อัปเดตความคืบหน้าจากหน้างาน และแจ้งเตือนเมื่องานเสี่ยงล่าช้า',
        planned: ['อัปเดตจากหน้างาน', 'งานเสี่ยงล่าช้า', 'บันทึกปัญหา'],
      },
      {
        path: 'completion',
        label: 'ปิดงาน / ส่งต่อ',
        icon: ShieldCheck,
        summary: 'ปิดงานบางส่วนหรือครบจำนวน และส่งต่อให้คลังรับเข้าอย่างเป็นขั้นตอน',
        planned: ['ปิดงานบางส่วน', 'ส่งต่อคลังสินค้า', 'ตรวจคุณภาพก่อนส่ง'],
      },
      {
        path: 'reports',
        label: 'รายงาน',
        icon: BarChart3,
        summary: 'งานตรงเวลา งานล่าช้า และกำลังการทำงาน',
        planned: ['งานตรงเวลา', 'สาเหตุความล่าช้า', 'ภาระงาน'],
      },
    ],
  },
  accounting: {
    id: 'accounting',
    nameTh: 'พื้นที่ทำงานบัญชีและการเงิน',
    nameEn: 'Accounting Workspace',
    icon: Calculator,
    persona: { name: 'คุณกานต์ธิดา', role: 'เจ้าหน้าที่บัญชี' },
    tagline: 'จ่ายถูกต้อง เมื่อเอกสารครบ',
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
        path: 'payments',
        label: 'การจ่ายเงิน',
        icon: Wallet,
        summary: 'บันทึกการจ่ายมัดจำและส่วนที่เหลือ พร้อมหลักฐานการจ่าย',
        planned: ['มัดจำ / ส่วนที่เหลือ', 'แนบหลักฐาน', 'อ้างอิงเอกสารต้นทาง'],
      },
      {
        path: 'payables',
        label: 'เจ้าหนี้',
        icon: FileStack,
        summary: 'ยอดค้างจ่ายซัพพลายเออร์แยกตามอายุหนี้',
        planned: ['อายุหนี้', 'กำหนดชำระ', 'สรุปรายซัพพลายเออร์'],
      },
      {
        path: 'documents',
        label: 'เอกสาร',
        icon: FileText,
        summary: 'ศูนย์รวมเอกสารที่เชื่อมโยงกัน PO → GR → ใบแจ้งหนี้ → การจ่าย',
        planned: ['เชื่อมโยงเอกสาร', 'ตรวจเอกสารขาด', 'ค้นหาย้อนหลัง'],
      },
      {
        path: 'reports',
        label: 'รายงาน',
        icon: BarChart3,
        summary: 'รายงานการจ่ายเงินและยอดค้างจ่าย',
        planned: ['การจ่ายตามช่วงเวลา', 'ยอดค้างจ่าย', 'เอกสารค้าง'],
      },
    ],
  },
  admin: {
    id: 'admin',
    nameTh: 'ผู้ดูแลระบบ',
    nameEn: 'System Admin',
    icon: Settings,
    persona: { name: 'คุณภาณุวัฒน์', role: 'ผู้ดูแลระบบ' },
    tagline: 'ตั้งค่าผู้ใช้ สิทธิ์ และเวิร์กโฟลว์ของบริษัท',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      {
        path: 'users',
        label: 'ผู้ใช้งาน',
        icon: Users,
        summary: 'เชิญ ระงับ และกำหนดแผนกหลักของผู้ใช้แต่ละคน',
        planned: ['เชิญผู้ใช้', 'ระงับการเข้าใช้', 'กำหนดแผนก'],
      },
      {
        path: 'roles',
        label: 'บทบาทและสิทธิ์',
        icon: KeyRound,
        summary: 'กำหนดสิทธิ์ตามบทบาทและแผนก ซึ่งเซิร์ฟเวอร์บังคับใช้กับทุกคำขอ',
        planned: ['บทบาทมาตรฐาน', 'สิทธิ์ระดับการกระทำ', 'สิทธิ์ระดับข้อมูล'],
      },
      {
        path: 'workflows',
        label: 'เวิร์กโฟลว์',
        icon: GitBranch,
        summary: 'ตั้งค่าขั้นตอนของเอกสารแต่ละประเภท ภายในกรอบที่ระบบตรวจสอบได้',
        planned: ['ขั้นตอนเอกสาร', 'เงื่อนไขการอนุมัติ', 'การแจ้งเตือน'],
      },
      {
        path: 'company',
        label: 'ตั้งค่าบริษัท',
        icon: Building2,
        summary: 'ข้อมูลบริษัทของพื้นที่ทำงานนี้ — CORE หนึ่งพื้นที่ทำงานสำหรับหนึ่งบริษัท',
        planned: ['ข้อมูลบริษัท', 'รูปแบบเลขที่เอกสาร', 'แพ็กเกจการใช้งาน'],
      },
      {
        path: 'audit',
        label: 'Audit Log',
        icon: ShieldCheck,
        summary: 'บันทึกทุกการกระทำสำคัญ พร้อมค่าก่อนและหลังการเปลี่ยนแปลง',
        planned: ['ค้นหาตามผู้ใช้ / เอกสาร', 'ค่าก่อน–หลัง', 'ส่งออกบันทึก'],
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
