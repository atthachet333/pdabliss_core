import type { Localized } from '@/i18n/useCopy';

const th = {
  intro:
    'CORE ใช้คำชุดเดียวกันทั้งเว็บไซต์ Demo และระบบ คำแต่ละคำมีความหมายเดียว อภิธานศัพท์นี้รวบรวมคำเหล่านั้นพร้อมตัวอย่าง และบอกว่าคำนั้นถูกอธิบายละเอียดในคู่มือใด',
  search: 'ค้นหาคำศัพท์',
  placeholder: 'พิมพ์คำไทยหรืออังกฤษ เช่น Handoff หรือ วันหมดอายุ',
  categories: 'หมวดคำศัพท์',
  all: 'ทั้งหมด',
  index: 'ดัชนีตามตัวอักษร',
  count: '{n} คำ',
  none: 'ไม่พบคำที่ตรงกับ “{q}” — ลองพิมพ์เป็นภาษาอังกฤษ หรือเลือกหมวด “ทั้งหมด”',
  example: 'ตัวอย่าง',
  see: 'อธิบายละเอียดใน',
  english: 'คำภาษาอังกฤษ',
  links: { demo: 'ลองใน CORE Demo', how: 'ดู How CORE Works' },
  cta: {
    title: 'เห็นคำเหล่านี้ทำงานจริง',
    body: 'Demo ใช้คำชุดเดียวกันนี้ — เจ้าของงาน สถานะ การส่งต่อ ข้อยกเว้น และการย้อนรอย',
    primary: 'เปิด CORE Demo',
    secondary: 'เริ่มต้นกับ CORE',
  },
};

export const GLOSSARY_PAGE: Localized<typeof th> = {
  th,
  en: {
    intro:
      'CORE uses one set of words across the website, the demo and the system, each with one meaning. This glossary collects them with examples, and says which guide explains each one in depth.',
    search: 'Search the glossary',
    placeholder: 'Type a term, e.g. handoff or expiry',
    categories: 'Glossary categories',
    all: 'All',
    index: 'Alphabetical index',
    count: '{n} terms',
    none: 'No term matches “{q}” — try another word, or choose “All”',
    example: 'Example',
    see: 'Explained in',
    english: 'English term',
    links: { demo: 'Try the CORE demo', how: 'See How CORE Works' },
    cta: {
      title: 'See these words at work',
      body: 'The demo uses this same vocabulary — owners, states, handoffs, exceptions and trace.',
      primary: 'Open the CORE demo',
      secondary: 'Getting started with CORE',
    },
  },
  'zh-CN': {
    intro:
      'CORE 在网站、演示和系统中使用同一套词语，每个词只有一个含义。本术语表汇集这些词语并附示例，同时说明每个词在哪份指南中有详细解释。',
    search: '搜索术语',
    placeholder: '输入中文或英文，例如：交接、有效期',
    categories: '术语类别',
    all: '全部',
    index: '字母索引',
    count: '{n} 个术语',
    none: '没有与“{q}”匹配的术语——试试英文，或选择“全部”',
    example: '示例',
    see: '详见',
    english: '英文术语',
    links: { demo: '体验 CORE 演示', how: '查看 CORE 如何运作' },
    cta: {
      title: '看看这些词语如何实际运作',
      body: '演示使用的正是这套词语——负责人、状态、交接、异常与追溯。',
      primary: '打开 CORE 演示',
      secondary: '开始了解 CORE',
    },
  },
};
