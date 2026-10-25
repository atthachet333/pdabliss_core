import {
  BadgeCheck,
  Bell,
  FileStack,
  History,
  KeyRound,
  ListChecks,
  TriangleAlert,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useCopy, type Localized } from '@/i18n/useCopy';

/** Human-error prevention capabilities CORE is architected around. */
const ICONS: readonly LucideIcon[] = [
  Workflow,
  BadgeCheck,
  ListChecks,
  History,
  Bell,
  TriangleAlert,
  FileStack,
  KeyRound,
];

type Safeguard = { title: string; body: string };

const TEXT: Localized<Safeguard[]> = {
  th: [
    {
      title: 'ขั้นตอนควบคุมด้วยเวิร์กโฟลว์',
      body: 'เอกสารเปลี่ยนสถานะได้เฉพาะเส้นทางที่กำหนด ข้ามขั้นตอนไม่ได้',
    },
    { title: 'การอนุมัติ', body: 'อนุมัติตามบทบาทและวงเงิน ผู้ขอไม่สามารถอนุมัติรายการของตัวเอง' },
    {
      title: 'ตรวจสอบความถูกต้อง',
      body: 'ตรวจข้อมูลทั้งหน้าจอและเซิร์ฟเวอร์ เช่น รับสินค้าเกินจำนวนที่สั่งไม่ได้',
    },
    {
      title: 'Audit trail',
      body: 'ทุกการกระทำสำคัญบันทึกผู้ทำ เวลา และค่าก่อน–หลังการเปลี่ยนแปลง',
    },
    { title: 'การแจ้งเตือน', body: 'แจ้งผู้ที่ต้องทำงานต่อทันทีเมื่องานมาถึงขั้นของเขา' },
    {
      title: 'แจ้งเตือนข้อยกเว้น',
      body: 'สต็อกต่ำ ใกล้ครบกำหนดส่ง ล็อตใกล้หมดอายุ ถูกยกขึ้นมาก่อนเป็นปัญหา',
    },
    { title: 'เชื่อมโยงเอกสาร', body: 'PO → GR → ใบแจ้งหนี้ → การจ่ายเงิน ตรวจย้อนกลับได้ทุกใบ' },
    {
      title: 'บังคับใช้สิทธิ์ที่เซิร์ฟเวอร์',
      body: 'ข้อมูลที่ไม่มีสิทธิ์เห็นจะไม่ถูกส่งออกจากเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนบนหน้าจอ',
    },
  ],
  en: [
    {
      title: 'Workflow-controlled steps',
      body: 'Documents change status only along defined paths — steps cannot be skipped.',
    },
    {
      title: 'Approvals',
      body: 'Approval by role and amount; requesters cannot approve their own items.',
    },
    {
      title: 'Validation',
      body: 'Data is checked on screen and on the server — for example, receiving more than ordered is blocked.',
    },
    {
      title: 'Audit trail',
      body: 'Every important action records who, when, and the values before and after.',
    },
    { title: 'Notifications', body: 'The next person is told as soon as work reaches their step.' },
    {
      title: 'Exception alerts',
      body: 'Low stock, approaching due dates and lots near expiry are raised before they become problems.',
    },
    {
      title: 'Linked documents',
      body: 'PO → GR → invoice → payment, every document traceable back.',
    },
    {
      title: 'Server-enforced permissions',
      body: 'Data a person may not see never leaves the server — it is not just hidden on screen.',
    },
  ],
  'zh-CN': [
    { title: '工作流管控的步骤', body: '单据只能按设定路径变更状态，无法跳过步骤。' },
    { title: '审批', body: '按角色与金额审批，申请人不能审批自己的事项。' },
    { title: '数据校验', body: '在界面与服务器两端校验数据，例如收货数量不能超过订购数量。' },
    { title: '审计记录', body: '每项重要操作都记录操作人、时间以及变更前后的值。' },
    { title: '通知', body: '工作一到达某人的环节，就立即通知下一位负责人。' },
    { title: '异常提醒', body: '低库存、临近交期、临期批次会在成为问题之前被提出。' },
    { title: '单据关联', body: '采购单 → 收货单 → 发票 → 付款，每一份都可追溯。' },
    { title: '服务器端权限控制', body: '无权查看的数据不会从服务器发出，而不只是在界面上隐藏。' },
  ],
};

export function useSafeguards() {
  const text = useCopy(TEXT);
  return ICONS.map((icon, i) => ({ icon, ...text[i]! }));
}
