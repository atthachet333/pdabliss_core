import { useCopy, type Localized } from '@/i18n/useCopy';

/**
 * EP00 SAMPLE plan structure only. No commercial pricing has been decided —
 * prices must not be invented here. Every plan covers exactly one company workspace.
 */
export type PlanId = 'starter' | 'business' | 'professional' | 'enterprise';

const DIMENSIONS = [
  'users',
  'departments',
  'warehouses',
  'approvals',
  'automation',
  'analytics',
  'api',
  'support',
] as const;
type Dimension = (typeof DIMENSIONS)[number];

const PLAN_META: { id: PlanId; name: string; highlight?: boolean }[] = [
  { id: 'starter', name: 'Starter' },
  { id: 'business', name: 'Business', highlight: true },
  { id: 'professional', name: 'Professional' },
  { id: 'enterprise', name: 'Enterprise' },
];

/** `null` = not included. */
type PlanText = { audience: string; values: Record<Dimension, string | null> };

interface PlansCopy {
  disclaimer: string;
  dimensions: Record<Dimension, string>;
  plans: Record<PlanId, PlanText>;
  ui: {
    featured: string;
    price: string;
    priceTbd: string;
    notIncluded: string;
    ask: string;
    notRealPrice: string;
    compare: string;
    capability: string;
    compareCaption: string;
  };
}

const TEXT: Localized<PlansCopy> = {
  th: {
    disclaimer: 'โครงสร้างแพ็กเกจตัวอย่าง',
    dimensions: {
      users: 'ผู้ใช้งาน',
      departments: 'แผนกที่เปิดใช้',
      warehouses: 'คลังสินค้า',
      approvals: 'การอนุมัติ',
      automation: 'ระบบอัตโนมัติ',
      analytics: 'การวิเคราะห์',
      api: 'API',
      support: 'การสนับสนุน',
    },
    plans: {
      starter: {
        audience: 'ทีมที่เริ่มเชื่อมงานระหว่าง 2–3 แผนก',
        values: {
          users: 'ทีมขนาดเล็ก',
          departments: 'แผนกหลักที่เลือก',
          warehouses: '1 คลัง',
          approvals: 'ขั้นเดียว',
          automation: 'การแจ้งเตือนพื้นฐาน',
          analytics: 'รายงานประจำแผนก',
          api: null,
          support: 'อีเมล',
        },
      },
      business: {
        audience: 'ธุรกิจที่ต้องการให้ทุกแผนกหลักทำงานบนระบบเดียว',
        values: {
          users: 'หลายทีม',
          departments: 'ทุกแผนกหลัก',
          warehouses: 'หลายคลัง',
          approvals: 'หลายขั้นตามวงเงิน',
          automation: 'กฎแจ้งเตือนข้อยกเว้น',
          analytics: 'ภาพรวมผู้บริหาร',
          api: null,
          support: 'อีเมล + แชท',
        },
      },
      professional: {
        audience: 'องค์กรที่ต้องการควบคุมเวิร์กโฟลว์และการวิเคราะห์เชิงลึก',
        values: {
          users: 'ทั้งองค์กร',
          departments: 'ทุกแผนก',
          warehouses: 'หลายคลัง + ตำแหน่งจัดเก็บ',
          approvals: 'ปรับแต่งเงื่อนไขได้',
          automation: 'เวิร์กโฟลว์อัตโนมัติ',
          analytics: 'วิเคราะห์ข้ามแผนก',
          api: 'API มาตรฐาน',
          support: 'ผู้ดูแลที่ได้รับมอบหมาย',
        },
      },
      enterprise: {
        audience: 'องค์กรที่มีกระบวนการเฉพาะและต้องการเชื่อมต่อระบบภายนอก',
        values: {
          users: 'ตามข้อตกลง',
          departments: 'ทุกแผนก + โมดูลเฉพาะ',
          warehouses: 'ตามความต้องการ',
          approvals: 'ปรับแต่งเต็มรูปแบบ',
          automation: 'ปรับแต่งเต็มรูปแบบ',
          analytics: 'ปรับแต่งรายงาน',
          api: 'API + การเชื่อมต่อเฉพาะ',
          support: 'ตามข้อตกลงระดับบริการ',
        },
      },
    },
    ui: {
      featured: 'เหมาะกับธุรกิจส่วนใหญ่',
      price: 'ราคา',
      priceTbd: 'อยู่ระหว่างกำหนด',
      notIncluded: 'ไม่รวม',
      ask: 'สอบถามแพ็กเกจ',
      notRealPrice: 'ยังไม่ใช่ราคาจริง',
      compare: 'เปรียบเทียบโครงสร้างแพ็กเกจ',
      capability: 'ความสามารถ',
      compareCaption: 'เปรียบเทียบความสามารถของแต่ละแพ็กเกจ',
    },
  },
  en: {
    disclaimer: 'Sample package structure',
    dimensions: {
      users: 'Users',
      departments: 'Departments enabled',
      warehouses: 'Warehouses',
      approvals: 'Approvals',
      automation: 'Automation',
      analytics: 'Analytics',
      api: 'API',
      support: 'Support',
    },
    plans: {
      starter: {
        audience: 'Teams starting to connect work across 2–3 departments',
        values: {
          users: 'Small team',
          departments: 'Selected core departments',
          warehouses: '1 warehouse',
          approvals: 'Single step',
          automation: 'Basic notifications',
          analytics: 'Department reports',
          api: null,
          support: 'Email',
        },
      },
      business: {
        audience: 'Businesses that want every core department on one system',
        values: {
          users: 'Several teams',
          departments: 'All core departments',
          warehouses: 'Multiple warehouses',
          approvals: 'Multi-step by amount',
          automation: 'Exception alert rules',
          analytics: 'Executive overview',
          api: null,
          support: 'Email + chat',
        },
      },
      professional: {
        audience: 'Organizations that need workflow control and deeper analysis',
        values: {
          users: 'Whole organization',
          departments: 'All departments',
          warehouses: 'Multiple warehouses + bin locations',
          approvals: 'Configurable conditions',
          automation: 'Automated workflows',
          analytics: 'Cross-department analysis',
          api: 'Standard API',
          support: 'Dedicated contact',
        },
      },
      enterprise: {
        audience: 'Organizations with specific processes that need external integrations',
        values: {
          users: 'By agreement',
          departments: 'All departments + specific modules',
          warehouses: 'As required',
          approvals: 'Fully configurable',
          automation: 'Fully configurable',
          analytics: 'Custom reports',
          api: 'API + custom integrations',
          support: 'By service-level agreement',
        },
      },
    },
    ui: {
      featured: 'Suits most businesses',
      price: 'Price',
      priceTbd: 'To be confirmed',
      notIncluded: 'Not included',
      ask: 'Ask about this package',
      notRealPrice: 'not final pricing',
      compare: 'Compare package structures',
      capability: 'Capability',
      compareCaption: 'Capabilities of each package',
    },
  },
  'zh-CN': {
    disclaimer: '方案结构示例',
    dimensions: {
      users: '用户',
      departments: '启用部门',
      warehouses: '仓库',
      approvals: '审批',
      automation: '自动化',
      analytics: '分析',
      api: 'API',
      support: '支持',
    },
    plans: {
      starter: {
        audience: '开始连接 2–3 个部门工作的团队',
        values: {
          users: '小型团队',
          departments: '选定的核心部门',
          warehouses: '1 个仓库',
          approvals: '单级',
          automation: '基础通知',
          analytics: '部门报表',
          api: null,
          support: '邮件',
        },
      },
      business: {
        audience: '希望所有核心部门在同一系统上工作的企业',
        values: {
          users: '多个团队',
          departments: '所有核心部门',
          warehouses: '多个仓库',
          approvals: '按金额多级审批',
          automation: '例外提醒规则',
          analytics: '管理层概览',
          api: null,
          support: '邮件 + 在线沟通',
        },
      },
      professional: {
        audience: '需要工作流管控与深入分析的组织',
        values: {
          users: '全公司',
          departments: '所有部门',
          warehouses: '多个仓库 + 库位',
          approvals: '可配置条件',
          automation: '自动化工作流',
          analytics: '跨部门分析',
          api: '标准 API',
          support: '专属对接人',
        },
      },
      enterprise: {
        audience: '流程特殊、需要连接外部系统的组织',
        values: {
          users: '按协议',
          departments: '所有部门 + 专属模块',
          warehouses: '按需求',
          approvals: '完全可配置',
          automation: '完全可配置',
          analytics: '定制报表',
          api: 'API + 定制集成',
          support: '按服务级别协议',
        },
      },
    },
    ui: {
      featured: '适合大多数企业',
      price: '价格',
      priceTbd: '待定',
      notIncluded: '不包含',
      ask: '咨询此方案',
      notRealPrice: '并非正式价格',
      compare: '方案结构比较',
      capability: '能力',
      compareCaption: '各方案的能力比较',
    },
  },
};

export interface PlanDefinition {
  id: PlanId;
  name: string;
  audience: string;
  highlight?: boolean;
  limits: { key: Dimension; label: string; value: string | null }[];
}

export function usePlans() {
  const t = useCopy(TEXT);
  const plans: PlanDefinition[] = PLAN_META.map((m) => ({
    ...m,
    audience: t.plans[m.id].audience,
    limits: DIMENSIONS.map((key) => ({
      key,
      label: t.dimensions[key],
      value: t.plans[m.id].values[key],
    })),
  }));
  return {
    plans,
    dimensions: DIMENSIONS.map((key) => ({ key, label: t.dimensions[key] })),
    disclaimer: t.disclaimer,
    ui: t.ui,
  };
}
