import {
  BadgeCheck,
  Bell,
  FileStack,
  History,
  KeyRound,
  ListChecks,
  TriangleAlert,
  Workflow,
} from 'lucide-react';

/** Human-error prevention capabilities CORE is architected around. */
export const SAFEGUARDS = [
  {
    icon: Workflow,
    title: 'ขั้นตอนควบคุมด้วยเวิร์กโฟลว์',
    body: 'เอกสารเปลี่ยนสถานะได้เฉพาะเส้นทางที่กำหนด ข้ามขั้นตอนไม่ได้',
  },
  {
    icon: BadgeCheck,
    title: 'การอนุมัติ',
    body: 'อนุมัติตามบทบาทและวงเงิน ผู้ขอไม่สามารถอนุมัติรายการของตัวเอง',
  },
  {
    icon: ListChecks,
    title: 'ตรวจสอบความถูกต้อง',
    body: 'ตรวจข้อมูลทั้งหน้าจอและเซิร์ฟเวอร์ เช่น รับสินค้าเกินจำนวนที่สั่งไม่ได้',
  },
  {
    icon: History,
    title: 'Audit trail',
    body: 'ทุกการกระทำสำคัญบันทึกผู้ทำ เวลา และค่าก่อน–หลังการเปลี่ยนแปลง',
  },
  { icon: Bell, title: 'การแจ้งเตือน', body: 'แจ้งผู้ที่ต้องทำงานต่อทันทีเมื่องานมาถึงขั้นของเขา' },
  {
    icon: TriangleAlert,
    title: 'แจ้งเตือนข้อยกเว้น',
    body: 'สต็อกต่ำ ใกล้ครบกำหนดส่ง ล็อตใกล้หมดอายุ ถูกยกขึ้นมาก่อนเป็นปัญหา',
  },
  {
    icon: FileStack,
    title: 'เชื่อมโยงเอกสาร',
    body: 'PO → GR → ใบแจ้งหนี้ → การจ่ายเงิน ตรวจย้อนกลับได้ทุกใบ',
  },
  {
    icon: KeyRound,
    title: 'บังคับใช้สิทธิ์ที่เซิร์ฟเวอร์',
    body: 'ข้อมูลที่ไม่มีสิทธิ์เห็นจะไม่ถูกส่งออกจากเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนบนหน้าจอ',
  },
] as const;
