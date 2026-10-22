/*
 * CORE status vocabulary (UI language only). Business documents will map their
 * own states onto these ten statuses later; colour comes from the family, so
 * no document ever invents a new status colour.
 */

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type Status =
  | 'draft'
  | 'pending'
  | 'processing'
  | 'partial'
  | 'completed'
  | 'closed'
  | 'rejected'
  | 'cancelled'
  | 'warning'
  | 'overdue';

export const STATUS_META: Record<Status, { label: string; tone: StatusTone; meaning: string }> = {
  draft: { label: 'ร่าง', tone: 'neutral', meaning: 'ยังไม่ส่งเข้าขั้นตอน' },
  pending: { label: 'รอดำเนินการ', tone: 'warning', meaning: 'รอคนถัดไปลงมือหรืออนุมัติ' },
  processing: { label: 'กำลังดำเนินการ', tone: 'info', meaning: 'อยู่ระหว่างทำงาน' },
  partial: { label: 'บางส่วน', tone: 'info', meaning: 'เสร็จไม่ครบจำนวน' },
  completed: { label: 'เสร็จสิ้น', tone: 'success', meaning: 'ครบถ้วนตามที่กำหนด' },
  closed: { label: 'ปิดแล้ว', tone: 'neutral', meaning: 'ปิดเอกสาร ไม่มีการเปลี่ยนแปลงอีก' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger', meaning: 'ถูกปฏิเสธพร้อมเหตุผล' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral', meaning: 'ยกเลิกก่อนเสร็จ' },
  warning: { label: 'ต้องติดตาม', tone: 'warning', meaning: 'มีความเสี่ยง ควรตรวจสอบ' },
  overdue: { label: 'เลยกำหนด', tone: 'danger', meaning: 'เลยวันที่กำหนดแล้ว' },
};

export const STATUS_ORDER = Object.keys(STATUS_META) as Status[];
