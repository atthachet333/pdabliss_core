import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

type Check = 'stock' | 'replenish' | 'transfer' | 'count' | 'expiry';

interface Signature {
  eyebrow: string;
  title: string;
  lead: string;
  dc: string;
  branches: Record<'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6', string>;
  checks: Record<Check, string>;
  health: Record<'ok' | 'attention' | 'blocked', string>;
  actions: Record<Check, string>;
  choose: string;
  allGood: string;
  loop: string;
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'ธุรกิจค้าปลีก — งานปฏิบัติการของทุกสาขาในภาพเดียว',
    description:
      'CORE สำหรับงานปฏิบัติการค้าปลีกหลายสาขา: สต็อกตามตำแหน่ง การเติมของ การโอนย้าย การนับสต็อก วันหมดอายุ และกรณียกเว้นของแต่ละสาขา — CORE ไม่ใช่ระบบ POS',
  },
  hero: {
    eyebrow: 'Retail operations',
    title: 'หลายสาขา\nหนึ่งภาพของงานปฏิบัติการ',
    lead: 'หน้าร้านมีระบบขายของตัวเองอยู่แล้ว — สิ่งที่มักขาดคืองานหลังร้าน: ของพอไหม ต้องเติมอะไร โอนจากไหน และสาขาไหนกำลังมีปัญหา',
    visual: 'เครือข่ายสาขารอบคลังกลาง แต่ละสาขามีสถานะของตัวเอง บางสาขาต้องดู และหนึ่งสาขาติดขัด',
  },
  reality: {
    title: 'อะไรทำให้งานค้าปลีกต่างจากธุรกิจอื่น',
    lead: 'สินค้าชิ้นเดียวกันอยู่หลายที่พร้อมกัน และแต่ละสาขามีความต้องการของตัวเอง',
    points: [
      { title: 'สต็อกกระจายตามสาขา', body: 'จำนวนรวมไม่ช่วยอะไร ถ้าของอยู่ผิดสาขา' },
      { title: 'การเติมของเป็นรอบ', body: 'ขอเติม โอนหรือซื้อ รับของ แล้วนับ วนซ้ำทุกสัปดาห์' },
      {
        title: 'แต่ละสาขามีเจ้าของ',
        body: 'ผู้จัดการสาขารับผิดชอบสาขาตัวเอง ผู้บริหารต้องเห็นทุกสาขา',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'สาขาของขาด แต่ไม่รู้ว่าคลังกลางหรือสาขาใกล้ ๆ มีของ',
      'โอนย้ายแล้ว แต่สาขาปลายทางยังไม่ยืนยันรับ',
      'ยอดนับไม่ตรงกับในระบบ และไม่รู้ว่าต่างเพราะอะไร',
      'ของใกล้หมดอายุค้างอยู่บางสาขา',
      'คำขอเติมของจากหลายสาขาส่งมาคนละรูปแบบ',
      'ผู้บริหารรู้ว่าสาขามีปัญหาเมื่อสายเกินไป',
    ],
  },
  departments: {
    title: 'แผนกที่ทำให้ทุกสาขามีของพร้อม',
    roles: {
      operations: 'ทีมสาขาขอเติมของ รับของ นับสต็อก และรายงานกรณียกเว้น',
      warehouse: 'คลังกลางจัดของ โอนย้าย และดูวันหมดอายุ',
      purchasing: 'เติมของเข้าคลังกลางตามความต้องการรวมของสาขา',
      executive: 'เห็นสุขภาพของทุกสาขาและสาขาที่ต้องช่วย',
    },
  },
  workflow: {
    title: 'รอบการเติมของของสาขา',
    notes: {
      branchDemand: 'สาขาส่งคำขอในรูปแบบเดียวกัน',
      inventory: 'ดูว่าคลังกลางหรือสาขาไหนมีของ',
      replenish: 'ซื้อเพิ่มเมื่อทั้งเครือข่ายมีไม่พอ',
      transfer: 'โอนจากที่ที่มีของ',
      receipt: 'สาขาปลายทางยืนยันรับ',
      exception: 'ของขาด ส่งผิด หรือนับไม่ตรง',
      visibility: 'ผู้บริหารเห็นทุกสาขาในหน้าเดียว',
    },
  },
  information: {
    title: 'ข้อมูลที่ต้องเห็นตรงกันทุกสาขา',
    items: [
      { label: 'สต็อกตามสาขาและตำแหน่ง', why: 'รู้ว่าของอยู่ที่ไหนจริง' },
      { label: 'คำขอเติมของ', why: 'สาขาไหนขออะไร สถานะถึงไหน' },
      { label: 'การโอนระหว่างทาง', why: 'ส่งแล้วแต่ยังไม่ถึง' },
      { label: 'ผลการนับ', why: 'ความต่างที่ต้องหาสาเหตุ' },
      { label: 'วันหมดอายุ', why: 'ของที่ต้องย้ายหรือจัดการก่อน' },
    ],
  },
  signals: {
    title: 'สิ่งที่ผู้ดูแลหลายสาขาต้องเห็น',
    notes: {
      branchException: 'สาขาที่มีเรื่องต้องจัดการ',
      stockIssue: 'สินค้าที่สาขาไม่พอขาย',
      transferPending: 'ของที่โอนแล้วแต่ยังไม่ถูกรับ',
      expiryRisk: 'ของใกล้หมดอายุในแต่ละสาขา',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานค้าปลีก',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานหลายสาขา หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: ['ระบบสมาชิกและโปรแกรมสะสมแต้ม', 'ระบบจัดการโปรโมชันและราคาหน้าร้าน'],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'โครงสร้างสาขา คลังกลาง และตำแหน่งจัดเก็บ',
      'กติกาการโอนย้ายและการอนุมัติ',
      'การรับข้อมูลยอดขายจากระบบ POS ที่ใช้อยู่',
    ],
  },
  signature: {
    eyebrow: 'Branch health',
    title: 'ทุกสาขา ห้าเรื่องที่ต้องดู',
    lead: 'ไม่ใช่ยอดขาย แต่เป็นสุขภาพของงานปฏิบัติการ — เลือกสาขาเพื่อดูว่าต้องทำอะไรต่อ',
    dc: 'คลังกลาง',
    branches: {
      b1: 'สาขาสยาม',
      b2: 'สาขาบางนา',
      b3: 'สาขารังสิต',
      b4: 'สาขาพระราม 2',
      b5: 'สาขาชลบุรี',
      b6: 'สาขาเชียงใหม่',
    },
    checks: {
      stock: 'สต็อก',
      replenish: 'เติมของ',
      transfer: 'โอนย้าย',
      count: 'การนับ',
      expiry: 'วันหมดอายุ',
    },
    health: { ok: 'ปกติ', attention: 'ต้องดู', blocked: 'ติดขัด' },
    actions: {
      stock: 'สินค้าบางรายการไม่พอขาย — โอนจากสาขาใกล้เคียงหรือขอเติม',
      replenish: 'คำขอเติมของรอจัดซื้อ',
      transfer: 'ของที่โอนมายังไม่ถูกยืนยันรับ',
      count: 'ยอดนับต่างจากในระบบ — รอตรวจสอบ',
      expiry: 'มีของใกล้หมดอายุ — วางแผนย้ายหรือจัดการ',
    },
    choose: 'เลือกสาขา',
    allGood: 'ทุกเรื่องปกติ — ไม่มีอะไรต้องทำ',
    loop: 'รอบการเติมของ',
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Retail operations — every branch’s operations in one picture',
    description:
      'CORE for multi-branch retail operations: stock by location, replenishment, transfers, counts, expiry and each branch’s exceptions. CORE is not a POS.',
  },
  hero: {
    eyebrow: 'Retail operations',
    title: 'Many branches,\none picture of operations',
    lead: 'Stores already have a system for selling. What’s usually missing is the work behind the counter: is there enough, what needs topping up, where to transfer from, and which branch is in trouble.',
    visual:
      'A branch network around a DC; each branch has its own state, some need attention and one is blocked',
  },
  reality: {
    title: 'What makes retail operations different',
    lead: 'The same item sits in many places at once, and every branch has its own demand.',
    points: [
      {
        title: 'Stock is spread across branches',
        body: 'A total doesn’t help if the goods are in the wrong branch.',
      },
      {
        title: 'Replenishment is a cycle',
        body: 'Request, transfer or buy, receive, count — every week.',
      },
      {
        title: 'Every branch has an owner',
        body: 'Branch managers own their branch; executives need all of them.',
      },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'A branch runs out without knowing whether the DC or a nearby branch has stock.',
      'A transfer is sent, but the receiving branch hasn’t confirmed it.',
      'Counts don’t match the system and nobody knows why.',
      'Near-expiry stock sits in some branches.',
      'Replenishment requests arrive from branches in different formats.',
      'Executives learn a branch is in trouble too late.',
    ],
  },
  departments: {
    title: 'Departments that keep every branch stocked',
    roles: {
      operations: 'Branch teams request stock, receive, count and report exceptions.',
      warehouse: 'The DC picks, transfers and watches expiry.',
      purchasing: 'Replenishes the DC from combined branch demand.',
      executive: 'Sees every branch’s health and where help is needed.',
    },
  },
  workflow: {
    title: 'A branch replenishment cycle',
    notes: {
      branchDemand: 'Branches send requests in one format.',
      inventory: 'See whether the DC or another branch has it.',
      replenish: 'Buy more when the network is short.',
      transfer: 'Transfer from where the stock is.',
      receipt: 'The receiving branch confirms.',
      exception: 'Short, wrong item or count mismatch.',
      visibility: 'Executives see every branch on one page.',
    },
  },
  information: {
    title: 'Information every branch must see the same way',
    items: [
      { label: 'Stock by branch and location', why: 'Know where goods really are.' },
      { label: 'Replenishment requests', why: 'Who asked for what, and where it stands.' },
      { label: 'Transfers in transit', why: 'Sent but not yet arrived.' },
      { label: 'Count results', why: 'Differences that need a cause.' },
      { label: 'Expiry dates', why: 'Stock to move or deal with first.' },
    ],
  },
  signals: {
    title: 'What a multi-branch manager needs to see',
    notes: {
      branchException: 'Branches with something to resolve.',
      stockIssue: 'Items a branch can’t keep in stock.',
      transferPending: 'Transfers sent but not received.',
      expiryRisk: 'Near-expiry stock by branch.',
    },
  },
  fit: {
    title: 'Where CORE fits in retail operations',
    lead: 'The same principles as every business — this is how they look across branches.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: ['Membership and loyalty programmes', 'Promotion and shelf-price management'],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'Branch, DC and storage-location structure',
      'Transfer and approval rules',
      'Taking sales data from the POS you already use',
    ],
  },
  signature: {
    eyebrow: 'Branch health',
    title: 'Every branch, five things to watch',
    lead: 'Not sales — the health of operations. Choose a branch to see what to do next.',
    dc: 'DC',
    branches: {
      b1: 'Siam',
      b2: 'Bang Na',
      b3: 'Rangsit',
      b4: 'Rama 2',
      b5: 'Chonburi',
      b6: 'Chiang Mai',
    },
    checks: {
      stock: 'Stock',
      replenish: 'Replenish',
      transfer: 'Transfers',
      count: 'Counts',
      expiry: 'Expiry',
    },
    health: { ok: 'OK', attention: 'Attention', blocked: 'Blocked' },
    actions: {
      stock: 'Some items can’t be kept in stock — transfer from a nearby branch or request more',
      replenish: 'A replenishment request is waiting for purchasing',
      transfer: 'An incoming transfer hasn’t been confirmed',
      count: 'Count differs from the system — under review',
      expiry: 'Near-expiry stock — plan a move or action',
    },
    choose: 'Choose a branch',
    allGood: 'Everything is OK — nothing to do',
    loop: 'Replenishment cycle',
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '零售运营——所有分店的运营一目了然',
    description:
      '面向多分店零售运营的 CORE：按位置的库存、补货、调拨、盘点、效期以及各分店的异常情况。CORE 不是 POS 系统。',
  },
  hero: {
    eyebrow: 'Retail operations',
    title: '多家分店\n一幅运营全景',
    lead: '门店已经有自己的收银系统——通常缺少的是后台工作：货够不够、要补什么、从哪里调拨、哪家分店出了问题。',
    visual: '配送中心周围的分店网络，每家分店都有自己的状态，部分需关注，一家受阻',
  },
  reality: {
    title: '零售运营有何不同',
    lead: '同一商品同时分布在多个地方，每家分店都有自己的需求。',
    points: [
      { title: '库存分散在各分店', body: '货在错误的分店时，总数没有意义。' },
      { title: '补货是一个循环', body: '申请、调拨或采购、收货、盘点——每周重复。' },
      { title: '每家分店都有负责人', body: '店长负责本店，管理层需要看到所有分店。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '分店缺货，却不知道配送中心或附近分店是否有货。',
      '已经调拨，目的分店却尚未确认收货。',
      '盘点数与系统不符，也不知道原因。',
      '临期商品积压在部分分店。',
      '各分店的补货申请格式各不相同。',
      '管理层发现分店出问题时已经太晚。',
    ],
  },
  departments: {
    title: '让每家分店有货的部门',
    roles: {
      operations: '分店团队申请补货、收货、盘点并上报异常。',
      warehouse: '配送中心拣货、调拨并关注效期。',
      purchasing: '根据各分店的汇总需求为配送中心补货。',
      executive: '看到所有分店的健康状况以及需要支援的地方。',
    },
  },
  workflow: {
    title: '分店补货循环',
    notes: {
      branchDemand: '分店以统一格式提交申请。',
      inventory: '查看配送中心或其他分店是否有货。',
      replenish: '整个网络都不足时再采购。',
      transfer: '从有货的地方调拨。',
      receipt: '目的分店确认收货。',
      exception: '缺货、错发或盘点不符。',
      visibility: '管理层在一页中看到所有分店。',
    },
  },
  information: {
    title: '所有分店必须一致看到的信息',
    items: [
      { label: '按分店与位置的库存', why: '知道货真正在哪里。' },
      { label: '补货申请', why: '哪家申请了什么，进展到哪里。' },
      { label: '在途调拨', why: '已发出但尚未到达。' },
      { label: '盘点结果', why: '需要查明原因的差异。' },
      { label: '效期', why: '需要优先调走或处理的货。' },
    ],
  },
  signals: {
    title: '多分店管理者需要看到的',
    notes: {
      branchException: '有事项需要处理的分店。',
      stockIssue: '分店无法保持库存的商品。',
      transferPending: '已调拨但未签收的货。',
      expiryRisk: '各分店的临期商品。',
    },
  },
  fit: {
    title: 'CORE 在零售运营中的作用',
    lead: '与所有业务相同的原则——在多分店运营中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['会员与积分系统', '促销与门店价格管理'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['分店、配送中心与库位结构', '调拨与审批规则', '从现有 POS 获取销售数据'],
  },
  signature: {
    eyebrow: 'Branch health',
    title: '每家分店，五件要看的事',
    lead: '不是销售额，而是运营的健康状况——选择一家分店，看看接下来要做什么。',
    dc: '配送中心',
    branches: {
      b1: '暹罗店',
      b2: '邦纳店',
      b3: '兰实店',
      b4: '拉玛二世店',
      b5: '春武里店',
      b6: '清迈店',
    },
    checks: { stock: '库存', replenish: '补货', transfer: '调拨', count: '盘点', expiry: '效期' },
    health: { ok: '正常', attention: '需关注', blocked: '受阻' },
    actions: {
      stock: '部分商品库存不足——从附近分店调拨或申请补货',
      replenish: '补货申请正在等待采购',
      transfer: '调入的货尚未确认收货',
      count: '盘点数与系统不符——核查中',
      expiry: '有临期商品——安排调走或处理',
    },
    choose: '选择分店',
    allGood: '一切正常——无需处理',
    loop: '补货循环',
  },
};

export const RETAIL: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };
