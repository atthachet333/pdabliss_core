import type { Localized } from '@/i18n/useCopy';

/*
 * The canonical public explanation of Warehouse privacy (EP16).
 * Words about prices are allowed; financial VALUES are not — a test scans
 * every locale of this file for amounts and currency.
 */

export const CLASSES = ['operational', 'commercial', 'financial'] as const;
export type DataClass = (typeof CLASSES)[number];
/** Mirrors backend/src/domain/access/data-classification.ts (illustrative). */
export const CLEARANCE = [
  { view: 'warehouse', classes: ['operational'] },
  { view: 'sales', classes: ['operational', 'commercial'] },
  { view: 'purchasing', classes: ['operational', 'commercial'] },
  { view: 'accounting', classes: ['operational', 'commercial', 'financial'] },
  { view: 'executive', classes: ['operational', 'commercial', 'financial'] },
] as const satisfies readonly { view: string; classes: readonly DataClass[] }[];

const th = {
  intro:
    'ในทุกหน้าของเว็บไซต์ CORE ตัวอย่างที่ถูกใช้บ่อยที่สุดคือ “คลังสินค้าไม่เห็นราคา” คู่มือนี้คือคำอธิบายหลักของเรื่องนี้ — ไม่ใช่เพราะคลังสำคัญน้อยกว่า แต่เพราะคลังเป็นตัวอย่างที่ชัดที่สุดของการมองเห็นตามหน้าที่',
  sees: {
    title: 'คลังเห็นอะไร',
    p: 'มุมมองคลังมีทุกอย่างที่งานรับและจัดสินค้าต้องใช้ — ครบพอที่จะทำงานได้ถูกต้องโดยไม่ต้องถามใคร',
    view: 'มุมมองคลังสินค้า (ตัวอย่าง)',
    fields: [
      { label: 'สินค้า', value: 'น้ำยาทำความสะอาด 5 ลิตร · SKU-7731' },
      { label: 'ตำแหน่งจัดเก็บ', value: 'A-03-2' },
      { label: 'Lot', value: 'LOT-B2410' },
      { label: 'วันหมดอายุ', value: '2027-06-30' },
      { label: 'การรับสินค้า', value: 'รับแล้ว 80 / 100 · ค้างรับ 20' },
      { label: 'การจัดสินค้า', value: 'จัดตามลำดับ FEFO' },
    ],
    caption: 'ทุกช่องในมุมมองนี้เป็นข้อมูลปฏิบัติงาน — ไม่มีช่องใดว่างไว้หรือถูกซ่อน',
  },
  compare: {
    sees: 'คลังเห็น',
    seesItems: ['สินค้าและจำนวน', 'Lot และวันหมดอายุ', 'ตำแหน่งจัดเก็บ', 'สถานะงานรับและจัดสินค้า'],
    not: 'คลังไม่เห็น',
    notItems: ['ราคาขาย', 'ต้นทุน / ราคาซื้อ', 'กำไร', 'ยอดชำระ', 'เงื่อนไขการเงินกับ Supplier'],
  },
  why: {
    title: 'ทำไมต้องแยก',
    p: 'เหตุผลไม่ใช่ความลับเพื่อความลับ แต่มีสามข้อที่ใช้ได้กับทุกแผนก',
    reasons: [
      {
        title: 'งานชัดขึ้น',
        body: 'ยิ่งหน้าจอมีเฉพาะสิ่งที่ต้องใช้ คนยิ่งโฟกัสกับความถูกต้องของจำนวน Lot และวันหมดอายุ ซึ่งเป็นสิ่งที่คลังรับผิดชอบจริง',
      },
      {
        title: 'เปิดข้อมูลเท่าที่จำเป็น',
        body: 'ข้อมูลการค้าเป็นข้อมูลอ่อนไหว ยิ่งมีคนเห็นน้อยเท่าที่จำเป็น โอกาสที่ข้อมูลจะหลุดหรือถูกใช้ผิดก็ยิ่งน้อยลง',
      },
      {
        title: 'แยกหน้าที่',
        body: 'คนที่นับและรับสินค้า ไม่ควรเป็นคนเดียวกับคนที่ตั้งราคาหรือจ่ายเงิน การแยกหน้าที่ช่วยลดความขัดแย้งและทำให้การตรวจสอบมีความหมาย',
      },
    ],
    note: 'ไม่ใช่เพราะไม่ไว้ใจคนในคลัง — แต่เพราะงานของคลังไม่ต้องใช้ข้อมูลเหล่านี้',
  },
  classes: {
    title: 'ข้อมูลถูกแยกอย่างไร',
    p: 'CORE แบ่งข้อมูลเป็นสามประเภท แล้วกำหนดว่ามุมมองใดรับข้อมูลประเภทใดได้ — แทนที่จะตัดสินทีละช่องบนหน้าจอ',
    names: {
      operational: { name: 'ปฏิบัติงาน', body: 'จำนวน Lot วันที่ สถานะ — สิ่งที่ต้องใช้ทำงาน' },
      commercial: { name: 'การค้า', body: 'ราคาขาย ต้นทุน กำไร เงื่อนไขกับ Supplier' },
      financial: { name: 'การเงิน', body: 'การจ่ายเงิน เจ้าหนี้ ยอดทางบัญชี' },
    } satisfies Record<DataClass, { name: string; body: string }>,
    views: {
      warehouse: 'คลังสินค้า',
      sales: 'ฝ่ายขาย',
      purchasing: 'จัดซื้อ',
      accounting: 'บัญชีและการเงิน',
      executive: 'ผู้บริหาร',
    },
    caption:
      'ตัวอย่างการกำหนดสิทธิ์ตามประเภทข้อมูล — การกำหนดจริงขึ้นกับขอบเขตการวางระบบของแต่ละองค์กร',
    receives: 'รับได้',
    not: 'ไม่รับ',
  },
  enforce: {
    title: 'ซ่อนบนหน้าจอ กับ ไม่ส่งเลย ต่างกันอย่างไร',
    p1: 'ถ้าข้อมูลราคาถูกส่งมาถึงเครื่องของคนในคลังแล้วค่อยซ่อนบนหน้าจอ ข้อมูลนั้นก็ยังอยู่ในเครื่อง — นั่นยังไม่ใช่ขอบเขตที่แท้จริง',
    p2: 'ขอบเขตที่แท้จริงคือ Server ตัดสินตั้งแต่ก่อนส่งว่ามุมมองนี้ได้รับข้อมูลอะไร ข้อมูลที่ไม่ได้รับอนุญาตไม่ถูกส่งออกมาเลย',
    now: 'วันนี้: ใน Demo ข้อมูลราคาไม่อยู่ในข้อมูลของมุมมองคลังตั้งแต่ต้น และ Backend พื้นฐานสร้างข้อมูลคลังจาก Allow-list เฉพาะข้อมูลประเภทปฏิบัติงาน ซึ่งทดสอบกับข้อมูลตัวอย่าง การบังคับสิทธิ์กับผู้ใช้จริงที่ Server อยู่ในระยะ Backend ถัดไป',
  },
  value: {
    title: 'แล้วงานที่ต้องใช้มูลค่าล่ะ?',
    p: 'บางงานต้องใช้ทั้งจำนวนและมูลค่า เช่น การตีมูลค่าสินค้าคงคลัง สินค้าเสียหาย หรือการเคลมประกัน งานเหล่านี้ไม่ได้หายไป — แค่แต่ละแผนกทำส่วนของตัวเองบนงานชิ้นเดียวกัน',
    items: [
      'คลังบันทึกจำนวน สภาพ และ Lot ของสินค้าที่เกี่ยวข้อง',
      'บัญชีหรือผู้บริหาร ซึ่งมีสิทธิ์เห็นข้อมูลการค้าและการเงิน เป็นผู้ประเมินมูลค่า',
      'ทั้งสองส่วนอยู่ในประวัติของงานชิ้นเดียวกัน จึงย้อนดูได้ครบ',
    ],
    note: 'ถ้าองค์กรของคุณให้หัวหน้าคลังรับผิดชอบเรื่องมูลค่าด้วย ก็กำหนดเป็นบทบาทแยกได้ตามขอบเขตการวางระบบ',
  },
  ask: {
    title: 'ใช้หลักนี้กับทุกแผนก',
    p: 'คำถามสี่ข้อนี้ช่วยกำหนดขอบเขตข้อมูลของแผนกใดก็ได้ ไม่ว่าจะใช้ระบบอะไร',
    items: [
      'งานของแผนกนี้ต้องตัดสินใจเรื่องอะไรบ้าง',
      'ข้อมูลใดจำเป็นต่อการตัดสินใจเหล่านั้นจริง',
      'ข้อมูลใดอ่อนไหว ถ้าเห็นมากเกินไปจะเสี่ยง',
      'ใครควรเป็นคนเห็นข้อมูลนั้นแทน และอยู่ในงานชิ้นเดียวกันอย่างไร',
    ],
  },
  links: {
    security: 'Security & Trust Center',
    department: 'หน้าแผนกคลังสินค้า',
    demo: 'มุมมองคลังใน CORE Demo',
  },
  cta: {
    title: 'ดูมุมมองคลังด้วยตัวเอง',
    body: 'เปิด Demo ในบทบาทคลังสินค้า แล้วดูว่ามีข้อมูลอะไรบ้าง — และไม่มีอะไร',
    primary: 'เปิด Demo ในมุมมองคลัง',
    secondary: 'ดู Security & Trust Center',
  },
};

export const WAREHOUSE_PRIVACY_GUIDE: Localized<typeof th> = {
  th,
  en: {
    intro:
      'Across the CORE website, the example used most often is “the warehouse does not see prices”. This guide is the reference explanation — not because the warehouse matters less, but because it is the clearest example of visibility by responsibility.',
    sees: {
      title: 'What the warehouse sees',
      p: 'The warehouse view holds everything receiving and picking need — enough to do the work correctly without asking anyone.',
      view: 'Warehouse view (sample)',
      fields: [
        { label: 'Item', value: 'Cleaning solution 5 L · SKU-7731' },
        { label: 'Location', value: 'A-03-2' },
        { label: 'Lot', value: 'LOT-B2410' },
        { label: 'Expiry', value: '2027-06-30' },
        { label: 'Receiving', value: 'Received 80 / 100 · 20 outstanding' },
        { label: 'Picking', value: 'FEFO order' },
      ],
      caption: 'Every field in this view is operational — nothing is left blank or hidden',
    },
    compare: {
      sees: 'The warehouse sees',
      seesItems: [
        'Items and quantities',
        'Lots and expiry dates',
        'Storage locations',
        'Receiving and picking status',
      ],
      not: 'The warehouse does not see',
      notItems: [
        'Selling price',
        'Cost / purchase price',
        'Margin',
        'Payment amounts',
        'Supplier financial terms',
      ],
    },
    why: {
      title: 'Why keep them apart',
      p: 'The reason is not secrecy for its own sake. Three reasons apply to every department.',
      reasons: [
        {
          title: 'Clearer work',
          body: 'The more a screen holds only what is needed, the more people focus on getting quantities, lots and expiry right — what the warehouse is actually responsible for.',
        },
        {
          title: 'Least exposure',
          body: 'Commercial information is sensitive. The fewer people who see it beyond need, the fewer chances it leaks or is misused.',
        },
        {
          title: 'Separation of duties',
          body: 'The people who count and receive goods should not be the same people who set prices or pay. Separating duties reduces conflicts and gives checks meaning.',
        },
      ],
      note: 'It is not that the warehouse is not trusted — the warehouse’s work simply does not need this information.',
    },
    classes: {
      title: 'How information is separated',
      p: 'CORE sorts data into three classes, then decides which view may receive which class — instead of deciding field by field on a screen.',
      names: {
        operational: {
          name: 'Operational',
          body: 'Quantities, lots, dates, statuses — what the work needs',
        },
        commercial: { name: 'Commercial', body: 'Selling price, cost, margin, supplier terms' },
        financial: { name: 'Financial', body: 'Payments, payables, accounting amounts' },
      },
      views: {
        warehouse: 'Warehouse',
        sales: 'Sales',
        purchasing: 'Purchasing',
        accounting: 'Accounting & Finance',
        executive: 'Executive',
      },
      caption:
        'An example of clearance by data class — the actual setup depends on each organization’s implementation scope',
      receives: 'Receives',
      not: 'Does not receive',
    },
    enforce: {
      title: 'Hiding on screen vs never sending',
      p1: 'If prices reach a warehouse user’s device and are then hidden on screen, the data is still on that device — that is not yet a real boundary.',
      p2: 'The real boundary is the server deciding, before anything is sent, what this view receives. Data that is not permitted is never sent at all.',
      now: 'Today: in the demo, prices are not part of the warehouse view’s data at all, and the backend foundation builds warehouse data from an allow-list of operational data only, tested on sample data. Server-side enforcement for real users comes in the next backend phases.',
    },
    value: {
      title: 'What about work that needs value?',
      p: 'Some work needs both quantity and value — stock valuation, damaged goods, an insurance claim. That work does not disappear; each department does its part on the same work item.',
      items: [
        'The warehouse records the quantity, condition and lot of the goods involved',
        'Accounting or an executive, cleared for commercial and financial data, assesses the value',
        'Both parts sit in the same work item’s history, so it can be traced in full',
      ],
      note: 'If your organization makes a warehouse lead responsible for value too, that can be a separate role, set in the implementation scope.',
    },
    ask: {
      title: 'Use the same principle for every department',
      p: 'These four questions help set the information boundary for any department, whatever system you use.',
      items: [
        'What decisions does this department’s work involve?',
        'Which information do those decisions really need?',
        'Which information is sensitive, and risky if seen too widely?',
        'Who should see that information instead, and how do they work on the same item?',
      ],
    },
    links: {
      security: 'Security & Trust Center',
      department: 'The Warehouse department page',
      demo: 'The warehouse view in the CORE demo',
    },
    cta: {
      title: 'See the warehouse view yourself',
      body: 'Open the demo as Warehouse and see what is there — and what is not.',
      primary: 'Open the demo as Warehouse',
      secondary: 'See the Security & Trust Center',
    },
  },
  'zh-CN': {
    intro:
      '在 CORE 网站的各个页面中，最常用的例子是“仓库看不到价格”。本指南是这一点的标准说明——不是因为仓库不重要，而是因为仓库是“按职责划分可见范围”最清楚的例子。',
    sees: {
      title: '仓库能看到什么',
      p: '仓库视图包含收货和拣货所需的一切——足以让人无需询问任何人就能正确完成工作。',
      view: '仓库视图（示例）',
      fields: [
        { label: '物品', value: '清洁剂 5 升 · SKU-7731' },
        { label: '库位', value: 'A-03-2' },
        { label: '批次', value: 'LOT-B2410' },
        { label: '有效期', value: '2027-06-30' },
        { label: '收货', value: '已收 80 / 100 · 待收 20' },
        { label: '拣货', value: '按 FEFO 顺序' },
      ],
      caption: '此视图中的每个字段都是业务操作信息——没有留空或隐藏的字段',
    },
    compare: {
      sees: '仓库可见',
      seesItems: ['物品与数量', '批次与有效期', '库位', '收货与拣货状态'],
      not: '仓库不可见',
      notItems: ['销售价', '成本 / 采购价', '毛利', '付款金额', '供应商财务条款'],
    },
    why: {
      title: '为什么要分开',
      p: '原因不是为了保密而保密。以下三点适用于每个部门。',
      reasons: [
        {
          title: '工作更清楚',
          body: '界面上越只保留所需内容，人们越能专注于数量、批次和有效期的准确——这才是仓库真正负责的事。',
        },
        {
          title: '只开放必要的信息',
          body: '商业信息是敏感信息。超出需要看到它的人越少，泄露或被误用的机会就越少。',
        },
        {
          title: '职责分离',
          body: '清点和收货的人不应同时是定价或付款的人。职责分离可以减少冲突，并让检查真正有意义。',
        },
      ],
      note: '这不是不信任仓库人员——只是仓库的工作不需要这些信息。',
    },
    classes: {
      title: '信息如何分开',
      p: 'CORE 把数据分为三类，再决定哪个视图可以接收哪一类——而不是在界面上逐个字段地决定。',
      names: {
        operational: { name: '业务操作', body: '数量、批次、日期、状态——工作所需' },
        commercial: { name: '商业', body: '销售价、成本、毛利、供应商条款' },
        financial: { name: '财务', body: '付款、应付款、会计金额' },
      },
      views: {
        warehouse: '仓库',
        sales: '销售部',
        purchasing: '采购部',
        accounting: '财务会计',
        executive: '管理层',
      },
      caption: '按数据类别授权的示例——实际设置取决于各组织的实施范围',
      receives: '可接收',
      not: '不接收',
    },
    enforce: {
      title: '在界面上隐藏与根本不发送有何不同',
      p1: '如果价格已经传到仓库人员的设备上，再在界面上隐藏，数据仍在设备里——这还不是真正的边界。',
      p2: '真正的边界是服务器在发送之前就决定该视图接收什么。未获准的数据根本不会发出。',
      now: '目前：在演示中，价格根本不在仓库视图的数据里；基础后端也仅从业务操作类数据的允许清单构建仓库数据，已用示例数据测试。针对真实用户的服务器端权限执行将在后续后端阶段提供。',
    },
    value: {
      title: '那需要金额的工作怎么办？',
      p: '有些工作同时需要数量和金额——例如库存估值、货物损坏或保险理赔。这些工作并不会消失，只是每个部门在同一项工作上完成自己的部分。',
      items: [
        '仓库记录相关货物的数量、状况和批次',
        '有权查看商业与财务数据的财务会计或高管负责评估金额',
        '两部分都在同一项工作的历史中，因此可以完整追溯',
      ],
      note: '如果您的组织让仓库主管也负责金额，可以在实施范围中设为单独的角色。',
    },
    ask: {
      title: '把同样的原则用于每个部门',
      p: '无论使用什么系统，这四个问题都能帮助设定任何部门的信息边界。',
      items: [
        '这个部门的工作涉及哪些决策？',
        '这些决策真正需要哪些信息？',
        '哪些信息是敏感的，看到的人太多会有风险？',
        '应由谁来看这些信息，他们如何在同一项工作上协作？',
      ],
    },
    links: {
      security: '安全与信任中心',
      department: '仓库部门页面',
      demo: 'CORE 演示中的仓库视图',
    },
    cta: {
      title: '亲自看看仓库视图',
      body: '以仓库角色打开演示，看看有哪些信息——以及没有哪些。',
      primary: '以仓库角色打开演示',
      secondary: '查看安全与信任中心',
    },
  },
};
