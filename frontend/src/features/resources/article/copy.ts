import type { Localized } from '@/i18n/useCopy';

/*
 * Words of the shared reading system (EP16). No authors and no dates:
 * guides are version-controlled product knowledge, not dated posts.
 */

const th = {
  root: 'คลังความรู้',
  breadcrumb: 'ตำแหน่งในคลังความรู้',
  progress: 'ความคืบหน้าการอ่าน',
  next: 'อ่านต่อ',
  nextLead: 'เรื่องที่ต่อจากคู่มือนี้โดยตรง',
  related: 'ที่เกี่ยวข้องในเว็บไซต์',
  kinds: {
    department: 'หน้าแผนก',
    solution: 'Solutions',
    workflow: 'How CORE Works',
  },
  example: 'ดูตัวอย่าง',
  diagram: 'แผนภาพ',
};

export type ArticleCopy = typeof th;

export const ARTICLE_COPY: Localized<ArticleCopy> = {
  th,
  en: {
    root: 'Resources',
    breadcrumb: 'Location in the library',
    progress: 'Reading progress',
    next: 'Read next',
    nextLead: 'What follows directly from this guide',
    related: 'Related on this site',
    kinds: { department: 'Department page', solution: 'Solutions', workflow: 'How CORE Works' },
    example: 'See an example',
    diagram: 'Diagram',
  },
  'zh-CN': {
    root: '资源中心',
    breadcrumb: '在资源库中的位置',
    progress: '阅读进度',
    next: '继续阅读',
    nextLead: '紧接本指南的内容',
    related: '本站相关内容',
    kinds: { department: '部门页面', solution: '解决方案', workflow: 'CORE 如何运作' },
    example: '查看示例',
    diagram: '示意图',
  },
};
