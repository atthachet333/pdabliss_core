/**
 * EP00 SAMPLE plan structure only. No commercial pricing has been decided —
 * prices must not be invented here. Every plan covers exactly one company workspace.
 */
export interface PlanDefinition {
  id: 'starter' | 'business' | 'professional' | 'enterprise';
  name: string;
  audience: string;
  highlight?: boolean;
  limits: { label: string; value: string }[];
}

export const PLAN_DIMENSIONS = [
  'ผู้ใช้งาน',
  'แผนกที่เปิดใช้',
  'คลังสินค้า',
  'การอนุมัติ',
  'ระบบอัตโนมัติ',
  'การวิเคราะห์',
  'API',
  'การสนับสนุน',
] as const;

export const PLANS: readonly PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'ทีมที่เริ่มเชื่อมงานระหว่าง 2–3 แผนก',
    limits: [
      { label: 'ผู้ใช้งาน', value: 'ทีมขนาดเล็ก' },
      { label: 'แผนกที่เปิดใช้', value: 'แผนกหลักที่เลือก' },
      { label: 'คลังสินค้า', value: '1 คลัง' },
      { label: 'การอนุมัติ', value: 'ขั้นเดียว' },
      { label: 'ระบบอัตโนมัติ', value: 'การแจ้งเตือนพื้นฐาน' },
      { label: 'การวิเคราะห์', value: 'รายงานประจำแผนก' },
      { label: 'API', value: '—' },
      { label: 'การสนับสนุน', value: 'อีเมล' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    audience: 'ธุรกิจที่ต้องการให้ทุกแผนกหลักทำงานบนระบบเดียว',
    highlight: true,
    limits: [
      { label: 'ผู้ใช้งาน', value: 'หลายทีม' },
      { label: 'แผนกที่เปิดใช้', value: 'ทุกแผนกหลัก' },
      { label: 'คลังสินค้า', value: 'หลายคลัง' },
      { label: 'การอนุมัติ', value: 'หลายขั้นตามวงเงิน' },
      { label: 'ระบบอัตโนมัติ', value: 'กฎแจ้งเตือนข้อยกเว้น' },
      { label: 'การวิเคราะห์', value: 'ภาพรวมผู้บริหาร' },
      { label: 'API', value: '—' },
      { label: 'การสนับสนุน', value: 'อีเมล + แชท' },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    audience: 'องค์กรที่ต้องการควบคุมเวิร์กโฟลว์และการวิเคราะห์เชิงลึก',
    limits: [
      { label: 'ผู้ใช้งาน', value: 'ทั้งองค์กร' },
      { label: 'แผนกที่เปิดใช้', value: 'ทุกแผนก' },
      { label: 'คลังสินค้า', value: 'หลายคลัง + ตำแหน่งจัดเก็บ' },
      { label: 'การอนุมัติ', value: 'ปรับแต่งเงื่อนไขได้' },
      { label: 'ระบบอัตโนมัติ', value: 'เวิร์กโฟลว์อัตโนมัติ' },
      { label: 'การวิเคราะห์', value: 'วิเคราะห์ข้ามแผนก' },
      { label: 'API', value: 'API มาตรฐาน' },
      { label: 'การสนับสนุน', value: 'ผู้ดูแลที่ได้รับมอบหมาย' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'องค์กรที่มีกระบวนการเฉพาะและต้องการเชื่อมต่อระบบภายนอก',
    limits: [
      { label: 'ผู้ใช้งาน', value: 'ตามข้อตกลง' },
      { label: 'แผนกที่เปิดใช้', value: 'ทุกแผนก + โมดูลเฉพาะ' },
      { label: 'คลังสินค้า', value: 'ตามความต้องการ' },
      { label: 'การอนุมัติ', value: 'ปรับแต่งเต็มรูปแบบ' },
      { label: 'ระบบอัตโนมัติ', value: 'ปรับแต่งเต็มรูปแบบ' },
      { label: 'การวิเคราะห์', value: 'ปรับแต่งรายงาน' },
      { label: 'API', value: 'API + การเชื่อมต่อเฉพาะ' },
      { label: 'การสนับสนุน', value: 'ตามข้อตกลงระดับบริการ' },
    ],
  },
];

export const PLAN_DISCLAIMER = 'โครงสร้างแพ็กเกจตัวอย่าง';
