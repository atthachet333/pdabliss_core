import { z } from 'zod';
import { DEPARTMENT_CODES } from '../billing/catalog.js';

/*
 * EP47 dashboard response allow-list (docs/EP47_METRIC_DEFINITIONS.md). Every
 * dashboard answer is parsed through these STRICT schemas before it leaves the
 * server, so a field a builder adds by mistake fails the request instead of
 * reaching the browser. Money appears in exactly one place — `amount` on an
 * Accounting supplier-deposit item — and the builders of every other
 * department never set it (asserted by tests over the serialized answers).
 */

const Department = z.enum(DEPARTMENT_CODES);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TONES = ['attention', 'blocked', 'progress', 'done', 'info'] as const;

const Metric = z
  .object({
    key: z.string(),
    value: z.number().int().nonnegative(),
    tone: z.enum(TONES),
    /** Where the number comes from, drilled into (null: no list screen the person may open). */
    link: z.string().startsWith('/core/').nullable(),
  })
  .strict();

const QueueItem = z
  .object({
    id: z.string(),
    kind: z.string(),
    number: z.string(),
    status: z.string(),
    /** The business context: a customer, a supplier, an item, a department. */
    context: z.string().nullable(),
    /** The next step (`<KIND>.<ACTION>` copy key) and who owns it. */
    action: z.string(),
    responsible: Department,
    /** May THIS person take that step (their effective permission)? The step happens on the document. */
    canAct: z.boolean(),
    date: Day.nullable(),
    dateKind: z.string().nullable(),
    overdue: z.boolean(),
    /** Work left on the document, in whole lines (never a sum across items or units). */
    progress: z.object({ open: z.number().int(), total: z.number().int() }).strict().nullable(),
    /** One quantity in its own unit (production order outstanding output). */
    quantity: z.object({ value: z.string(), unit: z.string() }).strict().nullable(),
    /** Accounting supplier-deposit items only (accounting.deposits.view). */
    amount: z.object({ value: z.string(), currency: z.string() }).strict().nullable(),
    /** The canonical document, only when this person may open it. */
    link: z.string().startsWith('/core/').nullable(),
  })
  .strict();

const Queue = z
  .object({
    key: z.string(),
    total: z.number().int().nonnegative(),
    items: z.array(QueueItem),
  })
  .strict();

export const DashboardView = z
  .object({
    department: Department,
    branch: z.object({ id: z.string(), code: z.string(), name: z.string() }).strict(),
    today: Day,
    generatedAt: z.string(),
    /** The person's highest tier in this department (presentation only). */
    access: z.enum(['READ', 'OPERATE', 'MANAGE']),
    /** EP46: shown on the Production dashboard. */
    manufacturingMode: z.enum(['BOM_REQUIRED', 'BOM_OPTIONAL']).nullable(),
    metrics: z.array(Metric),
    queues: z.array(Queue),
    /** Plain statements the screen shows (e.g. what CORE Accounting does not cover). */
    notes: z.array(z.string()),
  })
  .strict();

export type DashboardAnswer = z.input<typeof DashboardView>;
export type MetricRow = z.input<typeof Metric>;
export type QueueRow = z.input<typeof QueueItem>;
export type QueueBlock = z.input<typeof Queue>;

export const DashboardIndexView = z
  .object({
    branch: z.object({ id: z.string(), code: z.string(), name: z.string() }).strict(),
    role: z.string(),
    assignment: z.object({ status: z.string(), department: Department.nullable() }).strict(),
    /** Department dashboards this person may open, in catalog order. */
    dashboards: z.array(Department),
  })
  .strict();
