import type { DeptKey } from '@/features/departments/catalog';
import type { Localized } from '@/i18n/useCopy';
import type { MatchField } from './search';
import type { ProblemId, ResourceId, Stage, StartPath } from './registry';

/*
 * /resources home words (EP16). Problem names repeat the EP09 navigator
 * labels exactly (a test keeps them identical); chapter names follow EP08.
 */

type Problem = { label: string; cause: string };
type DeptReasons = Partial<Record<ResourceId, string>>;

const th = {
  meta: {
    title: 'คลังความรู้ CORE — เข้าใจระบบ ก่อนตัดสินใจใช้ระบบ',
    description:
      'แนวคิด ตัวอย่าง Workflow หลักการควบคุมงาน และวิธีเตรียมองค์กรก่อนนำ CORE ไปใช้ — คู่มือจริงเจ็ดเรื่อง ค้นหาได้ทันที',
  },
  hero: {
    eyebrow: 'Resource Center · คลังความรู้ CORE',
    title: 'เข้าใจระบบ\nก่อนตัดสินใจใช้ระบบ',
    lead: 'รวมแนวคิด ตัวอย่าง Workflow หลักการควบคุมงาน และวิธีเตรียมองค์กรก่อนนำ CORE ไปใช้',
    line: 'เข้าใจ CORE ให้ลึกขึ้น จากแนวคิด ไปจนถึงการนำไปใช้จริง',
    map: 'แผนที่คู่มือ',
    zones: ['แนวคิด', 'การทำงาน', 'การควบคุม', 'ขอบเขต', 'การนำไปใช้'],
  },
  search: {
    label: 'ค้นหาในคลังความรู้',
    placeholder: 'เช่น Lot, การอนุมัติ, คลังสินค้า',
    clear: 'ล้างคำค้น',
    results: '{n} ผลลัพธ์สำหรับ “{q}”',
    none: 'ไม่พบผลลัพธ์สำหรับ “{q}”',
    tryThese: 'ลองค้นหาคำเหล่านี้',
    suggestions: ['Handoff', 'วันหมดอายุ', 'ขอบเขตข้อมูล', 'การนำไปใช้'],
    term: 'คำศัพท์',
    why: {
      title: 'ตรงกับชื่อคู่มือ',
      tag: 'ตรงกับหัวข้อ “{d}”',
      term: 'มีคำว่า “{d}”',
      category: 'ตรงกับหมวด',
      summary: 'ตรงกับเนื้อหาสรุป',
      definition: 'ตรงกับคำอธิบาย',
    } satisfies Record<MatchField | 'definition', string>,
  },
  start: {
    eyebrow: '02 · Start here',
    title: 'ถ้ายังไม่รู้จะเริ่มตรงไหน',
    lead: 'เลือกคำถามที่ใกล้กับคุณที่สุด แล้วอ่านตามลำดับ — สองถึงสามคู่มือก็พอเห็นภาพ',
    paths: {
      what: { q: 'อยากรู้ว่า CORE คืออะไร', note: 'เริ่มจากภาพรวม แล้วค่อยลงรายละเอียด' },
      problems: { q: 'อยากรู้ว่า CORE แก้ปัญหาอะไร', note: 'เริ่มจากความผิดพลาดและงานที่ติด' },
      evaluate: {
        q: 'กำลังประเมินว่าจะนำ CORE ไปใช้',
        note: 'เริ่มจากการเตรียมองค์กรและขอบเขตข้อมูล',
      },
    } satisfies Record<StartPath, { q: string; note: string }>,
    step: 'ลำดับที่ {n}',
  },
  problems: {
    eyebrow: '03 · Learn by problem',
    title: 'เริ่มจากปัญหาที่เจออยู่',
    lead: 'เลือกปัญหา แล้วดูว่าควรอ่านอะไร ตรงกับส่วนไหนของ Solutions และกลไกใดใน How CORE Works',
    group: 'เลือกปัญหา',
    cause: 'สาเหตุที่พบบ่อย',
    guide: 'คู่มือที่อธิบายกลไก',
    solution: 'ปัญหานี้ในหน้า Solutions',
    workflow: 'กลไกใน How CORE Works',
    items: {
      fallingThrough: { label: 'งานตกหล่น', cause: 'งานเปลี่ยนมือโดยไม่มีเจ้าของและสถานะที่ชัด' },
      statusChasing: { label: 'ต้องถามสถานะ', cause: 'ไม่มีสถานะกลางที่ทุกแผนกเห็นร่วมกัน' },
      humanError: { label: 'Human Error', cause: 'ไม่มีการตรวจระหว่างทาง ความผิดพลาดจึงไหลต่อ' },
      approval: { label: 'Approval ช้า', cause: 'ไม่เห็นว่างานรอใคร และรอมานานแค่ไหน' },
      stock: { label: 'Stock คุมยาก', cause: 'จำนวนไม่ผูกกับตำแหน่ง Lot และวันหมดอายุ' },
      supplier: { label: 'Supplier เลท', cause: 'ไม่ได้ติดตามยอดค้างรับเทียบกับ PO' },
      payment: { label: 'เอกสารไม่ครบ', cause: 'คำขอจ่ายไม่ผูกกับงานและเอกสารต้นทาง' },
      management: {
        label: 'ผู้บริหารเห็นช้า',
        cause: 'สิ่งผิดปกติไม่ถูกยกขึ้นมาระหว่างที่งานยังเดิน',
      },
    } satisfies Record<ProblemId, Problem>,
    chapters: {
      handoff: 'การส่งต่องานระหว่างแผนก',
      responsibility: 'การกำหนดผู้รับผิดชอบ',
      'human-error': 'การป้องกัน Human Error',
      approval: 'การอนุมัติและการควบคุม',
      exceptions: 'ข้อยกเว้น',
      decisions: 'จุดตัดสินใจ',
      roles: 'การมองเห็นตามบทบาท',
      'one-work': 'งานหนึ่งชิ้นผ่านหลายแผนก',
      trace: 'การย้อนรอย',
      adapt: 'ปรับให้เข้ากับองค์กร',
    } as Record<string, string>,
  },
  departments: {
    eyebrow: '04 · Learn by department',
    title: 'อ่านจากมุมของแผนกคุณ',
    lead: 'สิ่งที่ควรอ่านก่อนสำหรับแต่ละแผนก และเหตุผล — รายละเอียดของแผนกอยู่ในหน้าแผนก',
    group: 'เลือกแผนก',
    page: 'ดูหน้าแผนก{name}',
    reasons: {
      sales: {
        howCoreWorks: 'เห็นว่างานที่ส่งต่อไปอยู่ตรงไหน โดยไม่ต้องโทรถามคลังหรือจัดซื้อ',
        gettingStarted: 'เข้าใจว่าพื้นที่ทำงานของฝ่ายขายต่างจากแผนกอื่นอย่างไร',
      },
      operations: {
        howCoreWorks: 'งานส่วนใหญ่ของปฏิบัติการคือการส่งต่อ — ดูว่าการส่งต่อที่ดีต้องมีอะไร',
        humanError: 'จุดที่ความผิดพลาดมักไหลผ่านระหว่างขั้น และวิธีจับไว้ก่อน',
        implementationGuide: 'ปฏิบัติการมักเป็นคนวาด Process จริง — เริ่มจากตรงนี้',
      },
      warehouse: {
        warehousePrivacy: 'ทำไมมุมมองคลังมีเฉพาะสิ่งที่งานรับและจัดต้องใช้',
        humanError: 'Lot วันหมดอายุ จำนวนไม่ตรง PO — สามจุดที่คลังเจอบ่อยที่สุด',
        coreGlossary: 'Lot, Expiry, FEFO — คำที่คลังใช้ทุกวัน ในความหมายเดียวกันทั้งระบบ',
      },
      purchasing: {
        humanError: 'การแจ้งเตือนเมื่อ Supplier เลยกำหนด และการตรวจพบยอดค้างรับ',
        howCoreWorks: 'เมื่อของไม่พอ งานไหลมาที่จัดซื้ออย่างไร และไหลต่อไปที่ไหน',
      },
      accounting: {
        humanError: 'การควบคุมก่อนจ่าย: เอกสารต้องครบก่อนถึงการอนุมัติ',
        warehousePrivacy: 'ทำไมข้อมูลการเงินถูกแยกจากมุมมองที่ไม่ต้องใช้',
        howCoreWorks: 'การอนุมัติเป็นส่วนหนึ่งของงาน ไม่ใช่ขั้นที่แยกออกมา',
      },
      executive: {
        gettingStarted: 'ภาพรวมของ CORE ก่อนตัดสินใจ — คืออะไร และไม่ใช่อะไร',
        securityAndData: 'ใครเห็นอะไร และอะไรที่ยังไม่ควรอ้าง',
        implementationGuide: 'องค์กรต้องเตรียมอะไร และการนำไปใช้เดินอย่างไร',
      },
    } satisfies Record<DeptKey, DeptReasons>,
  },
  stages: {
    eyebrow: '05 · Learn by organization stage',
    title: 'องค์กรของคุณอยู่ช่วงไหน',
    lead: 'แต่ละช่วงมีคำถามต่างกัน — อ่านเฉพาะสิ่งที่ช่วงของคุณต้องใช้',
    items: {
      starting: { name: 'กำลังเริ่มจัดระบบ', focus: 'Workflow พื้นฐานและเจ้าของงาน' },
      multiDepartment: { name: 'เริ่มมีหลายแผนก', focus: 'การส่งต่องาน สถานะ และการอนุมัติ' },
      growing: { name: 'องค์กรกำลังโต', focus: 'สิทธิ์ การควบคุม และการมองเห็นของผู้บริหาร' },
      standardizing: {
        name: 'ต้องการมาตรฐานมากขึ้น',
        focus: 'การนำไปใช้ ความปลอดภัย และความพร้อมในการเชื่อมต่อ',
      },
    } satisfies Record<Stage, { name: string; focus: string }>,
  },
  library: {
    eyebrow: '06 · Library',
    title: 'คู่มือทั้งหมด',
    lead: 'เจ็ดคู่มือที่เขียนจริงทุกเรื่อง — ไม่มีบทความรอเติม',
    filter: 'กรองตามหมวด',
    count: '{n} คู่มือ',
  },
  glossary: {
    eyebrow: '07 · Glossary',
    title: 'คำเดียว ความหมายเดียว',
    lead: 'CORE ใช้คำชุดเดียวกันทั้งระบบ — ถ้าเข้าใจคำเหล่านี้ ก็อ่านทุกหน้าได้ง่ายขึ้น',
    all: 'ดูอภิธานศัพท์ทั้งหมด',
  },
  security: {
    eyebrow: '08 · Security & Data',
    title: 'ทุกคนไม่ควรเห็นทุกอย่าง',
    body: 'ขอบเขตการมองเห็นตามหน้าที่ ทำไมการซ่อนบนหน้าจอยังไม่พอ และสิ่งที่ PDA BLISS ยังไม่อ้าง — อธิบายด้วยภาษาธรรมดา',
    guide: 'อ่านฉบับเข้าใจง่าย',
    center: 'ดู Security & Trust Center ฉบับเต็ม',
  },
  implementation: {
    eyebrow: '09 · Implementation',
    title: 'เริ่มจาก Process\nไม่ใช่จากการติดตั้ง',
    body: 'สิบขั้นของการนำ CORE ไปใช้ และสิ่งที่องค์กรควรเตรียมก่อนเริ่ม',
    guide: 'อ่านคู่มือการนำไปใช้',
    industries: 'เรียนรู้ตามประเภทธุรกิจ',
  },
  cta: {
    title: 'อยากให้ PDA BLISS ช่วยดู Process?',
    lead: 'เล่าว่างานติดตรงไหน แล้วค่อยคุยกันว่าระบบควรช่วยตรงไหน',
    primary: 'คุยกับทีม PDA BLISS',
    demo: 'ลองใน CORE Demo',
  },
  common: {
    read: 'อ่าน',
    category: 'หมวด',
  },
};

export type ResourcesCopy = typeof th;

export const RESOURCES_COPY: Localized<ResourcesCopy> = {
  th,
  en: {
    meta: {
      title: 'CORE Resource Center — understand the system before you decide',
      description:
        'Concepts, workflow examples, control principles and how to prepare an organization before using CORE — seven real guides, searchable instantly.',
    },
    hero: {
      eyebrow: 'Resource Center',
      title: 'Understand the system\nbefore you decide to use it',
      lead: 'Concepts, workflow examples, control principles, and how to prepare your organization before bringing in CORE.',
      line: 'Understand CORE more deeply — from the idea to real use.',
      map: 'Map of the guides',
      zones: ['Concepts', 'Work', 'Control', 'Boundaries', 'Implementation'],
    },
    search: {
      label: 'Search the library',
      placeholder: 'e.g. lot, approval, warehouse',
      clear: 'Clear search',
      results: '{n} results for “{q}”',
      none: 'No results for “{q}”',
      tryThese: 'Try one of these',
      suggestions: ['Handoff', 'Expiry', 'Information boundary', 'Implementation'],
      term: 'Glossary term',
      why: {
        title: 'Matches the guide title',
        tag: 'Matches the topic “{d}”',
        term: 'Covers the term “{d}”',
        category: 'Matches the category',
        summary: 'Matches the summary',
        definition: 'Matches the definition',
      },
    },
    start: {
      eyebrow: '02 · Start here',
      title: 'Not sure where to start?',
      lead: 'Pick the question closest to yours and read in order — two or three guides are enough to see the picture.',
      paths: {
        what: { q: 'I want to know what CORE is', note: 'Start with the overview, then go deeper' },
        problems: {
          q: 'I want to know what problems CORE solves',
          note: 'Start with mistakes and stuck work',
        },
        evaluate: {
          q: 'I am evaluating whether to implement CORE',
          note: 'Start with preparing the organization and data boundaries',
        },
      },
      step: 'Step {n}',
    },
    problems: {
      eyebrow: '03 · Learn by problem',
      title: 'Start from the problem you have',
      lead: 'Choose a problem to see what to read, where it sits on the Solutions page and which mechanism on How CORE Works shows it.',
      group: 'Choose a problem',
      cause: 'Common cause',
      guide: 'Guide that explains the mechanism',
      solution: 'This problem on Solutions',
      workflow: 'The mechanism on How CORE Works',
      items: {
        fallingThrough: {
          label: 'Work falls through',
          cause: 'Work changes hands without a clear owner or status',
        },
        statusChasing: {
          label: 'Chasing status',
          cause: 'No shared status that every department can see',
        },
        humanError: { label: 'Human error', cause: 'No checks along the way, so mistakes flow on' },
        approval: {
          label: 'Slow approvals',
          cause: 'Nobody can see who the work is waiting on, or for how long',
        },
        stock: {
          label: 'Stock is hard to control',
          cause: 'Quantities are not tied to location, lot and expiry',
        },
        supplier: {
          label: 'Late suppliers',
          cause: 'Outstanding quantities are not tracked against the PO',
        },
        payment: {
          label: 'Incomplete documents',
          cause: 'Payment requests are not tied to the work and its source documents',
        },
        management: {
          label: 'Executives see it late',
          cause: 'Anomalies are not raised while the work is still moving',
        },
      },
      chapters: {
        handoff: 'Department handoffs',
        responsibility: 'Responsibility routing',
        'human-error': 'Human error prevention',
        approval: 'Approval & control',
        exceptions: 'Exceptions',
        decisions: 'Decision points',
        roles: 'Visibility by role',
        'one-work': 'One work, many departments',
        trace: 'Complete trace',
        adapt: 'Adapt to your organization',
      },
    },
    departments: {
      eyebrow: '04 · Learn by department',
      title: 'Read from your department’s angle',
      lead: 'What each department should read first, and why — department details live on the department pages.',
      group: 'Choose a department',
      page: 'See the {name} page',
      reasons: {
        sales: {
          howCoreWorks: 'See where handed-on work is without calling Warehouse or Purchasing',
          gettingStarted: 'Understand how the Sales workspace differs from other departments',
        },
        operations: {
          howCoreWorks: 'Most operations work is handoffs — see what a good handoff carries',
          humanError: 'Where mistakes tend to slip between steps, and how to catch them early',
          implementationGuide: 'Operations usually knows the real process — start here',
        },
        warehouse: {
          warehousePrivacy: 'Why the warehouse view holds only what receiving and picking need',
          humanError:
            'Lots, expiry and quantities that differ from the PO — the three most common cases',
          coreGlossary: 'Lot, expiry, FEFO — everyday words with one meaning across the system',
        },
        purchasing: {
          humanError: 'Alerts when a supplier is late, and detecting outstanding quantities',
          howCoreWorks: 'When stock is short, how work reaches Purchasing and where it goes next',
        },
        accounting: {
          humanError: 'Control before paying: documents must be complete before approval',
          warehousePrivacy: 'Why financial data is kept out of views that do not need it',
          howCoreWorks: 'Approval as part of the work, not a separate step',
        },
        executive: {
          gettingStarted: 'The overview of CORE before deciding — what it is and is not',
          securityAndData: 'Who sees what, and what should not be claimed yet',
          implementationGuide: 'What the organization prepares, and how implementation runs',
        },
      },
    },
    stages: {
      eyebrow: '05 · Learn by organization stage',
      title: 'Where is your organization now?',
      lead: 'Each stage asks different questions — read what your stage needs.',
      items: {
        starting: { name: 'Starting to organize', focus: 'Basic workflow and ownership' },
        multiDepartment: {
          name: 'Several departments now',
          focus: 'Handoffs, status and approval',
        },
        growing: {
          name: 'Growing organization',
          focus: 'Access, control and executive visibility',
        },
        standardizing: {
          name: 'Ready for stronger standards',
          focus: 'Implementation, security and integration readiness',
        },
      },
    },
    library: {
      eyebrow: '06 · Library',
      title: 'All guides',
      lead: 'Seven guides, every one fully written — no placeholder articles.',
      filter: 'Filter by category',
      count: '{n} guides',
    },
    glossary: {
      eyebrow: '07 · Glossary',
      title: 'One word, one meaning',
      lead: 'CORE uses one set of words across the system — know these and every page reads more easily.',
      all: 'See the full glossary',
    },
    security: {
      eyebrow: '08 · Security & Data',
      title: 'Not everyone should see everything',
      body: 'Visibility by responsibility, why hiding on screen is not enough, and what PDA BLISS does not claim yet — in plain language.',
      guide: 'Read the plain-language guide',
      center: 'See the full Security & Trust Center',
    },
    implementation: {
      eyebrow: '09 · Implementation',
      title: 'Start from the process,\nnot the installation',
      body: 'The ten steps of implementing CORE, and what an organization should prepare first.',
      guide: 'Read the implementation guide',
      industries: 'Learn by industry',
    },
    cta: {
      title: 'Want PDA BLISS to look at your process?',
      lead: 'Tell us where work gets stuck, then we can talk about where a system should help.',
      primary: 'Talk to the PDA BLISS team',
      demo: 'Try it in the CORE demo',
    },
    common: { read: 'Read', category: 'Category' },
  },
  'zh-CN': {
    meta: {
      title: 'CORE 资源中心——先理解系统，再决定使用',
      description:
        '概念、工作流示例、控制原则，以及引入 CORE 前如何准备组织——七份真实指南，可即时搜索。',
    },
    hero: {
      eyebrow: '资源中心',
      title: '先理解系统\n再决定是否使用',
      lead: '汇集概念、工作流示例、工作控制原则，以及引入 CORE 前如何准备组织。',
      line: '更深入地理解 CORE——从理念到实际应用。',
      map: '指南地图',
      zones: ['概念', '工作', '控制', '边界', '实施'],
    },
    search: {
      label: '搜索资源库',
      placeholder: '例如：批次、审批、仓库',
      clear: '清除搜索',
      results: '“{q}”共 {n} 个结果',
      none: '没有找到“{q}”的结果',
      tryThese: '试试这些词',
      suggestions: ['交接', '有效期', '信息边界', '实施'],
      term: '术语',
      why: {
        title: '与指南标题匹配',
        tag: '与主题“{d}”匹配',
        term: '包含术语“{d}”',
        category: '与类别匹配',
        summary: '与摘要匹配',
        definition: '与定义匹配',
      },
    },
    start: {
      eyebrow: '02 · Start here',
      title: '不知道从哪里开始？',
      lead: '选择最接近您的问题，按顺序阅读——两到三份指南就足以看清全貌。',
      paths: {
        what: { q: '想知道 CORE 是什么', note: '先看全貌，再深入细节' },
        problems: { q: '想知道 CORE 解决什么问题', note: '从差错和受阻的工作开始' },
        evaluate: { q: '正在评估是否引入 CORE', note: '从组织准备和数据边界开始' },
      },
      step: '第 {n} 步',
    },
    problems: {
      eyebrow: '03 · Learn by problem',
      title: '从您遇到的问题开始',
      lead: '选择一个问题，查看该读什么、它在“解决方案”页的哪一部分，以及“CORE 如何运作”中哪个机制说明了它。',
      group: '选择问题',
      cause: '常见原因',
      guide: '解释机制的指南',
      solution: '此问题在解决方案页',
      workflow: '“CORE 如何运作”中的机制',
      items: {
        fallingThrough: { label: '工作遗漏', cause: '工作易手时没有明确的负责人和状态' },
        statusChasing: { label: '反复追问进度', cause: '没有所有部门共同可见的状态' },
        humanError: { label: '人为差错', cause: '过程中缺少检查，差错继续流转' },
        approval: { label: '审批缓慢', cause: '看不到工作在等谁、等了多久' },
        stock: { label: '库存难以管控', cause: '数量没有与库位、批次和到期日关联' },
        supplier: { label: '供应商延迟', cause: '待收货物没有按采购单跟踪' },
        payment: { label: '单据不齐', cause: '付款申请没有与源头工作和单据关联' },
        management: { label: '管理层发现太晚', cause: '异常没有在工作进行中被凸显' },
      },
      chapters: {
        handoff: '部门交接',
        responsibility: '按职责分派',
        'human-error': '人为差错预防',
        approval: '审批与控制',
        exceptions: '异常',
        decisions: '决策点',
        roles: '按角色可见',
        'one-work': '一项工作，多个部门',
        trace: '追溯',
        adapt: '适配您的组织',
      },
    },
    departments: {
      eyebrow: '04 · Learn by department',
      title: '从您部门的角度阅读',
      lead: '每个部门应先读什么，以及原因——部门详情请见各部门页面。',
      group: '选择部门',
      page: '查看{name}页面',
      reasons: {
        sales: {
          howCoreWorks: '无需致电仓库或采购部，就能看到交出的工作在哪里',
          gettingStarted: '了解销售部的工作空间与其他部门有何不同',
        },
        operations: {
          howCoreWorks: '运营的大部分工作是交接——看看好的交接需要包含什么',
          humanError: '差错容易在步骤之间溜走的地方，以及如何提前发现',
          implementationGuide: '运营通常最了解真实流程——从这里开始',
        },
        warehouse: {
          warehousePrivacy: '为什么仓库视图只包含收货与拣货所需的信息',
          humanError: '批次、有效期、与采购单不符的数量——仓库最常遇到的三种情况',
          coreGlossary: '批次、有效期、FEFO——日常用语，在整个系统中含义一致',
        },
        purchasing: {
          humanError: '供应商逾期时的提醒，以及发现待收数量',
          howCoreWorks: '缺货时，工作如何流到采购部，又流向哪里',
        },
        accounting: {
          humanError: '付款前的管控：单据齐全才能进入审批',
          warehousePrivacy: '为什么财务数据不出现在不需要它的视图中',
          howCoreWorks: '审批是工作的一部分，而不是单独的步骤',
        },
        executive: {
          gettingStarted: '决策前了解 CORE 的全貌——它是什么、不是什么',
          securityAndData: '谁能看到什么，以及目前不应声明什么',
          implementationGuide: '组织需要准备什么，以及实施如何推进',
        },
      },
    },
    stages: {
      eyebrow: '05 · Learn by organization stage',
      title: '您的组织处在哪个阶段？',
      lead: '每个阶段的问题不同——只读您所在阶段需要的内容。',
      items: {
        starting: { name: '开始梳理系统', focus: '基础工作流与负责人' },
        multiDepartment: { name: '已有多个部门', focus: '交接、状态与审批' },
        growing: { name: '组织正在成长', focus: '权限、控制与高管可见性' },
        standardizing: { name: '需要更高标准', focus: '实施、安全与集成准备' },
      },
    },
    library: {
      eyebrow: '06 · Library',
      title: '全部指南',
      lead: '七份指南，每一份都已完整撰写——没有待填充的文章。',
      filter: '按类别筛选',
      count: '{n} 份指南',
    },
    glossary: {
      eyebrow: '07 · Glossary',
      title: '一个词，一个含义',
      lead: 'CORE 在整个系统中使用同一套词语——理解这些词，读每一页都会更轻松。',
      all: '查看完整术语表',
    },
    security: {
      eyebrow: '08 · Security & Data',
      title: '不是每个人都该看到一切',
      body: '按职责划分可见范围、为什么仅在界面上隐藏还不够，以及 PDA BLISS 目前不作的声明——用通俗的语言说明。',
      guide: '阅读通俗版指南',
      center: '查看完整的安全与信任中心',
    },
    implementation: {
      eyebrow: '09 · Implementation',
      title: '从流程开始，\n而不是从安装开始',
      body: '实施 CORE 的十个步骤，以及组织在开始前应准备什么。',
      guide: '阅读实施指南',
      industries: '按行业了解',
    },
    cta: {
      title: '想请 PDA BLISS 帮您看看流程吗？',
      lead: '告诉我们工作卡在哪里，再一起讨论系统应在哪些地方提供帮助。',
      primary: '与 PDA BLISS 团队沟通',
      demo: '在 CORE 演示中体验',
    },
    common: { read: '阅读', category: '类别' },
  },
};
