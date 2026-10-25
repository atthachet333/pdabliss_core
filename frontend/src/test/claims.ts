/*
 * The shared claim-safety and language scanner (EP15, shared since EP16).
 * /security and the Resource Center read the same patterns, so a claim that
 * is blocked on one page can never slip through on another.
 */

export const LOCALES = ['th', 'en', 'zh-CN'] as const;
export const THAI = /[฀-฾เ-๿]/;
export const TRADITIONAL = /[們個發這開時關庫說價購資費號門運營權證統線際體與變]/;

/** Every string inside a copy object, however deeply nested. */
export function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings);
  return [];
}

/** Claims PDA BLISS cannot support today, in every language. */
export const CLAIMS = [
  /\bcertified\b|\bcompliant\b|\bcompliance\b|\bISO\b|SOC ?2|\bPCI\b|HIPAA|GDPR/i,
  /guarantee|99\.\d|\buptime\b|immutable|tamper-proof|penetration|pen-test/i,
  /enterprise-grade|bank-grade|military-grade|unhackable|\bRPO\b|\bRTO\b|100 ?%/i,
  /ได้รับการรับรอง|รับประกัน|ปลอดภัย 100|ไม่สามารถแก้ไขได้/,
  /已通过|已获得|保证|合规|不可篡改|万无一失/,
];
