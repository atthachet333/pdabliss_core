import {
  Blocks,
  BookOpen,
  Building2,
  Calculator,
  Compass,
  Crown,
  Eye,
  Factory,
  FileCheck2,
  GitBranch,
  Hammer,
  Handshake,
  Hourglass,
  Info,
  Layers,
  LifeBuoy,
  MessageSquare,
  Network,
  Orbit,
  Route,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Warehouse,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/*
 * Public site information architecture (EP04).
 *
 * Every link points to a destination that exists today — a public route, a
 * department anchor, or a homepage chapter. Topics whose dedicated page comes
 * in a later episode are listed as `notes` (plain text, never a dead link).
 * Pricing is intentionally not a top-level item: it lives under Product.
 */

export interface NavLinkItem {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  /** One sentence shown in the menu's side panel. */
  summary: string;
  links: readonly NavLinkItem[];
  /** Topics without their own page yet — shown as text, not links. */
  notes?: { title: string; items: readonly string[] };
  /** Primary call to action in the side panel. */
  cta: { label: string; to: string };
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'product',
    label: 'Product',
    summary: 'แพลตฟอร์มปฏิบัติการที่ให้แต่ละแผนกมีพื้นที่ทำงานของตัวเอง บนข้อมูลชุดเดียวกัน',
    links: [
      { label: 'ภาพรวม CORE', description: 'CORE คืออะไร และทำงานอย่างไร', to: '/', icon: Orbit },
      {
        label: 'แนวคิดของ CORE',
        description: 'เริ่มจากวิธีทำงานของแต่ละแผนก',
        to: '/#why-core',
        icon: Compass,
      },
      {
        label: 'โลกการทำงานของแต่ละแผนก',
        description: 'หกมุมมองการทำงานในระบบเดียว',
        to: '/#department-worlds',
        icon: Layers,
      },
      {
        label: 'เส้นทางงานข้ามแผนก',
        description: 'งานส่งต่อกันบนข้อมูลชุดเดียว',
        to: '/#connected-flow',
        icon: Route,
      },
      { label: 'ฟีเจอร์', description: 'ความสามารถหลักของระบบ', to: '/features', icon: Sparkles },
      {
        label: 'แพ็กเกจ',
        description: 'โครงสร้างแพ็กเกจสำหรับองค์กร',
        to: '/pricing',
        icon: Blocks,
      },
    ],
    notes: { title: 'กำลังจัดทำหน้าเฉพาะ', items: ['Analytics', 'Mobile', 'Integrations'] },
    cta: { label: 'สำรวจ CORE', to: '/#who-for' },
  },
  {
    id: 'departments',
    label: 'Departments',
    summary: 'แต่ละแผนกเห็นงานของตัวเองก่อน — แต่ยังเชื่อมกับทุกแผนกผ่าน CORE',
    links: [
      {
        label: 'ผู้บริหาร',
        description: 'ภาพรวมทุกแผนก ข้อยกเว้น และการอนุมัติ',
        to: '/departments#executive',
        icon: Crown,
      },
      {
        label: 'ฝ่ายขาย',
        description: 'จากคำสั่งซื้อลูกค้า ถึงการส่งมอบ',
        to: '/departments#sales',
        icon: ShoppingCart,
      },
      {
        label: 'ปฏิบัติการ',
        description: 'ใบสั่งงาน ลำดับงาน และความคืบหน้า',
        to: '/departments#operations',
        icon: Factory,
      },
      {
        label: 'คลังสินค้า',
        description: 'รับเข้า สต็อก Lot และวันหมดอายุ',
        to: '/departments#warehouse',
        icon: Warehouse,
      },
      {
        label: 'จัดซื้อ',
        description: 'ใบขอซื้อ ใบสั่งซื้อ และ Supplier',
        to: '/departments#purchasing',
        icon: Truck,
      },
      {
        label: 'บัญชีและการเงิน',
        description: 'คำขอจ่าย เอกสาร และยอดค้าง',
        to: '/departments#accounting',
        icon: Calculator,
      },
    ],
    cta: { label: 'ดูทุกแผนก', to: '/departments' },
  },
  {
    id: 'solutions',
    label: 'Solutions',
    summary: 'ปัญหาที่องค์กรหลายแผนกพบบ่อย และวิธีที่ CORE ถูกออกแบบมาเพื่อรับมือ',
    links: [
      {
        label: 'ลดความผิดพลาดจากคน',
        description: 'ป้องกัน ตรวจจับ และควบคุมก่อนเกิดปัญหา',
        to: '/#error-control',
        icon: ShieldCheck,
      },
      {
        label: 'เชื่อมหลายแผนก',
        description: 'แยกประสบการณ์ แต่ไม่แยกข้อมูล',
        to: '/#department-worlds',
        icon: Network,
      },
      {
        label: 'Workflow และการอนุมัติ',
        description: 'ขั้นตอนที่ชัดเจน ส่งต่อได้เอง',
        to: '/#connected-flow',
        icon: Workflow,
      },
      {
        label: 'มองเห็นการปฏิบัติงาน',
        description: 'สถานะเดียวกันทั้งองค์กร',
        to: '/#executive',
        icon: Eye,
      },
      {
        label: 'ควบคุมสต็อกและวันหมดอายุ',
        description: 'Lot ตามลำดับ FEFO',
        to: '/departments#warehouse',
        icon: Hourglass,
      },
      {
        label: 'การควบคุมของผู้บริหาร',
        description: 'ข้อยกเว้นที่ต้องตัดสินใจ',
        to: '/departments#executive',
        icon: Crown,
      },
    ],
    cta: { label: 'ดูตัวอย่างการใช้งาน', to: '/solutions' },
  },
  {
    id: 'industries',
    label: 'Industries',
    summary: 'CORE ออกแบบตามแผนกและกระบวนการ จึงปรับใช้ได้กับหลายประเภทธุรกิจ',
    links: [
      {
        label: 'ตัวอย่างการใช้งาน',
        description: 'ผลิตตามคำสั่งซื้อ สินค้ามีวันหมดอายุ และจัดซื้อบ่อย',
        to: '/solutions',
        icon: BookOpen,
      },
      {
        label: 'ปรึกษาสำหรับธุรกิจของคุณ',
        description: 'คุยกับทีมเพื่อดูว่า CORE เหมาะหรือไม่',
        to: '/contact',
        icon: MessageSquare,
      },
    ],
    notes: {
      title: 'กลุ่มธุรกิจ · หน้าเฉพาะกำลังจัดทำ',
      items: [
        'การผลิต (Manufacturing)',
        'การจัดจำหน่าย (Distribution)',
        'ค้าปลีก (Retail)',
        'งานบริการ (Services)',
        'อสังหาริมทรัพย์ (Property)',
        'การดำเนินงานเฉพาะทาง',
      ],
    },
    cta: { label: 'ดูว่า CORE เหมาะกับองค์กรคุณหรือไม่', to: '/#fit' },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    summary: 'เริ่มจากกระบวนการที่ใช้วันนี้ และขยายไปพร้อมกับความซับซ้อนขององค์กร',
    links: [
      {
        label: 'ภาพรวมสำหรับองค์กร',
        description: 'โครงสร้างที่ขยายได้ตามการเติบโต',
        to: '/#enterprise',
        icon: Building2,
      },
      {
        label: 'Audit และการควบคุม',
        description: 'ทุกการเปลี่ยนแปลงย้อนดูได้',
        to: '/#error-control',
        icon: FileCheck2,
      },
      {
        label: 'Workflow ตามองค์กร',
        description: 'ลำดับขั้นและการอนุมัติของคุณเอง',
        to: '/#connected-flow',
        icon: GitBranch,
      },
      {
        label: 'การวางระบบและการดูแล',
        description: 'วางระบบร่วมกับทีมของคุณ',
        to: '/contact',
        icon: LifeBuoy,
      },
    ],
    notes: { title: 'ทิศทางสถาปัตยกรรม', items: ['Security', 'Scalability', 'API & Integration'] },
    cta: { label: 'คุยกับทีม Enterprise', to: '/contact' },
  },
  {
    id: 'resources',
    label: 'Resources',
    summary: 'ทำความเข้าใจ CORE ก่อนตัดสินใจ',
    links: [
      {
        label: 'CORE ทำงานอย่างไร',
        description: 'แนวคิดและเส้นทางงานข้ามแผนก',
        to: '/#why-core',
        icon: Compass,
      },
      {
        label: 'ตัวอย่างการใช้งาน',
        description: 'สถานการณ์จริงของธุรกิจหลายแผนก',
        to: '/solutions',
        icon: BookOpen,
      },
      { label: 'ฟีเจอร์', description: 'ความสามารถหลักของระบบ', to: '/features', icon: Sparkles },
    ],
    notes: { title: 'กำลังจัดทำ', items: ['Product Guide', 'FAQ', 'Updates'] },
    cta: { label: 'ขอคำปรึกษา', to: '/contact' },
  },
  {
    id: 'company',
    label: 'Company',
    summary: 'PDA BLISS COMPANY LIMITED — ผู้พัฒนา PDA BLISS CORE',
    links: [
      { label: 'รู้จัก PDA BLISS', description: 'บริษัทผู้พัฒนา CORE', to: '/about', icon: Info },
      {
        label: 'ทำไมเราสร้าง CORE',
        description: 'แนวคิดเบื้องหลังระบบ',
        to: '/#trust',
        icon: Hammer,
      },
      {
        label: 'บริการให้คำปรึกษา',
        description: 'วางกระบวนการก่อนวางระบบ',
        to: '/contact',
        icon: Handshake,
      },
      { label: 'ติดต่อเรา', description: 'คุยกับทีมงาน', to: '/contact', icon: MessageSquare },
    ],
    cta: { label: 'ติดต่อเรา', to: '/contact' },
  },
];
