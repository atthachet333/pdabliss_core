import { Prisma } from '../generated/prisma/client.js';

/*
 * Purchase-order arithmetic (EP30) — exact decimals only (decimal.js through
 * Prisma.Decimal), never JavaScript numbers. Amounts are rounded half-up to
 * 2 places PER LINE; order totals are sums of the rounded line values, so the
 * stored lines always add up to the stored totals (database CHECKs hold the
 * same equations). The client's own totals are never read.
 *
 *   lineSubtotal = round2(quantity × unitPrice)
 *   lineTax      = round2((lineSubtotal − discountAmount) × taxRate / 100)
 *   lineTotal    = lineSubtotal − discountAmount + lineTax
 *   subtotal / discountTotal / taxTotal = Σ lines;  grandTotal = subtotal − discountTotal + taxTotal
 *   deposit      = AMOUNT: the amount as given; PERCENT: round2(grandTotal × percent / 100)
 */

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
type Value = Decimal | string;

const d = (v: Value) => new Decimal(v);
export const round2 = (v: Value) => d(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const ZERO = new Decimal(0);

export interface LineAmounts {
  lineSubtotal: Decimal;
  lineTax: Decimal;
  lineTotal: Decimal;
}

export function lineAmounts(l: {
  quantity: Value;
  unitPrice: Value;
  discountAmount: Value;
  taxRate: Value;
}): LineAmounts {
  const lineSubtotal = round2(d(l.quantity).times(l.unitPrice));
  const net = lineSubtotal.minus(l.discountAmount);
  const lineTax = round2(net.times(l.taxRate).dividedBy(100));
  return { lineSubtotal, lineTax, lineTotal: net.plus(lineTax) };
}

export interface OrderTotals {
  subtotal: Decimal;
  discountTotal: Decimal;
  taxTotal: Decimal;
  grandTotal: Decimal;
}

export function orderTotals(
  lines: readonly { lineSubtotal: Value; discountAmount: Value; lineTax: Value }[],
): OrderTotals {
  let subtotal = ZERO;
  let discountTotal = ZERO;
  let taxTotal = ZERO;
  for (const l of lines) {
    subtotal = subtotal.plus(l.lineSubtotal);
    discountTotal = discountTotal.plus(l.discountAmount);
    taxTotal = taxTotal.plus(l.lineTax);
  }
  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal.minus(discountTotal).plus(taxTotal),
  };
}

export function depositAmount(type: 'AMOUNT' | 'PERCENT', value: Value, grandTotal: Value) {
  return type === 'AMOUNT' ? round2(value) : round2(d(grandTotal).times(value).dividedBy(100));
}

/** Fixed-point text for the API: amounts with 2 places, others trimmed of trailing zeros. */
export const money = (v: Decimal | null) => (v === null ? null : v.toFixed(2));
export const exact = (v: Decimal | null) => (v === null ? null : v.toString());
