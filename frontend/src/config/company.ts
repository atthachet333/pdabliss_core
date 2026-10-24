import type { Locale } from '@/i18n/locales';
import { CONTACT } from './contact';
import { SITE } from './site';

/*
 * Company identity — the approved, factual fields only (EP12).
 *
 * /about and /why-core read the company's names from here; every contact
 * value still comes from CONTACT. Nothing else is a company fact: no founding
 * year, headcount, client count, registration number, certification or award
 * exists in an approved source, so none is modelled. The shape mirrors
 * schema.org Organization (name, legalName, alternateName, address,
 * telephone, email, sameAs) so structured data can be generated later
 * without re-collecting anything.
 */

export const COMPANY = {
  /** Brand name used in running text. */
  brand: 'PDA BLISS',
  /** Registered name in Thai — shown on Thai pages. */
  legalNameTh: 'บริษัท พีดีเอ บลิส จำกัด',
  /** Registered name in English — shown in international contexts. */
  legalName: CONTACT.company,
  address: CONTACT.address,
  telephone: CONTACT.phone.e164,
  email: CONTACT.email,
  /** Public profiles (LINE Official Account today). */
  sameAs: [CONTACT.lineUrl],
} as const;

/** The registered name for the locale: Thai on Thai pages, English elsewhere. */
export const companyName = (locale: Locale) =>
  locale === 'th' ? COMPANY.legalNameTh : COMPANY.legalName;

/** Products made by PDA BLISS, described only as far as approved docs allow. */
export const PRODUCTS = [
  { id: 'core', name: SITE.name, current: true },
  { id: 'one', name: 'PDA ONE', current: false },
  { id: 'property', name: 'Property & Rental Management', current: false },
] as const;

export type ProductId = (typeof PRODUCTS)[number]['id'];
