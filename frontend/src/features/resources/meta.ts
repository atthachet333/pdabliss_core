import type { Localized } from '@/i18n/useCopy';
import type { Category, Filter, ResourceId } from './registry';

/*
 * Light, localized metadata for every published resource: what /resources,
 * search and the mega menu need. Full guide copy lives in each guide's own
 * chunk, so the library home never downloads every article.
 */

export interface ResourceMeta {
  title: string;
  /** One line for menus and results. */
  short: string;
  summary: string;
  tags: readonly string[];
}

type MetaCopy = {
  categories: Record<Category, string>;
  filters: Record<Filter, string>;
  minutes: string;
  resources: Record<ResourceId, ResourceMeta>;
};

const th: MetaCopy = {
  categories: {
    start: 'เริ่มต้นกับ CORE',
    workflow: 'Workflow & Operations',
    control: 'Human Error & Control',
    warehouse: 'Warehouse & Inventory',
    implementation: 'Implementation',
    security: 'Security & Data',
    terminology: 'คำศัพท์',
  },
  filters: {
    all: 'ทั้งหมด',
    start: 'เริ่มต้น',
    workflow: 'Workflow',
    control: 'การควบคุม',
    warehouse: 'คลังสินค้า',
    implementation: 'การนำไปใช้',
    security: 'Security',
  },
  minutes: 'อ่านประมาณ {n} นาที',
  resources: {
    gettingStarted: {
      title: 'เริ่มต้นกับ CORE',
      short: 'CORE คืออะไร และควรเริ่มจากตรงไหน',
      summary:
        'CORE คืออะไร ไม่ใช่อะไร แต่ละแผนกใช้ต่างกันอย่างไร และขั้นต่อไปหลังอ่านจบ — คู่มือสั้นสำหรับคนที่เพิ่งรู้จัก CORE',
      tags: ['พื้นฐาน', 'Workspace', 'แผนก', 'Workflow', 'Demo', 'เริ่มต้น'],
    },
    howCoreWorks: {
      title: 'งานหนึ่งชิ้น จากต้นจนจบใน CORE',
      short: 'เจ้าของงาน สถานะ การส่งต่อ และการย้อนรอย',
      summary:
        'เจ้าของงาน สถานะ การส่งต่อ การอนุมัติ ข้อยกเว้น และการย้อนรอย — อธิบายทีละขั้นด้วยคำสั่งซื้อตัวอย่าง SO-1042',
      tags: ['Work Item', 'เจ้าของงาน', 'สถานะ', 'Handoff', 'การอนุมัติ', 'ข้อยกเว้น', 'Trace'],
    },
    humanError: {
      title: 'Human Error: ป้องกัน ตรวจพบ แจ้งเตือน ควบคุม ย้อนรอย',
      short: 'ห้าหลักการที่ช่วยจับความผิดพลาดระหว่างทาง',
      summary:
        'คนทำผิดพลาดได้เสมอ — คู่มือนี้อธิบายว่าการออกแบบระบบช่วยลดและจับความผิดพลาดระหว่างทางได้อย่างไร และขีดจำกัดอยู่ตรงไหน',
      tags: ['ป้องกัน', 'ตรวจพบ', 'แจ้งเตือน', 'ควบคุม', 'ย้อนรอย', 'Lot', 'วันหมดอายุ', 'เอกสาร'],
    },
    warehousePrivacy: {
      title: 'ทำไมคลังสินค้าไม่เห็นราคา',
      short: 'การมองเห็นตามหน้าที่ ด้วยตัวอย่างที่ชัดที่สุด',
      summary:
        'คำอธิบายหลักของ CORE เรื่องการมองเห็นตามหน้าที่ — คลังเห็นอะไร ไม่เห็นอะไร เพราะอะไร และขอบเขตนี้ควรถูกบังคับใช้ที่ไหน',
      tags: ['คลังสินค้า', 'ขอบเขตข้อมูล', 'การมองเห็น', 'Lot', 'วันหมดอายุ', 'ราคา'],
    },
    implementationGuide: {
      title: 'คู่มือการนำ CORE ไปใช้',
      short: 'สิบขั้น และสิ่งที่ควรเตรียมก่อนเริ่ม',
      summary:
        'สิบขั้นตั้งแต่ทำความเข้าใจองค์กรจนถึงการปรับปรุงหลังเริ่มใช้ พร้อมรายการสิ่งที่องค์กรควรเตรียมก่อนเริ่ม',
      tags: ['Implementation', 'Process', 'Workflow', 'Checklist', 'ข้อมูลเดิม', 'การฝึกอบรม'],
    },
    securityAndData: {
      title: 'ความปลอดภัยและข้อมูล ฉบับเข้าใจง่าย',
      short: 'ขอบเขต การบังคับใช้ และสิ่งที่ยังไม่อ้าง',
      summary:
        'ทำไมขอบเขตการมองเห็นสำคัญ ทำไมการซ่อนบนหน้าจอยังไม่พอ การย้อนรอย ความพร้อมก่อนใช้งานจริง และสิ่งที่ PDA BLISS ยังไม่อ้าง',
      tags: ['Security', 'สิทธิ์', 'ขอบเขตข้อมูล', 'Server', 'Backup', 'การย้อนรอย'],
    },
    coreGlossary: {
      title: 'อภิธานศัพท์ CORE',
      short: 'คำที่ใช้ทั่วทั้ง CORE ในความหมายเดียวกัน',
      summary: 'คำที่ใช้ทั่วทั้ง CORE พร้อมความหมายสั้น ๆ และตัวอย่าง — ค้นหาและกรองตามหมวดได้',
      tags: ['คำศัพท์', 'นิยาม', 'Glossary'],
    },
  },
};

export const RESOURCE_META: Localized<MetaCopy> = {
  th,
  en: {
    categories: {
      start: 'Getting started',
      workflow: 'Workflow & Operations',
      control: 'Human Error & Control',
      warehouse: 'Warehouse & Inventory',
      implementation: 'Implementation',
      security: 'Security & Data',
      terminology: 'Terminology',
    },
    filters: {
      all: 'All',
      start: 'Start',
      workflow: 'Workflow',
      control: 'Control',
      warehouse: 'Warehouse',
      implementation: 'Implementation',
      security: 'Security',
    },
    minutes: 'About {n} min read',
    resources: {
      gettingStarted: {
        title: 'Getting started with CORE',
        short: 'What CORE is, and where to begin',
        summary:
          'What CORE is and is not, how each department uses it differently, and what to do next — a short guide for people new to CORE.',
        tags: ['Basics', 'Workspace', 'Departments', 'Workflow', 'Demo', 'Start'],
      },
      howCoreWorks: {
        title: 'One work item, start to finish in CORE',
        short: 'Owners, states, handoffs and trace',
        summary:
          'Owners, states, handoffs, approval, exceptions and trace — explained step by step with the sample order SO-1042.',
        tags: ['Work item', 'Owner', 'State', 'Handoff', 'Approval', 'Exception', 'Trace'],
      },
      humanError: {
        title: 'Human error: prevent, detect, alert, control, trace',
        short: 'Five principles that catch mistakes along the way',
        summary:
          'People will always make mistakes. This guide explains how system design reduces them and catches them along the way — and where its limits are.',
        tags: ['Prevent', 'Detect', 'Alert', 'Control', 'Trace', 'Lot', 'Expiry', 'Documents'],
      },
      warehousePrivacy: {
        title: 'Why the warehouse does not see prices',
        short: 'Visibility by responsibility, with the clearest example',
        summary:
          'CORE’s reference explanation of visibility by responsibility — what the warehouse sees, what it does not, why, and where that boundary should be enforced.',
        tags: ['Warehouse', 'Information boundary', 'Visibility', 'Lot', 'Expiry', 'Price'],
      },
      implementationGuide: {
        title: 'Implementing CORE: a practical guide',
        short: 'Ten steps, and what to prepare first',
        summary:
          'Ten steps from understanding the organization to improving after go-live, with a checklist of what to prepare before you start.',
        tags: ['Implementation', 'Process', 'Workflow', 'Checklist', 'Existing data', 'Training'],
      },
      securityAndData: {
        title: 'Security and data, in plain language',
        short: 'Boundaries, enforcement and what is not claimed',
        summary:
          'Why visibility boundaries matter, why hiding on screen is not enough, traceability, readiness before live use, and what PDA BLISS does not claim yet.',
        tags: ['Security', 'Permissions', 'Information boundary', 'Server', 'Backup', 'Trace'],
      },
      coreGlossary: {
        title: 'CORE glossary',
        short: 'The words CORE uses, with one meaning each',
        summary:
          'The terms used across CORE, with short definitions and examples — searchable and filterable by category.',
        tags: ['Terminology', 'Definitions', 'Glossary'],
      },
    },
  },
  'zh-CN': {
    categories: {
      start: '开始了解 CORE',
      workflow: '工作流与运营',
      control: '人为差错与控制',
      warehouse: '仓库与库存',
      implementation: '实施',
      security: '安全与数据',
      terminology: '术语',
    },
    filters: {
      all: '全部',
      start: '入门',
      workflow: '工作流',
      control: '控制',
      warehouse: '仓库',
      implementation: '实施',
      security: '安全',
    },
    minutes: '约 {n} 分钟阅读',
    resources: {
      gettingStarted: {
        title: '开始了解 CORE',
        short: 'CORE 是什么，从哪里开始',
        summary:
          'CORE 是什么、不是什么、各部门如何以不同方式使用，以及读完后的下一步——写给初次了解 CORE 的人的简短指南。',
        tags: ['基础', '工作空间', '部门', '工作流', '演示', '入门'],
      },
      howCoreWorks: {
        title: '一项工作在 CORE 中从头到尾',
        short: '负责人、状态、交接与追溯',
        summary: '负责人、状态、交接、审批、异常与追溯——以示例订单 SO-1042 逐步说明。',
        tags: ['工作项', '负责人', '状态', '交接', '审批', '异常', '追溯'],
      },
      humanError: {
        title: '人为差错：预防、发现、提醒、管控、追溯',
        short: '在过程中抓住差错的五个原则',
        summary:
          '人总会出错。本指南说明系统设计如何减少差错、在过程中及时发现差错，以及它的局限在哪里。',
        tags: ['预防', '发现', '提醒', '管控', '追溯', '批次', '有效期', '单据'],
      },
      warehousePrivacy: {
        title: '为什么仓库看不到价格',
        short: '按职责划分可见范围，最清楚的例子',
        summary:
          'CORE 对“按职责划分可见范围”的标准说明——仓库能看到什么、看不到什么、为什么，以及这条边界应在哪里执行。',
        tags: ['仓库', '信息边界', '可见范围', '批次', '有效期', '价格'],
      },
      implementationGuide: {
        title: 'CORE 实施指南',
        short: '十个步骤，以及开始前要准备什么',
        summary: '从了解组织到上线后持续改进的十个步骤，并附开始前需要准备的清单。',
        tags: ['实施', '流程', '工作流', '清单', '现有数据', '培训'],
      },
      securityAndData: {
        title: '安全与数据，通俗说明',
        short: '边界、执行，以及尚未作出的声明',
        summary:
          '为什么可见边界很重要、为什么仅在界面上隐藏还不够、可追溯性、正式使用前的准备，以及 PDA BLISS 目前不作的声明。',
        tags: ['安全', '权限', '信息边界', '服务器', '备份', '追溯'],
      },
      coreGlossary: {
        title: 'CORE 术语表',
        short: 'CORE 使用的词语，每个只有一个含义',
        summary: 'CORE 中使用的术语，附简短定义与示例——可搜索，也可按类别筛选。',
        tags: ['术语', '定义', '术语表'],
      },
    },
  },
};
