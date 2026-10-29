import type { Prisma } from '../db/client.js';
import type { ItemType } from '../generated/prisma/enums.js';

/*
 * Business codes (EP28). A code is the identifier people read, print and
 * type: upper-case letters, digits and . _ / - (no spaces), unique per
 * company (per branch for locations), never a database id, and immutable
 * once the record exists.
 *
 * Generated codes are PREFIX-NNNNNN from a per-company counter
 * (MasterCodeSequence). The counter row is incremented by ONE atomic
 * INSERT … ON CONFLICT DO UPDATE … RETURNING inside the transaction that
 * creates the record and its audit entry: a concurrent create waits on that
 * row and receives the next number; a create that fails rolls the counter
 * back with it, so no number is skipped by an error. Never MAX(code) + 1.
 *
 * A code may also be entered on creation (legacy numbering). Entered codes
 * may not take the generated form (PREFIX-NNNNNN…) — that range belongs to
 * the counter, so a generated code can never collide with an entered one.
 */

export const CUSTOMER_PREFIX = 'CUS';
export const SUPPLIER_PREFIX = 'SUP';

export const ITEM_PREFIX: Readonly<Record<ItemType, string>> = {
  FINISHED_GOOD: 'FG',
  RAW_MATERIAL: 'RM',
  PACKAGING: 'PK',
  CONSUMABLE: 'CS',
  NON_STOCK: 'NS',
};

/** Digits of a generated code (CUS-000001); a larger number simply grows. */
const DIGITS = 6;

export const formatCode = (prefix: string, value: number) =>
  `${prefix}-${String(value).padStart(DIGITS, '0')}`;

/** True when `code` has the generated form of one of these prefixes. */
export const isReservedCode = (code: string, prefixes: readonly string[]) =>
  prefixes.some((p) => new RegExp(`^${p}-\\d{${DIGITS},}$`).test(code));

/** Takes the next number of `prefix` for this company — call inside the creating transaction. */
export async function nextCode(
  tx: Prisma.TransactionClient,
  companyId: string,
  prefix: string,
): Promise<string> {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "MasterCodeSequence" ("companyId", "prefix", "lastValue", "updatedAt")
    VALUES (${companyId}, ${prefix}, 1, NOW())
    ON CONFLICT ("companyId", "prefix")
    DO UPDATE SET "lastValue" = "MasterCodeSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"`;
  return formatCode(prefix, rows[0]!.lastValue);
}

/**
 * Moves the counter past `value` (never backwards) — for seeded records that
 * carry a code of the generated form, so the next generated code follows them.
 */
export async function reserveThrough(
  tx: Prisma.TransactionClient,
  companyId: string,
  prefix: string,
  value: number,
) {
  await tx.$executeRaw`
    INSERT INTO "MasterCodeSequence" ("companyId", "prefix", "lastValue", "updatedAt")
    VALUES (${companyId}, ${prefix}, ${value}, NOW())
    ON CONFLICT ("companyId", "prefix")
    DO UPDATE SET "lastValue" = GREATEST("MasterCodeSequence"."lastValue", ${value}), "updatedAt" = NOW()`;
}
