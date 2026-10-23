import type { Localized } from '@/i18n/useCopy';

const th = {
  meta: {
    title: 'แผนก — พื้นที่ทำงานตามหน้าที่',
    description:
      'PDA BLISS CORE ออกแบบพื้นที่ทำงานให้เหมาะกับบทบาทของผู้บริหาร ฝ่ายขาย ปฏิบัติการ คลังสินค้า จัดซื้อ และบัญชี โดยเชื่อมทุกกระบวนการไว้บนข้อมูลชุดเดียวกัน',
  },
  hero: {
    eyebrow: 'Department Experience',
    title: 'หนึ่งองค์กร\nหลายหน้าที่\nไม่จำเป็นต้องใช้หน้าจอเดียวกัน',
    lead: 'PDA BLISS CORE ออกแบบพื้นที่ทำงานให้เหมาะกับบทบาทของแต่ละแผนก โดยยังเชื่อมทุกกระบวนการไว้บนข้อมูลชุดเดียวกัน',
    visual: 'หกพื้นที่ทำงานที่แยกตามหน้าที่ เชื่อมกันผ่าน CORE',
  },
  why: {
    eyebrow: 'Why separate workspaces',
    title: 'แต่ละแผนกไม่ได้แค่มีเมนูต่างกัน\nแต่มีวิธีทำงานและความรับผิดชอบต่างกัน',
    oneSystem: 'ระบบเดียว ทุกคนใช้หน้าจอเดียวกัน',
    oneSystemNote: 'ทุกคนค้นหางานของตัวเองจากเมนูรวมของทั้งองค์กร',
    core: 'CORE · พื้นที่ทำงานตามหน้าที่',
    coreNote: 'แต่ละคนเริ่มจากงานของตัวเอง บนข้อมูลชุดเดียวกัน',
    reasons: [
      {
        title: 'หน้าที่ต่างกัน สิ่งที่ต้องรู้ก็ต่างกัน',
        body: 'คลังต้องเห็น Lot และวันหมดอายุ บัญชีต้องเห็นว่าเอกสารครบหรือยัง ผู้บริหารต้องเห็นสิ่งที่ผิดปกติ',
      },
      {
        title: 'ลดความสับสนจากสิ่งที่ไม่เกี่ยวข้อง',
        body: 'เมื่อแต่ละคนเห็นงานของตัวเองก่อน การค้นหา การถาม และการกดผิดเมนูก็ลดลง',
      },
      {
        title: 'แยกประสบการณ์ แต่ไม่แยกข้อมูล',
        body: 'สิ่งที่ฝ่ายขายบันทึก คือสิ่งที่คลัง จัดซื้อ และบัญชีเห็น — ไม่ต้องกรอกซ้ำ ไม่ต้องส่งไฟล์ต่อกัน',
      },
      {
        title: 'สิทธิ์ตามความรับผิดชอบ',
        body: 'ข้อมูลที่ไม่เกี่ยวกับหน้าที่ไม่ถูกส่งไปให้ เช่น คลังสินค้าไม่เห็นราคาและต้นทุน',
      },
    ],
  },
  stage: {
    eyebrow: 'Explore the departments',
    title: 'เลือกแผนก แล้วดูว่าโลกการทำงานของเขาเป็นอย่างไร',
    tabs: 'เลือกแผนก',
    today: 'วันนี้ของแผนกนี้',
    open: (name: string) => `เข้าสู่หน้าของ${name}`,
    prev: 'แผนกก่อนหน้า',
    next: 'แผนกถัดไป',
  },
  index: {
    eyebrow: 'Six workspaces',
    title: 'หกพื้นที่ทำงาน หนึ่ง CORE',
    lead: 'แต่ละแผนกรับงานเข้ามา ทำงานของตัวเอง และส่งต่อให้แผนกถัดไป',
    takesIn: 'รับเข้า',
    handsOn: 'ส่งต่อ',
    open: 'ดูแผนก',
  },
  connected: {
    eyebrow: 'Connected through CORE',
    title: 'งานเดินระหว่างแผนก\nโดยไม่หลุดออกจากข้อมูลชุดเดียว',
    lead: 'ทุกการส่งต่อผ่าน CORE — แผนกถัดไปเห็นงานทันที พร้อมเอกสารที่เกี่ยวข้อง',
    handoffs: [
      { from: 'sales', to: 'operations', what: 'Sales Order ที่ต้องเตรียมหรือผลิต' },
      { from: 'operations', to: 'warehouse', what: 'งานที่เสร็จ พร้อมส่งต่อ' },
      { from: 'purchasing', to: 'warehouse', what: 'PO ที่รอรับสินค้า' },
      { from: 'warehouse', to: 'accounting', what: 'ใบรับสินค้าสำหรับการตรวจก่อนจ่าย' },
      { from: 'purchasing', to: 'accounting', what: 'คำขอจ่ายมัดจำหรือส่วนที่เหลือ' },
      { from: 'all', to: 'executive', what: 'สถานะและข้อยกเว้นจากทุกแผนก' },
    ],
    map: 'แผนผังการส่งต่องานระหว่างแผนก',
  },
  altitude: {
    eyebrow: 'Employee · Manager · Executive',
    title: 'ข้อมูลชุดเดียว\nแต่ละระดับเห็นในมุมที่ต่างกัน',
    lead: 'องค์กรที่โตขึ้นต้องการทั้งงานที่ชัดสำหรับคนทำงาน และภาพรวมที่ชัดสำหรับผู้ตัดสินใจ',
    levels: [
      {
        name: 'พนักงาน',
        sees: 'งานที่ฉันต้องทำ',
        items: ['งานที่ได้รับมอบหมาย', 'ขั้นตอนถัดไป', 'สิ่งที่ต้องส่งต่อ'],
      },
      {
        name: 'หัวหน้าแผนก',
        sees: 'งานของทีม',
        items: ['งานค้างและงานล่าช้า', 'ข้อยกเว้นของแผนก', 'รายการรออนุมัติ'],
      },
      {
        name: 'ผู้บริหาร',
        sees: 'ภาพรวมองค์กร',
        items: ['สุขภาพของแต่ละแผนก', 'จุดที่ต้องจับตา', 'การตัดสินใจที่รออยู่'],
      },
    ],
  },
};

export const OVERVIEW: Localized<typeof th> = {
  th,
  en: {
    meta: {
      title: 'Departments — workspaces shaped by responsibility',
      description:
        'PDA BLISS CORE gives Executives, Sales, Operations, Warehouse, Purchasing and Accounting workspaces designed for their roles, connected on one shared set of data.',
    },
    hero: {
      eyebrow: 'Department Experience',
      title: 'One organization.\nMany roles.\nNo reason to share one screen.',
      lead: 'PDA BLISS CORE designs a workspace around each department’s role, while every process stays connected on one shared set of data.',
      visual: 'Six role-based workspaces, connected through CORE',
    },
    why: {
      eyebrow: 'Why separate workspaces',
      title:
        'Departments don’t just need different menus —\nthey work, decide and answer for different things',
      oneSystem: 'One system, one screen for everyone',
      oneSystemNote: 'Everyone searches the whole organization’s menus for their own work',
      core: 'CORE · workspaces by responsibility',
      coreNote: 'Everyone starts from their own work, on the same data',
      reasons: [
        {
          title: 'Different jobs need different information',
          body: 'The warehouse needs lots and expiry dates, finance needs to know whether documents are complete, executives need what is out of the ordinary.',
        },
        {
          title: 'Less confusion from what doesn’t apply',
          body: 'When people see their own work first, there is less searching, less asking and fewer wrong clicks.',
        },
        {
          title: 'Separate experiences, shared data',
          body: 'What Sales records is what the Warehouse, Purchasing and Accounting see — no re-keying, no files passed around.',
        },
        {
          title: 'Access follows responsibility',
          body: 'Data unrelated to a job is never sent to it — for example, the warehouse never sees prices or costs.',
        },
      ],
    },
    stage: {
      eyebrow: 'Explore the departments',
      title: 'Choose a department and see its world of work',
      tabs: 'Choose a department',
      today: 'Today in this department',
      open: (name) => `Go to ${name}`,
      prev: 'Previous department',
      next: 'Next department',
    },
    index: {
      eyebrow: 'Six workspaces',
      title: 'Six workspaces, one CORE',
      lead: 'Each department takes work in, does its part, and hands it to the next.',
      takesIn: 'Takes in',
      handsOn: 'Hands on',
      open: 'View department',
    },
    connected: {
      eyebrow: 'Connected through CORE',
      title: 'Work moves between departments\nwithout leaving the shared data',
      lead: 'Every handoff goes through CORE — the next department sees the work at once, with its documents.',
      handoffs: [
        { from: 'sales', to: 'operations', what: 'Sales orders to prepare or produce' },
        { from: 'operations', to: 'warehouse', what: 'Finished work, ready to hand on' },
        { from: 'purchasing', to: 'warehouse', what: 'POs awaiting receipt' },
        { from: 'warehouse', to: 'accounting', what: 'Goods receipts to check before payment' },
        { from: 'purchasing', to: 'accounting', what: 'Deposit or balance payment requests' },
        { from: 'all', to: 'executive', what: 'Status and exceptions from every department' },
      ],
      map: 'Map of handoffs between departments',
    },
    altitude: {
      eyebrow: 'Employee · Manager · Executive',
      title: 'One set of data,\nseen from different altitudes',
      lead: 'A growing organization needs clear work for the people doing it — and a clear picture for the people deciding.',
      levels: [
        {
          name: 'Team member',
          sees: 'The work I need to do',
          items: ['Assigned work', 'The next step', 'What to hand on'],
        },
        {
          name: 'Department lead',
          sees: 'The team’s work',
          items: ['Backlog and delays', 'Department exceptions', 'Items awaiting approval'],
        },
        {
          name: 'Executive',
          sees: 'The whole organization',
          items: ['Each department’s health', 'What to watch', 'Decisions waiting'],
        },
      ],
    },
  },
  'zh-CN': {
    meta: {
      title: '部门——按职责设计的工作空间',
      description:
        'PDA BLISS CORE 为管理层、销售、运营、仓库、采购与财务提供按岗位设计的工作空间，并在同一套数据上连接所有流程。',
    },
    hero: {
      eyebrow: 'Department Experience',
      title: '一个组织\n多种职责\n不必共用同一个界面',
      lead: 'PDA BLISS CORE 根据每个部门的角色设计工作空间，同时让所有流程在同一套数据上保持连接。',
      visual: '按职责划分的六个工作空间，通过 CORE 相连',
    },
    why: {
      eyebrow: 'Why separate workspaces',
      title: '各部门的区别不只是菜单不同\n而是工作方式与职责不同',
      oneSystem: '一个系统，所有人共用一个界面',
      oneSystemNote: '每个人都要在全公司的菜单中寻找自己的工作',
      core: 'CORE · 按职责划分的工作空间',
      coreNote: '每个人从自己的工作开始，基于同一套数据',
      reasons: [
        {
          title: '职责不同，需要的信息也不同',
          body: '仓库需要看到批次与保质期，财务需要知道单据是否齐全，管理层需要看到异常情况。',
        },
        {
          title: '减少无关内容带来的困扰',
          body: '每个人先看到自己的工作，搜索、询问和误操作都会减少。',
        },
        {
          title: '体验分开，数据不分开',
          body: '销售部录入的内容，就是仓库、采购与财务看到的内容——无需重复录入，也无需来回传文件。',
        },
        {
          title: '权限跟随职责',
          body: '与岗位无关的数据不会发送过去，例如仓库看不到价格与成本。',
        },
      ],
    },
    stage: {
      eyebrow: 'Explore the departments',
      title: '选择一个部门，看看它的工作世界',
      tabs: '选择部门',
      today: '该部门的今天',
      open: (name) => `进入${name}`,
      prev: '上一个部门',
      next: '下一个部门',
    },
    index: {
      eyebrow: 'Six workspaces',
      title: '六个工作空间，一个 CORE',
      lead: '每个部门接收工作、完成自己的部分，再交给下一个部门。',
      takesIn: '接收',
      handsOn: '交出',
      open: '查看部门',
    },
    connected: {
      eyebrow: 'Connected through CORE',
      title: '工作在部门之间流转\n始终不离开同一套数据',
      lead: '每一次交接都经过 CORE——下一个部门立即看到工作及相关单据。',
      handoffs: [
        { from: 'sales', to: 'operations', what: '需要准备或生产的销售订单' },
        { from: 'operations', to: 'warehouse', what: '已完成、可交接的工作' },
        { from: 'purchasing', to: 'warehouse', what: '待收货的采购单' },
        { from: 'warehouse', to: 'accounting', what: '付款前核对用的收货单' },
        { from: 'purchasing', to: 'accounting', what: '定金或尾款的付款申请' },
        { from: 'all', to: 'executive', what: '来自各部门的状态与例外' },
      ],
      map: '部门之间的工作交接图',
    },
    altitude: {
      eyebrow: 'Employee · Manager · Executive',
      title: '同一套数据\n不同层级看到不同视角',
      lead: '成长中的组织既需要让执行者清楚自己的工作，也需要让决策者看清全局。',
      levels: [
        {
          name: '员工',
          sees: '我需要完成的工作',
          items: ['分配给我的工作', '下一步', '需要交接的内容'],
        },
        { name: '部门主管', sees: '团队的工作', items: ['积压与延迟', '部门例外', '待审批事项'] },
        {
          name: '管理层',
          sees: '整个组织',
          items: ['各部门的健康状况', '需要关注的事项', '待决策事项'],
        },
      ],
    },
  },
};
