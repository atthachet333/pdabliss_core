import type { Locale } from '@/i18n/locales';

/*
 * The office on the map (EP24.1.4, owner-supplied). Only the Contact page
 * imports this module, so neither the coordinates nor the listing URL ship
 * with the public entry bundle. Address, phone, email and LINE stay in
 * config/contact.ts (CONTACT) — this file adds only the map location.
 */
export const OFFICE_LOCATION = {
  /** The Google Maps listing "PDA BLISS COMPANY LIMITED" (8m2!3d13.956774!4d100.3378182). */
  lat: 13.956774,
  lng: 100.3378182,
  /** Owner-provided listing — the "Open in Google Maps" destination. */
  listingUrl:
    'https://www.google.com/maps/place/PDA+BLISS+COMPANY+LIMITED/@13.9567792,100.3352433,17z/data=!3m1!4b1!4m6!3m5!1s0x30e28dcf7c817331:0x1465da3363a2e635!8m2!3d13.956774!4d100.3378182!16s%2Fg%2F11z_s4k4sn',
} as const;

const MAP_LANG: Record<Locale, string> = { th: 'th', en: 'en', 'zh-CN': 'zh-CN' };

/**
 * Keyless Google Maps embed centred on the listing's coordinates. No API key,
 * no Maps JavaScript SDK: a plain iframe, loaded only when the visitor asks.
 */
export function mapEmbedUrl(locale: Locale): string {
  const { lat, lng } = OFFICE_LOCATION;
  return `https://maps.google.com/maps?q=${lat},${lng}&z=17&hl=${MAP_LANG[locale]}&output=embed`;
}
