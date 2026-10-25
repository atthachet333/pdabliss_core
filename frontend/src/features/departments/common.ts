import type { Localized } from '@/i18n/useCopy';

/** Labels shared by every department page (EP06). Thai is the source. */
const th = {
  switcher: 'แผนกใน CORE',
  overview: 'ทุกแผนก',
  current: 'หน้านี้',
  io: {
    eyebrow: 'Work in · Work out',
    in: 'งานที่เข้ามา',
    do: 'สิ่งที่ต้องทำ',
    out: 'สิ่งที่ส่งต่อ',
  },
  today: { eyebrow: 'Today', label: 'วันนี้', sample: 'ตัวอย่างสถานะ — ไม่ใช่ข้อมูลจริง' },
  manager: {
    eyebrow: 'Manager perspective',
    employee: 'พนักงาน',
    employeeSub: 'งานที่ฉันต้องทำ',
    manager: 'หัวหน้าแผนก',
    managerSub: 'งานของทีม',
  },
  preview: {
    eyebrow: 'Real CORE preview',
    figure: (name: string) => `ตัวอย่างหน้าจอ${name} (ข้อมูลตัวอย่าง)`,
    caption: 'หน้าจอจริงจากระบบต้นแบบ แสดงด้วยข้อมูลตัวอย่าง',
  },
  connected: {
    eyebrow: 'Connected through CORE',
    title: 'งานนี้เชื่อมต่อกับ…',
    lead: 'งานของแผนกนี้ไม่ได้จบอยู่ในแผนกเดียว — ทุกการส่งต่อเกิดบนข้อมูลชุดเดียวกัน',
    open: 'ดูแผนก',
    supplier: 'Supplier',
    customer: 'ลูกค้า',
  },
  cta: {
    title: 'อยากเห็นว่าแผนกของคุณจะทำงานใน CORE อย่างไร?',
    lead: 'เล่าให้เราฟังว่าวันนี้ทีมทำงานอย่างไร แล้วเราจะช่วยดูว่าควรเริ่มจากตรงไหน',
    how: 'ดูวิธีการทำงานของ CORE',
    consult: 'ขอคำปรึกษา',
    tryRole: 'ลองมุมมองแผนกนี้ใน Demo',
    explore: 'สำรวจแผนกอื่น',
  },
};

export const COMMON: Localized<typeof th> = {
  th,
  en: {
    switcher: 'Departments in CORE',
    overview: 'All departments',
    current: 'This page',
    io: {
      eyebrow: 'Work in · Work out',
      in: 'Work coming in',
      do: 'What to do',
      out: 'What is handed on',
    },
    today: { eyebrow: 'Today', label: 'Today', sample: 'Example states — not real data' },
    manager: {
      eyebrow: 'Manager perspective',
      employee: 'Team member',
      employeeSub: 'The work I need to do',
      manager: 'Department lead',
      managerSub: 'The team’s work',
    },
    preview: {
      eyebrow: 'Real CORE preview',
      figure: (name) => `${name} screen preview (sample data)`,
      caption:
        'A real screen from the prototype, shown with sample data. The product interface is in Thai.',
    },
    connected: {
      eyebrow: 'Connected through CORE',
      title: 'This work connects to…',
      lead: 'This department’s work doesn’t end inside it — every handoff happens on the same data.',
      open: 'View department',
      supplier: 'Supplier',
      customer: 'Customer',
    },
    cta: {
      title: 'Want to see how your department would work in CORE?',
      lead: 'Tell us how your team works today, and we’ll help you see where to start.',
      how: 'See how CORE works',
      consult: 'Request a consultation',
      tryRole: 'Try this department’s view in the demo',
      explore: 'Explore other departments',
    },
  },
  'zh-CN': {
    switcher: 'CORE 中的部门',
    overview: '全部部门',
    current: '当前页面',
    io: {
      eyebrow: 'Work in · Work out',
      in: '流入的工作',
      do: '需要完成的事',
      out: '交接出去的内容',
    },
    today: { eyebrow: 'Today', label: '今天', sample: '示例状态——并非真实数据' },
    manager: {
      eyebrow: 'Manager perspective',
      employee: '员工',
      employeeSub: '我需要完成的工作',
      manager: '部门主管',
      managerSub: '团队的工作',
    },
    preview: {
      eyebrow: 'Real CORE preview',
      figure: (name) => `${name}界面预览（示例数据）`,
      caption: '来自原型系统的真实界面，使用示例数据展示。产品界面为泰语。',
    },
    connected: {
      eyebrow: 'Connected through CORE',
      title: '这项工作连接到……',
      lead: '本部门的工作并不止于部门内部——每一次交接都基于同一套数据。',
      open: '查看部门',
      supplier: '供应商',
      customer: '客户',
    },
    cta: {
      title: '想看看您的部门在 CORE 中如何工作？',
      lead: '告诉我们团队今天的工作方式，我们将帮您判断从哪里开始。',
      how: '了解 CORE 如何运作',
      consult: '申请咨询',
      tryRole: '在演示中体验这个部门的视图',
      explore: '探索其他部门',
    },
  },
};

/* ---------- Shapes shared by the department copy modules ---------- */

export interface IoCopy {
  title: string;
  in: readonly string[];
  do: readonly string[];
  out: readonly string[];
}

export type Tone = 'calm' | 'attention' | 'blocked' | 'done';

export interface TodayCopy {
  title: string;
  lead: string;
  groups: readonly { label: string; count: number; tone: Tone; items: readonly string[] }[];
}

export interface ManagerCopy {
  title: string;
  lead: string;
  employee: readonly string[];
  manager: readonly string[];
}

/** One hop in the connected-work chain shown at a page's foot. */
export interface ChainHop {
  /** Department key, or 'supplier' / 'customer' for external parties. */
  at: string;
  what: string;
}

export interface ConnectionsCopy {
  chain: readonly ChainHop[];
}
