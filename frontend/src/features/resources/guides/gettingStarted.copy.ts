import type { Localized } from '@/i18n/useCopy';

const th = {
  what: {
    title: 'CORE คืออะไร',
    p1: 'CORE คือ Department Operations Platform ของ PDA BLISS — ระบบที่ออกแบบจากมุมของแต่ละแผนก แต่ละแผนกมีพื้นที่ทำงานของตัวเอง และทุกขั้นของงานเชื่อมกันด้วยข้อมูลชุดเดียว',
    p2: 'คำถามที่ CORE พยายามตอบไม่ใช่ “ระบบมีเมนูอะไรบ้าง” แต่เป็น “งานชิ้นนี้อยู่ที่ใคร ต้องทำอะไรต่อ และต้องมีข้อมูลอะไรก่อนส่งต่อ”',
    key: 'ถ้าจำได้ประโยคเดียว: แต่ละคนเห็นงานในมุมของหน้าที่ตัวเอง แต่ทุกคนกำลังมองงานชิ้นเดียวกัน',
  },
  not: {
    title: 'CORE ไม่ใช่อะไร',
    is: 'CORE คือ',
    isItems: [
      'พื้นที่ทำงานของแต่ละแผนก เชื่อมกันด้วยข้อมูลชุดเดียว',
      'ที่ที่งานมีเจ้าของ สถานะ และประวัติ',
      'ระบบที่ช่วยป้องกันและจับความผิดพลาดระหว่างทาง',
      'สิ่งที่วางให้ตรงกับ Process ขององค์กร ร่วมกับทีม PDA BLISS',
    ],
    isNot: 'CORE ไม่ใช่',
    isNotItems: [
      'ระบบบัญชีที่ลงบัญชีหรือคำนวณภาษี',
      'ระบบที่ทำให้ความผิดพลาดหายไปทั้งหมด',
      'เมนูยาวชุดเดียวที่ทุกคนต้องเห็นทุกอย่าง',
      'ซอฟต์แวร์ที่ติดตั้งแล้วใช้ได้ทันทีโดยไม่ต้องดู Process',
    ],
    after:
      'ข้อสุดท้ายสำคัญที่สุด: ระบบที่ดีเริ่มจากการเข้าใจว่างานจริงเดินอย่างไร ก่อนจะตัดสินใจว่าหน้าจอควรเป็นแบบไหน',
  },
  who: {
    title: 'ใครควรเริ่มจากตรงไหน',
    p: 'คนแต่ละบทบาทมีคำถามต่างกัน จึงไม่จำเป็นต้องอ่านทุกอย่างตามลำดับเดียวกัน',
    items: [
      'เจ้าของกิจการหรือผู้บริหาร — เริ่มจากหน้านี้ แล้วอ่าน “ความปลอดภัยและข้อมูล” และ “คู่มือการนำ CORE ไปใช้”',
      'หัวหน้าแผนก — อ่าน “งานหนึ่งชิ้น จากต้นจนจบใน CORE” แล้วดูหน้าแผนกของคุณ',
      'คนทำงานประจำวัน — ลองใน Demo ด้วยบทบาทของคุณ แล้วอ่านอภิธานศัพท์',
      'คนที่กำลังประเมินระบบ — อ่านคู่มือการนำไปใช้ และรายการสิ่งที่ควรเตรียม',
    ],
  },
  departments: {
    title: 'แต่ละแผนกต่างกันอย่างไร',
    p: 'งานชิ้นเดียวกันถูกมองต่างกันในแต่ละแผนก CORE จึงไม่ให้ทุกแผนกใช้หน้าจอเดียวกัน — แต่ละแผนกเห็นสิ่งที่งานของตัวเองต้องใช้',
    open: 'เปิดหน้าแผนก',
  },
  workflow: {
    title: 'Workflow คืออะไร',
    p1: 'Workflow คือลำดับขั้นของงาน — ใครทำอะไร ต่อจากใคร ต้องมีข้อมูลอะไร และต้องผ่านการอนุมัติใด ไม่ใช่แผนผังบนกระดาษ แต่เป็นสิ่งที่ระบบใช้ตัดสินว่างานเดินต่อได้หรือยัง',
    p2: 'หลายองค์กรมี Workflow อยู่แล้ว เพียงแต่อยู่ในหัวคน ในกลุ่มแชท และในสเปรดชีต สิ่งที่ CORE ทำคือทำให้ลำดับนั้นมองเห็นได้และตรวจได้',
    flow: [
      { label: 'งานเข้า', note: 'คำสั่งซื้อ SO-1042' },
      { label: 'มีเจ้าของ', note: 'ฝ่ายขาย' },
      { label: 'มีสถานะ', note: 'ตรวจ Stock' },
      { label: 'ส่งต่อ', note: 'ไปยังจัดซื้อพร้อมข้อมูล' },
      { label: 'เจ้าของถัดไป', note: 'จัดซื้อเปิด PO' },
    ],
    caption: 'งานหนึ่งชิ้นเดินผ่านเจ้าของทีละคน โดยมีสถานะที่ทุกแผนกเห็นร่วมกัน',
    example:
      'ลูกค้าสั่ง 120 ชิ้น แต่มีในคลัง 20 ชิ้น ฝ่ายขายไม่ต้องโทรถามจัดซื้อ — งานถูกส่งต่อพร้อมจำนวนที่ขาด 100 ชิ้น จัดซื้อเห็นทันทีว่าต้องทำอะไร และฝ่ายขายเห็นว่างานอยู่ที่ใคร',
  },
  demo: {
    title: 'ลองใน CORE Demo อย่างไร',
    steps: [
      'เปิด Demo แล้วเลือกบทบาทที่ใกล้กับงานของคุณ',
      'ทำตามขั้นที่แนะนำ — งานจะส่งต่อไปยังแผนกถัดไปเอง',
      'สลับบทบาทระหว่างทาง ดูว่าแต่ละแผนกเห็นงานชิ้นเดียวกันต่างกันอย่างไร',
      'เปิดประวัติงานตอนจบ แล้วดูว่าทุกขั้นถูกบันทึกอย่างไร',
    ],
    note: 'Demo ใช้ข้อมูลจำลองทั้งหมด ไม่ต้องสมัคร และไม่มีการบันทึกใด ๆ',
  },
  next: {
    title: 'ขั้นต่อไป',
    p: 'หลังอ่านจบ ขั้นต่อไปขึ้นกับว่าคุณอยู่ตรงไหน:',
    items: [
      'อยากเห็นกลไกทีละขั้น — อ่าน “งานหนึ่งชิ้น จากต้นจนจบใน CORE”',
      'อยากรู้ขอบเขตงานและแพ็กเกจ — ดูหน้าแพ็กเกจ',
      'อยากรู้ว่าเราสร้าง CORE เพราะอะไร — อ่าน “ทำไมเราถึงสร้าง CORE”',
      'อยากคุยเรื่ององค์กรของคุณ — ขอคำปรึกษากับทีม PDA BLISS',
    ],
  },
  links: { demo: 'ลองใน CORE Demo', pricing: 'ดูแพ็กเกจ', why: 'ทำไมเราถึงสร้าง CORE' },
  cta: {
    title: 'อยากคุยว่าองค์กรของคุณควรเริ่มตรงไหน?',
    body: 'เล่าว่างานติดอยู่ตรงไหน แล้วค่อยดูกันว่าระบบควรช่วยส่วนใดก่อน',
    primary: 'ขอคำปรึกษา',
    secondary: 'ดูแพ็กเกจ',
  },
};

export const GETTING_STARTED: Localized<typeof th> = {
  th,
  en: {
    what: {
      title: 'What CORE is',
      p1: 'CORE is PDA BLISS’s Department Operations Platform — a system designed from each department’s point of view. Every department has its own workspace, and every step of the work is connected through one shared set of data.',
      p2: 'The question CORE tries to answer is not “what menus does the system have?” but “who has this piece of work, what happens next, and what information must be there before it moves on?”',
      key: 'If you remember one sentence: everyone sees the work from their own responsibility, yet everyone is looking at the same piece of work.',
    },
    not: {
      title: 'What CORE is not',
      is: 'CORE is',
      isItems: [
        'A workspace for each department, connected by one set of data',
        'A place where work has an owner, a state and a history',
        'A system that helps prevent and catch mistakes along the way',
        'Set up to fit the organization’s process, together with the PDA BLISS team',
      ],
      isNot: 'CORE is not',
      isNotItems: [
        'An accounting system that posts entries or calculates tax',
        'A system that makes every mistake disappear',
        'One long menu where everyone sees everything',
        'Software you install and use without looking at the process',
      ],
      after:
        'The last point matters most: a good system starts from understanding how the real work runs, before deciding what the screens should look like.',
    },
    who: {
      title: 'Who should start where',
      p: 'Each role asks different questions, so nobody has to read everything in the same order.',
      items: [
        'Owners and executives — start here, then read “Security and data” and the implementation guide',
        'Department leads — read “One work item, start to finish”, then your department page',
        'Day-to-day staff — try the demo in your role, then read the glossary',
        'People evaluating the system — read the implementation guide and its preparation checklist',
      ],
    },
    departments: {
      title: 'How departments differ',
      p: 'The same piece of work looks different in each department, so CORE does not give every department the same screen — each sees what its own work needs.',
      open: 'Open the department page',
    },
    workflow: {
      title: 'What a workflow is',
      p1: 'A workflow is the sequence of the work: who does what, after whom, with what information, and through which approvals. Not a diagram on paper, but what the system uses to decide whether work can move on.',
      p2: 'Most organizations already have workflows — in people’s heads, chat groups and spreadsheets. What CORE does is make that sequence visible and checkable.',
      flow: [
        { label: 'Work arrives', note: 'Order SO-1042' },
        { label: 'Has an owner', note: 'Sales' },
        { label: 'Has a state', note: 'Checking stock' },
        { label: 'Handed on', note: 'To Purchasing, with the information' },
        { label: 'Next owner', note: 'Purchasing opens a PO' },
      ],
      caption: 'One work item passes from owner to owner, with a state every department shares',
      example:
        'The customer orders 120 units but the warehouse holds 20. Sales does not call Purchasing — the work is handed on with the 100-unit shortage, Purchasing sees immediately what to do, and Sales can see who has the work.',
    },
    demo: {
      title: 'How to use the CORE demo',
      steps: [
        'Open the demo and choose the role closest to your work',
        'Follow the suggested steps — the work hands itself on to the next department',
        'Switch roles along the way to see how each department sees the same work',
        'Open the history at the end and see how every step was recorded',
      ],
      note: 'The demo uses simulated data only. No sign-up, and nothing is recorded.',
    },
    next: {
      title: 'What to do next',
      p: 'After this, the next step depends on where you are:',
      items: [
        'See the mechanism step by step — read “One work item, start to finish in CORE”',
        'Understand scope and packages — see the packages page',
        'Know why we built CORE — read “Why we built CORE”',
        'Talk about your organization — request a consultation with PDA BLISS',
      ],
    },
    links: { demo: 'Try the CORE demo', pricing: 'See packages', why: 'Why we built CORE' },
    cta: {
      title: 'Want to talk about where your organization should start?',
      body: 'Tell us where work gets stuck, then we can see which part a system should help first.',
      primary: 'Request a consultation',
      secondary: 'See packages',
    },
  },
  'zh-CN': {
    what: {
      title: 'CORE 是什么',
      p1: 'CORE 是 PDA BLISS 的部门运营平台——从每个部门的角度设计的系统。每个部门拥有自己的工作空间，工作的每一步都通过同一套数据相连。',
      p2: 'CORE 想回答的不是“系统有哪些菜单”，而是“这项工作在谁手上、下一步做什么、交接前必须有哪些信息”。',
      key: '如果只记住一句话：每个人从自己的职责看工作，但所有人看的是同一项工作。',
    },
    not: {
      title: 'CORE 不是什么',
      is: 'CORE 是',
      isItems: [
        '每个部门的工作空间，由同一套数据相连',
        '工作拥有负责人、状态和历史的地方',
        '帮助在过程中预防和发现差错的系统',
        '与 PDA BLISS 团队一起按组织流程进行设置',
      ],
      isNot: 'CORE 不是',
      isNotItems: [
        '记账或计算税务的会计系统',
        '能让所有差错消失的系统',
        '所有人都看到一切的一长串菜单',
        '不看流程、装好即用的软件',
      ],
      after: '最后一点最重要：好的系统始于理解真实工作如何运转，然后才决定界面应该是什么样子。',
    },
    who: {
      title: '谁应该从哪里开始',
      p: '不同角色的问题不同，因此不必按同一顺序阅读所有内容。',
      items: [
        '企业主或管理层——从本页开始，再阅读“安全与数据”和实施指南',
        '部门负责人——阅读“一项工作在 CORE 中从头到尾”，再看您的部门页面',
        '日常工作人员——以您的角色体验演示，再阅读术语表',
        '正在评估系统的人——阅读实施指南及其准备清单',
      ],
    },
    departments: {
      title: '各部门有何不同',
      p: '同一项工作在不同部门看来各不相同，所以 CORE 不让所有部门使用同一个界面——每个部门看到自己工作所需的内容。',
      open: '打开部门页面',
    },
    workflow: {
      title: '什么是工作流',
      p1: '工作流是工作的步骤顺序：谁做什么、接在谁之后、需要什么信息、经过哪些审批。它不是纸上的图，而是系统用来判断工作能否继续的依据。',
      p2: '大多数组织已经有工作流——在人的脑子里、聊天群和表格里。CORE 所做的是让这个顺序可见、可检查。',
      flow: [
        { label: '工作进入', note: '订单 SO-1042' },
        { label: '有负责人', note: '销售部' },
        { label: '有状态', note: '检查库存' },
        { label: '交接', note: '连同信息交给采购部' },
        { label: '下一位负责人', note: '采购部开立采购单' },
      ],
      caption: '一项工作在负责人之间依次传递，所有部门共享同一个状态',
      example:
        '客户订购 120 件，但仓库只有 20 件。销售部不必打电话问采购部——工作连同 100 件的缺口一起交接，采购部立即知道要做什么，销售部也能看到工作在谁手上。',
    },
    demo: {
      title: '如何使用 CORE 演示',
      steps: [
        '打开演示，选择最接近您工作的角色',
        '按建议的步骤操作——工作会自动交接到下一个部门',
        '中途切换角色，看看各部门如何看待同一项工作',
        '最后打开工作历史，看看每一步是如何被记录的',
      ],
      note: '演示全部使用模拟数据，无需注册，也不会记录任何内容。',
    },
    next: {
      title: '下一步',
      p: '读完之后，下一步取决于您的情况：',
      items: [
        '想逐步了解机制——阅读“一项工作在 CORE 中从头到尾”',
        '想了解范围与方案——查看方案页面',
        '想知道我们为什么打造 CORE——阅读“为什么我们打造 CORE”',
        '想讨论您的组织——向 PDA BLISS 团队申请咨询',
      ],
    },
    links: { demo: '体验 CORE 演示', pricing: '查看方案', why: '为什么我们打造 CORE' },
    cta: {
      title: '想讨论您的组织应从哪里开始吗？',
      body: '告诉我们工作卡在哪里，再看看系统应先帮助哪一部分。',
      primary: '申请咨询',
      secondary: '查看方案',
    },
  },
};
