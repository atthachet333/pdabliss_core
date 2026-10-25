import type { Localized } from '@/i18n/useCopy';
import type { JourneyStepId } from '../journey';

export const CHECKLIST = [
  'departments',
  'owners',
  'workflows',
  'stuck',
  'documents',
  'approvals',
  'data',
  'locations',
  'integrations',
] as const;
export type ChecklistId = (typeof CHECKLIST)[number];

type Step = { purpose: string; output: string; who: string };
type Check = { item: string; why: string };

const th = {
  intro: {
    p1: 'การนำระบบไปใช้ที่ล้มเหลวส่วนใหญ่ไม่ได้ล้มเพราะซอฟต์แวร์ แต่ล้มเพราะเริ่มติดตั้งก่อนเข้าใจว่างานจริงเดินอย่างไร คู่มือนี้จึงเริ่มจาก Process ไม่ใช่จากหน้าจอ',
    p2: 'สิบขั้นด้านล่างอยู่ในหกช่วงเดียวกับหน้าสำหรับองค์กร — DISCOVER, DESIGN, CONFIGURE, PREPARE, LAUNCH, IMPROVE ระยะเวลาและรายละเอียดจริงขึ้นกับขอบเขตของแต่ละองค์กร',
  },
  journey: {
    title: 'สิบขั้นของการนำ CORE ไปใช้',
    caption: 'สิบขั้นในหกช่วง — สองขั้นแรกใช้เวลาไปกับการเข้าใจ ก่อนแตะการตั้งค่า',
    purpose: 'เพื่อ',
    output: 'ได้',
    who: 'ใครเกี่ยวข้อง',
    steps: {
      discover: {
        purpose: 'เข้าใจองค์กร เป้าหมาย และสิ่งที่ทำให้อยากเปลี่ยน',
        output: 'ภาพรวมขององค์กรและปัญหาที่ต้องแก้ก่อน',
        who: 'เจ้าของกิจการ ผู้บริหาร และทีม PDA BLISS',
      },
      mapping: {
        purpose: 'วาดว่างานจริงเดินอย่างไร ไม่ใช่งานควรเดินอย่างไร',
        output: 'แผนผัง Process ปัจจุบัน พร้อมจุดที่งานติด',
        who: 'หัวหน้าแผนกและคนทำงานจริง',
      },
      responsibility: {
        purpose: 'กำหนดว่าแต่ละขั้นเป็นของใคร และแต่ละแผนกต้องเห็นอะไร',
        output: 'ตารางความรับผิดชอบและขอบเขตข้อมูลของแต่ละแผนก',
        who: 'หัวหน้าแผนกและผู้บริหาร',
      },
      workflow: {
        purpose: 'ออกแบบลำดับงาน ข้อมูลที่ต้องมี การอนุมัติ และข้อยกเว้น',
        output: 'Workflow ที่ตกลงร่วมกันก่อนตั้งค่า',
        who: 'หัวหน้าแผนกและทีม PDA BLISS',
      },
      data: {
        purpose: 'เตรียมข้อมูลเดิมที่จะนำเข้า และตัดสิ่งที่ไม่ใช้แล้วออก',
        output: 'ข้อมูลตั้งต้นที่ตรวจแล้ว เช่น สินค้า Supplier และตำแหน่งจัดเก็บ',
        who: 'คนดูแลข้อมูลของแต่ละแผนก',
      },
      configure: {
        purpose: 'ตั้งค่าพื้นที่ทำงาน สิทธิ์ และ Workflow ตามที่ออกแบบ',
        output: 'ระบบที่ตั้งค่าตามขอบเขตที่ตกลง',
        who: 'ทีม PDA BLISS',
      },
      validate: {
        purpose: 'ทดลองกับงานจริงบางส่วน เพื่อหาสิ่งที่ออกแบบไม่ตรง',
        output: 'รายการปรับแก้ก่อนเริ่มใช้จริง',
        who: 'คนทำงานจริงของแต่ละแผนก',
      },
      train: {
        purpose: 'ให้แต่ละคนรู้งานในพื้นที่ทำงานของตัวเอง',
        output: 'ผู้ใช้ที่พร้อมทำงานในบทบาทของตัวเอง',
        who: 'ผู้ใช้ทุกแผนก',
      },
      launch: {
        purpose: 'เริ่มใช้จริง โดยมีทีมดูแลใกล้ชิดในช่วงแรก',
        output: 'งานจริงเดินในระบบ',
        who: 'ทุกแผนก และทีม PDA BLISS',
      },
      improve: {
        purpose: 'ใช้การย้อนรอยและข้อยกเว้นที่เกิดขึ้นจริงเป็นข้อมูลปรับ Process',
        output: 'Process ที่ดีขึ้นจากการใช้งานจริง',
        who: 'ผู้บริหารและหัวหน้าแผนก',
      },
    } satisfies Record<JourneyStepId, Step>,
  },
  checklist: {
    title: 'สิ่งที่องค์กรควรเตรียมก่อนเริ่ม',
    p: 'ไม่จำเป็นต้องสมบูรณ์ แต่ยิ่งมีมากเท่าไร สองขั้นแรกก็ยิ่งเร็วขึ้น ใช้รายการนี้เช็กความพร้อมได้เลย — ไม่มีการบันทึกหรือส่งข้อมูลใด ๆ',
    progress: 'เตรียมแล้ว {n} จาก {total}',
    reset: 'ล้างรายการ',
    items: {
      departments: { item: 'รายชื่อแผนก', why: 'เพื่อรู้ว่าจะมีพื้นที่ทำงานกี่แบบ' },
      owners: {
        item: 'ผู้รับผิดชอบหลักของแต่ละแผนก',
        why: 'คนที่ตัดสินใจเรื่อง Process ของแผนกได้',
      },
      workflows: {
        item: 'Workflow ปัจจุบัน',
        why: 'แม้จะอยู่ในหัวคนหรือในแชท ก็ใช้เป็นจุดเริ่มได้',
      },
      stuck: {
        item: 'จุดที่งานติดบ่อย',
        why: 'เป็นสิ่งที่ควรแก้ก่อน และใช้วัดว่าการเปลี่ยนแปลงได้ผล',
      },
      documents: {
        item: 'เอกสารสำคัญ',
        why: 'เช่น PO ใบรับสินค้า ใบแจ้งหนี้ — งานส่วนใหญ่ผูกกับเอกสาร',
      },
      approvals: { item: 'การอนุมัติในปัจจุบัน', why: 'ใครอนุมัติอะไร ภายใต้เงื่อนไขใด' },
      data: { item: 'ข้อมูลเดิม', why: 'สินค้า Supplier ลูกค้า — อยู่ที่ไหน และสะอาดแค่ไหน' },
      locations: { item: 'โครงสร้างสาขาและสถานที่', why: 'คลังกี่แห่ง สาขาใดรับผิดชอบอะไร' },
      integrations: { item: 'ระบบที่ต้องเชื่อมต่อ', why: 'ระบบใดใช้ต่อ และต้องแลกข้อมูลอะไรกัน' },
    } satisfies Record<ChecklistId, Check>,
  },
  pitfalls: {
    title: 'สิ่งที่มักทำให้การนำไปใช้สะดุด',
    items: [
      'ตั้งค่าทุกอย่างพร้อมกันตั้งแต่วันแรก แทนที่จะเริ่มจากจุดที่เจ็บที่สุด',
      'ออกแบบ Workflow โดยไม่มีคนทำงานจริงอยู่ในห้อง',
      'ย้ายข้อมูลเดิมทั้งหมดโดยไม่ตรวจก่อน — ปัญหาเดิมจะย้ายตามมาด้วย',
      'ให้ทุกคนเห็นทุกอย่าง “ไว้ก่อน” แล้วค่อยมาจำกัดทีหลัง',
      'คิดว่าการเริ่มใช้คือจุดจบ ทั้งที่การปรับปรุงเริ่มจากการใช้งานจริง',
    ],
  },
  links: {
    pricing: 'ดูแพ็กเกจและขอบเขต',
    enterprise: 'การวางระบบสำหรับองค์กร',
  },
  cta: {
    title: 'อยากให้ PDA BLISS ช่วยดู Process?',
    body: 'เริ่มจากรายการด้านบนเท่าที่มี แล้วคุยกันว่าองค์กรของคุณควรเริ่มจากจุดไหน',
    primary: 'คุยกับทีม PDA BLISS',
    secondary: 'ดูแพ็กเกจ',
  },
};

export const IMPLEMENTATION_GUIDE: Localized<typeof th> = {
  th,
  en: {
    intro: {
      p1: 'Most failed system rollouts do not fail because of software. They fail because installation started before anyone understood how the real work runs. So this guide starts from the process, not the screens.',
      p2: 'The ten steps below sit in the same six phases as the Enterprise page — DISCOVER, DESIGN, CONFIGURE, PREPARE, LAUNCH, IMPROVE. Actual timing and detail depend on each organization’s scope.',
    },
    journey: {
      title: 'The ten steps of implementing CORE',
      caption:
        'Ten steps in six phases — the first two are spent understanding, before touching configuration',
      purpose: 'Purpose',
      output: 'Output',
      who: 'Who is involved',
      steps: {
        discover: {
          purpose: 'Understand the organization, its goals and what is driving the change',
          output: 'An overview of the organization and the problems to solve first',
          who: 'Owners, executives and the PDA BLISS team',
        },
        mapping: {
          purpose: 'Draw how the work really runs — not how it should run',
          output: 'A map of the current process, with the points where work gets stuck',
          who: 'Department leads and the people who do the work',
        },
        responsibility: {
          purpose: 'Decide who owns each step and what each department needs to see',
          output: 'A responsibility table and each department’s information boundary',
          who: 'Department leads and executives',
        },
        workflow: {
          purpose: 'Design the sequence, required information, approvals and exceptions',
          output: 'A workflow agreed before configuration',
          who: 'Department leads and the PDA BLISS team',
        },
        data: {
          purpose: 'Prepare existing data to bring in, and drop what is no longer used',
          output: 'Checked starting data — items, suppliers, storage locations',
          who: 'Each department’s data owner',
        },
        configure: {
          purpose: 'Set up workspaces, permissions and workflows as designed',
          output: 'A system configured to the agreed scope',
          who: 'The PDA BLISS team',
        },
        validate: {
          purpose: 'Try it with part of the real work to find what was designed wrong',
          output: 'A list of adjustments before going live',
          who: 'The people who do the work in each department',
        },
        train: {
          purpose: 'Make sure everyone knows their work in their own workspace',
          output: 'Users ready to work in their roles',
          who: 'Users in every department',
        },
        launch: {
          purpose: 'Go live, with the team close by in the first period',
          output: 'Real work running in the system',
          who: 'Every department and the PDA BLISS team',
        },
        improve: {
          purpose: 'Use real traces and exceptions as input for improving the process',
          output: 'A better process, from real use',
          who: 'Executives and department leads',
        },
      },
    },
    checklist: {
      title: 'What to prepare before you start',
      p: 'It does not need to be complete, but the more you have, the faster the first two steps go. Use this list to check readiness — nothing is saved or sent.',
      progress: '{n} of {total} prepared',
      reset: 'Clear the list',
      items: {
        departments: {
          item: 'A list of departments',
          why: 'To know how many kinds of workspace there will be',
        },
        owners: {
          item: 'The main owner in each department',
          why: 'Someone who can decide the department’s process',
        },
        workflows: {
          item: 'Current workflows',
          why: 'Even in people’s heads or chat groups, they are a starting point',
        },
        stuck: {
          item: 'Where work gets stuck',
          why: 'What to fix first — and how to tell whether the change worked',
        },
        documents: {
          item: 'Key documents',
          why: 'POs, goods receipts, invoices — most work is tied to documents',
        },
        approvals: { item: 'Current approvals', why: 'Who approves what, under which conditions' },
        data: {
          item: 'Existing data',
          why: 'Items, suppliers, customers — where it lives, and how clean it is',
        },
        locations: {
          item: 'Branch and location structure',
          why: 'How many warehouses, and which branch handles what',
        },
        integrations: {
          item: 'Integration requirements',
          why: 'Which systems stay, and what data they must exchange',
        },
      },
    },
    pitfalls: {
      title: 'What tends to trip implementation up',
      items: [
        'Configuring everything at once on day one, instead of starting with what hurts most',
        'Designing workflows without the people who do the work in the room',
        'Moving all existing data without checking it — the old problems move too',
        'Letting everyone see everything “for now” and planning to restrict it later',
        'Treating go-live as the finish line, when improvement starts with real use',
      ],
    },
    links: {
      pricing: 'See packages and scope',
      enterprise: 'Implementation for organizations',
    },
    cta: {
      title: 'Want PDA BLISS to look at your process?',
      body: 'Start with whatever you have from the list above, then let’s talk about where your organization should begin.',
      primary: 'Talk to the PDA BLISS team',
      secondary: 'See packages',
    },
  },
  'zh-CN': {
    intro: {
      p1: '大多数失败的系统上线并不是因为软件失败，而是因为在了解真实工作如何运转之前就开始安装。所以本指南从流程开始，而不是从界面开始。',
      p2: '下面的十个步骤与企业方案页的六个阶段一致——DISCOVER、DESIGN、CONFIGURE、PREPARE、LAUNCH、IMPROVE。实际时间与细节取决于各组织的范围。',
    },
    journey: {
      title: '实施 CORE 的十个步骤',
      caption: '六个阶段中的十个步骤——前两步用于理解，然后才进行配置',
      purpose: '目的',
      output: '产出',
      who: '参与者',
      steps: {
        discover: {
          purpose: '了解组织、目标以及推动变革的原因',
          output: '组织概况以及需要优先解决的问题',
          who: '企业主、高管与 PDA BLISS 团队',
        },
        mapping: {
          purpose: '画出工作实际如何运转——而不是应该如何运转',
          output: '当前流程图，并标出工作卡住的地方',
          who: '部门负责人与实际做事的人',
        },
        responsibility: {
          purpose: '确定每一步由谁负责，以及每个部门需要看到什么',
          output: '职责表以及各部门的信息边界',
          who: '部门负责人与高管',
        },
        workflow: {
          purpose: '设计步骤顺序、必需信息、审批与异常',
          output: '配置前共同确认的工作流',
          who: '部门负责人与 PDA BLISS 团队',
        },
        data: {
          purpose: '准备要导入的现有数据，并去掉不再使用的内容',
          output: '经检查的初始数据——物品、供应商、库位',
          who: '各部门的数据负责人',
        },
        configure: {
          purpose: '按设计设置工作空间、权限与工作流',
          output: '按约定范围配置好的系统',
          who: 'PDA BLISS 团队',
        },
        validate: {
          purpose: '用部分真实工作试运行，找出设计不符之处',
          output: '正式上线前的调整清单',
          who: '各部门实际做事的人',
        },
        train: {
          purpose: '让每个人熟悉自己工作空间中的工作',
          output: '准备好在各自角色中工作的用户',
          who: '各部门用户',
        },
        launch: {
          purpose: '正式上线，初期由团队就近支持',
          output: '真实工作在系统中运转',
          who: '所有部门与 PDA BLISS 团队',
        },
        improve: {
          purpose: '把真实的追溯记录与异常作为改进流程的依据',
          output: '在实际使用中变得更好的流程',
          who: '高管与部门负责人',
        },
      },
    },
    checklist: {
      title: '开始前组织应准备什么',
      p: '不必完整，但准备得越多，前两步就越快。可以直接用这份清单检查准备情况——不会保存或发送任何信息。',
      progress: '已准备 {n} / {total}',
      reset: '清空清单',
      items: {
        departments: { item: '部门名单', why: '以便知道需要几种工作空间' },
        owners: { item: '各部门的主要负责人', why: '能为本部门流程做决定的人' },
        workflows: { item: '当前工作流', why: '即使只在人的脑子里或聊天群里，也可以作为起点' },
        stuck: { item: '工作经常卡住的地方', why: '应优先解决的问题，也用于判断改变是否见效' },
        documents: { item: '重要单据', why: '如采购单、收货单、发票——大部分工作都与单据关联' },
        approvals: { item: '当前的审批', why: '谁在什么条件下审批什么' },
        data: { item: '现有数据', why: '物品、供应商、客户——在哪里、有多干净' },
        locations: { item: '分支与地点结构', why: '有几个仓库，哪个分支负责什么' },
        integrations: { item: '集成需求', why: '哪些系统继续使用，需要交换什么数据' },
      },
    },
    pitfalls: {
      title: '常让实施受阻的情况',
      items: [
        '第一天就同时配置所有内容，而不是先从最痛的地方开始',
        '设计工作流时，实际做事的人不在场',
        '不经检查就迁移全部现有数据——旧问题也会随之迁移',
        '“先”让所有人看到一切，打算以后再限制',
        '把上线当作终点，而改进恰恰从实际使用开始',
      ],
    },
    links: {
      pricing: '查看方案与范围',
      enterprise: '面向组织的实施',
    },
    cta: {
      title: '想请 PDA BLISS 帮您看看流程吗？',
      body: '从上面清单中已有的内容开始，再一起讨论您的组织应从哪里着手。',
      primary: '与 PDA BLISS 团队沟通',
      secondary: '查看方案',
    },
  },
};
