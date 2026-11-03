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
  Route,
  Settings,
  Settings2,
  ShoppingCart,
  Stamp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceId } from './registry';

/*
 * The identity of each EP01 prototype workspace that the public world previews
 * draw (accent, icon, short Thai name, the first seven sidebar entries). EP33:
 * split from `registry.ts` so the public pages do not ship the prototype's full
 * navigation copy; `identity.test.ts` keeps both in step.
 */

export interface WorkspaceIdentity {
  accent: string;
  icon: LucideIcon;
  shortTh: string;
  nav: readonly { path: string; label: string; icon: LucideIcon }[];
}

export const WORKSPACE_IDENTITY: Record<WorkspaceId, WorkspaceIdentity> = {
  executive: {
    accent: 'var(--color-ws-executive)',
    icon: Crown,
    shortTh: 'ผู้บริหาร',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'departments', label: 'แผนก', icon: Layers },
      { path: 'exceptions', label: 'Exception', icon: TriangleAlert },
      { path: 'approvals', label: 'การอนุมัติ', icon: Stamp },
      { path: 'reports', label: 'รายงาน', icon: BarChart3 },
    ],
  },
  sales: {
    accent: 'var(--color-ws-sales)',
    icon: ShoppingCart,
    shortTh: 'ฝ่ายขาย',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'customer-po', label: 'Customer PO', icon: FileInput },
      { path: 'sales-orders', label: 'Sales Order', icon: ClipboardList },
      { path: 'delivery', label: 'การส่งมอบ', icon: Truck },
      { path: 'customers', label: 'ลูกค้า', icon: Users },
      { path: 'reports', label: 'รายงาน', icon: BarChart3 },
    ],
  },
  warehouse: {
    accent: 'var(--color-ws-warehouse)',
    icon: Warehouse,
    shortTh: 'คลังสินค้า',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'receiving', label: 'รับสินค้า', icon: PackageCheck },
      { path: 'stock', label: 'สต็อกสินค้า', icon: Boxes },
      { path: 'lots', label: 'Lot / Batch', icon: Layers },
      { path: 'expiry', label: 'วันหมดอายุ', icon: Hourglass },
      { path: 'movements', label: 'การเคลื่อนไหว', icon: ArrowLeftRight },
      { path: 'stock-count', label: 'ตรวจนับ', icon: ListChecks },
    ],
  },
  purchasing: {
    accent: 'var(--color-ws-purchasing)',
    icon: PackageSearch,
    shortTh: 'จัดซื้อ',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'purchase-requests', label: 'ใบขอซื้อ', icon: FileText },
      { path: 'purchase-orders', label: 'ใบสั่งซื้อ', icon: ClipboardList },
      { path: 'suppliers', label: 'Supplier', icon: Building2 },
      { path: 'receiving-follow-up', label: 'ติดตามการรับ', icon: CalendarClock },
      { path: 'reports', label: 'รายงาน', icon: BarChart3 },
    ],
  },
  operations: {
    accent: 'var(--color-ws-operations)',
    icon: Factory,
    shortTh: 'ปฏิบัติการ',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'work-orders', label: 'Work Order', icon: ClipboardList },
      { path: 'plan', label: 'แผนงาน', icon: CalendarClock },
      { path: 'progress', label: 'ความคืบหน้า', icon: Route },
      { path: 'completed', label: 'งานเสร็จ', icon: CircleCheckBig },
      { path: 'reports', label: 'รายงาน', icon: BarChart3 },
    ],
  },
  accounting: {
    accent: 'var(--color-ws-accounting)',
    icon: Calculator,
    shortTh: 'บัญชี',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'payment-requests', label: 'คำขอจ่าย', icon: Receipt },
      { path: 'payments', label: 'การจ่ายเงิน', icon: Wallet },
      { path: 'outstanding', label: 'ยอดค้าง', icon: FileStack },
      { path: 'documents', label: 'เอกสาร', icon: FileCheck2 },
      { path: 'reports', label: 'รายงาน', icon: BarChart3 },
    ],
  },
  admin: {
    accent: 'var(--color-ws-admin)',
    icon: Settings,
    shortTh: 'ผู้ดูแลระบบ',
    nav: [
      { path: '', label: 'ภาพรวม', icon: LayoutDashboard },
      { path: 'users', label: 'ผู้ใช้งาน', icon: Users },
      { path: 'departments', label: 'แผนก', icon: Building2 },
      { path: 'roles', label: 'บทบาท', icon: KeyRound },
      { path: 'workflow', label: 'Workflow', icon: GitBranch },
      { path: 'settings', label: 'การตั้งค่า', icon: Settings2 },
    ],
  },
};
