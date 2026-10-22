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
