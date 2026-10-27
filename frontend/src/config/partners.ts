/*
 * Approved external companies (EP24.1). Kept apart from config/company.ts,
 * which the public entry bundle loads: these facts ship only with /about.
 */

/**
 * S2 ACCOUNTING CONSULTANT Co., Ltd. — the accounting and business-advisory
 * company that contributes business-process insight to CORE (owner-approved,
 * EP24.1). A separate company: no merger, ownership or certification is
 * implied. Only the names and the public website are modelled.
 */
export const INSIGHT_PARTNER = {
  brand: 'S2',
  legalNameTh: 'บริษัท เอสทู แอคเคาน์ติ้ง คอนซัลแตนท์ จำกัด',
  legalName: 'S2 ACCOUNTING CONSULTANT Co., Ltd.',
  website: 'https://www.s2aconsultant.com/',
  /** Logo asset path once the owner supplies it; until then a typographic mark is shown. */
  logo: null as string | null,
} as const;
