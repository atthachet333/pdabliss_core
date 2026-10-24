import { z } from 'zod';
import type { ContactFields, ContactMethod, Inquiry, Step } from './model';

/*
 * Inquiry validation (EP13). Returns error *keys*; copy.ts turns them into
 * localized messages. Only name and company are always required, plus one
 * way to reach the visitor that matches the reply method they chose.
 */

export type FieldError =
  | 'nameRequired'
  | 'companyRequired'
  | 'emailInvalid'
  | 'phoneInvalid'
  | 'lineInvalid'
  | 'phoneForMethod'
  | 'emailForMethod'
  | 'lineForMethod';

export type DetailErrors = Partial<Record<keyof ContactFields, FieldError>>;

const email = z.email();
const digits = (v: string) => v.replace(/\D/g, '');

export function validateDetails(c: ContactFields, method: ContactMethod): DetailErrors {
  const e: DetailErrors = {};
  if (c.name.trim().length < 2) e.name = 'nameRequired';
  if (c.company.trim().length < 2) e.company = 'companyRequired';

  const phone = c.phone.trim();
  const mail = c.email.trim();
  const line = c.lineId.trim();
  if (
    phone &&
    (!/^[+\d\s\-().]+$/.test(phone) || digits(phone).length < 9 || digits(phone).length > 15)
  ) {
    e.phone = 'phoneInvalid';
  }
  if (mail && !email.safeParse(mail).success) e.email = 'emailInvalid';
  if (line && !/^@?[\w.-]{2,40}$/.test(line)) e.lineId = 'lineInvalid';

  // The chosen reply method needs a way to use it.
  if (method === 'phone' && !phone) e.phone ??= 'phoneForMethod';
  if (method === 'email' && !mail) e.email ??= 'emailForMethod';
  if (method === 'line' && !line && !phone) e.lineId ??= 'lineForMethod';
  return e;
}

/** Whether a step can be left going forward. */
export function stepComplete(step: Step, inquiry: Inquiry): boolean {
  if (step === 'topic') return inquiry.type !== null;
  if (step === 'details')
    return Object.keys(validateDetails(inquiry.contact, inquiry.method)).length === 0;
  return true;
}
