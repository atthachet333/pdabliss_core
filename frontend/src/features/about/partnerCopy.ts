import type { Localized } from '@/i18n/useCopy';

/*
 * /about chapter 07 (EP24.1, owner-approved): S2 ACCOUNTING CONSULTANT as the
 * accounting and business-advisory perspective behind CORE. Two separate
 * companies with different roles — no merger, ownership, client numbers or
 * certifications are stated or implied. Company names and the website come
 * from config/partners.ts (INSIGHT_PARTNER).
 *
 * `|` marks where a display line may wrap on narrow screens.
 */

const th = {
  kicker: 'มุมมองทางธุรกิจ',
  title: 'เทคโนโลยี × ความเป็นจริง|ของธุรกิจ',
  lead: 'CORE ไม่ได้ถูกออกแบบจากมุมมองของ Software เพียงด้านเดียว PDA BLISS ออกแบบระบบและแพลตฟอร์ม ส่วน S2 ช่วยให้มุมมองจากงานบัญชี การให้คำปรึกษา และการเดินของเอกสารในองค์กรจริง',
  pda: {
    role: 'เทคโนโลยี · การออกแบบแพลตฟอร์ม',
    points: [
      'ออกแบบและพัฒนา PDA BLISS CORE',
      'วางโครงสร้างแผนก ขั้นตอน และสิทธิ์การเข้าถึง',
      'เปลี่ยนวิธีทำงานจริงให้เป็นการตั้งค่าที่ใช้ได้',
    ],
  },
  s2: {
    role: 'บัญชี · ที่ปรึกษา · กระบวนการธุรกิจ',
    points: [
      'มุมมองจากงานบัญชีและเอกสารทางการเงิน',
      'ความเข้าใจว่าเอกสารส่งต่อกันระหว่างฝ่ายอย่างไร',
      'คำถามจากการให้คำปรึกษาธุรกิจที่ช่วยทดสอบแนวคิด',
    ],
  },
  bridge: {
    title: 'สิ่งที่เกิดขึ้นตรงกลาง',
    body: 'แนวคิดของ CORE ถูกตรวจทานกับวิธีที่งานบัญชีและเอกสารเดินจริง เพื่อให้ขั้นตอนในระบบตรงกับสิ่งที่องค์กรต้องทำ ไม่ใช่สิ่งที่ Software อยากให้ทำ',
    core: 'CORE',
  },
  boundary:
    'PDA BLISS และ S2 เป็นบริษัทแยกกัน แต่ละบริษัทดูแลงานของตัวเอง — PDA BLISS ดูแลผลิตภัณฑ์และการนำไปใช้ S2 ดูแลงานบัญชีและที่ปรึกษา',
  visit: 'เยี่ยมชมเว็บไซต์ S2',
  external: '(เปิดในแท็บใหม่)',
  logoAlt: 'โลโก้ S2 ACCOUNTING CONSULTANT',
};

export type PartnerCopy = typeof th;

export const PARTNER: Localized<PartnerCopy> = {
  th,
  en: {
    kicker: 'Business perspective',
    title: 'Technology × business|reality',
    lead: 'CORE is not designed from software thinking alone. PDA BLISS designs the system and the platform; S2 brings the perspective of accounting work, advisory practice and how documents really move through an organization.',
    pda: {
      role: 'Technology · platform design',
      points: [
        'Designs and builds PDA BLISS CORE',
        'Structures departments, steps and access',
        'Turns how work really happens into usable configuration',
      ],
    },
    s2: {
      role: 'Accounting · advisory · business process',
      points: [
        'A view from accounting and financial paperwork',
        'An understanding of how documents pass between teams',
        'Questions from business advisory that test the design',
      ],
    },
    bridge: {
      title: 'What happens in between',
      body: 'CORE’s ideas are checked against how accounting and documents actually flow, so the steps in the system match what an organization has to do — not what software would like it to do.',
      core: 'CORE',
    },
    boundary:
      'PDA BLISS and S2 are separate companies, each responsible for its own work — PDA BLISS for the product and its implementation, S2 for accounting and advisory services.',
    visit: 'Visit the S2 website',
    external: '(opens in a new tab)',
    logoAlt: 'S2 ACCOUNTING CONSULTANT logo',
  },
  'zh-CN': {
    kicker: '业务视角',
    title: '技术 × 业务|现实',
    lead: 'CORE 并非只从软件角度设计。PDA BLISS 负责系统与平台设计；S2 带来会计工作、咨询实践以及单据在组织中真实流转方式的视角。',
    pda: {
      role: '技术 · 平台设计',
      points: [
        '设计并开发 PDA BLISS CORE',
        '规划部门、步骤与访问权限',
        '把真实的工作方式转化为可用的配置',
      ],
    },
    s2: {
      role: '会计 · 咨询 · 业务流程',
      points: [
        '来自会计与财务单据工作的视角',
        '理解单据如何在各部门之间传递',
        '来自业务咨询、用以检验设计的问题',
      ],
    },
    bridge: {
      title: '两者之间',
      body: 'CORE 的设计会对照会计与单据的实际流转方式进行检验，使系统中的步骤符合组织必须完成的工作，而不是软件希望它做的事。',
      core: 'CORE',
    },
    boundary:
      'PDA BLISS 与 S2 是两家独立的公司，各自负责自己的工作 — PDA BLISS 负责产品与实施，S2 负责会计与咨询服务。',
    visit: '访问 S2 网站',
    external: '（在新标签页中打开）',
    logoAlt: 'S2 ACCOUNTING CONSULTANT 标志',
  },
};
