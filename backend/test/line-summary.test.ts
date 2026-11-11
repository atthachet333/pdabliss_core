import { describe, expect, it } from 'vitest';
import { LINE_SUMMARY_KEYS, LineSummary, lineSummary } from '../src/lib/line-summary.js';

/*
 * EP42.3: a document's contents at a glance on list rows — first line, quantity, unit and
 * how many more. Operational only: the projection has no room for a price or an amount.
 */
describe('line summary (EP42.3)', () => {
  const d = (s: string) => ({ toString: () => s });

  it('names the first line, trims the decimal scale and counts the rest', () => {
    const s = lineSummary(
      [
        { itemCode: 'FG-1', itemName: 'Cream', unitCode: 'PCS', quantity: d('12.000000') },
        { itemCode: 'FG-2', itemName: 'Serum', unitCode: 'PCS', quantity: d('2.500000') },
      ],
      (l) => l.quantity,
    );
    expect(s).toEqual({ code: 'FG-1', name: 'Cream', quantity: '12', unit: 'PCS', more: 1 });
    expect(LineSummary.parse(s)).toEqual(s);
  });

  it('uses the description of a non-item line and the full count when only one line was loaded', () => {
    const s = lineSummary(
      [{ itemCode: null, itemName: null, description: 'Office chair', quantity: d('2.50') }],
      (l) => l.quantity,
      4,
    );
    expect(s).toEqual({ code: null, name: 'Office chair', quantity: '2.5', unit: null, more: 3 });
  });

  it('is null for a document without lines', () => {
    expect(lineSummary([], () => d('1'))).toBeNull();
  });

  it('carries operational keys only', () => {
    expect([...LINE_SUMMARY_KEYS].sort()).toEqual(Object.keys(LineSummary.unwrap().shape).sort());
    for (const k of LINE_SUMMARY_KEYS) expect(k).not.toMatch(/price|amount|total|cost|note|tax/i);
  });
});
