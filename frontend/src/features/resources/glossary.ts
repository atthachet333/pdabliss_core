import type { Localized } from '@/i18n/useCopy';
import type { ResourceId } from './registry';

/*
 * The CORE glossary (EP16). One meaning per word, in the same wording the
 * rest of the site uses (EP06 departments, EP08 workflow, EP10 enterprise,
 * EP14 demo, EP15 security). Structure here; words below, per locale.
 * Shared by the glossary page and the in-memory resource search.
 */

export const TERM_CATEGORIES = [
  'concept',
  'workflow',
  'control',
  'warehouse',
  'security',
  'implementation',
] as const;
export type TermCategory = (typeof TERM_CATEGORIES)[number];

export const TERMS = [
  { id: 'core', en: 'CORE', category: 'concept', see: 'gettingStarted' },
  { id: 'workspace', en: 'Workspace', category: 'concept', see: 'gettingStarted' },
  {
    id: 'departmentWorkspace',
    en: 'Department Workspace',
    category: 'concept',
    see: 'gettingStarted',
  },
  { id: 'workItem', en: 'Work Item', category: 'workflow', see: 'howCoreWorks' },
  { id: 'owner', en: 'Owner', category: 'workflow', see: 'howCoreWorks' },
  { id: 'state', en: 'State', category: 'workflow', see: 'howCoreWorks' },
  { id: 'handoff', en: 'Handoff', category: 'workflow', see: 'howCoreWorks' },
  { id: 'workflow', en: 'Workflow', category: 'workflow', see: 'howCoreWorks' },
  { id: 'dependency', en: 'Dependency', category: 'workflow', see: 'howCoreWorks' },
  { id: 'approval', en: 'Approval', category: 'control', see: 'howCoreWorks' },
  { id: 'requiredInformation', en: 'Required Information', category: 'control', see: 'humanError' },
  { id: 'exception', en: 'Exception', category: 'control', see: 'humanError' },
  { id: 'trace', en: 'Trace', category: 'control', see: 'humanError' },
  { id: 'auditTrail', en: 'Audit Trail (concept)', category: 'security', see: 'securityAndData' },
  { id: 'lot', en: 'Lot', category: 'warehouse', see: 'warehousePrivacy' },
  { id: 'expiry', en: 'Expiry', category: 'warehouse', see: 'humanError' },
  { id: 'fefo', en: 'FEFO', category: 'warehouse', see: 'humanError' },
  {
    id: 'informationBoundary',
    en: 'Information Boundary',
    category: 'security',
    see: 'warehousePrivacy',
  },
  {
    id: 'dataClassification',
    en: 'Data Classification',
    category: 'security',
    see: 'securityAndData',
  },
  {
    id: 'executiveVisibility',
    en: 'Executive Visibility',
    category: 'concept',
    see: 'securityAndData',
  },
  { id: 'operationalFinance', en: 'Operational Finance', category: 'concept', see: 'howCoreWorks' },
  {
    id: 'implementationScope',
    en: 'Implementation Scope',
    category: 'implementation',
    see: 'implementationGuide',
  },
] as const satisfies readonly {
  id: string;
  en: string;
  category: TermCategory;
  see: ResourceId;
}[];
export type TermId = (typeof TERMS)[number]['id'];

export const termAnchor = (id: TermId) => `term-${id}`;

type TermText = { name: string; definition: string; example?: string };
type GlossaryCopy = {
  categories: Record<TermCategory, string>;
  terms: Record<TermId, TermText>;
};

const th: GlossaryCopy = {
  categories: {
    concept: 'แนวคิด',
    workflow: 'Workflow',
    control: 'การควบคุม',
    warehouse: 'คลังสินค้า',
    security: 'Security & Data',
    implementation: 'การนำไปใช้',
  },
  terms: {
    core: {
      name: 'CORE',
      definition:
        'Department Operations Platform ของ PDA BLISS — แต่ละแผนกมีพื้นที่ทำงานของตัวเอง และทุกขั้นของงานเชื่อมกันด้วยข้อมูลชุดเดียว',
    },
    workspace: {
      name: 'พื้นที่ทำงาน',
      definition:
        'หน้าจอที่จัดตามหน้าที่ของคนที่ใช้ แสดงงานที่ต้องทำต่อและข้อมูลที่จำเป็นต่องานนั้น ไม่ใช่เมนูทั้งระบบ',
    },
    departmentWorkspace: {
      name: 'พื้นที่ทำงานของแผนก',
      definition:
        'พื้นที่ทำงานของแต่ละแผนก เช่น คลังสินค้าหรือจัดซื้อ — แผนกเห็นงานในมุมของตัวเอง แทนที่ทุกคนจะใช้หน้าจอเดียวกันทั้งหมด',
      example: 'คลังเห็นงานรับและจัดสินค้า จัดซื้อเห็น PO และยอดค้างรับ',
    },
    workItem: {
      name: 'งานหนึ่งชิ้น',
      definition: 'สิ่งที่เดินผ่านหลายแผนกตั้งแต่เริ่มจนจบ มีเจ้าของ สถานะ และประวัติของตัวเอง',
      example: 'คำสั่งซื้อ SO-1042 เริ่มที่ฝ่ายขาย ผ่านจัดซื้อ คลัง และบัญชี',
    },
    owner: {
      name: 'เจ้าของงาน',
      definition:
        'บทบาทหรือแผนกที่รับผิดชอบขั้นปัจจุบันของงาน ในแต่ละช่วงมีเจ้าของที่ชัดเจนหนึ่งเดียว',
      example: 'ช่วงรอของจาก Supplier เจ้าของ SO-1042 คือจัดซื้อ — ฝ่ายขายรู้ว่าต้องถามใคร',
    },
    state: {
      name: 'สถานะ',
      definition:
        'ตำแหน่งปัจจุบันของงาน เช่น รอรับสินค้า หรือรออนุมัติ — ทุกแผนกเห็นสถานะเดียวกัน จึงไม่ต้องโทรถาม',
      example: '“รอรับของ 20 ชิ้นตาม PO-2215” แทน “กำลังดำเนินการ”',
    },
    handoff: {
      name: 'การส่งต่องาน',
      definition:
        'เมื่อเจ้าของงานเปลี่ยน ข้อมูลที่จำเป็นเดินทางไปพร้อมกับงาน ผู้รับรู้ว่าต้องทำอะไรต่อ — ไม่ใช่แค่ข้อความว่า “ส่งแล้ว”',
      example:
        'ฝ่ายขายส่งต่อให้จัดซื้อ พร้อมรายการสินค้า จำนวนที่ขาด 100 ชิ้น และวันที่ลูกค้าต้องการ',
    },
    workflow: {
      name: 'Workflow',
      definition: 'ลำดับขั้นของงาน — ใครทำอะไร ต่อจากใคร ต้องมีข้อมูลอะไร และต้องผ่านการอนุมัติใด',
      example: 'ขาย → จัดซื้อ → คลังรับสินค้า → บัญชีตรวจเอกสาร → ส่งมอบ',
    },
    dependency: {
      name: 'สิ่งที่งานต้องรอ',
      definition:
        'งานหนึ่งเดินต่อไม่ได้จนกว่าอีกงานจะเสร็จ การเห็นสิ่งที่รอช่วยให้รู้ว่างานติดอยู่ที่ใคร',
      example: 'ส่งของให้ลูกค้าต้องรอการรับสินค้าจาก PO-2215',
    },
    approval: {
      name: 'การอนุมัติ',
      definition:
        'ขั้นที่งานต้องผ่านผู้อนุมัติตามเงื่อนไขก่อนเดินต่อ เป็นส่วนหนึ่งของงาน ไม่ใช่ปุ่มที่แยกออกมา',
      example: 'คำขอจ่ายมัดจำตาม PO-2215 รอบัญชีอนุมัติ ก่อนที่ Supplier จะยืนยันคำสั่งซื้อ',
    },
    requiredInformation: {
      name: 'ข้อมูลที่ต้องมี',
      definition: 'ข้อมูลที่ต้องครบก่อนงานเดินต่อ — หลักการ “ป้องกัน” ในทางปฏิบัติ',
      example: 'ปิดรับสินค้าไม่ได้จนกว่าจะระบุ Lot และวันหมดอายุ',
    },
    exception: {
      name: 'ข้อยกเว้น',
      definition:
        'สิ่งที่ไม่เป็นไปตามปกติ ถูกยกขึ้นมาให้เห็นพร้อมผู้รับผิดชอบ แทนที่จะรอให้มีคนสังเกตเอง',
      example: 'รับของ 80 จาก 100 ชิ้น — ค้างรับ 20 ชิ้น จัดซื้อรับผิดชอบติดตาม',
    },
    trace: {
      name: 'การย้อนรอย',
      definition:
        'ดูย้อนหลังได้ว่าใคร บทบาทใด แผนกใด ทำอะไร ก่อนและหลังเป็นอย่างไร เกิดขึ้นลำดับใด และอ้างอิงเอกสารใด',
      example:
        'LOT-B2410 รับเข้าเมื่อใด โดยใคร จาก GR-3307 — ตอบได้จากประวัติงาน ไม่ต้องพึ่งความจำ',
    },
    auditTrail: {
      name: 'บันทึกตรวจสอบย้อนหลัง (แนวคิด)',
      definition:
        'โครงสร้างประวัติงานที่ออกแบบไว้ใน CORE — Demo แสดงประวัติจำลอง การจัดเก็บในระบบจริงมาพร้อม Backend ระยะถัดไป',
    },
    lot: {
      name: 'Lot',
      definition:
        'กลุ่มสินค้าที่รับเข้ามาพร้อมกัน ใช้ย้อนดูว่าสินค้ามาจากการรับครั้งไหน และควรจ่ายก่อนหรือหลัง',
      example: 'LOT-B2410 รับเข้าจาก GR-3307',
    },
    expiry: {
      name: 'วันหมดอายุ',
      definition: 'บันทึกคู่กับ Lot เพื่อให้รู้ว่าควรจ่ายสินค้าใดก่อน และแจ้งเตือนเมื่อใกล้หมดอายุ',
      example: 'LOT-B2410 หมดอายุ 2027-06-30 — มีการแจ้งเตือนเมื่อใกล้ถึงกำหนด',
    },
    fefo: {
      name: 'FEFO',
      definition:
        'First Expired, First Out — จ่าย Lot ที่หมดอายุก่อนออกก่อน ใน CORE เป็นคำแนะนำให้ผู้จัดสินค้า ไม่ใช่การตัดสินใจแทน',
      example: 'มีสอง Lot ในคลัง — ผู้จัดสินค้าเห็นคำแนะนำให้จ่าย Lot ที่หมดอายุก่อน',
    },
    informationBoundary: {
      name: 'ขอบเขตข้อมูล',
      definition:
        'เส้นที่กำหนดว่าบทบาทใดได้รับข้อมูลใด เพื่อให้แต่ละคนเห็นสิ่งที่จำเป็นต่อหน้าที่ ไม่เกินกว่านั้น',
      example: 'มุมมองคลังไม่ได้รับราคาขาย ต้นทุน หรือกำไร',
    },
    dataClassification: {
      name: 'การจัดประเภทข้อมูล',
      definition:
        'แบ่งข้อมูลเป็นประเภทปฏิบัติงาน การค้า และการเงิน แล้วกำหนดว่ามุมมองใดรับข้อมูลประเภทใดได้',
      example:
        'จำนวนและ Lot เป็นข้อมูลปฏิบัติงาน ราคาขายเป็นข้อมูลการค้า การจ่ายเงินเป็นข้อมูลการเงิน',
    },
    executiveVisibility: {
      name: 'การมองเห็นของผู้บริหาร',
      definition:
        'เห็นภาพรวม ข้อยกเว้น คอขวด และความเสี่ยงทั้งองค์กร โดยไม่ต้องเปิดทุกรายการ — ต่างจากผู้ดูแลระบบที่ดูแลการตั้งค่า',
      example: 'ผู้บริหารเห็นว่า SO-1042 อาจส่งช้าเพราะค้างรับ 20 ชิ้น โดยไม่ต้องเปิดดู PO ทีละใบ',
    },
    operationalFinance: {
      name: 'การเงินเชิงปฏิบัติงาน',
      definition:
        'ส่วนที่ CORE ช่วยบัญชี เช่น ความครบของเอกสารและความพร้อมจ่าย — ไม่ใช่สมุดบัญชี การลงบัญชี หรือภาษี',
      example: 'บัญชีเห็นว่าคำขอจ่ายมัดจำมี PO และเอกสารประกอบครบหรือยัง ก่อนส่งไปอนุมัติ',
    },
    implementationScope: {
      name: 'ขอบเขตการวางระบบ',
      definition:
        'แผนก Workflow สิทธิ์ และการเชื่อมต่อที่ตกลงร่วมกันว่าจะนำ CORE ไปใช้ในองค์กรอย่างไร',
      example:
        'เริ่มจากฝ่ายขาย จัดซื้อ และคลัง ด้วย Workflow สั่งซื้อถึงรับสินค้า แล้วค่อยเพิ่มบัญชีในระยะถัดไป',
    },
  },
};

export const GLOSSARY: Localized<GlossaryCopy> = {
  th,
  en: {
    categories: {
      concept: 'Concepts',
      workflow: 'Workflow',
      control: 'Control',
      warehouse: 'Warehouse',
      security: 'Security & Data',
      implementation: 'Implementation',
    },
    terms: {
      core: {
        name: 'CORE',
        definition:
          'PDA BLISS’s Department Operations Platform — each department has its own workspace, and every step of the work is connected through one shared set of data.',
      },
      workspace: {
        name: 'Workspace',
        definition:
          'A screen arranged around the responsibility of the person using it: the work to do next and the information that work needs — not the menu of the whole system.',
      },
      departmentWorkspace: {
        name: 'Department workspace',
        definition:
          'Each department’s own workspace, such as Warehouse or Purchasing. The department sees the work from its own angle instead of everyone sharing one screen.',
        example: 'Warehouse sees receiving and picking; Purchasing sees POs and open receipts.',
      },
      workItem: {
        name: 'Work item',
        definition:
          'Something that moves through several departments from start to finish, with its own owner, state and history.',
        example:
          'Order SO-1042 starts in Sales and passes through Purchasing, Warehouse and Accounting.',
      },
      owner: {
        name: 'Owner',
        definition:
          'The role or department responsible for the work’s current step. At any moment there is one clear owner.',
        example:
          'While goods are awaited from the supplier, Purchasing owns SO-1042 — Sales knows whom to ask.',
      },
      state: {
        name: 'State',
        definition:
          'Where the work is right now, such as awaiting receipt or awaiting approval. Every department sees the same state, so nobody has to call and ask.',
        example: '“Waiting for 20 units on PO-2215” instead of “In progress”.',
      },
      handoff: {
        name: 'Handoff',
        definition:
          'When the owner changes, the information the next step needs travels with the work, and the receiver knows what to do next — not just a message saying “sent”.',
        example:
          'Sales hands the work to Purchasing with the item, the 100-unit shortage and the customer’s date.',
      },
      workflow: {
        name: 'Workflow',
        definition:
          'The sequence of the work: who does what, after whom, with what information, and through which approvals.',
        example: 'Sales → Purchasing → Warehouse receiving → Accounting document check → Delivery',
      },
      dependency: {
        name: 'Dependency',
        definition:
          'One piece of work cannot continue until another is done. Seeing what work waits on shows who it is stuck with.',
        example: 'Delivering to the customer waits on receiving PO-2215.',
      },
      approval: {
        name: 'Approval',
        definition:
          'A step where the work must pass an approver, under set conditions, before it continues. Part of the work — not a separate button.',
        example:
          'A deposit request for PO-2215 waits for Accounting’s approval before the supplier confirms the order.',
      },
      requiredInformation: {
        name: 'Required information',
        definition:
          'Information that must be complete before the work moves on — the “prevent” principle in practice.',
        example: 'Receiving cannot close until the lot and expiry date are recorded.',
      },
      exception: {
        name: 'Exception',
        definition:
          'Something that is not going as normal, raised so it is seen with a responsible owner, instead of waiting for someone to notice.',
        example: 'Received 80 of 100 — 20 outstanding, Purchasing follows up.',
      },
      trace: {
        name: 'Trace',
        definition:
          'Looking back at who, in which role and department, did what, what it was before and after, in what order, and which document it refers to.',
        example:
          'When LOT-B2410 was received, by whom, from GR-3307 — answered from the work history, not from memory.',
      },
      auditTrail: {
        name: 'Audit trail (concept)',
        definition:
          'The work-history structure designed into CORE. The demo shows a simulated history; storing it in production arrives with the next backend phases.',
      },
      lot: {
        name: 'Lot',
        definition:
          'A group of goods received together, used to trace which receipt an item came from and whether it should leave earlier or later.',
        example: 'LOT-B2410, received through GR-3307.',
      },
      expiry: {
        name: 'Expiry date',
        definition:
          'Recorded with the lot so it is clear which goods should leave first, with an alert as the date approaches.',
        example: 'LOT-B2410 expires on 2027-06-30 — a reminder appears as the date approaches.',
      },
      fefo: {
        name: 'FEFO',
        definition:
          'First Expired, First Out — the lot that expires first leaves first. In CORE it is a suggestion to the picker, not a decision made for them.',
        example:
          'Two lots are in stock — the picker is advised to issue the one that expires first.',
      },
      informationBoundary: {
        name: 'Information boundary',
        definition:
          'The line that sets which role receives which information, so everyone sees what their work needs and nothing beyond it.',
        example: 'The warehouse view does not receive selling price, cost or margin.',
      },
      dataClassification: {
        name: 'Data classification',
        definition:
          'Sorting data into operational, commercial and financial classes, then deciding which view may receive which class.',
        example:
          'Quantity and lot are operational; selling price is commercial; payments are financial.',
      },
      executiveVisibility: {
        name: 'Executive visibility',
        definition:
          'Seeing the overview, exceptions, bottlenecks and risk across the organization without opening every record — different from the admin, who manages settings.',
        example:
          'An executive sees that SO-1042 may be late because 20 units are outstanding, without opening each PO.',
      },
      operationalFinance: {
        name: 'Operational finance',
        definition:
          'The part CORE helps Accounting with, such as document completeness and payment readiness — not a ledger, journal entries or tax.',
        example:
          'Accounting sees whether a deposit request has its PO and supporting documents before it goes for approval.',
      },
      implementationScope: {
        name: 'Implementation scope',
        definition:
          'The departments, workflows, permissions and integrations agreed for how CORE will be used in the organization.',
        example:
          'Start with Sales, Purchasing and Warehouse on the order-to-receiving workflow, then add Accounting in a later phase.',
      },
    },
  },
  'zh-CN': {
    categories: {
      concept: '概念',
      workflow: '工作流',
      control: '控制',
      warehouse: '仓库',
      security: '安全与数据',
      implementation: '实施',
    },
    terms: {
      core: {
        name: 'CORE',
        definition:
          'PDA BLISS 的部门运营平台——每个部门拥有自己的工作空间，工作的每一步通过同一套数据相连。',
      },
      workspace: {
        name: '工作空间',
        definition:
          '按使用者职责安排的界面：显示接下来要做的工作和该工作所需的信息，而不是整个系统的菜单。',
      },
      departmentWorkspace: {
        name: '部门工作空间',
        definition:
          '每个部门自己的工作空间，例如仓库或采购部。部门从自己的角度看待工作，而不是所有人共用一个界面。',
        example: '仓库看到收货与拣货；采购部看到采购单与待收货。',
      },
      workItem: {
        name: '工作项',
        definition: '从开始到结束经过多个部门的一项工作，拥有自己的负责人、状态和历史。',
        example: '订单 SO-1042 从销售部开始，经过采购部、仓库和财务会计。',
      },
      owner: {
        name: '负责人',
        definition: '负责工作当前步骤的角色或部门。任何时候都只有一个明确的负责人。',
        example: '等待供应商到货期间，SO-1042 的负责人是采购部——销售部知道该问谁。',
      },
      state: {
        name: '状态',
        definition:
          '工作当前所处的位置，例如等待收货或等待审批。所有部门看到同一个状态，因此无需打电话询问。',
        example: '“等待 PO-2215 的 20 件到货”，而不是“处理中”。',
      },
      handoff: {
        name: '交接',
        definition:
          '负责人变更时，下一步所需的信息随工作一起传递，接收方知道接下来要做什么——而不只是一句“已发送”。',
        example: '销售部把工作交给采购部，附上商品、缺少的 100 件和客户要求的日期。',
      },
      workflow: {
        name: '工作流',
        definition: '工作的步骤顺序：谁做什么、接在谁之后、需要什么信息、经过哪些审批。',
        example: '销售 → 采购 → 仓库收货 → 财务核对单据 → 交付',
      },
      dependency: {
        name: '依赖',
        definition: '一项工作必须等另一项完成才能继续。看到工作在等什么，就知道卡在谁那里。',
        example: '给客户交货要等 PO-2215 收货完成。',
      },
      approval: {
        name: '审批',
        definition: '工作在继续之前须按条件经过审批人的步骤。它是工作的一部分，而不是单独的按钮。',
        example: 'PO-2215 的定金申请需财务审批后，供应商才确认订单。',
      },
      requiredInformation: {
        name: '必需信息',
        definition: '工作继续前必须齐全的信息——即“预防”原则的实际做法。',
        example: '未登记批次与有效期前，无法关闭收货。',
      },
      exception: {
        name: '异常',
        definition: '不按常规进行的情况，会连同负责人一起被凸显出来，而不是等人自己发现。',
        example: '收到 80 / 100 件——待收 20 件，由采购部跟进。',
      },
      trace: {
        name: '追溯',
        definition:
          '回看是谁、什么角色、哪个部门、做了什么、前后有何不同、发生顺序以及引用了哪份单据。',
        example: 'LOT-B2410 何时由谁根据 GR-3307 收货——从工作历史中查到，不靠记忆。',
      },
      auditTrail: {
        name: '审计记录（概念）',
        definition:
          'CORE 中设计的工作历史结构。演示展示模拟历史；生产环境中的存储将随后续后端阶段提供。',
      },
      lot: {
        name: '批次',
        definition: '同一次收进的一组货物，用来追溯物品来自哪次收货，以及应先出还是后出。',
        example: 'LOT-B2410，经 GR-3307 收货。',
      },
      expiry: {
        name: '有效期',
        definition: '与批次一起记录，以明确哪些货物应先出，并在临近到期时提醒。',
        example: 'LOT-B2410 有效期至 2027-06-30——临近时会出现提醒。',
      },
      fefo: {
        name: 'FEFO',
        definition:
          'First Expired, First Out——先到期的批次先出。在 CORE 中它是给拣货人员的建议，而不是替他们做决定。',
        example: '库存中有两个批次——拣货员会看到先发出较早到期批次的建议。',
      },
      informationBoundary: {
        name: '信息边界',
        definition: '规定哪个角色接收哪些信息的界线，让每个人看到工作所需的内容，而不超出。',
        example: '仓库视图不接收销售价、成本或毛利。',
      },
      dataClassification: {
        name: '数据分类',
        definition: '把数据分为业务操作、商业与财务三类，再决定哪个视图可以接收哪一类。',
        example: '数量与批次属于运营数据；销售价格属于商业数据；付款属于财务数据。',
      },
      executiveVisibility: {
        name: '高管可见性',
        definition:
          '无需打开每条记录即可看到整个组织的概况、异常、瓶颈与风险——与负责设置的系统管理员不同。',
        example: '高管看到 SO-1042 因待收 20 件可能延迟，无需逐张打开采购单。',
      },
      operationalFinance: {
        name: '运营财务',
        definition:
          'CORE 协助财务会计的部分，例如单据是否齐全、付款是否就绪——不是总账、记账或税务。',
        example: '财务在提交审批前，查看定金申请是否附有采购单和证明单据。',
      },
      implementationScope: {
        name: '实施范围',
        definition: '约定 CORE 在组织中如何使用的部门、工作流、权限与集成。',
        example: '先从销售、采购和仓库的下单到收货工作流开始，下一阶段再加入财务。',
      },
    },
  },
};
