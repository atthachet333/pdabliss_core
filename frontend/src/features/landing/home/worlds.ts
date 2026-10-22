import type { DepartmentId } from '@/config/departments';

/** The six operational perspectives on the homepage (Reports is shared, not a world). */
export type WorldId = Extract<
  DepartmentId,
  'sales' | 'operations' | 'warehouse' | 'purchasing' | 'accounting' | 'executive'
>;

export interface World {
  id: WorldId;
  nameTh: string;
  nameEn: string;
  /** Visual mood of the environment. */
  mood: string;
  message: string;
  responsibilities: readonly string[];
  /** Restrained light tint for the environment (EP02 workspace accent token). */
  accent: string;
}

export const WORLDS: readonly World[] = [
  {
    id: 'sales',
    nameTh: 'ฝ่ายขาย',
    nameEn: 'Sales',
    mood: 'ความเคลื่อนไหว · ความต้องการของลูกค้า · เส้นทางส่งมอบ',
    message: 'ฝ่ายขายเห็นสิ่งที่ต้องทำต่อ โดยไม่ต้องไล่ถามสถานะจากทุกแผนก',
    responsibilities: [
      'Customer PO',
      'Sales Order',
      'ความพร้อมของสินค้า',
      'การส่งมอบ',
      'สถานะที่บอกลูกค้าได้',
    ],
    accent: 'var(--color-ws-sales)',
  },
  {
    id: 'operations',
    nameTh: 'ปฏิบัติการ',
    nameEn: 'Operations',
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
    accent: 'var(--color-ws-operations)',
  },
  {
    id: 'warehouse',
    nameTh: 'คลังสินค้า',
    nameEn: 'Warehouse',
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
    accent: 'var(--color-ws-warehouse)',
  },
  {
    id: 'purchasing',
    nameTh: 'จัดซื้อ',
    nameEn: 'Purchasing',
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
    accent: 'var(--color-ws-purchasing)',
  },
  {
    id: 'accounting',
    nameTh: 'บัญชีและการเงิน',
    nameEn: 'Accounting',
    mood: 'การตรวจสอบ · ลำดับการจ่าย · ความครบถ้วนของเอกสาร',
    message: 'การเงินจ่ายเมื่อเอกสารครบและได้รับอนุมัติ — ทุกการจ่ายย้อนกลับไปถึงต้นทางได้',
    responsibilities: ['คำขอจ่าย', 'มัดจำ', 'ยอดค้าง', 'เอกสารประกอบ', 'การจ่ายเงิน', 'เจ้าหนี้'],
    accent: 'var(--color-ws-accounting)',
  },
  {
    id: 'executive',
    nameTh: 'ผู้บริหาร',
    nameEn: 'Executive',
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
    accent: 'var(--color-ws-executive)',
  },
];
