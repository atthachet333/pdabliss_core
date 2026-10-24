import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

interface Signature {
  eyebrow: string;
  title: string;
  lead: string;
  wo: string;
  product: string;
  planned: string;
  done: string;
  remaining: string;
  materialsTitle: string;
  materials: Record<'m1' | 'm2' | 'm3', string>;
  required: string;
  available: string;
  short: string;
  enough: string;
  buildable: string;
  receive: string;
  received: string;
  outputLot: string;
  partialNote: string;
  lanes: Record<'material' | 'workOrder' | 'operations' | 'output', string>;
  unit: string;
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'การผลิต — Work Order ที่วัตถุดิบมาทันและส่งต่อได้ครบ',
    description:
      'CORE สำหรับธุรกิจการผลิต: เชื่อม Work Order วัตถุดิบ จัดซื้อ การรับของ การผลิตบางส่วน Lot และการส่งผลผลิตเข้าคลัง — Workflow การปฏิบัติงานรอบการผลิต ไม่ใช่ MRP หรือ MES เต็มรูปแบบ',
  },
  hero: {
    eyebrow: 'Manufacturing',
    title: 'Work Order หนึ่งใบ\nต้องรอวัตถุดิบหลายตัว\nและส่งต่อให้หลายฝ่าย',
    lead: 'งานผลิตไม่ได้เริ่มที่เครื่องจักร แต่เริ่มที่ความต้องการ วัตถุดิบ และการส่งต่อ — ถ้าวัตถุดิบตัวเดียวไม่มา Work Order ทั้งใบก็เดินไม่ได้',
    visual:
      'เส้นทางการไหลของวัตถุดิบ: วัตถุดิบเข้า Work Order ผ่านการผลิต แล้วออกเป็นผลผลิตเข้าคลัง มีวัตถุดิบหนึ่งตัวที่ยังขาด',
  },
  reality: {
    title: 'อะไรทำให้งานผลิตต่างจากธุรกิจอื่น',
    lead: 'ของที่ส่งให้ลูกค้าต้องถูกสร้างขึ้นก่อน จากวัตถุดิบหลายตัวที่ต้องมาพร้อมกัน',
    points: [
      { title: 'วัตถุดิบต้องครบ', body: 'ขาดตัวเดียวก็เริ่มไม่ได้ หรือผลิตได้แค่บางส่วน' },
      { title: 'Lot ต้องตามได้', body: 'ต้องรู้ว่าผลผลิต Lot นี้ใช้วัตถุดิบ Lot ไหน' },
      {
        title: 'การส่งต่อมีหลายจุด',
        body: 'คลังเบิกให้ผลิต ผลิตส่งกลับเข้าคลัง คลังส่งให้ฝ่ายขาย',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'Work Order เปิดแล้ว แต่วัตถุดิบตัวหนึ่งยังไม่เข้า',
      'จัดซื้อไม่รู้ว่าวัตถุดิบที่ขาดกระทบ Work Order ไหน',
      'ผลิตได้บางส่วน แต่ฝ่ายขายยังคิดว่าได้ครบ',
      'ผลผลิตเสร็จแล้ว แต่ยังไม่ถูกรับเข้าคลัง',
      'Lot และวันหมดอายุของวัตถุดิบต้องจดแยก',
      'การส่งต่อระหว่างผลิตกับคลังไม่มีหลักฐาน',
    ],
  },
  departments: {
    title: 'แผนกที่ Work Order หนึ่งใบต้องผ่าน',
    roles: {
      operations: 'วางแผน เปิด Work Order ผลิต และรายงานผลผลิต',
      warehouse: 'เบิกวัตถุดิบ รับวัตถุดิบเข้า รับผลผลิต และดูแล Lot',
      purchasing: 'สั่งวัตถุดิบที่ขาดและตามของค้างรับ',
      sales: 'ส่งความต้องการ และรู้ว่าของพร้อมส่งเมื่อไร',
      executive: 'เห็น Work Order ที่เสี่ยงและวัตถุดิบที่ขาด',
      accounting: 'รับเอกสารการรับวัตถุดิบเมื่อองค์กรต้องการ',
    },
  },
  workflow: {
    title: 'จากความต้องการ ถึงการส่งมอบ',
    notes: {
      demand: 'ฝ่ายขายแจ้งสินค้าและวันที่ต้องการ',
      availability: 'มีสินค้าพร้อมขายหรือต้องผลิตเพิ่ม',
      planning: 'กำหนดจำนวนและช่วงเวลาผลิต',
      workOrder: 'Work Order ระบุวัตถุดิบที่ต้องใช้',
      material: 'คลังเบิกวัตถุดิบตาม Work Order',
      purchasing: 'วัตถุดิบที่ขาดถูกส่งต่อให้จัดซื้อ',
      receiving: 'รับเข้าพร้อม Lot และวันหมดอายุ',
      production: 'ผลิตได้ครบหรือบางส่วน',
      output: 'ส่งผลผลิตเข้าคลังพร้อม Lot',
      delivery: 'ฝ่ายขายส่งมอบลูกค้า',
    },
  },
  information: {
    title: 'ข้อมูลที่งานผลิตต้องมี',
    items: [
      { label: 'วัตถุดิบที่ต้องใช้และที่มีจริง', why: 'รู้ก่อนเริ่มว่าผลิตได้เท่าไร' },
      { label: 'ความคืบหน้าของ Work Order', why: 'ผลิตไปแล้วเท่าไร เหลือเท่าไร' },
      { label: 'Lot ของวัตถุดิบและผลผลิต', why: 'ตามย้อนได้เมื่อมีปัญหา' },
      { label: 'วันหมดอายุ', why: 'วัตถุดิบที่ต้องใช้ก่อน' },
      { label: 'การส่งต่อเข้าคลัง', why: 'ผลผลิตถูกรับแล้วหรือยัง' },
    ],
  },
  signals: {
    title: 'สิ่งที่ผู้จัดการฝ่ายผลิตต้องเห็น',
    notes: {
      woDelay: 'Work Order ที่เลยกำหนดหรือเริ่มไม่ได้',
      materialShortage: 'วัตถุดิบที่ไม่พอสำหรับ Work Order ที่เปิดอยู่',
      partialCompletion: 'Work Order ที่ผลิตได้ไม่ครบตามแผน',
      handoffPending: 'ผลผลิตที่เสร็จแล้วแต่คลังยังไม่รับ',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานผลิต',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานผลิต หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: ['ระบบควบคุมเครื่องจักรหรือ PLC', 'ระบบห้องปฏิบัติการและการทดสอบคุณภาพ'],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'สูตรการผลิตและรายการวัตถุดิบของแต่ละสินค้า',
      'กติกาการปล่อยผลิตบางส่วน',
      'การเชื่อมต่อกับระบบวางแผนหรือ ERP ที่มีอยู่',
    ],
  },
  signature: {
    eyebrow: 'Work Order board',
    title: 'Work Order เดียว ดูครบว่าเดินต่อได้แค่ไหน',
    lead: 'วัตถุดิบที่มีพอผลิตได้กี่ชิ้น ผลิตไปแล้วเท่าไร และถ้าวัตถุดิบที่ค้างเข้ามา จะเปลี่ยนอะไร',
    wo: 'WO-0318',
    product: 'ชุดประกอบตัวอย่าง X',
    planned: 'ตามแผน',
    done: 'ผลิตแล้ว',
    remaining: 'เหลือ',
    materialsTitle: 'วัตถุดิบตาม Work Order',
    materials: { m1: 'โครงตัวเรือน', m2: 'ชุดยึด (2 ชิ้นต่อหน่วย)', m3: 'แผงควบคุม' },
    required: 'ต้องใช้',
    available: 'มีอยู่',
    short: 'ขาด',
    enough: 'พอ',
    buildable: 'วัตถุดิบที่มีพอผลิตได้ {n} จาก {total} ชิ้น',
    receive: 'จำลองการรับชุดยึดที่ค้างจากจัดซื้อ',
    received: 'รับแล้ว',
    outputLot: 'ผลผลิตส่งเข้าคลัง · LOT-OUT-2410',
    partialNote: 'ส่งผลผลิตที่เสร็จเข้าคลังได้ก่อน ส่วนที่เหลือรอวัตถุดิบ',
    lanes: {
      material: 'วัตถุดิบ',
      workOrder: 'Work Order',
      operations: 'การผลิต',
      output: 'ผลผลิต',
    },
    unit: 'ชิ้น',
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Manufacturing — Work Orders with materials in time and complete handoffs',
    description:
      'CORE for manufacturing: connect Work Orders, materials, purchasing, receiving, partial completion, lots and handing output to the warehouse — operational workflow around production, not a full MRP or MES.',
  },
  hero: {
    eyebrow: 'Manufacturing',
    title: 'One Work Order\nwaits on many materials\nand hands off to many teams',
    lead: 'Production doesn’t start at the machine. It starts with demand, materials and handoffs — and if one material is missing, the whole Work Order can’t move.',
    visual:
      'Material flow: materials feed a Work Order, pass through production and leave as output into the warehouse, with one material still short',
  },
  reality: {
    title: 'What makes manufacturing different',
    lead: 'What you ship has to be made first, from several materials that must arrive together.',
    points: [
      {
        title: 'Materials must be complete',
        body: 'One missing material stops the start, or allows only a partial run.',
      },
      {
        title: 'Lots must be traceable',
        body: 'Know which material lots went into each output lot.',
      },
      {
        title: 'Many handoffs',
        body: 'The warehouse issues to production, production returns output, the warehouse ships for sales.',
      },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'The Work Order is open but one material hasn’t arrived.',
      'Purchasing doesn’t know which Work Orders a shortage affects.',
      'Only part of the run is done, but sales thinks it’s complete.',
      'Output is finished but not yet received into the warehouse.',
      'Material lots and expiry dates are recorded separately.',
      'Handoffs between production and the warehouse leave no record.',
    ],
  },
  departments: {
    title: 'Departments a single Work Order passes through',
    roles: {
      operations: 'Plans, opens Work Orders, produces and reports output.',
      warehouse: 'Issues materials, receives materials and output, and keeps lots.',
      purchasing: 'Orders missing materials and chases open receipts.',
      sales: 'Sends demand and knows when goods will be ready.',
      executive: 'Sees Work Orders at risk and missing materials.',
      accounting: 'Receives material receipt documents where needed.',
    },
  },
  workflow: {
    title: 'From demand to delivery',
    notes: {
      demand: 'Sales gives the product and required date.',
      availability: 'In stock, or needs producing.',
      planning: 'Set quantity and timing.',
      workOrder: 'The Work Order lists the materials needed.',
      material: 'The warehouse issues materials to the Work Order.',
      purchasing: 'Missing materials go to purchasing.',
      receiving: 'Received with lot and expiry.',
      production: 'Produced in full or in part.',
      output: 'Output goes to the warehouse with its lot.',
      delivery: 'Sales delivers to the customer.',
    },
  },
  information: {
    title: 'Information production needs',
    items: [
      {
        label: 'Materials required vs. available',
        why: 'Know before starting how many you can make.',
      },
      { label: 'Work Order progress', why: 'How many made, how many left.' },
      { label: 'Material and output lots', why: 'Trace back when something goes wrong.' },
      { label: 'Expiry dates', why: 'Materials to use first.' },
      { label: 'Handoff into the warehouse', why: 'Whether output has been received.' },
    ],
  },
  signals: {
    title: 'What a production manager needs to see',
    notes: {
      woDelay: 'Work Orders overdue or unable to start.',
      materialShortage: 'Materials short for open Work Orders.',
      partialCompletion: 'Work Orders produced below plan.',
      handoffPending: 'Finished output the warehouse hasn’t received.',
    },
  },
  fit: {
    title: 'Where CORE fits in manufacturing',
    lead: 'The same principles as every business — this is how they look in production.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: ['Machine control or PLC systems', 'Laboratory and quality-testing systems'],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'Recipes and material lists per product',
      'Rules for partial release',
      'Connection to an existing planning system or ERP',
    ],
  },
  signature: {
    eyebrow: 'Work Order board',
    title: 'One Work Order, and how far it can go',
    lead: 'How many units the materials on hand allow, how many are done, and what changes when the open material arrives.',
    wo: 'WO-0318',
    product: 'Sample assembly X',
    planned: 'Planned',
    done: 'Produced',
    remaining: 'Remaining',
    materialsTitle: 'Materials for this Work Order',
    materials: { m1: 'Housing', m2: 'Fastener set (2 per unit)', m3: 'Control board' },
    required: 'Required',
    available: 'Available',
    short: 'Short',
    enough: 'Enough',
    buildable: 'Materials on hand allow {n} of {total} units',
    receive: 'Simulate receiving the open fastener sets',
    received: 'Received',
    outputLot: 'Output to the warehouse · LOT-OUT-2410',
    partialNote: 'Finished output can go to the warehouse now; the rest waits for materials.',
    lanes: {
      material: 'Materials',
      workOrder: 'Work Order',
      operations: 'Production',
      output: 'Output',
    },
    unit: 'units',
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '制造业——物料及时到位、交接完整的工单',
    description:
      '面向制造业的 CORE：连接工单、物料、采购、收货、部分完工、批次与产出入库——围绕生产的运营工作流，而非完整的 MRP 或 MES。',
  },
  hero: {
    eyebrow: 'Manufacturing',
    title: '一张工单\n要等多种物料\n并交接给多个部门',
    lead: '生产不是从设备开始的，而是从需求、物料与交接开始——只要缺一种物料，整张工单就无法推进。',
    visual: '物料流：物料进入工单，经过生产后作为产出入库，其中一种物料仍短缺',
  },
  reality: {
    title: '制造业有何不同',
    lead: '交付给客户的产品必须先被制造出来，由多种必须同时到位的物料组成。',
    points: [
      { title: '物料必须齐全', body: '缺一种就无法开工，或只能部分生产。' },
      { title: '批次必须可追溯', body: '要知道每个产出批次用了哪些物料批次。' },
      { title: '交接环节多', body: '仓库发料给生产，生产把产出交回仓库，仓库再为销售发货。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '工单已开，但有一种物料还没到。',
      '采购不知道缺料影响哪些工单。',
      '只完成了一部分，销售却以为已全部完成。',
      '产出已完成，却尚未入库。',
      '物料批次与效期需要另外记录。',
      '生产与仓库之间的交接没有记录。',
    ],
  },
  departments: {
    title: '一张工单要经过的部门',
    roles: {
      operations: '计划、开工单、生产并报告产出。',
      warehouse: '发料、物料入库、接收产出并管理批次。',
      purchasing: '采购短缺物料并跟进待收货。',
      sales: '提出需求，并知道何时可以发货。',
      executive: '看到有风险的工单与短缺物料。',
      accounting: '在需要时接收物料收货单据。',
    },
  },
  workflow: {
    title: '从需求到交付',
    notes: {
      demand: '销售提供产品与需求日期。',
      availability: '有现货，还是需要生产。',
      planning: '确定数量与时间。',
      workOrder: '工单列出所需物料。',
      material: '仓库按工单发料。',
      purchasing: '短缺物料转给采购。',
      receiving: '入库时记录批次与效期。',
      production: '全部或部分完成。',
      output: '产出连同批次入库。',
      delivery: '销售交付给客户。',
    },
  },
  information: {
    title: '生产需要的信息',
    items: [
      { label: '所需物料与实际可用量', why: '开工前就知道能生产多少。' },
      { label: '工单进度', why: '已生产多少，还剩多少。' },
      { label: '物料与产出批次', why: '出问题时可以追溯。' },
      { label: '效期', why: '需要优先使用的物料。' },
      { label: '入库交接', why: '产出是否已被接收。' },
    ],
  },
  signals: {
    title: '生产经理需要看到的',
    notes: {
      woDelay: '逾期或无法开工的工单。',
      materialShortage: '对在制工单不足的物料。',
      partialCompletion: '产量低于计划的工单。',
      handoffPending: '已完成但仓库尚未接收的产出。',
    },
  },
  fit: {
    title: 'CORE 在制造中的作用',
    lead: '与所有业务相同的原则——在生产中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['设备控制或 PLC 系统', '实验室与质量检测系统'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['各产品的配方与物料清单', '部分放行的规则', '与现有计划系统或 ERP 的连接'],
  },
  signature: {
    eyebrow: 'Work Order board',
    title: '一张工单，看清能推进多远',
    lead: '现有物料够生产多少件、已经生产多少，以及待收物料到货后会有什么变化。',
    wo: 'WO-0318',
    product: '示例组件 X',
    planned: '计划',
    done: '已生产',
    remaining: '剩余',
    materialsTitle: '本工单的物料',
    materials: { m1: '外壳', m2: '紧固件套装（每件 2 套）', m3: '控制板' },
    required: '需要',
    available: '现有',
    short: '短缺',
    enough: '充足',
    buildable: '现有物料可生产 {n} / {total} 件',
    receive: '模拟收取待到的紧固件套装',
    received: '已收货',
    outputLot: '产出入库 · LOT-OUT-2410',
    partialNote: '已完成的产出可先入库，其余等待物料。',
    lanes: { material: '物料', workOrder: '工单', operations: '生产', output: '产出' },
    unit: '件',
  },
};

export const MANUFACTURING: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };
