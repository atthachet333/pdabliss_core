import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

interface Signature {
  eyebrow: string;
  title: string;
  lead: string;
  order: string;
  lines: Record<'a' | 'b' | 'c', string>;
  ordered: string;
  available: string;
  state: Record<'ready' | 'partial' | 'short', string>;
  inbound: string;
  receive: string;
  received: string;
  outcome: { partial: string; ready: string };
  note: string;
  nodes: { suppliers: string; dc: string; customers: string };
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'กระจายสินค้า / ค้าส่ง — ของพร้อมส่งจริงไหม',
    description:
      'CORE สำหรับธุรกิจกระจายสินค้าและค้าส่ง: เชื่อมออเดอร์ สต็อกพร้อมส่ง ของค้างรับจาก Supplier การรับของบางส่วน และการจัดส่ง ให้ขาย คลัง และจัดซื้อเห็นภาพเดียวกัน',
  },
  hero: {
    eyebrow: 'Distribution / Wholesale',
    title: 'ของต้องไหล\nจาก Supplier ถึงลูกค้า\nโดยไม่ติดที่รอยต่อ',
    lead: 'ในธุรกิจกระจายสินค้า ปัญหาไม่ใช่ไม่มีข้อมูลสต็อก แต่คือฝ่ายขายเห็นออเดอร์ คลังเห็นจำนวน และจัดซื้อเห็น PO — โดยไม่มีใครเห็นว่าทั้งหมดเกี่ยวกันอย่างไร',
    visual:
      'เครือข่ายการไหลของสินค้า: Supplier เข้าคลังกลาง แล้วกระจายออกไปยังลูกค้า มีจุดที่ของค้างรับและจุดที่ออเดอร์รอของ',
  },
  reality: {
    title: 'อะไรทำให้งานกระจายสินค้าต่างจากธุรกิจอื่น',
    lead: 'ทุกออเดอร์ผูกกับของจริงที่ต้องมีอยู่ในคลัง ณ เวลาที่ต้องส่ง',
    points: [
      {
        title: 'Demand มาก่อนของ',
        body: 'ลูกค้าสั่งวันนี้ แต่ของบางรายการยังอยู่ระหว่างทางจาก Supplier',
      },
      {
        title: 'ส่งบางส่วนเป็นเรื่องปกติ',
        body: 'ออเดอร์หนึ่งอาจมีรายการที่พร้อม รายการที่ขาด และรายการที่รอรับเข้า',
      },
      {
        title: 'Lot และวันหมดอายุมีผล',
        body: 'สินค้าบางประเภทต้องเลือก Lot ที่หมดอายุก่อนออกก่อน',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'ฝ่ายขายไม่รู้ว่าของพร้อมส่งไหม ต้องโทรถามคลัง',
      'คลังเห็นจำนวน แต่ไม่รู้ว่าของชิ้นนี้ถูกจองให้ออเดอร์ไหน',
      'ของค้างที่ Supplier แต่ไม่มีใครรู้ว่ากระทบออเดอร์อะไรบ้าง',
      'รับของเข้ามาบางส่วน แล้วออเดอร์ที่รออยู่ไม่ถูกปล่อยต่อ',
      'ออเดอร์ค้างเพราะของขาด โดยไม่มีใครเป็นเจ้าของปัญหา',
      'Lot และวันหมดอายุซับซ้อน คลังต้องจำเอง',
    ],
  },
  departments: {
    title: 'แผนกที่ส่งงานให้กันทุกวัน',
    roles: {
      sales: 'รับออเดอร์ เห็นว่าของพร้อมส่งแค่ไหน และแจ้งลูกค้าได้ทันที',
      warehouse: 'จัดของตามออเดอร์ เลือก Lot รับของเข้า และยืนยันพร้อมส่ง',
      purchasing: 'เห็นว่ารายการไหนขาด สั่งเติม และตามของค้างรับ',
      accounting: 'รับเอกสารการส่งและการรับของที่ครบ เพื่อดำเนินการต่อ',
      executive: 'เห็นออเดอร์ค้าง ของขาด และ Supplier ที่เลท',
    },
  },
  workflow: {
    title: 'จากความต้องการของลูกค้า ถึงการส่งมอบ',
    notes: {
      demand: 'ลูกค้าแจ้งรายการและวันที่ต้องการ',
      availability: 'เห็นจำนวนพร้อมส่งหลังหักของที่จองไว้แล้ว',
      order: 'เปิดคำสั่งขาย พร้อมระบุรายการที่ต้องรอ',
      pick: 'จัดของตาม Lot ที่ควรออกก่อน',
      replenish: 'รายการที่ขาดถูกส่งต่อให้จัดซื้อ',
      dispatch: 'ส่งเมื่อพร้อม หรือส่งบางส่วนตามที่อนุมัติ',
      complete: 'เอกสารส่งของครบ ส่งต่อให้บัญชี',
    },
  },
  information: {
    title: 'ข้อมูลที่ต้องมีให้เห็นตรงกัน',
    items: [
      { label: 'จำนวนพร้อมส่ง', why: 'ไม่ใช่แค่จำนวนในคลัง แต่หักของที่จองไว้แล้ว' },
      { label: 'ของค้างรับ', why: 'PO ไหนยังไม่เข้า และจะช่วยออเดอร์ไหน' },
      { label: 'สถานะแต่ละรายการในออเดอร์', why: 'พร้อม บางส่วน หรือขาด' },
      { label: 'Lot และวันหมดอายุ', why: 'เพื่อจัดของที่ควรออกก่อน' },
      { label: 'ความพร้อมในการจัดส่ง', why: 'ของครบ เอกสารครบ รถพร้อม' },
    ],
  },
  signals: {
    title: 'สิ่งที่หัวหน้าต้องเห็นก่อนลูกค้าโทรมา',
    notes: {
      stuckOrders: 'ออเดอร์ที่ถึงกำหนดแต่ยังส่งไม่ได้',
      shortage: 'รายการที่ demand มากกว่าของพร้อมส่ง',
      supplierLate: 'PO ที่เลยวันที่คาดว่าจะได้รับ',
      partialReceipt: 'รับเข้าไม่ครบ และกระทบออเดอร์ที่รออยู่',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานกระจายสินค้า',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานกระจายสินค้า หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: [
      'ระบบบริหารการขนส่งหรือการจัดเส้นทางรถ',
      'ระบบคลังอัตโนมัติที่ควบคุมเครื่องจักรหรือหุ่นยนต์',
    ],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'กติกาการจองสต็อกและการจัดลำดับออเดอร์',
      'การเชื่อมต่อกับระบบบัญชีหรือ ERP เดิม',
      'โครงสร้างหลายคลังหรือหลายสาขา',
    ],
  },
  signature: {
    eyebrow: 'Order fulfillment',
    title: 'ออเดอร์เดียว สามสถานะ',
    lead: 'ฝ่ายขายเห็นทันทีว่ารายการไหนพร้อม รายการไหนรอของ — และของที่กำลังจะเข้าจะช่วยออเดอร์นี้ได้แค่ไหน',
    order: 'คำสั่งขาย SO-1042',
    lines: { a: 'สินค้า A · กล่อง 12 ชิ้น', b: 'สินค้า B · แพ็ค 6', c: 'สินค้า C · ถุง 5 กก.' },
    ordered: 'สั่ง',
    available: 'พร้อมส่ง',
    state: { ready: 'พร้อมส่ง', partial: 'ได้บางส่วน', short: 'ขาด' },
    inbound: 'ของค้างรับจาก PO-2215',
    receive: 'จำลองการรับของจาก PO-2215',
    received: 'รับของแล้ว',
    outcome: {
      partial: 'ส่งได้บางส่วน — รายการที่เหลือรอของจาก Supplier',
      ready: 'ทุกรายการพร้อมส่ง — คลังจัดของได้ทันที',
    },
    note: 'หน้าจอนี้แสดงเฉพาะจำนวนและสถานะ — เห็นเท่าที่คลังและฝ่ายขายต้องใช้',
    nodes: { suppliers: 'Supplier', dc: 'คลังกลาง', customers: 'ลูกค้า' },
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Distribution / Wholesale — is it really ready to ship?',
    description:
      'CORE for distribution and wholesale: connect orders, available stock, open supplier receipts, partial receipts and dispatch, so sales, warehouse and purchasing see one picture.',
  },
  hero: {
    eyebrow: 'Distribution / Wholesale',
    title: 'Goods should flow\nfrom supplier to customer\nwithout stalling at the joins',
    lead: 'In distribution the problem isn’t missing stock data. Sales sees the order, the warehouse sees quantities and purchasing sees the PO — and nobody sees how they relate.',
    visual:
      'A goods network: suppliers feed a central warehouse that distributes to customers, with a point where a receipt is outstanding and an order waiting for stock',
  },
  reality: {
    title: 'What makes distribution different',
    lead: 'Every order is tied to physical goods that must be in the warehouse when it ships.',
    points: [
      {
        title: 'Demand comes before stock',
        body: 'Customers order today; some lines are still on the way from the supplier.',
      },
      {
        title: 'Partial shipments are normal',
        body: 'One order may hold lines that are ready, short, or waiting for a receipt.',
      },
      { title: 'Lot and expiry matter', body: 'Some goods must ship first-expiry-first-out.' },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'Sales doesn’t know whether goods are ready, so they phone the warehouse.',
      'The warehouse sees quantities but not which order the stock is reserved for.',
      'Goods are stuck at a supplier and nobody knows which orders that affects.',
      'A partial receipt arrives, and the orders waiting for it are never released.',
      'Orders stall on shortages with nobody owning the problem.',
      'Lots and expiry dates are complex, and the warehouse has to remember them.',
    ],
  },
  departments: {
    title: 'Departments handing work to each other every day',
    roles: {
      sales: 'Takes orders, sees what can ship and can tell the customer right away.',
      warehouse: 'Picks by order, chooses the lot, receives goods and confirms readiness.',
      purchasing: 'Sees what is short, replenishes and chases open receipts.',
      accounting: 'Receives complete shipping and receipt documents to continue.',
      executive: 'Sees orders waiting, shortages and late suppliers.',
    },
  },
  workflow: {
    title: 'From customer demand to delivery',
    notes: {
      demand: 'The customer gives items and a required date.',
      availability: 'Available stock after existing reservations.',
      order: 'Open the sales order, marking lines that must wait.',
      pick: 'Pick the lot that should leave first.',
      replenish: 'Short lines go to purchasing.',
      dispatch: 'Ship when ready, or partially as approved.',
      complete: 'Complete shipping documents go to accounting.',
    },
  },
  information: {
    title: 'Information everyone must see the same way',
    items: [
      { label: 'Available to ship', why: 'Not just on hand — net of reservations.' },
      { label: 'Open receipts', why: 'Which POs are still out, and which orders they help.' },
      { label: 'State of each order line', why: 'Ready, partial or short.' },
      { label: 'Lot and expiry', why: 'To pick what should leave first.' },
      { label: 'Dispatch readiness', why: 'Goods, documents and transport ready.' },
    ],
  },
  signals: {
    title: 'What managers should see before the customer calls',
    notes: {
      stuckOrders: 'Orders due that can’t ship yet.',
      shortage: 'Items where demand exceeds what can ship.',
      supplierLate: 'POs past their expected receipt date.',
      partialReceipt: 'Short receipts that affect waiting orders.',
    },
  },
  fit: {
    title: 'Where CORE fits in distribution',
    lead: 'The same principles as every business — this is how they look in distribution.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: [
      'Transport management or route planning',
      'Automated warehouse systems that control machines or robots',
    ],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'Stock reservation and order priority rules',
      'Connection to an existing accounting system or ERP',
      'Multi-warehouse or multi-branch structure',
    ],
  },
  signature: {
    eyebrow: 'Order fulfillment',
    title: 'One order, three states',
    lead: 'Sales sees at once which lines are ready and which wait for goods — and how much the incoming receipt will help this order.',
    order: 'Sales order SO-1042',
    lines: { a: 'Item A · box of 12', b: 'Item B · 6-pack', c: 'Item C · 5 kg bag' },
    ordered: 'Ordered',
    available: 'Can ship',
    state: { ready: 'Ready', partial: 'Partial', short: 'Short' },
    inbound: 'Open receipt from PO-2215',
    receive: 'Simulate receiving PO-2215',
    received: 'Received',
    outcome: {
      partial: 'Partial shipment possible — remaining lines wait for the supplier',
      ready: 'Every line is ready — the warehouse can pick now',
    },
    note: 'This view shows quantities and states only — what the warehouse and sales need.',
    nodes: { suppliers: 'Suppliers', dc: 'Central warehouse', customers: 'Customers' },
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '分销 / 批发——货真的可以发了吗',
    description:
      '面向分销与批发的 CORE：连接订单、可发库存、供应商待收货、部分收货与发货，让销售、仓库与采购看到同一幅全景。',
  },
  hero: {
    eyebrow: 'Distribution / Wholesale',
    title: '货物应当\n从供应商流向客户\n不在衔接处停滞',
    lead: '在分销业务中，问题不是缺少库存数据，而是销售看到订单、仓库看到数量、采购看到采购单——却没有人看到它们之间的关系。',
    visual: '货物网络：供应商供货至中心仓库，再分发给客户；其中一处待收货，一张订单在等货',
  },
  reality: {
    title: '分销业务有何不同',
    lead: '每张订单都对应着发货时必须在仓库中的实物。',
    points: [
      { title: '需求先于库存', body: '客户今天下单，部分商品还在从供应商运来的路上。' },
      { title: '部分发货很常见', body: '一张订单可能同时有已备好、缺货和等待入库的行。' },
      { title: '批次与效期很重要', body: '部分商品需要先到期先出库。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '销售不知道货是否备好，只能打电话问仓库。',
      '仓库看到数量，却不知道这批货预留给了哪张订单。',
      '货卡在供应商那里，没人知道会影响哪些订单。',
      '部分收货后，等着这批货的订单没有被继续放行。',
      '订单因缺货停滞，却没人负责处理。',
      '批次与效期复杂，全靠仓库记忆。',
    ],
  },
  departments: {
    title: '每天相互交接工作的部门',
    roles: {
      sales: '接单，看到可发数量，并能立即告知客户。',
      warehouse: '按订单拣货、选择批次、收货并确认可发。',
      purchasing: '看到哪些缺货，补货并跟进待收货。',
      accounting: '接收完整的发货与收货单据以继续处理。',
      executive: '看到积压订单、缺货与延迟的供应商。',
    },
  },
  workflow: {
    title: '从客户需求到交付',
    notes: {
      demand: '客户提供商品与需求日期。',
      availability: '扣除已预留后的可发数量。',
      order: '创建销售订单，并标出需要等待的行。',
      pick: '按应先出库的批次拣货。',
      replenish: '缺货行转给采购。',
      dispatch: '备齐即发，或按审批部分发货。',
      complete: '完整的发货单据移交财务。',
    },
  },
  information: {
    title: '各方必须一致看到的信息',
    items: [
      { label: '可发数量', why: '不只是在库数，而是扣除预留后的数量。' },
      { label: '待收货', why: '哪些采购单未到，能帮助哪些订单。' },
      { label: '订单各行状态', why: '已备好、部分或缺货。' },
      { label: '批次与效期', why: '用于挑选应先出库的货。' },
      { label: '发货准备情况', why: '货、单据与运输均已就绪。' },
    ],
  },
  signals: {
    title: '在客户来电之前主管就该看到的',
    notes: {
      stuckOrders: '已到期但仍无法发货的订单。',
      shortage: '需求大于可发数量的商品。',
      supplierLate: '超过预计到货日期的采购单。',
      partialReceipt: '收货不足并影响等待中的订单。',
    },
  },
  fit: {
    title: 'CORE 在分销中的作用',
    lead: '与所有业务相同的原则——在分销中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['运输管理或路线规划系统', '控制设备或机器人的自动化仓储系统'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['库存预留与订单优先级规则', '与现有会计系统或 ERP 的连接', '多仓库或多分支机构结构'],
  },
  signature: {
    eyebrow: 'Order fulfillment',
    title: '一张订单，三种状态',
    lead: '销售立即看到哪些行已备好、哪些在等货——以及即将到货的采购单能帮这张订单多少。',
    order: '销售订单 SO-1042',
    lines: { a: '商品 A · 12 件装', b: '商品 B · 6 件装', c: '商品 C · 5 公斤袋装' },
    ordered: '订购',
    available: '可发',
    state: { ready: '已备好', partial: '部分', short: '缺货' },
    inbound: '来自 PO-2215 的待收货',
    receive: '模拟收取 PO-2215',
    received: '已收货',
    outcome: {
      partial: '可部分发货——其余行等待供应商到货',
      ready: '所有行均已备好——仓库可立即拣货',
    },
    note: '此视图只显示数量与状态——即仓库与销售所需的信息。',
    nodes: { suppliers: '供应商', dc: '中心仓库', customers: '客户' },
  },
};

export const DISTRIBUTION: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };
