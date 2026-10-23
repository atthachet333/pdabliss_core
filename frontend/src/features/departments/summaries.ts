import type { Localized } from '@/i18n/useCopy';
import type { DeptKey } from './catalog';

/** One-glance summary of each department, used by /departments (EP06). */
export interface DeptSummary {
  /** The department's primary idea (also the spirit of its page). */
  idea: string;
  /** Three “วันนี้” states. */
  today: readonly string[];
  takesIn: string;
  handsOn: string;
}

export const DEPT_SUMMARIES: Localized<Record<DeptKey, DeptSummary>> = {
  th: {
    executive: {
      idea: 'ไม่ต้องเปิดทุกแผนก เพื่อรู้ว่าองค์กรกำลังเกิดอะไรขึ้น',
      today: ['สิ่งที่ต้องจับตา', 'งานที่ติดขัด', 'รายการรอการตัดสินใจ'],
      takesIn: 'สัญญาณและข้อยกเว้นจากทุกแผนก',
      handsOn: 'การตัดสินใจ การอนุมัติ และลำดับความสำคัญ',
    },
    sales: {
      idea: 'ฝ่ายขายควรรู้ว่าออเดอร์อยู่ตรงไหน โดยไม่ต้องไล่ถามทุกแผนก',
      today: ['ออเดอร์ใหม่', 'ใกล้กำหนดส่ง', 'ติด Stock'],
      takesIn: 'Customer PO และความต้องการของลูกค้า',
      handsOn: 'Sales Order และความต้องการสินค้าให้ทีมถัดไป',
    },
    operations: {
      idea: 'เห็นงานที่ต้องทำ ลำดับความสำคัญ ความคืบหน้า และจุดที่ติดขัด',
      today: ['งานใหม่', 'กำลังทำ', 'ล่าช้า'],
      takesIn: 'คำสั่งงานจากฝ่ายขายและความต้องการภายใน',
      handsOn: 'งานที่เสร็จและพร้อมส่งต่อ',
    },
    warehouse: {
      idea: 'คลังเห็นสิ่งที่ต้องใช้ในการทำงาน โดยไม่เห็นข้อมูลที่ไม่เกี่ยวข้องกับหน้าที่',
      today: ['รอรับสินค้า', 'ใกล้หมดอายุ', 'ต้องตรวจนับ'],
      takesIn: 'PO รอรับ และคำขอเบิกสินค้า',
      handsOn: 'ใบรับสินค้า สินค้าพร้อมส่ง และการเคลื่อนไหวสต็อก',
    },
    purchasing: {
      idea: 'จัดซื้อไม่ได้จบที่ออก PO แต่ต้องรู้ว่ารับแล้วเท่าไร และอะไรยังค้าง',
      today: ['PR รอดำเนินการ', 'PO ค้างรับ', 'Supplier ล่าช้า'],
      takesIn: 'ใบขอซื้อและความต้องการจากหน้างาน',
      handsOn: 'PO ถึง Supplier และคำขอจ่ายเงิน',
    },
    accounting: {
      idea: 'บัญชีเห็นว่าต้องจ่ายอะไร เพราะอะไร และเอกสารครบหรือยัง',
      today: ['รอจ่าย', 'เอกสารไม่ครบ', 'ใกล้กำหนด'],
      takesIn: 'คำขอจ่ายพร้อมเอกสารต้นทาง',
      handsOn: 'การจ่ายเงินที่ตรวจสอบได้ และสถานะที่อัปเดตกลับ',
    },
  },
  en: {
    executive: {
      idea: 'Know what is happening across the organization without opening every department.',
      today: ['Things to watch', 'Work that is stuck', 'Decisions waiting'],
      takesIn: 'Signals and exceptions from every department',
      handsOn: 'Decisions, approvals and priorities',
    },
    sales: {
      idea: 'Sales should know where every order is — without chasing every department.',
      today: ['New orders', 'Due soon', 'Waiting for stock'],
      takesIn: 'Customer POs and customer demand',
      handsOn: 'Sales orders and demand for the next team',
    },
    operations: {
      idea: 'See the work, its priority, its progress and where it is stuck.',
      today: ['New work', 'In progress', 'Delayed'],
      takesIn: 'Requests from Sales and internal demand',
      handsOn: 'Finished work, ready to hand on',
    },
    warehouse: {
      idea: 'The warehouse sees what it needs to work — and nothing unrelated to its job.',
      today: ['Awaiting receipt', 'Near expiry', 'Count due'],
      takesIn: 'POs awaiting receipt and pick requests',
      handsOn: 'Goods receipts, goods ready to ship and stock movements',
    },
    purchasing: {
      idea: 'Purchasing doesn’t end at the PO — it knows what has arrived and what is still outstanding.',
      today: ['PRs to process', 'POs awaiting receipt', 'Late suppliers'],
      takesIn: 'Purchase requests and operational demand',
      handsOn: 'POs to suppliers and payment requests',
    },
    accounting: {
      idea: 'Finance sees what to pay, why, and whether the documents are complete.',
      today: ['To pay', 'Incomplete documents', 'Due soon'],
      takesIn: 'Payment requests with their source documents',
      handsOn: 'Verifiable payments and status sent back',
    },
  },
  'zh-CN': {
    executive: {
      idea: '无需打开每个部门，也能知道组织正在发生什么。',
      today: ['需要关注的事项', '受阻的工作', '待决策事项'],
      takesIn: '来自各部门的信号与例外',
      handsOn: '决策、审批与优先级',
    },
    sales: {
      idea: '销售部应该知道每张订单在哪里——无需逐个部门追问。',
      today: ['新订单', '即将到期', '等待库存'],
      takesIn: '客户采购单与客户需求',
      handsOn: '销售订单及交给下一个团队的需求',
    },
    operations: {
      idea: '看清要做的工作、优先级、进度以及受阻的环节。',
      today: ['新工作', '进行中', '延迟'],
      takesIn: '来自销售部的请求与内部需求',
      handsOn: '已完成、可交接的工作',
    },
    warehouse: {
      idea: '仓库看得到工作所需的信息——而看不到与岗位无关的数据。',
      today: ['待收货', '临期', '待盘点'],
      takesIn: '待收货的采购单与领料请求',
      handsOn: '收货单、待发货商品与库存移动',
    },
    purchasing: {
      idea: '采购并不止于下达采购单——还要知道收到了多少、还有什么未到。',
      today: ['待处理请购', '待收货采购单', '延迟的供应商'],
      takesIn: '请购单与现场需求',
      handsOn: '发给供应商的采购单与付款申请',
    },
    accounting: {
      idea: '财务清楚要付什么、为什么付，以及单据是否齐全。',
      today: ['待付款', '单据不全', '即将到期'],
      takesIn: '附有源单据的付款申请',
      handsOn: '可核查的付款及回传的状态',
    },
  },
};
