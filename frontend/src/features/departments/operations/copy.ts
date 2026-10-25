import type { Localized } from '@/i18n/useCopy';
import type { ConnectionsCopy, IoCopy, ManagerCopy, TodayCopy } from '../common';

const th = {
  meta: {
    title: 'ปฏิบัติการ — วางแผน ติดตาม และส่งต่องานอย่างเป็นขั้นตอน',
    description:
      'พื้นที่ทำงานฝ่ายปฏิบัติการใน PDA BLISS CORE รับงานเข้า วางแผน มอบหมาย ติดตามความคืบหน้าและงานล่าช้า แล้วส่งต่อให้แผนกถัดไป ใช้ได้ทั้งงานผลิต งานบริการ และงานเตรียมสินค้า',
  },
  hero: {
    eyebrow: 'Operations',
    title: 'เห็นงานที่ต้องทำ ลำดับความสำคัญ\nความคืบหน้า และจุดที่กำลังติดขัด',
    lead: 'ไม่ว่าจะเป็นงานผลิต งานบริการ งานติดตั้ง หรืองานเตรียมสินค้า ฝ่ายปฏิบัติการต้องรู้ว่าวันนี้ใครทำอะไร งานไหนเดินตามแผน และงานไหนกำลังรอ',
    lanes: ['ทีมเตรียมสินค้า', 'ทีมบริการ', 'ทีมติดตั้ง', 'ทีมตรวจสอบ'],
    days: ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'],
    late: 'ล่าช้า',
    handoff: 'ส่งต่อคลัง',
    now: 'ตอนนี้',
    visual: 'สายงานของแต่ละทีมบนเส้นเวลา พร้อมงานล่าช้าและการส่งต่อ',
  },
  intake: {
    eyebrow: 'Work intake',
    title: 'งานเข้ามาจากหลายทาง\nแต่ไปรวมอยู่ในคิวเดียว',
    lead: 'ฝ่ายปฏิบัติการไม่ต้องรับงานจากแชตหรือกระดาษ ทุกงานเข้ามาพร้อมที่มาและข้อมูลที่ต้องใช้',
    sources: [
      { name: 'Sales Order', note: 'สินค้าหรือบริการที่ต้องเตรียมให้ลูกค้า' },
      { name: 'งานภายใน', note: 'งานเตรียมสต็อกหรือบำรุงรักษา' },
      { name: 'คำขอบริการ', note: 'งานติดตั้ง ซ่อม หรือบริการตามนัด' },
    ],
    queue: 'คิวงานของปฏิบัติการ',
    queueItems: [
      'งานจาก Sales Order · กำหนดพฤหัสบดี',
      'งานติดตั้ง · นัดวันศุกร์',
      'เตรียมสต็อก · ไม่เร่งด่วน',
    ],
  },
  planning: {
    eyebrow: 'Planning & assignment',
    title: 'ใคร ทำอะไร เมื่อไร',
    lead: 'วางงานลงบนทีมและวัน เห็นภาระงานล่วงหน้า ก่อนที่งานจะชนกัน',
    team: 'ทีม',
    teams: ['ทีม A', 'ทีม B', 'ทีม C'],
    days: ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'],
    blocks: ['เตรียมสินค้า', 'ติดตั้ง', 'ตรวจสอบ', 'บริการ'],
    full: 'งานเต็ม',
  },
  workOrder: {
    eyebrow: 'Work Order',
    title: 'Work Order หนึ่งใบ\nบอกทุกอย่างที่ทีมต้องรู้',
    lead: 'ที่มาของงาน ขั้นตอน สิ่งที่ต้องใช้ ผู้รับผิดชอบ และกำหนดเสร็จ — อยู่ในที่เดียว',
    sample: 'Work Order ตัวอย่าง',
    fields: [
      { label: 'ที่มา', value: 'Sales Order ตัวอย่าง' },
      { label: 'ผู้รับผิดชอบ', value: 'ทีม A' },
      { label: 'กำหนดเสร็จ', value: 'พฤหัสบดี' },
    ],
    stepsLabel: 'ขั้นตอน',
    steps: [
      { name: 'รับงานและตรวจรายละเอียด', done: true },
      { name: 'เบิกวัสดุที่ต้องใช้', done: true },
      { name: 'ดำเนินงาน', done: false },
      { name: 'ตรวจสอบคุณภาพ', done: false },
      { name: 'ส่งต่อคลังสินค้า', done: false },
    ],
    materials: 'สิ่งที่ต้องใช้',
    materialItems: [
      { name: 'วัสดุ A', state: 'พร้อม', ok: true },
      { name: 'วัสดุ B', state: 'รอรับจาก PO', ok: false },
    ],
  },
  progress: {
    eyebrow: 'Progress & delays',
    title: 'เห็นความคืบหน้าจริง\nและรู้ว่างานที่ช้า ช้าเพราะอะไร',
    lead: 'งานที่เสร็จบางส่วนบันทึกได้ งานที่ล่าช้าบอกสาเหตุ และเชื่อมไปถึงต้นทางที่ทำให้รอ',
    items: [
      { name: 'งานเตรียมสินค้า', pct: 100, state: 'เสร็จแล้ว', tone: 'done' },
      { name: 'งานติดตั้ง', pct: 60, state: 'เสร็จบางส่วน · ส่งต่อได้ 3 จาก 5', tone: 'calm' },
      { name: 'งานจาก Sales Order', pct: 25, state: 'ล่าช้า · รอวัสดุจาก PO', tone: 'blocked' },
    ],
  },
  handoff: {
    eyebrow: 'Handoff',
    title: 'งานที่เสร็จ ส่งต่ออย่างมีหลักฐาน',
    lead: 'เมื่อปฏิบัติการปิดงาน คลังเห็นงานที่ต้องรับทันที พร้อมจำนวนที่ส่งต่อ — ไม่ต้องโทรบอก',
    from: 'ปฏิบัติการ',
    to: 'คลังสินค้า',
    checks: ['งานผ่านการตรวจสอบ', 'ระบุจำนวนที่ส่งต่อ', 'คลังรับทราบและรับเข้า'],
  },
  today: {
    title: 'วันนี้ฝ่ายปฏิบัติการเห็นอะไร',
    lead: 'งานเข้าใหม่ งานที่กำลังทำ และงานที่ต้องเร่งแก้ — ในหน้าจอเดียว',
    groups: [
      { label: 'งานใหม่', count: 3, tone: 'calm', items: ['รอวางแผน', 'รอมอบหมายทีม'] },
      { label: 'กำลังทำ', count: 5, tone: 'done', items: ['ตามแผน 4 งาน', 'เสร็จบางส่วน 1 งาน'] },
      { label: 'ล่าช้า', count: 1, tone: 'blocked', items: ['รอวัสดุจาก PO'] },
    ],
  } satisfies TodayCopy,
  manager: {
    title: 'หัวหน้าเห็นภาระงานของทั้งทีม',
    lead: 'คนทำงานเห็นงานของตัวเอง หัวหน้าเห็นว่าทีมไหนงานล้น และงานไหนเสี่ยงช้า',
    employee: ['งานที่ได้รับมอบหมายวันนี้', 'ขั้นตอนถัดไปของแต่ละงาน', 'งานที่ต้องส่งต่อ'],
    manager: ['ภาระงานของแต่ละทีม', 'งานล่าช้าและสาเหตุ', 'งานที่ต้องจัดลำดับใหม่'],
  } satisfies ManagerCopy,
  io: {
    title: 'ปฏิบัติการรับงาน\nทำให้เสร็จ แล้วส่งต่อ',
    in: ['Sales Order ที่ต้องเตรียม', 'งานภายใน', 'คำขอบริการ'],
    do: ['วางแผนและมอบหมาย', 'ติดตามความคืบหน้า', 'แก้ปัญหางานล่าช้า'],
    out: ['งานที่เสร็จให้คลัง', 'ความต้องการวัสดุให้จัดซื้อ', 'สถานะให้ฝ่ายขาย'],
  } satisfies IoCopy,
  preview: {
    title: 'หน้าจอปฏิบัติการจริงใน CORE',
    lead: 'บอร์ดงานตามสถานะ งานล่าช้า และงานที่รอส่งต่อ — ข้อมูลตัวอย่าง',
  },
  connections: {
    chain: [
      { at: 'sales', what: 'ส่ง Sales Order ที่ต้องเตรียม' },
      { at: 'operations', what: 'วางแผน ทำงาน และติดตาม' },
      { at: 'purchasing', what: 'จัดหาวัสดุที่ขาด' },
      { at: 'warehouse', what: 'รับงานที่เสร็จเข้าคลัง' },
    ],
  } satisfies ConnectionsCopy,
};

export const OPERATIONS: Localized<typeof th> = {
  th,
  en: {
    meta: {
      title: 'Operations — plan, track and hand over work step by step',
      description:
        'The Operations workspace in PDA BLISS CORE takes work in, plans and assigns it, tracks progress and delays, then hands it on — for production, service and fulfilment work alike.',
    },
    hero: {
      eyebrow: 'Operations',
      title: 'See the work, its priority,\nits progress and where it’s stuck',
      lead: 'Whether it is production, service, installation or order preparation, Operations needs to know who is doing what today, what is on plan and what is waiting.',
      lanes: ['Preparation team', 'Service team', 'Installation team', 'Inspection team'],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      late: 'Late',
      handoff: 'To warehouse',
      now: 'Now',
      visual: 'Each team’s work streams on a timeline, with a delay and a handoff',
    },
    intake: {
      eyebrow: 'Work intake',
      title: 'Work arrives from many places —\nand lands in one queue',
      lead: 'Operations no longer takes work from chats or paper. Every job arrives with its origin and the information it needs.',
      sources: [
        { name: 'Sales Order', note: 'Goods or services to prepare for a customer' },
        { name: 'Internal work', note: 'Stock preparation or maintenance' },
        { name: 'Service request', note: 'Installation, repair or scheduled service' },
      ],
      queue: 'Operations work queue',
      queueItems: [
        'From a sales order · due Thursday',
        'Installation · booked Friday',
        'Stock preparation · not urgent',
      ],
    },
    planning: {
      eyebrow: 'Planning & assignment',
      title: 'Who does what, and when',
      lead: 'Place work on teams and days and see the load ahead — before jobs collide.',
      team: 'Team',
      teams: ['Team A', 'Team B', 'Team C'],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      blocks: ['Preparation', 'Installation', 'Inspection', 'Service'],
      full: 'Fully booked',
    },
    workOrder: {
      eyebrow: 'Work Order',
      title: 'One work order\ntells the team everything',
      lead: 'Origin, steps, what is needed, who is responsible and when it is due — in one place.',
      sample: 'Sample work order',
      fields: [
        { label: 'Origin', value: 'Sample sales order' },
        { label: 'Owner', value: 'Team A' },
        { label: 'Due', value: 'Thursday' },
      ],
      stepsLabel: 'Steps',
      steps: [
        { name: 'Accept and check details', done: true },
        { name: 'Draw the materials needed', done: true },
        { name: 'Carry out the work', done: false },
        { name: 'Quality check', done: false },
        { name: 'Hand over to the warehouse', done: false },
      ],
      materials: 'What is needed',
      materialItems: [
        { name: 'Material A', state: 'Ready', ok: true },
        { name: 'Material B', state: 'Awaiting PO receipt', ok: false },
      ],
    },
    progress: {
      eyebrow: 'Progress & delays',
      title: 'See real progress —\nand why late work is late',
      lead: 'Partial completion can be recorded, delays carry a reason, and both link back to whatever is holding the work.',
      items: [
        { name: 'Order preparation', pct: 100, state: 'Done', tone: 'done' },
        { name: 'Installation', pct: 60, state: 'Partly done · 3 of 5 handed on', tone: 'calm' },
        {
          name: 'Sales order job',
          pct: 25,
          state: 'Late · waiting for material from a PO',
          tone: 'blocked',
        },
      ],
    },
    handoff: {
      eyebrow: 'Handoff',
      title: 'Finished work is handed on with evidence',
      lead: 'When Operations closes a job, the warehouse sees what to receive at once, with the quantity handed on — no phone call needed.',
      from: 'Operations',
      to: 'Warehouse',
      checks: [
        'Work passed inspection',
        'Quantity handed on recorded',
        'Warehouse acknowledges and receives',
      ],
    },
    today: {
      title: 'What Operations sees today',
      lead: 'New work, work in progress and work that needs fixing — on one screen.',
      groups: [
        { label: 'New work', count: 3, tone: 'calm', items: ['To plan', 'Team to assign'] },
        { label: 'In progress', count: 5, tone: 'done', items: ['4 on plan', '1 partly done'] },
        { label: 'Delayed', count: 1, tone: 'blocked', items: ['Waiting for material from a PO'] },
      ],
    },
    manager: {
      title: 'The lead sees the whole team’s load',
      lead: 'People see their own work; the lead sees which team is overloaded and which jobs risk running late.',
      employee: ['My assigned work today', 'The next step for each job', 'Work to hand on'],
      manager: ['Each team’s load', 'Delays and their causes', 'Work to re-prioritize'],
    },
    io: {
      title: 'Operations takes work in,\nfinishes it and hands it on',
      in: ['Sales orders to prepare', 'Internal work', 'Service requests'],
      do: ['Plan and assign', 'Track progress', 'Resolve delays'],
      out: ['Finished work to the warehouse', 'Material demand to Purchasing', 'Status to Sales'],
    },
    preview: {
      title: 'The real Operations screen in CORE',
      lead: 'A work board by status, delayed work and work waiting for handoff — sample data.',
    },
    connections: {
      chain: [
        { at: 'sales', what: 'Sends sales orders to prepare' },
        { at: 'operations', what: 'Plans, works and tracks' },
        { at: 'purchasing', what: 'Sources missing materials' },
        { at: 'warehouse', what: 'Receives finished work' },
      ],
    },
  },
  'zh-CN': {
    meta: {
      title: '运营部——按步骤计划、跟踪与交接工作',
      description:
        'PDA BLISS CORE 运营工作空间接收工作、计划与分配、跟踪进度与延迟并交接给下一个部门，适用于生产、服务与备货等各类工作。',
    },
    hero: {
      eyebrow: 'Operations',
      title: '看清要做的工作\n优先级与进度\n以及受阻的环节',
      lead: '无论是生产、服务、安装还是备货，运营部都需要知道今天谁在做什么、哪些按计划进行、哪些在等待。',
      lanes: ['备货组', '服务组', '安装组', '检验组'],
      days: ['周一', '周二', '周三', '周四', '周五'],
      late: '延迟',
      handoff: '交接仓库',
      now: '现在',
      visual: '各团队的工作流排布在时间轴上，包含一项延迟和一次交接',
    },
    intake: {
      eyebrow: 'Work intake',
      title: '工作来自多个渠道\n却汇入同一个队列',
      lead: '运营部不再从聊天或纸张接收工作。每项工作都附带来源与所需信息。',
      sources: [
        { name: '销售订单', note: '需要为客户准备的商品或服务' },
        { name: '内部工作', note: '备库存或维护' },
        { name: '服务请求', note: '安装、维修或预约服务' },
      ],
      queue: '运营部工作队列',
      queueItems: ['来自销售订单 · 周四到期', '安装 · 已约周五', '备库存 · 不紧急'],
    },
    planning: {
      eyebrow: 'Planning & assignment',
      title: '谁、在何时、做什么',
      lead: '把工作排到团队与日期上，提前看到负荷——避免工作冲突。',
      team: '团队',
      teams: ['A 组', 'B 组', 'C 组'],
      days: ['周一', '周二', '周三', '周四', '周五'],
      blocks: ['备货', '安装', '检验', '服务'],
      full: '已排满',
    },
    workOrder: {
      eyebrow: 'Work Order',
      title: '一张工单\n告诉团队需要知道的一切',
      lead: '来源、步骤、所需物料、负责人与完成时间——都在一处。',
      sample: '示例工单',
      fields: [
        { label: '来源', value: '示例销售订单' },
        { label: '负责人', value: 'A 组' },
        { label: '完成时间', value: '周四' },
      ],
      stepsLabel: '步骤',
      steps: [
        { name: '接收并核对细节', done: true },
        { name: '领取所需物料', done: true },
        { name: '执行工作', done: false },
        { name: '质量检验', done: false },
        { name: '交接仓库', done: false },
      ],
      materials: '所需物料',
      materialItems: [
        { name: '物料 A', state: '已就绪', ok: true },
        { name: '物料 B', state: '等待采购单到货', ok: false },
      ],
    },
    progress: {
      eyebrow: 'Progress & delays',
      title: '看到真实进度\n并知道延迟的原因',
      lead: '可记录部分完成，延迟会注明原因，并关联到造成等待的源头。',
      items: [
        { name: '备货工作', pct: 100, state: '已完成', tone: 'done' },
        { name: '安装工作', pct: 60, state: '部分完成 · 已交接 5 件中的 3 件', tone: 'calm' },
        { name: '销售订单工作', pct: 25, state: '延迟 · 等待采购单物料', tone: 'blocked' },
      ],
    },
    handoff: {
      eyebrow: 'Handoff',
      title: '完成的工作，有据可查地交接',
      lead: '运营部关闭工作后，仓库立即看到要接收的内容及交接数量——无需电话通知。',
      from: '运营部',
      to: '仓库',
      checks: ['工作已通过检验', '已记录交接数量', '仓库确认并入库'],
    },
    today: {
      title: '运营部今天看到什么',
      lead: '新工作、进行中的工作与需要处理的工作——都在一个界面。',
      groups: [
        { label: '新工作', count: 3, tone: 'calm', items: ['待计划', '待分配团队'] },
        { label: '进行中', count: 5, tone: 'done', items: ['4 项按计划', '1 项部分完成'] },
        { label: '延迟', count: 1, tone: 'blocked', items: ['等待采购单物料'] },
      ],
    },
    manager: {
      title: '主管看到整个团队的负荷',
      lead: '员工看到自己的工作，主管看到哪个团队超负荷、哪些工作有延迟风险。',
      employee: ['今天分配给我的工作', '每项工作的下一步', '需要交接的工作'],
      manager: ['各团队的负荷', '延迟及其原因', '需要重新排序的工作'],
    },
    io: {
      title: '运营部接收工作\n完成后交接出去',
      in: ['需要准备的销售订单', '内部工作', '服务请求'],
      do: ['计划与分配', '跟踪进度', '处理延迟'],
      out: ['交给仓库的完成品', '交给采购部的物料需求', '交给销售部的状态'],
    },
    preview: {
      title: 'CORE 中真实的运营界面',
      lead: '按状态排列的工作看板、延迟的工作与待交接的工作——示例数据。',
    },
    connections: {
      chain: [
        { at: 'sales', what: '发送需要准备的销售订单' },
        { at: 'operations', what: '计划、执行与跟踪' },
        { at: 'purchasing', what: '采购缺少的物料' },
        { at: 'warehouse', what: '接收完成的工作入库' },
      ],
    },
  },
};
