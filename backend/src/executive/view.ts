import { z } from 'zod';
import { DEPARTMENT_CODES } from '../billing/catalog.js';

/*
 * EP48 Executive Command Center — response allow-list (docs/EP48_EXECUTIVE_METRIC_DICTIONARY.md).
 * Every answer is parsed through these STRICT schemas: a field added by mistake fails the
 * request instead of reaching the browser. There is NO money field and NO quantity field
 * anywhere in this contract — only document counts, line counts, lot counts, states, dates
 * and links (the Command Center discloses no price, cost, total, deposit amount, recipe line,
 * ratio or material quantity, whatever the viewer's other permissions are).
 */

const Department = z.enum(DEPARTMENT_CODES);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Link = z.string().startsWith('/core/').nullable();
const BranchRef = z.object({ id: z.string(), code: z.string(), name: z.string() }).strict();

export const CLASSES = ['BLOCKED', 'OVERDUE', 'MISSING_DATE', 'WAITING'] as const;
export type WorkClass = (typeof CLASSES)[number];

const Evidence = z
  .object({
    code: z.string(),
    open: z.number().int().nonnegative().optional(),
    total: z.number().int().nonnegative().optional(),
    count: z.number().int().nonnegative().optional(),
  })
  .strict();

export const WorkItem = z
  .object({
    kind: z.string(),
    id: z.string(),
    number: z.string(),
    /** Customer, supplier, item or originating department (never an amount). */
    context: z.string().nullable(),
    branch: BranchRef,
    /** The department whose document it is, and the one that must act next. */
    department: Department,
    next: Department,
    /** The single current stage (one per document — nothing is counted twice). */
    stage: z.string(),
    class: z.enum(CLASSES),
    /** Why it is in the priority queue (null when it is normal waiting). */
    reason: z.string().nullable(),
    evidence: Evidence,
    /** The real expected / required date of the document, when it has one. */
    date: Day.nullable(),
    dateKind: z.string().nullable(),
    overdueDays: z.number().int().nonnegative().nullable(),
    /** When the document entered its current stage (where the record keeps that time). */
    since: Day.nullable(),
    ageDays: z.number().int().nonnegative().nullable(),
    link: Link,
  })
  .strict();
export type WorkItemRow = z.input<typeof WorkItem>;

const Metric = z
  .object({
    key: z.string(),
    value: z.number().int().nonnegative(),
    unit: z.enum(['DOCUMENTS', 'LINES', 'LOTS']),
    tone: z.enum(['attention', 'blocked', 'progress', 'done', 'info']),
    link: Link,
  })
  .strict();
export type MetricEntry = z.input<typeof Metric>;

const Count = z.object({ key: z.string(), value: z.number().int().nonnegative() }).strict();
const DeptCount = z
  .object({ department: Department, value: z.number().int().nonnegative() })
  .strict();

const DepartmentHealth = z
  .object({
    department: Department,
    /** Open documents of this department (each in exactly one stage). */
    open: z.number().int().nonnegative(),
    /** Work items — of any department — whose next step belongs to this department. */
    waiting: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    overdue: z.number().int().nonnegative(),
    stages: z.array(Count),
    completed: z.array(Count),
    /** This department's documents waiting on another department / others waiting on it. */
    waitsOn: z.array(DeptCount),
    awaitedBy: z.array(DeptCount),
    link: Link,
  })
  .strict();

const Bottleneck = z
  .object({
    key: z.string(),
    from: Department,
    to: Department,
    total: z.number().int().nonnegative(),
    classes: z.array(Count),
    stages: z.array(Count),
    items: z.array(WorkItem),
  })
  .strict();

const Activity = z
  .object({
    kind: z.string(),
    id: z.string(),
    number: z.string(),
    event: z.string(),
    at: z.string(),
    branch: BranchRef,
    department: Department,
    link: Link,
  })
  .strict();

export const OverviewView = z
  .object({
    scope: z
      .object({
        company: z.string(),
        /** Every active branch this person may work in (the filter's options). */
        branches: z.array(BranchRef),
        /** 'all' or one of `branches`. */
        selected: z.string(),
      })
      .strict(),
    role: z.enum(['COMPANY_OWNER', 'EXECUTIVE']),
    readOnly: z.literal(true),
    today: Day,
    generatedAt: z.string(),
    /** Departments whose information this person may see here. */
    visible: z.array(Department),
    pulse: z.array(z.object({ department: Department, metrics: z.array(Metric) }).strict()),
    departments: z.array(DepartmentHealth),
    bottlenecks: z.array(Bottleneck),
    queue: z.object({ total: z.number().int().nonnegative(), items: z.array(WorkItem) }).strict(),
    branchComparison: z
      .object({
        keys: z.array(z.string()),
        rows: z.array(
          z.object({ branch: BranchRef, values: z.record(z.string(), z.number().int()) }).strict(),
        ),
      })
      .strict(),
    activity: z.array(Activity),
    /** Plain statements the screen shows (scope, bounded lists, no trends). */
    notes: z.array(z.string()),
  })
  .strict();
export type Overview = z.input<typeof OverviewView>;

export const TraceView = z
  .object({
    document: z
      .object({
        kind: z.string(),
        id: z.string(),
        number: z.string(),
        status: z.string(),
        context: z.string().nullable(),
        branch: BranchRef,
        link: Link,
      })
      .strict(),
    /** Its current work item (null when nothing is outstanding — e.g. completed). */
    item: WorkItem.nullable(),
    related: z.array(
      z
        .object({
          kind: z.string(),
          id: z.string(),
          number: z.string(),
          status: z.string(),
          at: Day.nullable(),
          link: Link,
        })
        .strict(),
    ),
  })
  .strict();
