export const SITE = {
  name: 'PDA BLISS CORE',
  company: 'PDA BLISS COMPANY LIMITED',
  positioning: 'Department Operations Platform',
  url: import.meta.env.VITE_SITE_URL ?? 'https://core.pdabliss.com',
  defaultDescription:
    'PDA BLISS CORE แพลตฟอร์มปฏิบัติการระดับแผนก ให้ทุกแผนกมีพื้นที่ทำงานของตัวเอง เชื่อมทุกขั้นตอนด้วยข้อมูลชุดเดียวกันทั้งองค์กร',
} as const;

/** Year printed in the footer copyright line. */
export const COPYRIGHT_YEAR = 2026;

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:1112';

/**
 * EP48.5 F1/F3: whether self-service sign-up exists. The public build (core.pdabliss.com) sets
 * VITE_PUBLIC_SIGNUP=false: the API has no /auth/register there and the edge blocks /register,
 * so the screens never send a visitor to it — accounts come from company invitations.
 */
export const publicSignup = (): boolean => import.meta.env.VITE_PUBLIC_SIGNUP !== 'false';
