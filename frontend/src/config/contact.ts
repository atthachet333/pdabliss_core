/*
 * Public contact details — the single source of truth (EP05, revised).
 *
 * Every phone number, email address, LINE link and the company address shown
 * anywhere on the public site reads from here. Never hardcode these values in
 * a component: the footer, the floating contact panel, the contact page and
 * every future LINE button import CONTACT instead.
 *
 * EP05 revision: the public site shows ONE phone number only (owner request).
 * Its contact-person label lives in the locale dictionaries
 * (`contact.phoneLabel`).
 */

export interface ContactPhone {
  /** As printed: 063-869-3614 */
  display: string;
  /** E.164 for `tel:` links: +66638693614 */
  e164: string;
}

const LINE_ID = '@593oiwec';

export const CONTACT = {
  company: 'PDA BLISS COMPANY LIMITED',
  /** Registered office address — printed exactly as given, in Thai, in every locale. */
  address: '186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110',
  /** The single public phone number (contact person: คุณวิน). */
  phone: { display: '063-869-3614', e164: '+66638693614' } satisfies ContactPhone,
  email: 'pdablissoffice@gmail.com',
  lineId: LINE_ID,
  /**
   * LINE official account add-friend link. On desktop LINE shows its own
   * add-friend / QR page; on phones the OS hands the link to the LINE app.
   */
  lineUrl: `https://line.me/R/ti/p/${LINE_ID}`,
} as const;

export const telHref = (phone: ContactPhone = CONTACT.phone) => `tel:${phone.e164}`;
export const mailtoHref = (email: string = CONTACT.email) => `mailto:${email}`;
