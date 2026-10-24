import type { Localized } from '@/i18n/useCopy';
import type { IndustryPageCopy } from './types';

interface Signature {
  eyebrow: string;
  title: string;
  lead: string;
  phases: Record<'plan' | 'procure' | 'build' | 'handover', string>;
  milestones: Record<
    'design' | 'materials' | 'install' | 'systems' | 'inspection' | 'acceptance',
    string
  >;
  toggle: string;
  onTrack: string;
  impacted: string;
  summaryCalm: string;
  summaryLate: string;
  waitChain: { title: string; items: readonly string[] };
  phaseMatrix: string;
}

const th: IndustryPageCopy<Signature> = {
  meta: {
    title: 'ธุรกิจโครงการ — เห็นว่า Milestone ไหนกำลังเสี่ยง',
    description:
      'CORE สำหรับธุรกิจโครงการ: เชื่อม Phase จัดซื้อ การดำเนินงาน Milestone การตรวจรับ และงวดเงิน ให้เห็นว่างานไหนรองานไหน และความล่าช้าส่งผลไปถึงไหน',
  },
  hero: {
    eyebrow: 'Project-based business',
    title: 'งานโครงการ\nไม่ได้ช้าทีละจุด\nแต่ช้าต่อกันเป็นทอด',
    lead: 'โครงการหนึ่งมีหลาย Phase หลายทีม และหลายงานที่ต้องรอกัน — เมื่อของชิ้นหนึ่งมาไม่ทัน ทุก Milestone ข้างหลังได้รับผลกระทบ',
    visual:
      'สถาปัตยกรรมของ Milestone: Phase เรียงจากซ้ายไปขวา มีเส้นแสดงงานที่ต้องรอกัน และงานจัดซื้อหนึ่งงานที่ล่าช้า',
  },
  reality: {
    title: 'อะไรทำให้งานโครงการต่างจากธุรกิจอื่น',
    lead: 'แต่ละโครงการไม่เหมือนกัน และกินเวลาหลายสัปดาห์ถึงหลายเดือน',
    points: [
      {
        title: 'งานต้องรอกัน',
        body: 'ติดตั้งไม่ได้ถ้าวัสดุยังไม่มา ตรวจรับไม่ได้ถ้างานระบบยังไม่เสร็จ',
      },
      { title: 'Milestone ผูกกับเงิน', body: 'งวดการจ่ายเงินมักขึ้นกับการตรวจรับ Milestone' },
      {
        title: 'หลายทีมในงานเดียว',
        body: 'ทีมโครงการ จัดซื้อ ผู้รับเหมา และบัญชี ต้องเห็นภาพเดียวกัน',
      },
    ],
  },
  frictions: {
    title: 'งานมักติดตรงนี้',
    items: [
      'งานมีหลาย Phase แต่ไม่มีใครเห็นภาพรวมว่าอยู่ตรงไหน',
      'จัดซื้อเลท แล้วกระทบงานติดตั้งโดยไม่มีใครเตือน',
      'ไม่รู้ว่า Milestone จริง ๆ เสร็จถึงไหน',
      'เอกสารตรวจรับไม่ครบ งวดเงินจึงเลื่อน',
      'งวดการจ่ายเงินขึ้นกับเอกสารที่ไม่มีใครตาม',
      'หลายทีมรอกัน โดยไม่รู้ว่ากำลังรอใคร',
    ],
  },
  departments: {
    title: 'แผนกที่ทำงานร่วมกันตาม Phase',
    roles: {
      operations: 'วางแผน ดำเนินงาน ส่งมอบ Milestone และดูแลงานที่ต้องรอกัน',
      sales: 'รับความต้องการ ดูแลลูกค้า และประสานการตรวจรับ',
      purchasing: 'จัดหาวัสดุและผู้รับเหมาให้ทันตามแผน',
      accounting: 'ดูงวดเงินที่ผูกกับการตรวจรับ',
      executive: 'เห็นโครงการที่ Milestone เสี่ยงและงานที่รอกันนานเกินไป',
    },
  },
  workflow: {
    title: 'จากความต้องการของลูกค้า ถึงปิดโครงการ',
    notes: {
      requirement: 'ขอบเขตและเงื่อนไขของลูกค้า',
      planning: 'แตก Phase และ Milestone',
      procurement: 'วัสดุและผู้รับเหมาที่ต้องใช้',
      execution: 'ทีมดำเนินงานตามแผน',
      milestone: 'ส่งมอบงานแต่ละช่วง',
      acceptance: 'ลูกค้าตรวจรับพร้อมเอกสาร',
      payment: 'งวดเงินตามการตรวจรับ',
      complete: 'ปิดโครงการเมื่อทุกอย่างครบ',
    },
  },
  information: {
    title: 'ข้อมูลที่โครงการต้องมี',
    items: [
      { label: 'Milestone และสถานะจริง', why: 'ไม่ใช่แค่วันในแผน แต่คือเสร็จจริงหรือยัง' },
      { label: 'งานที่ต้องรอ', why: 'อะไรต้องเสร็จก่อน อะไรเริ่มได้' },
      { label: 'สถานะจัดซื้อ', why: 'วัสดุที่ยังไม่มาและงานที่จะได้รับผลกระทบ' },
      { label: 'เอกสารตรวจรับ', why: 'ใช้ปิด Milestone และงวดเงิน' },
      { label: 'การเปลี่ยนแปลงขอบเขต', why: 'ใครอนุมัติ เมื่อไร' },
    ],
  },
  signals: {
    title: 'สิ่งที่ผู้จัดการโครงการต้องเห็น',
    notes: {
      milestoneRisk: 'Milestone ที่งานก่อนหน้ายังไม่พร้อม',
      dependencyDelay: 'วัสดุหรืองานที่ต้องรอ ยังไม่มาตามกำหนด',
      pendingAcceptance: 'งานเสร็จแต่เอกสารตรวจรับยังไม่ครบ',
      waitingApproval: 'การเปลี่ยนขอบเขตหรืองวดเงินที่รออนุมัติ',
    },
  },
  fit: {
    title: 'CORE ช่วยตรงไหนในงานโครงการ',
    lead: 'หลักเดียวกับทุกธุรกิจ แต่ในงานโครงการ หลักเหล่านี้หน้าตาแบบนี้',
  },
  notReplace: {
    title: 'สิ่งที่ CORE ไม่ได้แทน',
    items: ['ซอฟต์แวร์ออกแบบหรือเขียนแบบ', 'ระบบประเมินราคาและถอดปริมาณงานโดยละเอียด'],
  },
  custom: {
    title: 'อาจต้องกำหนดในการวางระบบ',
    items: [
      'โครงสร้าง Phase และ Milestone ของแต่ละประเภทโครงการ',
      'กติกางวดเงินที่ผูกกับการตรวจรับ',
      'การให้ผู้รับเหมาภายนอกเห็นงานของตัวเอง',
    ],
  },
  signature: {
    eyebrow: 'Dependency map',
    title: 'เมื่องานหนึ่งเลท ความล่าช้าไปถึงไหน',
    lead: 'เปิดสถานการณ์ “วัสดุมาไม่ทัน” แล้วดูว่า Milestone ไหนได้รับผลกระทบ และอันไหนยังเดินต่อได้',
    phases: { plan: 'วางแผน', procure: 'จัดหา', build: 'ดำเนินงาน', handover: 'ส่งมอบ' },
    milestones: {
      design: 'แบบอนุมัติแล้ว',
      materials: 'วัสดุเข้าหน้างาน',
      install: 'งานติดตั้ง',
      systems: 'งานระบบ',
      inspection: 'ตรวจงานร่วม',
      acceptance: 'ลูกค้าตรวจรับ',
    },
    toggle: 'จำลอง: วัสดุจาก Supplier มาไม่ทัน',
    onTrack: 'ตามแผน',
    impacted: 'ได้รับผลกระทบ',
    summaryCalm: 'ทุก Milestone ตามแผน',
    summaryLate: 'งานระบบยังเดินต่อได้ แต่ติดตั้ง ตรวจงาน และตรวจรับ ต้องรอวัสดุ',
    waitChain: {
      title: 'ใครกำลังรอใคร',
      items: [
        'ทีมติดตั้ง รอ วัสดุ',
        'วัสดุ รอ Supplier',
        'ตรวจงาน รอ งานติดตั้ง',
        'งวดเงิน รอ ตรวจรับ',
      ],
    },
    phaseMatrix: 'แผนกที่ทำงานในแต่ละ Phase',
  },
};

const en: IndustryPageCopy<Signature> = {
  meta: {
    title: 'Project-based business — see which milestone is at risk',
    description:
      'CORE for project-based businesses: connect phases, procurement, execution, milestones, acceptance and instalments, so you see what waits on what and how far a delay reaches.',
  },
  hero: {
    eyebrow: 'Project-based business',
    title: 'Projects don’t slip\nat one point —\nthey slip in a chain',
    lead: 'A project has many phases, many teams and many tasks waiting on each other. When one delivery is late, every milestone behind it feels it.',
    visual:
      'Milestone architecture: phases run left to right, lines show what waits on what, and one procurement task is late',
  },
  reality: {
    title: 'What makes project work different',
    lead: 'Every project is different, and runs for weeks or months.',
    points: [
      {
        title: 'Work waits on work',
        body: 'No installation until materials arrive; no acceptance until systems are done.',
      },
      {
        title: 'Milestones are tied to money',
        body: 'Instalments usually depend on milestone acceptance.',
      },
      {
        title: 'Many teams, one job',
        body: 'Project, purchasing, subcontractors and accounting need one picture.',
      },
    ],
  },
  frictions: {
    title: 'Where work gets stuck',
    items: [
      'Many phases, and nobody sees where the whole project stands.',
      'Procurement slips and hits installation without warning.',
      'Nobody knows how far a milestone really is.',
      'Acceptance documents are incomplete, so the instalment slides.',
      'Instalments depend on documents nobody is chasing.',
      'Teams wait on each other without knowing whom they’re waiting for.',
    ],
  },
  departments: {
    title: 'Departments working together by phase',
    roles: {
      operations: 'Plans, executes, delivers milestones and manages dependencies.',
      sales: 'Owns requirements, the client and coordinating acceptance.',
      purchasing: 'Secures materials and subcontractors in time for the plan.',
      accounting: 'Follows instalments tied to acceptance.',
      executive: 'Sees projects with milestones at risk and long waits.',
    },
  },
  workflow: {
    title: 'From client requirement to project close',
    notes: {
      requirement: 'The client’s scope and conditions.',
      planning: 'Break into phases and milestones.',
      procurement: 'Materials and subcontractors needed.',
      execution: 'Teams deliver to plan.',
      milestone: 'Hand over each stage.',
      acceptance: 'The client accepts, with documents.',
      payment: 'Instalment follows acceptance.',
      complete: 'Close when everything is complete.',
    },
  },
  information: {
    title: 'Information a project needs',
    items: [
      {
        label: 'Milestones and real status',
        why: 'Not just the planned date — is it actually done?',
      },
      { label: 'Dependencies', why: 'What must finish first, what can start.' },
      { label: 'Procurement status', why: 'Materials not yet in, and the work they affect.' },
      { label: 'Acceptance documents', why: 'To close the milestone and the instalment.' },
      { label: 'Scope changes', why: 'Who approved them, and when.' },
    ],
  },
  signals: {
    title: 'What a project manager needs to see',
    notes: {
      milestoneRisk: 'Milestones whose prerequisites aren’t ready.',
      dependencyDelay: 'Materials or tasks not in on time.',
      pendingAcceptance: 'Work done, acceptance documents incomplete.',
      waitingApproval: 'Scope changes or instalments awaiting approval.',
    },
  },
  fit: {
    title: 'Where CORE fits in project work',
    lead: 'The same principles as every business — this is how they look in projects.',
  },
  notReplace: {
    title: 'What CORE does not replace',
    items: ['Design or drafting software', 'Detailed estimating and quantity take-off tools'],
  },
  custom: {
    title: 'May be defined during implementation',
    items: [
      'Phase and milestone structures per project type',
      'Instalment rules tied to acceptance',
      'Letting external subcontractors see their own work',
    ],
  },
  signature: {
    eyebrow: 'Dependency map',
    title: 'When one task is late, how far does it reach?',
    lead: 'Switch on “materials arrive late” and see which milestones are affected — and which can keep going.',
    phases: { plan: 'Plan', procure: 'Procure', build: 'Build', handover: 'Hand over' },
    milestones: {
      design: 'Design approved',
      materials: 'Materials on site',
      install: 'Installation',
      systems: 'Systems work',
      inspection: 'Joint inspection',
      acceptance: 'Client acceptance',
    },
    toggle: 'Simulate: supplier materials arrive late',
    onTrack: 'On track',
    impacted: 'Affected',
    summaryCalm: 'Every milestone is on track',
    summaryLate:
      'Systems work can continue; installation, inspection and acceptance wait for materials',
    waitChain: {
      title: 'Who is waiting for whom',
      items: [
        'Installation team waits for materials',
        'Materials wait for the supplier',
        'Inspection waits for installation',
        'Instalment waits for acceptance',
      ],
    },
    phaseMatrix: 'Departments active in each phase',
  },
};

const zh: IndustryPageCopy<Signature> = {
  meta: {
    title: '项目型业务——看清哪个里程碑有风险',
    description:
      '面向项目型业务的 CORE：连接阶段、采购、实施、里程碑、验收与分期款，看清哪些工作在相互等待，以及延误会波及多远。',
  },
  hero: {
    eyebrow: 'Project-based business',
    title: '项目不是在一处延误\n而是一环扣一环地延误',
    lead: '一个项目有多个阶段、多个团队和许多相互等待的工作——一批货没到，后面的每个里程碑都会受影响。',
    visual: '里程碑结构：阶段从左到右排列，连线表示相互等待的工作，其中一项采购延迟',
  },
  reality: {
    title: '项目工作有何不同',
    lead: '每个项目都不一样，周期长达数周到数月。',
    points: [
      { title: '工作相互依赖', body: '材料没到就不能安装，系统没完成就不能验收。' },
      { title: '里程碑与款项挂钩', body: '分期款通常取决于里程碑验收。' },
      { title: '一项工作，多个团队', body: '项目、采购、分包商与财务需要看到同一幅全景。' },
    ],
  },
  frictions: {
    title: '工作常卡在这里',
    items: [
      '项目有多个阶段，却没人看到整体进展到哪里。',
      '采购延迟，在没有预警的情况下影响安装。',
      '不知道里程碑实际完成到哪一步。',
      '验收文件不全，分期款随之推迟。',
      '分期款取决于无人跟进的文件。',
      '多个团队相互等待，却不知道在等谁。',
    ],
  },
  departments: {
    title: '按阶段协作的部门',
    roles: {
      operations: '计划、实施、交付里程碑并管理相互依赖的工作。',
      sales: '负责需求与客户，并协调验收。',
      purchasing: '按计划及时落实材料与分包商。',
      accounting: '跟进与验收挂钩的分期款。',
      executive: '看到里程碑有风险、等待过久的项目。',
    },
  },
  workflow: {
    title: '从客户需求到项目收尾',
    notes: {
      requirement: '客户的范围与条件。',
      planning: '拆分阶段与里程碑。',
      procurement: '所需材料与分包商。',
      execution: '团队按计划实施。',
      milestone: '交付每个阶段。',
      acceptance: '客户凭文件验收。',
      payment: '分期款跟随验收。',
      complete: '一切齐全后收尾。',
    },
  },
  information: {
    title: '项目需要的信息',
    items: [
      { label: '里程碑与实际状态', why: '不只是计划日期，而是是否真的完成。' },
      { label: '依赖关系', why: '什么必须先完成，什么可以开始。' },
      { label: '采购状态', why: '尚未到货的材料及其影响的工作。' },
      { label: '验收文件', why: '用于关闭里程碑与分期款。' },
      { label: '范围变更', why: '谁批准的，何时批准。' },
    ],
  },
  signals: {
    title: '项目经理需要看到的',
    notes: {
      milestoneRisk: '前置工作尚未就绪的里程碑。',
      dependencyDelay: '未按时到位的材料或工作。',
      pendingAcceptance: '工作已完成，验收文件不全。',
      waitingApproval: '等待审批的范围变更或分期款。',
    },
  },
  fit: {
    title: 'CORE 在项目工作中的作用',
    lead: '与所有业务相同的原则——在项目中是这样的。',
  },
  notReplace: {
    title: 'CORE 不替代的',
    items: ['设计或制图软件', '详细的估价与工程量计算工具'],
  },
  custom: {
    title: '可能需要在实施中确定',
    items: ['各类项目的阶段与里程碑结构', '与验收挂钩的分期款规则', '让外部分包商看到自己的工作'],
  },
  signature: {
    eyebrow: 'Dependency map',
    title: '一项工作延误时，影响会波及多远',
    lead: '打开“材料未按时到货”的情景，看看哪些里程碑受影响，哪些仍可继续。',
    phases: { plan: '计划', procure: '采购', build: '实施', handover: '交付' },
    milestones: {
      design: '设计已批准',
      materials: '材料到场',
      install: '安装',
      systems: '系统工程',
      inspection: '联合检查',
      acceptance: '客户验收',
    },
    toggle: '模拟：供应商材料未按时到货',
    onTrack: '按计划',
    impacted: '受影响',
    summaryCalm: '所有里程碑均按计划进行',
    summaryLate: '系统工程可以继续；安装、检查与验收需要等待材料',
    waitChain: {
      title: '谁在等谁',
      items: ['安装团队在等材料', '材料在等供应商', '检查在等安装', '分期款在等验收'],
    },
    phaseMatrix: '各阶段参与的部门',
  },
};

export const PROJECTS: Localized<IndustryPageCopy<Signature>> = { th, en, 'zh-CN': zh };
