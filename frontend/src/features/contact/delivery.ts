import type { Inquiry } from './model';

/*
 * Inquiry delivery (EP13) — the seam a real backend will plug into.
 *
 * Today there is NO delivery endpoint: the backend has no inquiry route, no
 * email sending and no CRM. So the only implementation is `UNAVAILABLE`,
 * which sends nothing and says so. The page never shows "sent" unless a
 * delivery reports `ok: true`.
 *
 * TODO(backend): add `POST /api/inquiries` (validate with the same rules as
 * validation.ts, rate-limit, store or forward), then return an HTTP-backed
 * delivery from `getInquiryDelivery()`. See docs/CONTACT_EXPERIENCE.md.
 */

export type DeliveryResult =
  { ok: true; reference?: string } | { ok: false; reason: 'unavailable' | 'failed' };

export interface InquiryDelivery {
  /** False when nothing can actually be sent from the website. */
  readonly available: boolean;
  send(inquiry: Inquiry): Promise<DeliveryResult>;
}

/** The current state: nothing is sent, no request is made. */
export const UNAVAILABLE: InquiryDelivery = {
  available: false,
  send: async () => ({ ok: false, reason: 'unavailable' }),
};

export function getInquiryDelivery(): InquiryDelivery {
  return UNAVAILABLE;
}
