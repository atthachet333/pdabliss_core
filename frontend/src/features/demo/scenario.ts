/*
 * The one EP14 demo scenario: customer order SO-1042 (fictional sample data).
 *
 * These are the scenario's facts — every number a role might see. Role
 * views (views.ts) pick from here; the Warehouse view never receives any of
 * the commercial fields. Codes match the EP08 illustration (/how-core-works).
 * Names and words are localized in copy.ts; nothing here is real data.
 */

export const SCENARIO_ID = 'customer-order';

export const SCENARIO = {
  order: {
    id: 'SO-1042',
    customerPo: 'CPO-0418',
    /** Units the customer ordered. */
    qty: 120,
    /** Sample commercial value — Sales and Executive context only. */
    value: 48_000,
    currency: 'THB',
    requestedBy: '2026-11-06',
  },
  item: { sku: 'SKU-7731', location: 'A-03-2', unit: 'box' },
  /** Stock on hand when the order arrives (an older lot). */
  onHand: { lot: 'LOT-A2409', expiry: '2026-12-15', qty: 20 },
  po: {
    id: 'PO-2215',
    qty: 100,
    /** Sample purchase value — Purchasing and Accounting only. */
    value: 36_000,
    currency: 'THB',
    expected: '2026-11-02',
    balanceExpected: '2026-11-04',
  },
  /** What the supplier actually delivers first. */
  firstReceipt: 80,
  receipt: { id: 'GR-3307' },
  invoice: { id: 'INV-5521', amount: 36_000, currency: 'THB' },
  /** Lot / expiry choices for the received goods (sample values). */
  lotOptions: [
    { code: 'LOT-B2410', expiry: '2027-06-30' },
    { code: 'LOT-B2411', expiry: '2027-07-31' },
  ],
  delivery: { id: 'DO-0588' },
} as const;

/** Shortage when the order arrives. */
export const SHORTAGE = SCENARIO.order.qty - SCENARIO.onHand.qty;
/** Outstanding after the first, partial receipt. */
export const OUTSTANDING = SCENARIO.po.qty - SCENARIO.firstReceipt;

export type LotChoice = (typeof SCENARIO.lotOptions)[number];

/** Where the demo leads afterwards (unlocalized; pass through `href()`). */
export const DEMO_LINKS = {
  contact: '/consultation?topic=demo',
  pricing: '/pricing',
} as const;
