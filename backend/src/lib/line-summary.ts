import { z } from 'zod';

/*
 * EP42.3 — a document's contents at a glance, for list rows: the first line's
 * item (code and name, or the free-text description), its quantity and unit,
 * and how many other lines there are. Operational only — never a price, an
 * amount or a note — so the same projection is safe on every department's
 * list, Warehouse included. `null` when the document has no lines yet.
 */
export const LineSummary = z
  .object({
    code: z.string().nullable(),
    name: z.string(),
    quantity: z.string(),
    unit: z.string().nullable(),
    /** The other lines (0 = a single-line document). */
    more: z.number().int().nonnegative(),
  })
  .nullable();
export type LineSummary = z.infer<typeof LineSummary>;

/** The keys a summary carries — every one operational (see the Warehouse field classes). */
export const LINE_SUMMARY_KEYS = ['code', 'name', 'quantity', 'unit', 'more'] as const;

interface Decimalish {
  toString(): string;
}
interface SummaryLine {
  itemCode?: string | null;
  itemName?: string | null;
  description?: string | null;
  unitCode?: string | null;
}

/**
 * The summary of `lines` (already in line order). `quantity` picks the figure
 * that matters to the reader (ordered, still to receive, planned …); `total`
 * is the document's line count when only the first line was loaded.
 */
export function lineSummary<L extends SummaryLine>(
  lines: readonly L[],
  quantity: (l: L) => Decimalish,
  total = lines.length,
): LineSummary {
  const first = lines[0];
  if (!first) return null;
  return {
    code: first.itemCode ?? null,
    name: first.itemName ?? first.description ?? '',
    // Decimal(18,6) prints its scale ("12.000000"); trailing zeros carry no meaning here.
    quantity: trimZeros(quantity(first).toString()),
    unit: first.unitCode ?? null,
    more: Math.max(0, total - 1),
  };
}

const trimZeros = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
