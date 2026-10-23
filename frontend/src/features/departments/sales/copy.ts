import type { Localized } from '@/i18n/useCopy';
import type { ConnectionsCopy, IoCopy, ManagerCopy, TodayCopy } from '../common';

const th = {
  meta: {
    title: 'ฝ่ายขาย — เห็นออเดอร์ทุกใบตั้งแต่รับจนส่งมอบ',
    description:
      'พื้นที่ทำงานฝ่ายขายใน PDA BLISS CORE ติดตาม Customer PO, Sales Order ความพร้อมของสินค้า การจอง และสถานะการส่งมอบ โดยไม่ต้องไล่ถามทุกแผนก',
  },
  hero: {
    eyebrow: 'Sales',
    title: 'ฝ่ายขายควรรู้ว่าออเดอร์อยู่ตรงไหน\nโดยไม่ต้องไล่ถามทุกแผนก',
    lead: 'CORE ไม่ได้เป็นแค่ระบบติดตามลูกค้าที่สนใจ แต่ทำให้ฝ่ายขายมองเห็นออเดอร์ที่กำลังเดินจริง — ตั้งแต่ Customer PO จนถึงการส่งมอบ',
    token: 'SO ตัวอย่าง',
    route: ['Customer PO', 'Sales Order', 'ตรวจสินค้า', 'พร้อมส่ง', 'จัดส่ง', 'ส่งครบ'],
    branch: 'ต้องเตรียม / ผลิต',
    visual: 'ออเดอร์เดินตามเส้นทางจาก Customer PO ไปสู่การส่งมอบ',
  },
  responsibility: {
    eyebrow: 'Customer order responsibility',
    title: 'ฝ่ายขายรับผิดชอบคำมั่นที่ให้กับลูกค้า',
    lead: 'ไม่ใช่แค่ปิดการขาย แต่ต้องรู้ว่าสิ่งที่ตกลงกับลูกค้าจะส่งได้จริงเมื่อไร',
    points: [
      {
        title: 'รับคำสั่งซื้อให้ถูกตั้งแต่ต้น',
        body: 'Customer PO กลายเป็น Sales Order ที่ทุกแผนกเห็นตรงกัน',
      },
      {
        title: 'ยืนยันกำหนดส่งจากสถานะจริง',
        body: 'ดูความพร้อมสินค้าและงานที่ต้องเตรียมก่อนให้คำตอบลูกค้า',
      },
      {
        title: 'บอกลูกค้าได้ทุกเมื่อ',
        body: 'รู้ว่าออเดอร์อยู่ขั้นไหน โดยไม่ต้องโทรถามคลังหรือปฏิบัติการ',
      },
    ],
  },
  today: {
    title: 'วันนี้ฝ่ายขายเห็นอะไร',
    lead: 'หน้าจอแรกบอกว่าออเดอร์ไหนต้องดูแลก่อน',
    groups: [
      {
        label: 'ออเดอร์ใหม่',
        count: 4,
        tone: 'calm',
        items: ['รอสร้าง Sales Order', 'รอยืนยันกำหนดส่ง'],
      },
      {
        label: 'ใกล้กำหนดส่ง',
        count: 3,
        tone: 'attention',
        items: ['ส่งภายใน 2 วัน', 'รอคลังจัดเตรียม'],
      },
      { label: 'ติด Stock', count: 1, tone: 'blocked', items: ['รอฝ่ายปฏิบัติการเตรียมสินค้า'] },
    ],
  } satisfies TodayCopy,
  progression: {
    eyebrow: 'Order progression',
    title: 'ออเดอร์หนึ่งใบ เดินผ่านหลายขั้น\nฝ่ายขายเห็นทุกขั้น',
    lead: 'เส้นทางตัวอย่าง — แต่ละองค์กรกำหนดขั้นตอนและการอนุมัติของตัวเองได้',
    tabs: 'ขั้นของออเดอร์',
    involved: 'แผนกที่เกี่ยวข้อง',
    customer: 'สิ่งที่บอกลูกค้าได้',
    stages: [
      {
        name: 'Customer PO',
        body: 'ลูกค้าส่งคำสั่งซื้อ ฝ่ายขายตรวจรายการ จำนวน และกำหนดส่งที่ต้องการ',
        depts: ['sales'],
        tell: 'ได้รับคำสั่งซื้อแล้ว',
      },
      {
        name: 'Sales Order',
        body: 'สร้าง Sales Order ที่ทุกแผนกเห็นตรงกัน — เป็นจุดเริ่มของงานทั้งหมด',
        depts: ['sales'],
        tell: 'ยืนยันคำสั่งซื้อ',
      },
      {
        name: 'ตรวจความพร้อม',
        body: 'ดูสินค้าที่มีในคลังและ Lot ที่ใช้ได้ หากพอจะจองไว้สำหรับออเดอร์นี้',
        depts: ['sales', 'warehouse'],
        tell: 'กำลังตรวจสอบสินค้า',
      },
      {
        name: 'พร้อม / ต้องเตรียม',
        body: 'ส่วนที่ยังไม่พอถูกส่งเป็นความต้องการให้ฝ่ายปฏิบัติการหรือจัดซื้อ พร้อมกำหนดที่คาดไว้',
        depts: ['operations', 'purchasing'],
        tell: 'กำหนดส่งที่คาดไว้',
      },
      {
        name: 'จัดส่ง',
        body: 'คลังจัดเตรียมและจ่ายออกตามลำดับ ฝ่ายขายเห็นสถานะการส่งทันที',
        depts: ['warehouse'],
        tell: 'สินค้าอยู่ระหว่างจัดส่ง',
      },
      {
        name: 'ส่งครบ',
        body: 'ยืนยันการส่งมอบ เอกสารพร้อมส่งต่อให้บัญชี',
        depts: ['sales', 'accounting'],
        tell: 'ส่งมอบครบแล้ว',
      },
    ],
  },
  dependency: {
    eyebrow: 'Stock & Operations dependency',
    title: 'คำตอบที่ให้ลูกค้า ขึ้นกับแผนกอื่น',
    lead: 'CORE แสดงให้ฝ่ายขายเห็นว่าออเดอร์พึ่งอะไรอยู่ จึงให้กำหนดส่งที่ทำได้จริง',
    check: 'ตรวจสินค้าสำหรับออเดอร์',
    enough: { title: 'สินค้าพอ', steps: ['จองสินค้าให้ออเดอร์', 'คลังจัดเตรียม', 'พร้อมส่ง'] },
    short: {
      title: 'สินค้าไม่พอ',
      steps: ['ส่งความต้องการให้ปฏิบัติการ / จัดซื้อ', 'ได้กำหนดที่คาดไว้', 'ฝ่ายขายแจ้งลูกค้า'],
    },
  },
  delivery: {
    eyebrow: 'Delivery visibility',
    title: 'สถานะการส่งมอบ ที่ฝ่ายขายเห็นพร้อมกับคลัง',
    lead: 'ทุกครั้งที่คลังบันทึกการเตรียมหรือจ่ายออก ฝ่ายขายเห็นทันที — ไม่ต้องรอข้อความ',
    internal: 'ในระบบ',
    customerView: 'สิ่งที่ฝ่ายขายบอกลูกค้า',
    steps: [
      { label: 'คลังรับงานจัดเตรียม', done: true },
      { label: 'จัดเตรียมครบ', done: true },
      { label: 'จ่ายออกจากคลัง', done: true },
      { label: 'ยืนยันการส่งมอบ', done: false },
    ],
    message: 'สินค้าออกจากคลังแล้ว อยู่ระหว่างจัดส่ง',
  },
  manager: {
    title: 'หัวหน้าฝ่ายขายเห็นทั้งทีม',
    lead: 'พนักงานขายดูแลออเดอร์ของตัวเอง หัวหน้าเห็นภาพรวมของทุกออเดอร์',
    employee: ['ออเดอร์ที่ฉันดูแล', 'ออเดอร์ที่ต้องยืนยันกำหนดส่ง', 'ลูกค้าที่รอคำตอบ'],
    manager: [
      'ออเดอร์ที่เสี่ยงล่าช้าทั้งทีม',
      'ออเดอร์ที่ติด Stock',
      'งานที่รออนุมัติ เช่น เงื่อนไขพิเศษ',
    ],
  } satisfies ManagerCopy,
  io: {
    title: 'ฝ่ายขายรับความต้องการของลูกค้า\nแล้วเปลี่ยนเป็นงานของทั้งองค์กร',
    in: ['Customer PO', 'คำถามจากลูกค้า', 'การเปลี่ยนแปลงคำสั่งซื้อ'],
    do: ['สร้าง Sales Order', 'ตรวจและจองสินค้า', 'ยืนยันกำหนดส่ง'],
    out: ['ความต้องการให้ปฏิบัติการ', 'งานจัดเตรียมให้คลัง', 'เอกสารส่งมอบให้บัญชี'],
  } satisfies IoCopy,
  preview: {
    title: 'หน้าจอฝ่ายขายจริงใน CORE',
    lead: 'Sales Order ที่ต้องติดตาม และเส้นทางของออเดอร์ที่เลือก — ข้อมูลตัวอย่างทั้งหมด',
  },
  connections: {
    chain: [
      { at: 'customer', what: 'ส่ง Customer PO' },
      { at: 'sales', what: 'สร้าง Sales Order และยืนยันกำหนดส่ง' },
      { at: 'operations', what: 'เตรียมหรือผลิตส่วนที่ไม่พอ' },
      { at: 'warehouse', what: 'จัดเตรียมและจ่ายออก' },
    ],
  } satisfies ConnectionsCopy,
};

export const SALES: Localized<typeof th> = {
  th,
  en: {
    meta: {
      title: 'Sales — every order visible from PO to delivery',
      description:
        'The Sales workspace in PDA BLISS CORE follows customer POs, sales orders, stock availability, reservations and delivery status — without chasing every department.',
    },
    hero: {
      eyebrow: 'Sales',
      title: 'Sales should know where every order is\nwithout chasing every department',
      lead: 'CORE isn’t just a lead tracker. It gives Sales real visibility of orders in motion — from the customer PO all the way to delivery.',
      token: 'Sample SO',
      route: ['Customer PO', 'Sales Order', 'Check stock', 'Ready', 'Shipping', 'Delivered'],
      branch: 'Prepare / produce',
      visual: 'An order travels from the customer PO to delivery',
    },
    responsibility: {
      eyebrow: 'Customer order responsibility',
      title: 'Sales owns the promise made to the customer',
      lead: 'Not just closing the sale — knowing when what was agreed can really be delivered.',
      points: [
        {
          title: 'Take the order right from the start',
          body: 'The customer PO becomes a sales order every department sees the same way.',
        },
        {
          title: 'Confirm dates from real status',
          body: 'Check stock and the work to prepare before answering the customer.',
        },
        {
          title: 'Answer the customer any time',
          body: 'Know which step an order is at — without calling the warehouse or operations.',
        },
      ],
    },
    today: {
      title: 'What Sales sees today',
      lead: 'The first screen shows which orders need attention first.',
      groups: [
        {
          label: 'New orders',
          count: 4,
          tone: 'calm',
          items: ['Sales order to create', 'Delivery date to confirm'],
        },
        {
          label: 'Due soon',
          count: 3,
          tone: 'attention',
          items: ['Due within 2 days', 'Waiting for warehouse picking'],
        },
        {
          label: 'Waiting for stock',
          count: 1,
          tone: 'blocked',
          items: ['Operations preparing goods'],
        },
      ],
    },
    progression: {
      eyebrow: 'Order progression',
      title: 'One order moves through many steps —\nSales sees every one',
      lead: 'An example route — each organization defines its own steps and approvals.',
      tabs: 'Order steps',
      involved: 'Departments involved',
      customer: 'What the customer can be told',
      stages: [
        {
          name: 'Customer PO',
          body: 'The customer sends an order; Sales checks items, quantities and the requested date.',
          depts: ['sales'],
          tell: 'Order received',
        },
        {
          name: 'Sales Order',
          body: 'A sales order every department sees the same way — the starting point of all the work.',
          depts: ['sales'],
          tell: 'Order confirmed',
        },
        {
          name: 'Check availability',
          body: 'See stock and usable lots; if enough, reserve them for this order.',
          depts: ['sales', 'warehouse'],
          tell: 'Checking stock',
        },
        {
          name: 'Ready / to prepare',
          body: 'Anything short becomes demand for Operations or Purchasing, with an expected date.',
          depts: ['operations', 'purchasing'],
          tell: 'Expected delivery date',
        },
        {
          name: 'Shipping',
          body: 'The warehouse picks and dispatches; Sales sees the status at once.',
          depts: ['warehouse'],
          tell: 'Out for delivery',
        },
        {
          name: 'Delivered',
          body: 'Delivery confirmed; documents move on to Accounting.',
          depts: ['sales', 'accounting'],
          tell: 'Delivered in full',
        },
      ],
    },
    dependency: {
      eyebrow: 'Stock & Operations dependency',
      title: 'The answer to the customer depends on other departments',
      lead: 'CORE shows Sales what an order depends on, so the date promised is one that can be kept.',
      check: 'Check stock for the order',
      enough: {
        title: 'Enough stock',
        steps: ['Reserve stock for the order', 'Warehouse prepares', 'Ready to ship'],
      },
      short: {
        title: 'Not enough stock',
        steps: [
          'Send demand to Operations / Purchasing',
          'Get an expected date',
          'Sales updates the customer',
        ],
      },
    },
    delivery: {
      eyebrow: 'Delivery visibility',
      title: 'Delivery status Sales sees at the same moment as the warehouse',
      lead: 'Each time the warehouse records picking or dispatch, Sales sees it immediately — no waiting for messages.',
      internal: 'In CORE',
      customerView: 'What Sales tells the customer',
      steps: [
        { label: 'Warehouse accepts picking', done: true },
        { label: 'Picking complete', done: true },
        { label: 'Dispatched from warehouse', done: true },
        { label: 'Delivery confirmed', done: false },
      ],
      message: 'Your goods have left the warehouse and are on the way.',
    },
    manager: {
      title: 'The sales lead sees the whole team',
      lead: 'Each salesperson looks after their own orders; the lead sees every order.',
      employee: [
        'Orders I look after',
        'Orders needing a confirmed date',
        'Customers waiting for an answer',
      ],
      manager: [
        'Orders at risk of delay across the team',
        'Orders waiting for stock',
        'Items awaiting approval, such as special terms',
      ],
    },
    io: {
      title: 'Sales takes in customer demand\nand turns it into work for the whole organization',
      in: ['Customer POs', 'Customer questions', 'Order changes'],
      do: ['Create the sales order', 'Check and reserve stock', 'Confirm the delivery date'],
      out: [
        'Demand for Operations',
        'Picking work for the warehouse',
        'Delivery documents for Accounting',
      ],
    },
    preview: {
      title: 'The real Sales screen in CORE',
      lead: 'Sales orders to follow, and the route of the selected order — all sample data.',
    },
    connections: {
      chain: [
        { at: 'customer', what: 'Sends a customer PO' },
        { at: 'sales', what: 'Creates the sales order and confirms the date' },
        { at: 'operations', what: 'Prepares or produces what is short' },
        { at: 'warehouse', what: 'Picks and dispatches' },
      ],
    },
  },
  'zh-CN': {
    meta: {
      title: '销售部——从采购单到交付，每张订单清晰可见',
      description:
        'PDA BLISS CORE 销售工作空间跟踪客户采购单、销售订单、库存可用性、预留与交付状态，无需逐个部门追问。',
    },
    hero: {
      eyebrow: 'Sales',
      title: '每张订单在哪里\n销售部都应知道\n无需逐个部门追问',
      lead: 'CORE 不只是潜在客户跟踪工具，它让销售部看到真实流转中的订单——从客户采购单一直到交付。',
      token: '示例 SO',
      route: ['客户采购单', '销售订单', '检查库存', '可发货', '运输中', '已送达'],
      branch: '需准备 / 生产',
      visual: '订单从客户采购单一路流转到交付',
    },
    responsibility: {
      eyebrow: 'Customer order responsibility',
      title: '销售部对给客户的承诺负责',
      lead: '不只是促成交易，还要知道约定的内容何时真正能交付。',
      points: [
        { title: '从一开始就正确接单', body: '客户采购单转为各部门一致看到的销售订单。' },
        { title: '依据真实状态确认交期', body: '回复客户前先查看库存及需要准备的工作。' },
        { title: '随时答复客户', body: '知道订单在哪一步——无需打电话问仓库或运营部。' },
      ],
    },
    today: {
      title: '销售部今天看到什么',
      lead: '首屏显示哪些订单需要优先处理。',
      groups: [
        { label: '新订单', count: 4, tone: 'calm', items: ['待创建销售订单', '待确认交期'] },
        { label: '即将到期', count: 3, tone: 'attention', items: ['2 天内交货', '等待仓库备货'] },
        { label: '等待库存', count: 1, tone: 'blocked', items: ['等待运营部准备商品'] },
      ],
    },
    progression: {
      eyebrow: 'Order progression',
      title: '一张订单经过多个环节\n销售部每一步都看得见',
      lead: '示例路径——每家企业都可以设定自己的步骤与审批。',
      tabs: '订单环节',
      involved: '相关部门',
      customer: '可以告诉客户的内容',
      stages: [
        {
          name: '客户采购单',
          body: '客户下单，销售部核对品项、数量与要求的交期。',
          depts: ['sales'],
          tell: '已收到订单',
        },
        {
          name: '销售订单',
          body: '创建各部门一致看到的销售订单——所有工作的起点。',
          depts: ['sales'],
          tell: '订单已确认',
        },
        {
          name: '检查可用性',
          body: '查看库存与可用批次，足够时为该订单预留。',
          depts: ['sales', 'warehouse'],
          tell: '正在检查库存',
        },
        {
          name: '可发货 / 需准备',
          body: '不足的部分转为运营部或采购部的需求，并附预计日期。',
          depts: ['operations', 'purchasing'],
          tell: '预计交货日期',
        },
        {
          name: '运输中',
          body: '仓库备货出库，销售部即时看到状态。',
          depts: ['warehouse'],
          tell: '商品运输中',
        },
        {
          name: '已送达',
          body: '确认交付，单据转交财务。',
          depts: ['sales', 'accounting'],
          tell: '已全部送达',
        },
      ],
    },
    dependency: {
      eyebrow: 'Stock & Operations dependency',
      title: '给客户的答复取决于其他部门',
      lead: 'CORE 让销售部看到订单依赖什么，从而承诺真正能兑现的交期。',
      check: '为订单检查库存',
      enough: { title: '库存充足', steps: ['为订单预留库存', '仓库备货', '可发货'] },
      short: {
        title: '库存不足',
        steps: ['向运营部 / 采购部提出需求', '获得预计日期', '销售部通知客户'],
      },
    },
    delivery: {
      eyebrow: 'Delivery visibility',
      title: '销售部与仓库同时看到交付状态',
      lead: '仓库每次记录备货或出库，销售部都能即时看到——无需等待消息。',
      internal: '系统内',
      customerView: '销售部告诉客户的内容',
      steps: [
        { label: '仓库接收备货任务', done: true },
        { label: '备货完成', done: true },
        { label: '已出库', done: true },
        { label: '确认交付', done: false },
      ],
      message: '商品已出库，正在运输中。',
    },
    manager: {
      title: '销售主管看到整个团队',
      lead: '销售人员负责自己的订单，主管看到所有订单的全局。',
      employee: ['我负责的订单', '需要确认交期的订单', '等待答复的客户'],
      manager: ['团队中有延迟风险的订单', '等待库存的订单', '待审批事项，例如特殊条件'],
    },
    io: {
      title: '销售部接收客户需求\n并将其转化为全组织的工作',
      in: ['客户采购单', '客户咨询', '订单变更'],
      do: ['创建销售订单', '检查并预留库存', '确认交期'],
      out: ['给运营部的需求', '给仓库的备货任务', '给财务的交付单据'],
    },
    preview: {
      title: 'CORE 中真实的销售界面',
      lead: '需要跟进的销售订单及所选订单的路径——全部为示例数据。',
    },
    connections: {
      chain: [
        { at: 'customer', what: '发送客户采购单' },
        { at: 'sales', what: '创建销售订单并确认交期' },
        { at: 'operations', what: '准备或生产不足的部分' },
        { at: 'warehouse', what: '备货并出库' },
      ],
    },
  },
};
