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
