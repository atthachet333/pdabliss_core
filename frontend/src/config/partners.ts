/*
 * Approved external companies (EP24.1). Kept apart from config/company.ts,
 * which the public entry bundle loads: these facts ship only with /about.
 */

/** A logo supplied by its owner: square artwork on a light background, served from public/. */
export interface PartnerLogo {
  /** 1× file (the CSS size). */
  src: string;
  /** 2× file for dense screens. */
  src2x: string;
  /** Intrinsic CSS size in px (square). */
  size: number;
}

/**
 * S2 ACCOUNTING CONSULTANT Co., Ltd. — the accounting and business-advisory
 * company that contributes business-process insight to CORE (owner-approved,
 * EP24.1). A separate company: no merger, ownership or certification is
 * implied. Only the names, the public website and the owner-supplied logo
 * (source: docs/assets/partners/s2-logo-source.webp) are modelled. Set `logo`
 * to null to fall back to the typographic mark.
 */
export const INSIGHT_PARTNER = {
  brand: 'S2',
  legalNameTh: 'บริษัท เอสทู แอคเคาน์ติ้ง คอนซัลแตนท์ จำกัด',
  legalName: 'S2 ACCOUNTING CONSULTANT Co., Ltd.',
  website: 'https://www.s2aconsultant.com/',
  logo: {
    src: '/partners/s2-logo-280.webp',
    src2x: '/partners/s2-logo-560.webp',
    size: 280,
  } as PartnerLogo | null,
} as const;
