import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  CircleCheckBig,
  ClipboardList,
  Crown,
  Factory,
  FileCheck2,
  FileInput,
  FileStack,
  FileText,
  GitBranch,
  Hourglass,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  PackageSearch,
  Receipt,
  Route as RouteIcon,
  Settings,
  Settings2,
  ShoppingCart,
  Stamp,
  Truck,
  TriangleAlert,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { ColumnPriority } from '@/components/core';

export type WorkspaceId =
  'executive' | 'sales' | 'warehouse' | 'purchasing' | 'operations' | 'accounting' | 'admin';

/**
 * The list a module will show once it is built: its columns (first = record
 * title), quick filters, primary action and empty-state copy. Module pages
 * render this as a real DataTable with zero rows, so every screen already
 * has its final structure without fake records.
 */
export interface ModuleBlueprint {
  columns: readonly { header: string; priority?: ColumnPriority; align?: 'end' }[];
  filters?: readonly string[];
  /** Label of the primary action (disabled in the prototype). */
  action?: string;
  empty: { title: string; description: string };
}

export interface WorkspaceNavItem {
  /** Path segment relative to the workspace root; '' is the overview. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar. At most four per workspace (overview included). */
  mobile?: boolean;
  /** Planned module flagged in navigation (e.g. Approval, Workflow). */
  placeholder?: boolean;
  /** What this module will do — shown on module pages until it is built. */
  summary?: string;
  planned?: readonly string[];
  blueprint?: ModuleBlueprint;
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  nameTh: string;
  nameEn: string;
  /** Short name for compact UI (switcher, top bar, mobile). */
  shortTh: string;
  icon: LucideIcon;
  tagline: string;
  /** CSS colour token giving each workspace its own restrained accent. */
  accent: string;
  /** Switcher grouping: the Executive control center, departments, system. */
  group: 'control' | 'department' | 'system';
  /** Warehouse: a centre scan button in the phone bottom bar (barcode / QR, future). */
  scanAction?: boolean;
  nav: readonly WorkspaceNavItem[];
}

const REPORTS = (summary: string): WorkspaceNavItem => ({
  path: 'reports',
  label: 'รายงาน',
  icon: BarChart3,
  summary,
  planned: ['รายงานมาตรฐานของแผนก', 'เลือกช่วงเวลา', 'ส่งออกเป็นไฟล์'],
  blueprint: {
    columns: [
      { header: 'รายงาน', priority: 'primary' },
      { header: 'สถานะ', priority: 'status' },
      { header: 'รอบข้อมูล' },
      { header: 'ปรับปรุงล่าสุด', priority: 'medium' },
    ],
    empty: {
      title: 'ยังไม่มีรายงาน',
      description: 'รายงานจะสร้างจากข้อมูลจริงของแผนกเมื่อเชื่อมระบบข้อมูลแล้ว',
    },
  },
});

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
    group: 'control',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'departments',
        label: 'แผนก',
        icon: Layers,
        mobile: true,
        summary: 'สรุปของแต่ละแผนกในมุมมองอ่านอย่างเดียว จากข้อมูลชุดเดียวกับที่แผนกใช้งานจริง',
        planned: ['สรุปรายแผนก', 'แนวโน้มรายสัปดาห์', 'ลิงก์ไปยังเอกสารต้นทาง'],
      },
      {
        path: 'exceptions',
        label: 'Exception',
        icon: TriangleAlert,
        mobile: true,
        summary: 'รวมเหตุการณ์ที่ผิดไปจากแผนจากทุกแผนก จัดลำดับตามความรุนแรงและอายุของปัญหา',
        planned: ['แจ้งเตือนตามกฎของแต่ละแผนก', 'มอบหมายผู้รับผิดชอบ', 'ติดตามจนปิดเรื่อง'],
        blueprint: {
          columns: [
            { header: 'เรื่อง', priority: 'primary' },
            { header: 'ความรุนแรง', priority: 'status' },
            { header: 'แผนก' },
            { header: 'อ้างอิง' },
            { header: 'เกิดขึ้นเมื่อ', priority: 'medium' },
            { header: 'ผู้รับผิดชอบ', priority: 'low' },
          ],
          filters: ['วิกฤต', 'สูง', 'ปานกลาง'],
          empty: {
            title: 'ไม่มี Exception ที่ต้องตัดสินใจ',
            description: 'เมื่อเอกสารใดผิดไปจากแผน เช่น ส่งล่าช้าหรือใกล้หมดอายุ จะยกขึ้นมาที่นี่',
          },
        },
      },
      {
        path: 'approvals',
        label: 'การอนุมัติ',
        icon: Stamp,
        mobile: true,
        placeholder: true,
        summary: 'รายการที่รอผู้บริหารอนุมัติ ตามวงเงินและลำดับขั้นที่บริษัทกำหนด',
        planned: ['อนุมัติตามวงเงิน', 'อนุมัติหลายรายการ', 'ปฏิเสธพร้อมเหตุผล'],
        blueprint: {
          columns: [
            { header: 'เอกสาร', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'แผนก' },
            { header: 'ผู้ขอ' },
            { header: 'วันที่ขอ', priority: 'medium' },
          ],
          empty: {
            title: 'ไม่มีรายการรออนุมัติ',
            description: 'ขั้นตอนอนุมัติจะเปิดใช้พร้อมระบบสิทธิ์จริง',
          },
        },
      },
      REPORTS('รายงานภาพรวมองค์กร รวมจากทุกแผนกบนข้อมูลชุดเดียวกัน'),
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
    group: 'department',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'customer-po',
        label: 'Customer PO',
        icon: FileInput,
        mobile: true,
        summary: 'บันทึกใบสั่งซื้อจากลูกค้า แล้วแปลงเป็น Sales Order พร้อมตรวจความพร้อมของสินค้า',
        planned: ['บันทึก Customer PO', 'แนบเอกสารลูกค้า', 'แปลงเป็น Sales Order'],
        blueprint: {
          columns: [
            { header: 'เลขที่ Customer PO', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ลูกค้า' },
            { header: 'วันที่รับ' },
            { header: 'กำหนดส่ง', priority: 'medium' },
            { header: 'ผู้รับผิดชอบ', priority: 'low' },
          ],
          filters: ['รอดำเนินการ', 'แปลงเป็น SO แล้ว'],
          action: 'บันทึก Customer PO',
          empty: {
            title: 'ยังไม่มี Customer PO',
            description: 'ใบสั่งซื้อที่ได้รับจากลูกค้าจะแสดงที่นี่ ก่อนแปลงเป็น Sales Order',
          },
        },
      },
      {
        path: 'sales-orders',
        label: 'Sales Order',
        icon: ClipboardList,
        mobile: true,
        summary: 'ใบสั่งขายที่ยืนยันแล้ว ติดตามตั้งแต่ตรวจสต็อก ส่งผลิต จนส่งมอบครบ',
        planned: ['ตรวจสต็อกอัตโนมัติ', 'ส่งต่อฝ่ายปฏิบัติการ', 'ปิด SO เมื่อส่งครบ'],
        blueprint: {
          columns: [
            { header: 'เลขที่ SO', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ลูกค้า' },
            { header: 'กำหนดส่ง' },
            { header: 'ส่งแล้ว', priority: 'medium' },
            { header: 'Customer PO', priority: 'low' },
          ],
          filters: ['กำลังดำเนินการ', 'ส่งบางส่วน', 'ใกล้กำหนดส่ง'],
          action: 'สร้าง Sales Order',
          empty: {
            title: 'ยังไม่มี Sales Order',
            description: 'เมื่อแปลง Customer PO แล้ว ใบสั่งขายจะปรากฏที่นี่พร้อมสถานะแต่ละขั้น',
          },
        },
      },
      {
        path: 'delivery',
        label: 'การส่งมอบ',
        icon: Truck,
        mobile: true,
        summary: 'ติดตามการส่งมอบบางส่วนและครบจำนวน จนปิดใบสั่งขายได้',
        planned: ['ส่งบางส่วน', 'ยืนยันการรับของลูกค้า', 'แจ้งเตือนใกล้ครบกำหนด'],
        blueprint: {
          columns: [
            { header: 'เลขที่ใบส่งของ', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'SO อ้างอิง' },
            { header: 'ลูกค้า' },
            { header: 'วันที่ส่ง', priority: 'medium' },
          ],
          filters: ['วันนี้', 'ส่งบางส่วน'],
          empty: {
            title: 'ยังไม่มีการส่งมอบ',
            description: 'รายการส่งมอบจะสร้างจาก Sales Order ที่พร้อมส่ง',
          },
        },
      },
      {
        path: 'customers',
        label: 'ลูกค้า',
        icon: Users,
        summary: 'ข้อมูลลูกค้าที่ทุกแผนกอ้างอิงจากแหล่งเดียวกัน',
        planned: ['ข้อมูลลูกค้า', 'ผู้ติดต่อ', 'ประวัติคำสั่งซื้อ'],
        blueprint: {
          columns: [
            { header: 'ลูกค้า', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ผู้ติดต่อ' },
            { header: 'SO ที่เปิดอยู่', priority: 'medium' },
          ],
          action: 'เพิ่มลูกค้า',
          empty: {
            title: 'ยังไม่มีข้อมูลลูกค้า',
            description: 'ลูกค้าที่เพิ่มแล้วจะใช้ร่วมกันใน Customer PO, Sales Order และการส่งมอบ',
          },
        },
      },
      REPORTS('รายงานยอดคำสั่งซื้อ การส่งมอบตรงเวลา และงานค้างของฝ่ายขาย'),
    ],
  },
  warehouse: {
    id: 'warehouse',
    nameTh: 'พื้นที่ทำงานคลังสินค้า',
    nameEn: 'Warehouse Workspace',
    shortTh: 'คลังสินค้า',
    icon: Warehouse,
    tagline: 'รับเข้า ตรวจสอบ จัดเก็บ — แม่นยำทุก Lot',
    accent: 'var(--color-ws-warehouse)',
    group: 'department',
    scanAction: true,
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'receiving',
        label: 'รับสินค้า',
        icon: PackageCheck,
        mobile: true,
        summary: 'รับสินค้าตาม PO โดยระบบไม่ยอมให้รับเกินจำนวนที่สั่ง และบันทึกผล QC ทุกครั้ง',
        planned: ['สแกนบาร์โค้ด', 'ตรวจ QC / ปฏิเสธพร้อมเหตุผล', 'บันทึก Lot และวันหมดอายุ'],
        blueprint: {
          columns: [
            { header: 'เลขที่ใบรับ (GR)', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'PO อ้างอิง' },
            { header: 'ผู้ส่ง' },
            { header: 'กำหนดรับ', priority: 'medium' },
            { header: 'จำนวนรายการ', priority: 'low', align: 'end' },
          ],
          filters: ['ถึงกำหนดวันนี้', 'รอ QC'],
          action: 'รับสินค้า',
          empty: {
            title: 'ยังไม่มีรายการรอรับ',
            description:
              'เมื่อฝ่ายจัดซื้อออก PO รายการที่ถึงกำหนดรับจะปรากฏที่นี่ พร้อมขั้นตอนตรวจ QC',
          },
        },
      },
      {
        path: 'stock',
        label: 'สต็อกสินค้า',
        icon: Boxes,
        mobile: true,
        summary: 'ยอดคงเหลือ ยอดจอง และพร้อมใช้ แยกตามคลังและตำแหน่งจัดเก็บ — แสดงเฉพาะปริมาณ',
        planned: ['ยอดตามตำแหน่ง', 'จุดสั่งซื้อซ้ำ', 'ค้นหาด้วยบาร์โค้ด'],
        blueprint: {
          columns: [
            { header: 'สินค้า', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'คงเหลือ', align: 'end' },
            { header: 'พร้อมใช้', align: 'end' },
            { header: 'ตำแหน่ง', priority: 'medium' },
            { header: 'จุดสั่งซื้อซ้ำ', priority: 'low', align: 'end' },
          ],
          filters: ['ต่ำกว่าจุดสั่งซื้อ', 'ติดจอง'],
          empty: {
            title: 'ยังไม่มีสินค้าในคลัง',
            description: 'ยอดสต็อกจะเกิดจากการรับสินค้าและการเคลื่อนไหวที่บันทึกในระบบเท่านั้น',
          },
        },
      },
      {
        path: 'lots',
        label: 'Lot / Batch',
        icon: Layers,
        summary: 'ติดตามทุก Lot ตั้งแต่รับเข้าจนจ่ายออก จ่ายตามหลัก FEFO',
        planned: ['ประวัติ Lot', 'ย้อนรอยต้นทาง', 'กักกัน Lot'],
        blueprint: {
          columns: [
            { header: 'Lot / Batch', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'สินค้า' },
            { header: 'จำนวน', align: 'end' },
            { header: 'วันที่รับเข้า', priority: 'medium' },
            { header: 'ตำแหน่ง', priority: 'low' },
          ],
          filters: ['พร้อมใช้', 'กักกัน'],
          empty: {
            title: 'ยังไม่มี Lot',
            description: 'Lot จะถูกสร้างเมื่อรับสินค้าเข้าคลัง พร้อมวันผลิตและวันหมดอายุ',
          },
        },
      },
      {
        path: 'expiry',
        label: 'วันหมดอายุ',
        icon: Hourglass,
        summary: 'Lot ที่ใกล้หมดอายุ เรียงตามวันที่ ระบบไม่อนุญาตให้จ่าย Lot ที่หมดอายุแล้ว',
        planned: ['แจ้งเตือนล่วงหน้า', 'บล็อก Lot หมดอายุ', 'ตั้งช่วงเตือนตามสินค้า'],
        blueprint: {
          columns: [
            { header: 'Lot', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'สินค้า' },
            { header: 'วันหมดอายุ' },
            { header: 'เหลือ (วัน)', priority: 'medium', align: 'end' },
            { header: 'จำนวน', priority: 'low', align: 'end' },
          ],
          filters: ['ภายใน 30 วัน', 'ภายใน 90 วัน'],
          empty: {
            title: 'ยังไม่มี Lot ที่ใกล้หมดอายุ',
            description: 'Lot ที่จะหมดอายุภายในช่วงที่กำหนดจะแสดงที่นี่ เรียงตามวันหมดอายุ',
          },
        },
      },
      {
        path: 'movements',
        label: 'การเคลื่อนไหว',
        icon: ArrowLeftRight,
        summary: 'ทุกการรับเข้า จ่ายออก และโอนย้าย บันทึกพร้อมเอกสารอ้างอิงและผู้ทำรายการ',
        planned: ['รับเข้า / จ่ายออก', 'โอนย้ายตำแหน่ง', 'ย้อนดูตามเอกสาร'],
        blueprint: {
          columns: [
            { header: 'เลขที่เอกสาร', priority: 'primary' },
            { header: 'ประเภท', priority: 'status' },
            { header: 'สินค้า' },
            { header: 'จำนวน', align: 'end' },
            { header: 'จาก → ไป', priority: 'medium' },
            { header: 'เวลา', priority: 'low' },
          ],
          filters: ['รับเข้า', 'จ่ายออก', 'โอนย้าย'],
          empty: {
            title: 'ยังไม่มีการเคลื่อนไหว',
            description: 'การเคลื่อนไหวของสินค้าทุกครั้งจะถูกบันทึกที่นี่โดยอัตโนมัติ',
          },
        },
      },
      {
        path: 'stock-count',
        label: 'ตรวจนับ',
        icon: ListChecks,
        summary: 'งานตรวจนับแบบรอบหรือทั้งคลัง ผลต่างต้องได้รับการอนุมัติก่อนปรับยอด',
        planned: ['นับด้วยมือถือ', 'นับซ้ำเมื่อผลต่างสูง', 'อนุมัติผลต่าง'],
        blueprint: {
          columns: [
            { header: 'งานตรวจนับ', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'พื้นที่' },
            { header: 'ผู้ตรวจนับ' },
            { header: 'กำหนด', priority: 'medium' },
          ],
          action: 'สร้างงานตรวจนับ',
          empty: {
            title: 'ยังไม่มีงานตรวจนับ',
            description: 'งานตรวจนับที่มอบหมายให้ทีมคลังจะแสดงที่นี่ พร้อมพื้นที่และกำหนดเวลา',
          },
        },
      },
      REPORTS('รายงานปริมาณคงคลัง การหมุนเวียน และผลตรวจนับ — แสดงเฉพาะปริมาณ'),
    ],
  },
  purchasing: {
    id: 'purchasing',
    nameTh: 'พื้นที่ทำงานจัดซื้อ',
    nameEn: 'Purchasing Workspace',
    shortTh: 'จัดซื้อ',
    icon: PackageSearch,
    tagline: 'จากความต้องการ ถึงรับของครบ',
    accent: 'var(--color-ws-purchasing)',
    group: 'department',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'purchase-requests',
        label: 'ใบขอซื้อ',
        icon: FileText,
        mobile: true,
        summary: 'รับคำขอซื้อจากคลังและฝ่ายปฏิบัติการ ผ่านขั้นตอนอนุมัติที่ผู้ขออนุมัติเองไม่ได้',
        planned: ['รวม PR หลายใบ', 'อนุมัติตามวงเงิน', 'แปลงเป็น PO'],
        blueprint: {
          columns: [
            { header: 'เลขที่ PR', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'แผนกที่ขอ' },
            { header: 'ผู้ขอ' },
            { header: 'วันที่ต้องการ', priority: 'medium' },
            { header: 'จำนวนรายการ', priority: 'low', align: 'end' },
          ],
          filters: ['รออนุมัติ', 'อนุมัติแล้ว'],
          action: 'สร้างใบขอซื้อ',
          empty: {
            title: 'ยังไม่มีใบขอซื้อ',
            description:
              'ใบขอซื้อจากคลังสินค้าและฝ่ายปฏิบัติการจะเข้ามาที่นี่เพื่อตรวจสอบและอนุมัติ',
          },
        },
      },
      {
        path: 'purchase-orders',
        label: 'ใบสั่งซื้อ',
        icon: ClipboardList,
        mobile: true,
        summary: 'ใบสั่งซื้อที่ผูกกับ PR ต้นทาง ติดตามการรับของบางส่วนจนปิด PO',
        planned: ['เงื่อนไขมัดจำ', 'ติดตามการรับของ', 'ปิด PO อัตโนมัติ'],
        blueprint: {
          columns: [
            { header: 'เลขที่ PO', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'Supplier' },
            { header: 'กำหนดส่ง' },
            { header: 'รับแล้ว', priority: 'medium' },
            { header: 'PR อ้างอิง', priority: 'low' },
          ],
          filters: ['เปิดอยู่', 'รับบางส่วน', 'เลยกำหนด'],
          action: 'สร้างใบสั่งซื้อ',
          empty: {
            title: 'ยังไม่มีใบสั่งซื้อ',
            description: 'PO ที่สร้างจากใบขอซื้อที่อนุมัติแล้วจะแสดงที่นี่',
          },
        },
      },
      {
        path: 'suppliers',
        label: 'Supplier',
        icon: Building2,
        summary: 'ข้อมูล Supplier และประวัติการส่งของตรงเวลา',
        planned: ['ข้อมูลผู้ติดต่อ', 'ประวัติการส่งตรงเวลา', 'หมวดสินค้าที่จัดหา'],
        blueprint: {
          columns: [
            { header: 'Supplier', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ผู้ติดต่อ' },
            { header: 'PO ที่เปิดอยู่', align: 'end' },
            { header: 'ส่งตรงเวลา', priority: 'medium' },
          ],
          action: 'เพิ่ม Supplier',
          empty: {
            title: 'ยังไม่มี Supplier',
            description: 'Supplier ที่เพิ่มแล้วจะใช้ร่วมกันใน PO และการรับสินค้าของคลัง',
          },
        },
      },
      {
        path: 'receiving-follow-up',
        label: 'ติดตามการรับ',
        icon: CalendarClock,
        mobile: true,
        summary: 'ติดตามกำหนดส่งของ Supplier และเห็นผลการรับของจากคลังทันที',
        planned: ['กำหนดส่ง', 'ส่งล่าช้า', 'รับบางส่วน'],
        blueprint: {
          columns: [
            { header: 'PO', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'Supplier' },
            { header: 'กำหนดส่ง' },
            { header: 'รับแล้ว', priority: 'medium' },
            { header: 'GR ล่าสุด', priority: 'low' },
          ],
          filters: ['ใกล้กำหนด', 'เลยกำหนด'],
          empty: {
            title: 'ไม่มี PO ที่ต้องติดตาม',
            description: 'PO ที่ยังรับของไม่ครบจะแสดงที่นี่ เรียงตามกำหนดส่ง',
          },
        },
      },
      REPORTS('รายงานการจัดซื้อ ระยะเวลา PR → PO และการส่งตรงเวลาของ Supplier'),
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
    group: 'department',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'work-orders',
        label: 'Work Order',
        icon: ClipboardList,
        mobile: true,
        summary: 'ใบสั่งงานที่เกิดจาก Sales Order หรือแผนงาน พร้อมสถานะของแต่ละขั้น',
        planned: ['สร้างจาก Sales Order', 'กำหนดผู้รับผิดชอบ', 'ขั้นตอนการทำงาน'],
        blueprint: {
          columns: [
            { header: 'Work Order', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'SO อ้างอิง' },
            { header: 'ผู้รับผิดชอบ' },
            { header: 'กำหนดเสร็จ', priority: 'medium' },
          ],
          filters: ['กำลังดำเนินการ', 'เสี่ยงล่าช้า'],
          action: 'สร้าง Work Order',
          empty: {
            title: 'ยังไม่มี Work Order',
            description: 'Work Order จะสร้างจาก Sales Order ที่ต้องผลิตหรือจากแผนงานของทีม',
          },
        },
      },
      {
        path: 'plan',
        label: 'แผนงาน',
        icon: CalendarClock,
        mobile: true,
        summary: 'จัดลำดับงานตามกำหนดส่ง และตรวจความพร้อมวัตถุดิบก่อนเริ่มงาน',
        planned: ['ตารางงาน', 'ตรวจความพร้อม', 'ปรับลำดับงาน'],
        blueprint: {
          columns: [
            { header: 'งาน', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'วันที่เริ่ม' },
            { header: 'วันที่เสร็จ' },
            { header: 'ความพร้อมวัตถุดิบ', priority: 'medium' },
          ],
          empty: {
            title: 'ยังไม่มีงานในแผน',
            description: 'Work Order ที่ลงตารางแล้วจะเรียงตามวันที่ที่นี่',
          },
        },
      },
      {
        path: 'progress',
        label: 'ความคืบหน้า',
        icon: RouteIcon,
        mobile: true,
        summary: 'อัปเดตความคืบหน้าจากหน้างาน และส่งต่อให้คลังเมื่อเสร็จ',
        planned: ['อัปเดตจากหน้างาน', 'งานเสี่ยงล่าช้า', 'ส่งต่อคลังสินค้า'],
        blueprint: {
          columns: [
            { header: 'Work Order', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ขั้นตอนปัจจุบัน' },
            { header: 'ความคืบหน้า' },
            { header: 'อัปเดตล่าสุด', priority: 'medium' },
          ],
          filters: ['เสี่ยงล่าช้า'],
          empty: {
            title: 'ยังไม่มีงานที่กำลังดำเนินการ',
            description: 'งานที่เริ่มแล้วจะแสดงความคืบหน้าที่นี่ อัปเดตจากหน้างาน',
          },
        },
      },
      {
        path: 'completed',
        label: 'งานเสร็จ',
        icon: CircleCheckBig,
        summary: 'งานที่เสร็จและส่งต่อคลังแล้ว พร้อมผู้ปิดงานและเวลาที่ใช้',
        planned: ['ส่งต่อคลังสินค้า', 'ระยะเวลาที่ใช้จริง', 'ย้อนดูตาม Sales Order'],
        blueprint: {
          columns: [
            { header: 'Work Order', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'วันที่เสร็จ' },
            { header: 'ส่งต่อคลัง' },
            { header: 'ผู้ปิดงาน', priority: 'medium' },
          ],
          empty: {
            title: 'ยังไม่มีงานที่เสร็จในช่วงนี้',
            description: 'เมื่อปิด Work Order งานจะย้ายมาที่นี่และแจ้งคลังสินค้าโดยอัตโนมัติ',
          },
        },
      },
      REPORTS('รายงานงานเสร็จตรงเวลา งานล่าช้า และภาระงานของทีม'),
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
    group: 'department',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'payment-requests',
        label: 'คำขอจ่าย',
        icon: Receipt,
        mobile: true,
        summary:
          'คำขอจ่ายเงินที่ผูกกับ PO และใบรับสินค้า จ่ายได้เมื่อได้รับอนุมัติและเอกสารครบเท่านั้น',
        planned: ['ตรวจเอกสารครบอัตโนมัติ', 'อนุมัติตามวงเงิน', 'ป้องกันการจ่ายซ้ำ'],
        blueprint: {
          columns: [
            { header: 'เลขที่คำขอ', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ผู้รับเงิน' },
            { header: 'ยอดเงิน', align: 'end' },
            { header: 'อ้างอิง PO / GR', priority: 'medium' },
            { header: 'กำหนดจ่าย', priority: 'low' },
          ],
          filters: ['รออนุมัติ', 'เอกสารไม่ครบ'],
          action: 'สร้างคำขอจ่าย',
          empty: {
            title: 'ยังไม่มีคำขอจ่าย',
            description: 'คำขอจ่ายเงินที่ผูกกับใบสั่งซื้อและใบรับสินค้าจะเข้ามาที่นี่',
          },
        },
      },
      {
        path: 'payments',
        label: 'การจ่ายเงิน',
        icon: Wallet,
        mobile: true,
        summary: 'บันทึกการจ่ายมัดจำและส่วนที่เหลือ เมื่อเงื่อนไขก่อนจ่ายครบ',
        planned: ['มัดจำ', 'ส่วนที่เหลือ', 'หลักฐานการจ่าย'],
        blueprint: {
          columns: [
            { header: 'เลขที่การจ่าย', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ผู้รับเงิน' },
            { header: 'ยอดเงิน', align: 'end' },
            { header: 'วันที่จ่าย', priority: 'medium' },
          ],
          empty: {
            title: 'ยังไม่มีการจ่ายเงิน',
            description: 'การจ่ายเงินที่บันทึกแล้วจะแสดงที่นี่ พร้อมคำขอจ่ายที่อ้างอิง',
          },
        },
      },
      {
        path: 'outstanding',
        label: 'ยอดค้าง',
        icon: FileStack,
        mobile: true,
        summary: 'ยอดค้างจ่าย Supplier แยกตามอายุหนี้',
        planned: ['อายุหนี้', 'สรุปราย Supplier', 'ส่งออกรายงาน'],
        blueprint: {
          columns: [
            { header: 'Supplier', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ยอดค้าง', align: 'end' },
            { header: 'อายุหนี้' },
            { header: 'ครบกำหนดถัดไป', priority: 'medium' },
          ],
          empty: {
            title: 'ไม่มีรายการค้าง',
            description: 'ยอดค้างจ่ายจะคำนวณจากคำขอจ่ายที่อนุมัติแล้วแต่ยังไม่ได้จ่าย',
          },
        },
      },
      {
        path: 'documents',
        label: 'เอกสาร',
        icon: FileCheck2,
        summary: 'ใบแจ้งหนี้ ใบเสร็จ และใบกำกับภาษี ผูกกับคำขอจ่ายและ PO',
        planned: ['ตรวจเอกสารครบ', 'ผูกกับคำขอจ่าย', 'ค้นหาตามเลขที่'],
        blueprint: {
          columns: [
            { header: 'เอกสาร', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ประเภท' },
            { header: 'อ้างอิง' },
            { header: 'วันที่', priority: 'medium' },
          ],
          filters: ['ใบแจ้งหนี้', 'ใบเสร็จ', 'ใบกำกับภาษี'],
          empty: {
            title: 'ยังไม่มีเอกสาร',
            description: 'เอกสารที่แนบกับคำขอจ่ายจะรวมไว้ที่นี่เพื่อค้นหาและตรวจสอบ',
          },
        },
      },
      REPORTS('รายงานการจ่ายเงิน ยอดค้างตามอายุหนี้ และเอกสารไม่ครบ'),
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
    group: 'system',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard, mobile: true },
      {
        path: 'users',
        label: 'ผู้ใช้งาน',
        icon: Users,
        mobile: true,
        summary: 'เชิญ ระงับ และกำหนดแผนกหลักของผู้ใช้แต่ละคน',
        planned: ['เชิญผู้ใช้', 'ระงับการเข้าใช้', 'กำหนดแผนกหลัก'],
        blueprint: {
          columns: [
            { header: 'ผู้ใช้', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'แผนกหลัก' },
            { header: 'บทบาท' },
            { header: 'เข้าใช้ล่าสุด', priority: 'medium' },
          ],
          filters: ['ใช้งานอยู่', 'ระงับ'],
          action: 'เชิญผู้ใช้',
          empty: {
            title: 'ยังไม่มีผู้ใช้ในระบบ',
            description:
              'การเชิญผู้ใช้จะเปิดใช้พร้อมระบบยืนยันตัวตนจริง บัญชีทดลอง user1 ใช้สำหรับตรวจต้นแบบเท่านั้นและไม่ได้ถูกบันทึกเป็นผู้ใช้',
          },
        },
      },
      {
        path: 'departments',
        label: 'แผนก',
        icon: Building2,
        mobile: true,
        summary: 'แผนกมาตรฐานของ CORE — รหัสแผนกใช้เป็นตัวระบุภายใน ไม่ใช่ชื่อที่แสดง',
        planned: ['เปิด/ปิดแผนก', 'ชื่อที่แสดง', 'หัวหน้าแผนก'],
      },
      {
        path: 'roles',
        label: 'บทบาท',
        icon: KeyRound,
        mobile: true,
        summary: 'บทบาทของบัญชีผู้ใช้ — สิทธิ์ละเอียดจะกำหนดในรอบพัฒนาถัดไป',
        planned: ['บทบาทมาตรฐาน', 'สิทธิ์ระดับการกระทำ', 'สิทธิ์ระดับข้อมูล'],
      },
      {
        path: 'workflow',
        label: 'Workflow',
        icon: GitBranch,
        placeholder: true,
        summary: 'ลำดับขั้นอนุมัติและการส่งต่องานระหว่างแผนก กำหนดได้ต่อประเภทเอกสาร',
        planned: ['ขั้นอนุมัติตามวงเงิน', 'ผู้อนุมัติแทน', 'เงื่อนไขการส่งต่อ'],
        blueprint: {
          columns: [
            { header: 'Workflow', priority: 'primary' },
            { header: 'สถานะ', priority: 'status' },
            { header: 'ประเภทเอกสาร' },
            { header: 'จำนวนขั้น', align: 'end' },
            { header: 'ปรับปรุงล่าสุด', priority: 'medium' },
          ],
          empty: {
            title: 'ยังไม่มี Workflow ที่กำหนดเอง',
            description: 'ระบบใช้ลำดับขั้นมาตรฐานของ CORE จนกว่าจะเปิดให้ปรับแต่ง',
          },
        },
      },
      {
        path: 'settings',
        label: 'การตั้งค่า',
        icon: Settings2,
        summary: 'ข้อมูลบริษัท ค่าเริ่มต้นของเอกสาร และการแจ้งเตือนของพื้นที่ทำงาน',
        planned: ['ข้อมูลบริษัท', 'รูปแบบเลขที่เอกสาร', 'การแจ้งเตือน'],
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

export function workspacePath(id: WorkspaceId, path = '') {
  return path ? `/app/${id}/${path}` : `/app/${id}`;
}
