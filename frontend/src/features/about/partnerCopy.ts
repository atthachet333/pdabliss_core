import type { Localized } from '@/i18n/useCopy';

/*
 * /about chapter 07 (EP24.1, owner-approved): S2 ACCOUNTING CONSULTANT as the
 * business and accounting insight behind CORE. Two separate companies with
 * different roles — no merger, ownership, subsidiary, client numbers or
 * certifications are stated or implied. Company names, the website and the
 * logo come from config/partners.ts (INSIGHT_PARTNER).
 */

const th = {
  label: 'พันธมิตรด้านมุมมองธุรกิจและบัญชี',
  titleA: 'เทคโนโลยี',
  titleB: 'ความเป็นจริงของธุรกิจ',
  lead: 'CORE ไม่ได้ถูกออกแบบจากระบบและ Software เพียงด้านเดียว แต่ถูกหล่อหลอมด้วยมุมมองจากงานบัญชี เอกสาร และกระบวนการธุรกิจที่เกิดขึ้นจริง',
  pda: {
    field: 'เทคโนโลยี',
    role: 'การออกแบบแพลตฟอร์มและระบบ',
    points: [
      'ออกแบบและพัฒนา PDA BLISS CORE',
      'วางโครงสร้างแผนก ขั้นตอน และสิทธิ์การเข้าถึง',
      'เปลี่ยนวิธีทำงานจริงให้เป็นการตั้งค่าที่ใช้ได้',
    ],
  },
  s2: {
    field: 'ความเป็นจริงของธุรกิจ',
    role: 'บัญชี · ที่ปรึกษา · กระบวนการธุรกิจ',
    points: [
      'มุมมองจากงานบัญชีและเอกสารทางการเงิน',
      'ความเข้าใจว่าเอกสารส่งต่อกันระหว่างฝ่ายอย่างไร',
      'คำถามจากการให้คำปรึกษาธุรกิจที่ช่วยทดสอบแนวคิด',
    ],
  },
  bridge: {
    core: 'CORE',
    title: 'จุดที่สองมุมมองมาบรรจบ',
    body: 'แนวคิดของ CORE ถูกตรวจทานกับวิธีที่งานบัญชีและเอกสารเดินจริง เพื่อให้ขั้นตอนในระบบตรงกับสิ่งที่องค์กรต้องทำ ไม่ใช่สิ่งที่ Software อยากให้ทำ',
  },
  boundary:
    'PDA BLISS และ S2 เป็นบริษัทแยกกัน แต่ละบริษัทดูแลงานของตัวเอง — PDA BLISS พัฒนาแพลตฟอร์มและเทคโนโลยี S2 ให้มุมมองด้านบัญชี ที่ปรึกษา และกระบวนการธุรกิจ',
  visit: 'รู้จัก S2',
  external: '(เปิดเว็บไซต์ S2 ในแท็บใหม่)',
  logoAlt: 'โลโก้ S2 ACCOUNTING CONSULTANT',
};

export type PartnerCopy = typeof th;

export const PARTNER: Localized<PartnerCopy> = {
  th,
  en: {
    label: 'Business & Accounting Insight Partner',
    titleA: 'Technology',
    titleB: 'Business Reality',
    lead: 'CORE is shaped not only by software and system design, but by practical insight into accounting, documentation and the way business processes really run.',
    pda: {
      field: 'Technology',
      role: 'Platform and system design',
      points: [
        'Designs and builds PDA BLISS CORE',
        'Structures departments, steps and access',
        'Turns how work really happens into usable configuration',
      ],
    },
    s2: {
      field: 'Business reality',
      role: 'Accounting · advisory · business process',
      points: [
        'A view from accounting and financial paperwork',
        'An understanding of how documents pass between teams',
        'Questions from business advisory that test the design',
      ],
    },
    bridge: {
      core: 'CORE',
      title: 'Where the two perspectives meet',
      body: 'CORE’s ideas are checked against how accounting and documents actually flow, so the steps in the system match what an organization has to do — not what software would like it to do.',
    },
    boundary:
      'PDA BLISS and S2 are separate companies, each responsible for its own work — PDA BLISS develops the platform and technology; S2 contributes the accounting, advisory and business-process perspective.',
    visit: 'Learn about S2',
    external: '(opens the S2 website in a new tab)',
    logoAlt: 'S2 ACCOUNTING CONSULTANT logo',
  },
  'zh-CN': {
    label: '业务与会计洞察伙伴',
    titleA: '技术',
    titleB: '业务现实',
    lead: 'CORE 不仅由软件与系统设计塑造，也源于对会计、单据以及业务流程实际运作方式的务实洞察。',
    pda: {
      field: '技术',
      role: '平台与系统设计',
      points: [
        '设计并开发 PDA BLISS CORE',
        '规划部门、步骤与访问权限',
        '把真实的工作方式转化为可用的配置',
      ],
    },
    s2: {
      field: '业务现实',
      role: '会计 · 咨询 · 业务流程',
      points: [
        '来自会计与财务单据工作的视角',
        '理解单据如何在各部门之间传递',
        '来自业务咨询、用以检验设计的问题',
      ],
    },
    bridge: {
      core: 'CORE',
      title: '两种视角交汇之处',
      body: 'CORE 的设计会对照会计与单据的实际流转方式进行检验，使系统中的步骤符合组织必须完成的工作，而不是软件希望它做的事。',
    },
    boundary:
      'PDA BLISS 与 S2 是两家独立的公司，各自负责自己的工作 — PDA BLISS 开发平台与技术；S2 提供会计、咨询与业务流程方面的视角。',
    visit: '了解 S2',
    external: '（在新标签页中打开 S2 网站）',
    logoAlt: 'S2 ACCOUNTING CONSULTANT 标志',
  },
};
