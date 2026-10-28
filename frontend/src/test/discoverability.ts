import type { MegaGroupId } from '@/config/navigation';
import type { PUBLIC_ROUTES } from './publicRoutes';

/*
 * EP17: how a normal visitor reaches every public page without typing a URL
 * (entry paths updated for the EP18 four-menu header).
 * One row per public route (plus /login). discoverability.test.tsx checks
 * that each declared entry really exists — in the navigation config or as a
 * rendered link on the named page — and that the measured click depth from
 * the homepage is no deeper than declared. docs/PUBLIC_ROUTE_DISCOVERABILITY.md
 * is the readable version of this table.
 *
 * Depth counts page navigations from the homepage; opening a mega menu is not
 * a navigation, so a mega-menu item is depth 1.
 */

export type Entry =
  | { via: 'header'; label: string }
  | { via: 'mega'; group: MegaGroupId; label: string }
  | { via: 'footer'; label: string }
  | { via: 'page'; from: string; label: string };

export type Status = 'PASS' | 'NEEDS LINK' | 'INTENTIONALLY INDIRECT';

export interface Discovery {
  route: (typeof PUBLIC_ROUTES)[number] | '/login';
  purpose: string;
  primary: Entry;
  secondary?: Entry;
  depth: 0 | 1 | 2;
  status: Status;
}

const dept = (id: string, name: string): Discovery => ({
  route: `/departments/${id}` as Discovery['route'],
  purpose: `${name} department experience`,
  primary: { via: 'mega', group: 'product', label: `ผลิตภัณฑ์ → ดูตามแผนก → ${name}` },
  secondary: { via: 'page', from: '/departments', label: `แผนก overview → ${name}` },
  depth: 1,
  status: 'PASS',
});

const industry = (id: string, name: string): Discovery => ({
  route: `/industries/${id}` as Discovery['route'],
  purpose: `${name} industry page`,
  primary: { via: 'mega', group: 'solutions', label: `โซลูชัน → ตามประเภทธุรกิจ → ${name}` },
  secondary: { via: 'page', from: '/industries', label: `ประเภทธุรกิจ → ${name}` },
  depth: 1,
  status: 'PASS',
});

const guide = (slug: string, label: string): Discovery => ({
  route: `/resources/${slug}` as Discovery['route'],
  purpose: `Resource guide: ${label}`,
  primary: { via: 'mega', group: 'resources', label: `ความรู้ → ${label}` },
  secondary: { via: 'page', from: '/resources', label: `Resource Center library → ${label}` },
  depth: 1,
  status: 'PASS',
});

export const DISCOVERY: readonly Discovery[] = [
  {
    route: '/',
    purpose: 'Homepage — CORE Universe and the eleven-chapter story',
    primary: { via: 'header', label: 'Logo / ภาพรวม' },
    secondary: { via: 'footer', label: 'Footer logo' },
    depth: 0,
    status: 'PASS',
  },
  {
    route: '/features',
    purpose: 'Capability overview by department',
    primary: { via: 'page', from: '/', label: 'Homepage final chapter → สำรวจ CORE เพิ่มเติม' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/departments',
    purpose: 'Department philosophy and the six department worlds',
    primary: { via: 'mega', group: 'product', label: 'ผลิตภัณฑ์ → แผนก' },
    secondary: { via: 'footer', label: 'ผลิตภัณฑ์ → แผนก' },
    depth: 1,
    status: 'PASS',
  },
  dept('executive', 'ผู้บริหาร'),
  dept('sales', 'ฝ่ายขาย'),
  dept('operations', 'ปฏิบัติการ'),
  dept('warehouse', 'คลังสินค้า'),
  dept('purchasing', 'จัดซื้อ'),
  dept('accounting', 'บัญชีและการเงิน'),
  {
    route: '/solutions',
    purpose: 'Problem-first solutions (EP09)',
    primary: { via: 'mega', group: 'solutions', label: 'โซลูชัน → ปัญหาที่ CORE ช่วยจัดการ' },
    secondary: { via: 'footer', label: 'สำรวจ → โซลูชัน' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/how-core-works',
    purpose: 'One work item through the company (EP08)',
    primary: { via: 'mega', group: 'product', label: 'ผลิตภัณฑ์ → CORE ทำงานอย่างไร' },
    secondary: { via: 'footer', label: 'ผลิตภัณฑ์ → วิธีการทำงาน' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/enterprise',
    purpose: 'For organizations: control, readiness, implementation (EP10)',
    primary: { via: 'mega', group: 'solutions', label: 'โซลูชัน → สำหรับองค์กร' },
    secondary: { via: 'footer', label: 'สำรวจ → สำหรับองค์กร' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/industries',
    purpose: 'Industry overview (EP11)',
    primary: { via: 'mega', group: 'solutions', label: 'โซลูชัน → ประเภทธุรกิจ' },
    secondary: { via: 'footer', label: 'สำรวจ → ประเภทธุรกิจ' },
    depth: 1,
    status: 'PASS',
  },
  industry('distribution', 'กระจายสินค้า'),
  industry('services', 'บริการ'),
  industry('projects', 'โครงการ'),
  industry('retail', 'ค้าปลีก'),
  industry('property', 'อสังหาฯ'),
  industry('manufacturing', 'การผลิต'),
  {
    route: '/pricing',
    purpose: 'Packages and subscription (EP07)',
    primary: { via: 'mega', group: 'product', label: 'ผลิตภัณฑ์ → แพ็คเกจ' },
    secondary: { via: 'footer', label: 'ผลิตภัณฑ์ → แพ็คเกจ' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/about',
    purpose: 'PDA BLISS company and approach (EP12–13)',
    primary: { via: 'mega', group: 'about', label: 'เกี่ยวกับเรา → PDA BLISS' },
    secondary: { via: 'footer', label: 'สำรวจ → เกี่ยวกับเรา' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/why-core',
    purpose: 'Why CORE exists (EP12)',
    primary: { via: 'mega', group: 'about', label: 'เกี่ยวกับเรา → ทำไมเราถึงสร้าง CORE' },
    secondary: { via: 'page', from: '/about', label: 'About → ทำไมเราถึงสร้าง CORE' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/contact',
    purpose: 'Company contact: channels, location and map (EP13; contact-only since EP24.1.4.3)',
    primary: { via: 'header', label: 'ติดต่อเรา action (≥ 768 px; mobile menu below)' },
    secondary: { via: 'footer', label: 'ติดต่อเรา → ขอคำปรึกษา' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/consultation',
    purpose: 'Guided consultation inquiry (EP13 wizard; own route since EP24.1.4.3)',
    primary: { via: 'page', from: '/contact', label: 'Contact → เริ่มปรึกษาเรา' },
    secondary: { via: 'page', from: '/pricing', label: 'Pricing → ขอ Demo / ปรึกษา (?topic=)' },
    depth: 2,
    status: 'PASS',
  },
  {
    route: '/demo',
    purpose: 'Public interactive demo (EP14)',
    primary: {
      via: 'mega',
      group: 'product',
      label: 'ผลิตภัณฑ์ → ทดลองใช้งาน CORE (also featured)',
    },
    secondary: { via: 'footer', label: 'ผลิตภัณฑ์ → ทดลองใช้งาน CORE' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/security',
    purpose: 'Security & Trust Center (EP15)',
    primary: { via: 'mega', group: 'about', label: 'เกี่ยวกับเรา → Security & Trust' },
    secondary: {
      via: 'page',
      from: '/resources/security-and-data',
      label: 'Security & Data guide → Security & Trust Center',
    },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/resources',
    purpose: 'CORE knowledge library (EP16)',
    primary: { via: 'mega', group: 'resources', label: 'ความรู้ → เปิดคลังความรู้' },
    secondary: { via: 'footer', label: 'สำรวจ → คลังความรู้' },
    depth: 1,
    status: 'PASS',
  },
  guide('getting-started', 'เริ่มต้นกับ CORE'),
  guide('how-core-works', 'Workflow & Operations'),
  guide('human-error', 'Human Error'),
  guide('warehouse-privacy', 'Warehouse Privacy'),
  guide('implementation-guide', 'Implementation Guide'),
  guide('security-and-data', 'Security & Data'),
  guide('core-glossary', 'CORE Glossary'),
  {
    route: '/privacy',
    purpose: 'Privacy policy (placeholder until commercial launch)',
    primary: { via: 'footer', label: 'Legal row → นโยบายความเป็นส่วนตัว' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/terms',
    purpose: 'Terms of use (placeholder until commercial launch)',
    primary: { via: 'footer', label: 'Legal row → ข้อกำหนดการใช้งาน' },
    depth: 1,
    status: 'PASS',
  },
  {
    route: '/login',
    purpose: 'CORE Gateway prototype sign-in (noindex)',
    primary: {
      via: 'header',
      label: 'เข้าสู่ระบบ (labelled at every desktop width; mobile menu below 640 px)',
    },
    depth: 1,
    status: 'PASS',
  },
];
