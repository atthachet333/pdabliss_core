import type { Localized } from '@/i18n/useCopy';

/**
 * The homepage story, in order. Ids are anchor targets (header mega menus,
 * CTAs) and drive the quiet chapter indicator.
 */
export const CHAPTERS = [
  { id: 'core-world', index: '01', label: 'CORE' },
  { id: 'who-for', index: '02', label: 'องค์กรที่เหมาะกับ CORE' },
  { id: 'complexity', index: '03', label: 'เมื่อองค์กรโตเร็วกว่ากระบวนการ' },
  { id: 'why-core', index: '04', label: 'แนวคิดของ CORE' },
  { id: 'department-worlds', index: '05', label: 'โลกการทำงานของแต่ละแผนก' },
  { id: 'connected-flow', index: '06', label: 'เส้นทางงานข้ามแผนก' },
  { id: 'error-control', index: '07', label: 'ป้องกันความผิดพลาด' },
  { id: 'executive', index: '08', label: 'มุมมองผู้บริหาร' },
  { id: 'enterprise', index: '09', label: 'เติบโตไปกับองค์กร' },
  { id: 'trust', index: '10', label: 'PDA BLISS' },
  { id: 'begin', index: '11', label: 'เริ่มต้นกับ CORE' },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]['id'];

export function chapter(id: ChapterId) {
  return CHAPTERS.find((c) => c.id === id)!;
}

/** Chapter labels per locale (Thai labels above are the source). */
export const CHAPTER_LABELS: Localized<Record<ChapterId, string>> = {
  th: Object.fromEntries(CHAPTERS.map((c) => [c.id, c.label])) as Record<ChapterId, string>,
  en: {
    'core-world': 'CORE',
    'who-for': 'Who CORE is for',
    complexity: 'When growth outpaces process',
    'why-core': 'The CORE idea',
    'department-worlds': 'Department worlds',
    'connected-flow': 'Work across departments',
    'error-control': 'Preventing mistakes',
    executive: 'The executive view',
    enterprise: 'Growing with you',
    trust: 'PDA BLISS',
    begin: 'Start with CORE',
  },
  'zh-CN': {
    'core-world': 'CORE',
    'who-for': '适合 CORE 的企业',
    complexity: '当企业成长快于流程',
    'why-core': 'CORE 的理念',
    'department-worlds': '各部门的工作世界',
    'connected-flow': '跨部门工作路径',
    'error-control': '预防错误',
    executive: '管理层视角',
    enterprise: '与企业共同成长',
    trust: 'PDA BLISS',
    begin: '开始使用 CORE',
  },
};
