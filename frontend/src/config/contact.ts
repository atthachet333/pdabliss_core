/*
 * Public contact details — the single source of truth (EP05).
 *
 * Every phone number, email address, LINE link and the company address shown
 * anywhere on the public site reads from here. Never hardcode these values in
 * a component: the footer, the floating contact panel, the contact page and
 * every future LINE button import CONTACT instead.
 */

export type PhoneId = 'office' | 'pueng' | 'in';

export interface ContactPhone {
  id: PhoneId;
  /** As printed: 064-924-5544 */
  display: string;
  /** E.164 for `tel:` links: +66649245544 */
  e164: string;
}

const LINE_ID = '@593oiwec';

export const CONTACT = {
  company: 'PDA BLISS COMPANY LIMITED',
  /** Registered office address — printed exactly as given, in Thai, in every locale. */
  address: '186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110',
  phones: [
    { id: 'office', display: '064-924-5544', e164: '+66649245544' },
    { id: 'pueng', display: '090-662-5464', e164: '+66906625464' },
    { id: 'in', display: '063-869-3614', e164: '+66638693614' },
  ] as const satisfies readonly ContactPhone[],
  email: 'pdablissoffice@gmail.com',
  lineId: LINE_ID,
  /**
   * LINE official account add-friend link. On desktop LINE shows its own
   * add-friend / QR page; on phones the OS hands the link to the LINE app.
   */
  lineUrl: `https://line.me/R/ti/p/${LINE_ID}`,
} as const;

/** The primary number used for single "call us" actions. */
export const PRIMARY_PHONE: ContactPhone = CONTACT.phones[0];

export const telHref = (phone: ContactPhone) => `tel:${phone.e164}`;
export const mailtoHref = (email: string = CONTACT.email) => `mailto:${email}`;
