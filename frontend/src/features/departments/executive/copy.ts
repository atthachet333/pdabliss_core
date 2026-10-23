import type { Localized } from '@/i18n/useCopy';
import type { ConnectionsCopy, IoCopy, ManagerCopy, TodayCopy } from '../common';

type Health = 'ok' | 'watch' | 'stuck';

const th = {
  meta: {
    title: 'ผู้บริหาร — ศูนย์มองเห็นทั้งองค์กร',
    description:
      'พื้นที่ทำงานผู้บริหารใน PDA BLISS CORE รวมสัญญาณจากทุกแผนก แยกสิ่งที่ต้องจับตา งานที่ติดขัด และรายการรอการตัดสินใจ พร้อมเจาะลึกได้ถึงต้นทาง',
  },
  hero: {
    eyebrow: 'Executive',
    title: 'ไม่ต้องเปิดทุกแผนก\nเพื่อรู้ว่าองค์กรกำลังเกิดอะไรขึ้น',
    lead: 'ทุกแผนกสร้างสัญญาณจากงานจริง CORE รวมสัญญาณเหล่านั้นและคัดสิ่งที่ต้องรู้ขึ้นมา ผู้บริหารจึงเห็นภาพรวมที่ชัด และลงรายละเอียดได้เมื่อจำเป็น',
    surface: 'สิ่งที่ต้องรู้',
    signals: [
      { text: 'PO 2 รายการเลยกำหนดรับ', from: 'จัดซื้อ', tone: 'attention' },
      { text: 'งาน 1 รายการติดรอวัตถุดิบ', from: 'ปฏิบัติการ', tone: 'blocked' },
      { text: 'คำขอจ่าย 3 รายการรออนุมัติ', from: 'บัญชีและการเงิน', tone: 'calm' },
    ],
    visual: 'สัญญาณจากทุกแผนกรวมเข้าสู่พื้นผิวควบคุมของผู้บริหาร',
  },
  visibility: {
    eyebrow: 'Organization-wide visibility',
    title: 'ผู้บริหารควรเห็น “สิ่งที่ต้องรู้”\nไม่ใช่ “ทุกข้อมูลที่มี”',
    steps: [
      {
        title: 'แผนกสร้างสัญญาณ',
        body: 'สถานะเกิดจากงานที่แต่ละแผนกบันทึกอยู่แล้ว ไม่ต้องทำรายงานเพิ่ม',
      },
      { title: 'สัญญาณรวมกันที่ CORE', body: 'ข้อมูลทุกแผนกอยู่บนชุดเดียวกัน ตัวเลขจึงไม่ขัดกัน' },
      {
        title: 'CORE คัดสิ่งที่ผิดปกติ',
        body: 'งานที่ล่าช้า เสี่ยง หรือรอการตัดสินใจ ถูกยกขึ้นมาก่อน',
      },
      { title: 'ผู้บริหารเห็นและตัดสินใจ', body: 'เห็นภาพเดียวกันทั้งองค์กร และสั่งการได้ตรงจุด' },
    ],
  },
  today: {
    title: 'สิ่งที่ต้องจับตา',
    lead: 'หน้าจอแรกของผู้บริหารสรุปสิ่งที่ต้องรู้ในวันนี้ — ไม่ต้องเปิดดูทีละแผนก',
    groups: [
      {
        label: 'ภาพรวมวันนี้',
        count: 5,
        tone: 'calm',
        items: ['ทุกแผนกเปิดงานตามปกติ', 'ส่งมอบตามแผน 4 รายการ'],
      },
      {
        label: 'จุดที่ต้องจับตา',
        count: 2,
        tone: 'attention',
        items: ['Supplier ส่งล่าช้า', 'Lot ใกล้หมดอายุ'],
      },
      { label: 'งานที่ติดขัด', count: 1, tone: 'blocked', items: ['Work Order รอวัตถุดิบ'] },
      {
        label: 'รายการรอการตัดสินใจ',
        count: 3,
        tone: 'calm',
        items: ['คำขอจ่ายเกินวงเงิน', 'อนุมัติ PO ใหม่'],
      },
    ],
  } satisfies TodayCopy,
  pulse: {
    eyebrow: 'Department pulse',
    title: 'สุขภาพของแต่ละแผนก ในภาพเดียว',
    lead: 'สถานะเชิงคุณภาพจากงานจริง — ไม่ใช่ตัวเลขการเงินที่ต้องรวบรวม',
    status: { ok: 'ปกติ', watch: 'ต้องจับตา', stuck: 'ติดขัด' } as Record<Health, string>,
    rows: [
      { dept: 'sales', health: 'ok', signal: 'ออเดอร์เดินตามแผน' },
      { dept: 'operations', health: 'stuck', signal: 'งาน 1 รายการรอวัตถุดิบ' },
      { dept: 'warehouse', health: 'watch', signal: 'มี Lot ใกล้หมดอายุ' },
      { dept: 'purchasing', health: 'watch', signal: 'PO 2 รายการเลยกำหนด' },
      { dept: 'accounting', health: 'ok', signal: 'เอกสารครบตามรอบ' },
    ] as { dept: string; health: Health; signal: string }[],
  },
  exceptions: {
    eyebrow: 'Exception concept',
    title: 'สิ่งที่ปกติ ไม่ต้องรบกวนผู้บริหาร',
    lead: 'งานส่วนใหญ่เดินได้เองตามขั้นตอนที่องค์กรกำหนด CORE ยกขึ้นมาเฉพาะสิ่งที่ล่าช้า เสี่ยง หรือต้องการการตัดสินใจ',
    normal: 'งานที่เดินตามปกติ',
    exception: 'ข้อยกเว้นที่ต้องดู',
  },
  drill: {
    eyebrow: 'Drill-down',
    title: 'จากภาพรวม ลงไปถึงต้นทาง\nในไม่กี่ขั้น',
    lead: 'ทุกสัญญาณย้อนกลับไปถึงแผนก งาน และเอกสารที่เกี่ยวข้องได้',
    tabs: 'เลือกข้อยกเว้น',
    items: [
      {
        label: 'PO เลยกำหนดรับ',
        path: ['ภาพรวมองค์กร', 'จัดซื้อ', 'PO ค้างรับ', 'PO ตัวอย่าง · รับแล้วบางส่วน'],
        action: 'มอบหมายให้จัดซื้อติดตาม Supplier',
      },
      {
        label: 'งานรอวัตถุดิบ',
        path: ['ภาพรวมองค์กร', 'ปฏิบัติการ', 'งานล่าช้า', 'Work Order ตัวอย่าง · รอวัตถุดิบ'],
        action: 'ดูว่ารอ PO ใบไหน และกระทบกำหนดส่งใด',
      },
      {
        label: 'คำขอจ่ายรออนุมัติ',
        path: ['ภาพรวมองค์กร', 'บัญชีและการเงิน', 'รออนุมัติ', 'คำขอจ่ายตัวอย่าง · เอกสารครบ'],
        action: 'ตรวจเอกสารต้นทาง แล้วอนุมัติตามสิทธิ์',
      },
    ],
  },
  manager: {
    title: 'หัวหน้าดูแลทีม ผู้บริหารดูทั้งองค์กร',
    lead: 'ข้อมูลชุดเดียวกัน แต่ความสูงของมุมมองต่างกัน',
    employee: ['งานค้างของทีม', 'ข้อยกเว้นในแผนก', 'รายการรออนุมัติของแผนก'],
    manager: ['สุขภาพของทุกแผนก', 'ความเสี่ยงข้ามแผนก', 'การตัดสินใจที่รออยู่'],
  } satisfies ManagerCopy,
  levels: { a: 'หัวหน้าแผนก', aSub: 'งานของทีม', b: 'ผู้บริหาร', bSub: 'ภาพรวมองค์กร' },
  io: {
    title: 'ผู้บริหารรับสัญญาณ\nและส่งต่อการตัดสินใจ',
    in: ['สถานะจากทุกแผนก', 'ข้อยกเว้นและความเสี่ยง', 'คำขออนุมัติตามวงเงิน'],
    do: ['ดูภาพรวมและจุดที่ต้องจับตา', 'เจาะลึกถึงต้นทาง', 'ตัดสินใจและกำหนดลำดับความสำคัญ'],
    out: ['การอนุมัติ', 'การมอบหมายติดตาม', 'ทิศทางให้แต่ละแผนก'],
  } satisfies IoCopy,
  preview: {
    title: 'หน้าจอผู้บริหารจริงใน CORE',
    lead: 'Business Pulse สถานะรายแผนก และศูนย์ข้อยกเว้น — แสดงด้วยสถานะเชิงคุณภาพ ไม่มีตัวเลขการเงินขององค์กรใด',
  },
  connections: {
    chain: [
      { at: 'sales', what: 'สถานะออเดอร์และความเสี่ยงกำหนดส่ง' },
      { at: 'purchasing', what: 'PO ค้างและ Supplier ล่าช้า' },
      { at: 'executive', what: 'เห็นภาพรวม ตัดสินใจ และอนุมัติ' },
      { at: 'accounting', what: 'การจ่ายที่ได้รับอนุมัติแล้ว' },
    ],
  } satisfies ConnectionsCopy,
};

export const EXECUTIVE: Localized<typeof th> = {
  th,
  en: {
    meta: {
      title: 'Executive — organization-wide visibility',
      description:
        'The Executive workspace in PDA BLISS CORE gathers signals from every department and surfaces what to watch, what is stuck and what awaits a decision — with drill-down to the source.',
    },
    hero: {
      eyebrow: 'Executive',
      title: 'Know what’s happening\nwithout opening every department',
      lead: 'Every department produces signals from real work. CORE gathers them and surfaces what matters, so leaders see a clear picture — and go deeper only when needed.',
      surface: 'What you need to know',
      signals: [
        { text: '2 POs past their receipt date', from: 'Purchasing', tone: 'attention' },
        { text: '1 job waiting for materials', from: 'Operations', tone: 'blocked' },
        {
          text: '3 payment requests awaiting approval',
          from: 'Accounting & Finance',
          tone: 'calm',
        },
      ],
      visual: 'Signals from every department converge on the executive command surface',
    },
    visibility: {
      eyebrow: 'Organization-wide visibility',
      title: 'Leaders should see what they need to know —\nnot everything there is',
      steps: [
        {
          title: 'Departments generate signals',
          body: 'Status comes from work already recorded — no extra reporting.',
        },
        {
          title: 'Signals converge in CORE',
          body: 'Every department works on one set of data, so the numbers never conflict.',
        },
        {
          title: 'CORE surfaces the unusual',
          body: 'Late, risky or pending-decision work rises to the top.',
        },
        {
          title: 'Leaders see and decide',
          body: 'One shared picture of the organization, and action exactly where it’s needed.',
        },
      ],
    },
    today: {
      title: 'What to watch',
      lead: 'The first executive screen sums up what matters today — no need to visit each department.',
      groups: [
        {
          label: 'Today at a glance',
          count: 5,
          tone: 'calm',
          items: ['All departments running normally', '4 deliveries on plan'],
        },
        {
          label: 'Things to watch',
          count: 2,
          tone: 'attention',
          items: ['Late supplier', 'Lot near expiry'],
        },
        {
          label: 'Work that is stuck',
          count: 1,
          tone: 'blocked',
          items: ['Work order waiting for materials'],
        },
        {
          label: 'Decisions waiting',
          count: 3,
          tone: 'calm',
          items: ['Payment request above limit', 'New PO approval'],
        },
      ],
    },
    pulse: {
      eyebrow: 'Department pulse',
      title: 'Every department’s health in one view',
      lead: 'Qualitative status from real work — not financial figures that need compiling.',
      status: { ok: 'Normal', watch: 'Watch', stuck: 'Stuck' },
      rows: [
        { dept: 'sales', health: 'ok', signal: 'Orders running to plan' },
        { dept: 'operations', health: 'stuck', signal: '1 job waiting for materials' },
        { dept: 'warehouse', health: 'watch', signal: 'Lots near expiry' },
        { dept: 'purchasing', health: 'watch', signal: '2 POs past due' },
        { dept: 'accounting', health: 'ok', signal: 'Documents complete this cycle' },
      ],
    },
    exceptions: {
      eyebrow: 'Exception concept',
      title: 'What is normal shouldn’t interrupt leaders',
      lead: 'Most work moves on its own through the steps your organization defines. CORE raises only what is late, risky or needs a decision.',
      normal: 'Work running normally',
      exception: 'Exceptions to review',
    },
    drill: {
      eyebrow: 'Drill-down',
      title: 'From the overview to the source\nin a few steps',
      lead: 'Every signal traces back to its department, its work and its documents.',
      tabs: 'Choose an exception',
      items: [
        {
          label: 'PO past receipt date',
          path: [
            'Organization',
            'Purchasing',
            'POs awaiting receipt',
            'Sample PO · partly received',
          ],
          action: 'Ask Purchasing to follow up the supplier',
        },
        {
          label: 'Job waiting for materials',
          path: [
            'Organization',
            'Operations',
            'Delayed work',
            'Sample work order · waiting for materials',
          ],
          action: 'See which PO it waits for and which delivery it affects',
        },
        {
          label: 'Payment awaiting approval',
          path: [
            'Organization',
            'Accounting & Finance',
            'Awaiting approval',
            'Sample request · documents complete',
          ],
          action: 'Check the source documents, then approve within your authority',
        },
      ],
    },
    manager: {
      title: 'Leads run their team; executives see the organization',
      lead: 'The same data, seen from a different altitude.',
      employee: ['The team’s backlog', 'Exceptions in the department', 'Department approvals'],
      manager: ['Every department’s health', 'Cross-department risks', 'Decisions waiting'],
    },
    levels: {
      a: 'Department lead',
      aSub: 'The team’s work',
      b: 'Executive',
      bSub: 'The whole organization',
    },
    io: {
      title: 'Executives take in signals\nand hand on decisions',
      in: ['Status from every department', 'Exceptions and risks', 'Approval requests by limit'],
      do: [
        'Review the overview and what to watch',
        'Drill down to the source',
        'Decide and set priorities',
      ],
      out: ['Approvals', 'Follow-up assignments', 'Direction for each department'],
    },
    preview: {
      title: 'The real Executive screen in CORE',
      lead: 'Business Pulse, department status and the exception center — shown with qualitative states, never any organization’s financial figures.',
    },
    connections: {
      chain: [
        { at: 'sales', what: 'Order status and delivery risk' },
        { at: 'purchasing', what: 'Outstanding POs and late suppliers' },
        { at: 'executive', what: 'Overview, decisions and approvals' },
        { at: 'accounting', what: 'Approved payments' },
      ],
    },
  },
  'zh-CN': {
    meta: {
      title: '管理层——全组织可视',
      description:
        'PDA BLISS CORE 管理层工作空间汇集各部门信号，提炼需要关注的事项、受阻的工作与待决策事项，并可追溯到源头。',
    },
    hero: {
      eyebrow: 'Executive',
      title: '无需打开每个部门\n也能知道\n组织正在发生什么',
      lead: '每个部门都会从真实工作中产生信号。CORE 汇集这些信号并提炼出需要知道的内容，让管理层看清全局，必要时再深入细节。',
      surface: '需要知道的事',
      signals: [
        { text: '2 张采购单已过收货日期', from: '采购部', tone: 'attention' },
        { text: '1 项工作在等待物料', from: '运营部', tone: 'blocked' },
        { text: '3 项付款申请待审批', from: '财务会计', tone: 'calm' },
      ],
      visual: '各部门的信号汇聚到管理层的控制界面',
    },
    visibility: {
      eyebrow: 'Organization-wide visibility',
      title: '管理层应看到“需要知道的事”\n而不是“所有数据”',
      steps: [
        { title: '部门产生信号', body: '状态来自各部门已记录的工作，无需额外编写报告。' },
        { title: '信号汇聚到 CORE', body: '所有部门基于同一套数据，数字不会相互矛盾。' },
        { title: 'CORE 筛出异常', body: '延迟、有风险或待决策的工作被优先提出。' },
        { title: '管理层查看并决策', body: '全组织看到同一幅画面，并能精准下达指示。' },
      ],
    },
    today: {
      title: '需要关注的事项',
      lead: '管理层的首屏汇总今天需要知道的事——无需逐个部门查看。',
      groups: [
        {
          label: '今日概览',
          count: 5,
          tone: 'calm',
          items: ['各部门运转正常', '4 项交付按计划进行'],
        },
        { label: '需要关注', count: 2, tone: 'attention', items: ['供应商延迟交货', '批次临期'] },
        { label: '受阻的工作', count: 1, tone: 'blocked', items: ['工单等待物料'] },
        { label: '待决策事项', count: 3, tone: 'calm', items: ['超额付款申请', '新采购单审批'] },
      ],
    },
    pulse: {
      eyebrow: 'Department pulse',
      title: '各部门的健康状况，一览无余',
      lead: '来自真实工作的定性状态——而不是需要汇总的财务数字。',
      status: { ok: '正常', watch: '需关注', stuck: '受阻' },
      rows: [
        { dept: 'sales', health: 'ok', signal: '订单按计划推进' },
        { dept: 'operations', health: 'stuck', signal: '1 项工作等待物料' },
        { dept: 'warehouse', health: 'watch', signal: '有临期批次' },
        { dept: 'purchasing', health: 'watch', signal: '2 张采购单逾期' },
        { dept: 'accounting', health: 'ok', signal: '本期单据齐全' },
      ],
    },
    exceptions: {
      eyebrow: 'Exception concept',
      title: '正常的事，无需打扰管理层',
      lead: '大多数工作会按企业设定的步骤自行推进。CORE 只提出延迟、有风险或需要决策的事项。',
      normal: '正常推进的工作',
      exception: '需要查看的例外',
    },
    drill: {
      eyebrow: 'Drill-down',
      title: '从全局到源头\n只需几步',
      lead: '每一个信号都能追溯到相关的部门、工作与单据。',
      tabs: '选择例外事项',
      items: [
        {
          label: '采购单逾期未收货',
          path: ['全组织', '采购部', '待收货采购单', '示例采购单 · 部分到货'],
          action: '安排采购部跟进供应商',
        },
        {
          label: '工作等待物料',
          path: ['全组织', '运营部', '延迟的工作', '示例工单 · 等待物料'],
          action: '查看它在等哪张采购单，会影响哪个交期',
        },
        {
          label: '付款待审批',
          path: ['全组织', '财务会计', '待审批', '示例申请 · 单据齐全'],
          action: '核对源单据，按权限审批',
        },
      ],
    },
    manager: {
      title: '主管管理团队，管理层看全组织',
      lead: '同一套数据，不同高度的视角。',
      employee: ['团队积压的工作', '部门内的例外', '部门待审批事项'],
      manager: ['各部门的健康状况', '跨部门风险', '待决策事项'],
    },
    levels: { a: '部门主管', aSub: '团队的工作', b: '管理层', bSub: '整个组织' },
    io: {
      title: '管理层接收信号\n并交出决策',
      in: ['各部门的状态', '例外与风险', '按金额提交的审批请求'],
      do: ['查看全局与需关注事项', '深入追溯源头', '决策并设定优先级'],
      out: ['审批', '跟进安排', '给各部门的方向'],
    },
    preview: {
      title: 'CORE 中真实的管理层界面',
      lead: '业务脉搏、部门状态与例外中心——以定性状态呈现，不含任何企业的财务数字。',
    },
    connections: {
      chain: [
        { at: 'sales', what: '订单状态与交期风险' },
        { at: 'purchasing', what: '未结采购单与延迟的供应商' },
        { at: 'executive', what: '查看全局、决策与审批' },
        { at: 'accounting', what: '已获批的付款' },
      ],
    },
  },
};
