import { defineMachine } from '../workflow/state-machine.js';

/**
 * Reference workflow for the Purchase Request document. This is the EP00
 * example of how a domain owns its states; the remaining documents (PO, GR,
 * SO, WO, payment requests) will define their own machines in later episodes.
 */
export const PURCHASE_REQUEST_STATES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'converted',
  'cancelled',
] as const;
export type PurchaseRequestState = (typeof PURCHASE_REQUEST_STATES)[number];

export type PurchaseRequestAction =
  'submit' | 'approve' | 'reject' | 'revise' | 'convert_to_po' | 'cancel';

export interface PurchaseRequestContext {
  lineCount: number;
  requestedBy: string;
  actorId: string;
}

export const purchaseRequestWorkflow = defineMachine<
  PurchaseRequestState,
  PurchaseRequestAction,
  PurchaseRequestContext
>({
  name: 'purchase_request',
  initial: 'draft',
  states: PURCHASE_REQUEST_STATES,
  terminal: ['converted', 'cancelled'],
  transitions: [
    {
      action: 'submit',
      from: ['draft'],
      to: 'submitted',
      guard: (ctx) =>
        ctx.lineCount > 0
          ? { ok: true }
          : { ok: false, code: 'PR_EMPTY', message: 'A purchase request needs at least one line' },
    },
    {
      action: 'approve',
      from: ['submitted'],
      to: 'approved',
      // Segregation of duties: nobody approves their own request.
      guard: (ctx) =>
        ctx.actorId !== ctx.requestedBy
          ? { ok: true }
          : {
              ok: false,
              code: 'SELF_APPROVAL_FORBIDDEN',
              message: 'Requesters cannot approve their own purchase request',
            },
    },
    { action: 'reject', from: ['submitted'], to: 'rejected', requiresReason: true },
    { action: 'revise', from: ['rejected'], to: 'draft' },
    { action: 'convert_to_po', from: ['approved'], to: 'converted' },
    {
      action: 'cancel',
      from: ['draft', 'submitted', 'rejected'],
      to: 'cancelled',
      requiresReason: true,
    },
  ],
});
