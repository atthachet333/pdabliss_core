import type { Tone } from '@/components/app/primitives';
import type { WorkspaceId } from '../registry';

/* EP00 mock data — Executive Control Center. */

export interface DepartmentPulse {
  workspace: Exclude<WorkspaceId, 'executive' | 'admin'>;
  status: { tone: Tone; label: string };
  metrics: { label: string; value: string }[];
}

export const DEPARTMENT_PULSE: DepartmentPulse[] = [
  {
    workspace: 'sales',
    status: { tone: 'warning', label: 'ต้องติดตาม' },
    metrics: [
      { label: 'คำสั่งซื้อ', value: '128' },
      { label: 'ส่งแล้ว', value: '96' },
      { label: 'ค้างส่ง', value: '32' },
    ],
  },
  {
    workspace: 'operations',
    status: { tone: 'danger', label: 'มีงานล่าช้า' },
    metrics: [
      { label: 'งานใหม่', value: '6' },
      { label: 'กำลังทำ', value: '9' },
      { label: 'ล่าช้า', value: '2' },
    ],
  },
  {
    workspace: 'warehouse',
    status: { tone: 'warning', label: 'ต้องติดตาม' },
    metrics: [
      { label: 'สต็อกต่ำ', value: '5' },
      { label: 'ใกล้หมดอายุ', value: '4' },
      { label: 'หมดอายุ', value: '1' },
      { label: 'รอรับเข้า', value: '6' },
    ],
  },
  {
    workspace: 'purchasing',
    status: { tone: 'warning', label: 'ต้องติดตาม' },
    metrics: [
      { label: 'PR รออนุมัติ', value: '3' },
      { label: 'PO เปิดอยู่', value: '23' },
      { label: 'ส่งล่าช้า', value: '2' },
    ],
  },
  {
    workspace: 'accounting',
    status: { tone: 'success', label: 'ปกติ' },
    metrics: [
      { label: 'รอมัดจำ', value: '4' },
      { label: 'รอส่วนที่เหลือ', value: '7' },
      { label: 'ค้างจ่าย', value: '฿ 1.84 ล้าน' },
    ],
  },
];

/** Weekly order intake vs shipped (count of sales orders). */
export const ORDER_TREND = [
  { week: 'ส.ค. W1', orders: 24, shipped: 21 },
  { week: 'ส.ค. W2', orders: 28, shipped: 23 },
  { week: 'ส.ค. W3', orders: 26, shipped: 27 },
  { week: 'ส.ค. W4', orders: 31, shipped: 25 },
  { week: 'ก.ย. W1', orders: 29, shipped: 28 },
  { week: 'ก.ย. W2', orders: 35, shipped: 30 },
  { week: 'ก.ย. W3', orders: 33, shipped: 34 },
  { week: 'ต.ค. W1', orders: 38, shipped: 31 },
];

export interface ExceptionItem {
  id: string;
  title: string;
  detail: string;
  workspace: Exclude<WorkspaceId, 'executive' | 'admin'>;
  severity: 'critical' | 'high' | 'medium';
  age: string;
  owner: string;
}

export const EXCEPTIONS: ExceptionItem[] = [
  {
    id: 'EX-1',
    title: 'ใบสั่งขายเลยกำหนดส่ง',
    detail: 'SO-2410 · บจก. สยามโฮมเทค เลยกำหนด 2 วัน',
    workspace: 'sales',
    severity: 'critical',
    age: '2 วัน',
    owner: 'ฝ่ายขาย',
  },
  {
    id: 'EX-2',
    title: 'ซัพพลายเออร์ส่งล่าช้า',
    detail: 'PO-0918 · Chem Partner Asia ค้างส่ง 60%',
    workspace: 'purchasing',
    severity: 'high',
    age: '3 วัน',
    owner: 'จัดซื้อ',
  },
  {
    id: 'EX-3',
    title: 'ล็อตหมดอายุยังอยู่ในคลัง',
    detail: 'L2604-090 · กาวอุตสาหกรรม 77 จำนวน 12 แกลลอน',
    workspace: 'warehouse',
    severity: 'critical',
    age: '6 วัน',
    owner: 'คลังสินค้า',
  },
  {
    id: 'EX-4',
    title: 'ใบสั่งงานล่าช้า',
    detail: 'WO-1185 · ช้ากว่าแผน 1 วัน รอวัตถุดิบ',
    workspace: 'operations',
    severity: 'high',
    age: '1 วัน',
    owner: 'ปฏิบัติการ',
  },
  {
    id: 'EX-5',
    title: 'คำขอจ่ายเงินรอเอกสาร',
    detail: 'PAY-0334 · ยังไม่มีใบรับสินค้าและใบแจ้งหนี้',
    workspace: 'accounting',
    severity: 'medium',
    age: '2 วัน',
    owner: 'บัญชี',
  },
  {
    id: 'EX-6',
    title: 'รายการรออนุมัติเกินกำหนด',
    detail: 'PR-0412 · รออนุมัติจากผู้จัดการเกิน 48 ชม.',
    workspace: 'purchasing',
    severity: 'medium',
    age: '2 วัน',
    owner: 'ผู้บริหาร',
  },
];
