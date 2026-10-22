/* Notification model + prototype samples (no backend notification logic). */

export type NotificationCategory = 'task' | 'approval' | 'alert' | 'system';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  time: string;
}

/**
 * Minimal sample notifications for UX review. Quantities and references only —
 * nothing monetary, so the panel is safe in every workspace (incl. Warehouse).
 */
export const SAMPLE_NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: 'n1',
    category: 'task',
    title: 'มีงานใหม่ที่มอบหมายให้คุณ',
    body: 'ตรวจสอบเอกสารตัวอย่าง และส่งต่อขั้นตอนถัดไป',
    time: '5 นาทีที่แล้ว',
  },
  {
    id: 'n2',
    category: 'approval',
    title: 'PR-ตัวอย่าง รอการอนุมัติ',
    body: 'ใบขอซื้อจากคลังสินค้า รอผู้มีสิทธิ์อนุมัติ',
    time: '1 ชั่วโมงที่แล้ว',
  },
  {
    id: 'n3',
    category: 'alert',
    title: 'LOT-A ใกล้หมดอายุ',
    body: 'เหลือ 18 วัน · จ่ายออกตามหลัก FEFO',
    time: 'วันนี้ 08:30',
  },
  {
    id: 'n4',
    category: 'system',
    title: 'ระบบแจ้งเตือนอยู่ในโหมดต้นแบบ',
    body: 'รายการทั้งหมดเป็นตัวอย่าง การแจ้งเตือนจริงจะเปิดใช้เมื่อเชื่อมข้อมูล',
    time: 'เมื่อวาน',
  },
];
