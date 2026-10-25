import type { DeptKey } from '@/features/departments/catalog';
import type { PlanId } from '@/features/pricing/plans';
import { CHAPTER } from '@/features/workflow/model';

/*
 * Solutions (EP09) — the shared, typed model of the organizational problems
 * CORE addresses. Structure lives here; words live in copy.ts (th / en / zh).
 * Every story, the problem map and the navigator read from this file.
 *
 * Qualitative only: no numeric improvement claims anywhere.
 */

export const SOLUTION_IDS = [
  'fallingThrough',
  'statusChasing',
  'humanError',
  'approval',
  'stock',
  'supplier',
  'payment',
  'management',
  'crossDepartment',
] as const;
export type SolutionId = (typeof SOLUTION_IDS)[number];

/** Problem tone — the restrained CORE status language. */
export type Tone = 'attention' | 'blocked' | 'waiting';

/** Nodes of the problem map: the six departments. */
export type MapNode = DeptKey;

export interface Solution {
  id: SolutionId;
  /** Section id on /solutions — the mega menu and the map link here. */
  anchor: string;
  /** Departments involved; the first is the primary department page link. */
  departments: readonly DeptKey[];
  /** The /how-core-works chapter that shows the mechanism. */
  workflow: (typeof CHAPTER)[keyof typeof CHAPTER];
  tone: Tone;
  /** Where the friction sits on the problem map (between two departments). */
  between: readonly [MapNode, MapNode] | null;
  /** Position of the friction along that join, from the first department (default ½). */
  mapT?: number;
  /** Package to mention, only where it genuinely matters. */
  plan?: PlanId;
}

export const SOLUTIONS: readonly Solution[] = [
  {
    id: 'fallingThrough',
    anchor: 'falling-through',
    departments: ['sales', 'warehouse', 'purchasing', 'accounting'],
    workflow: CHAPTER.handoff,
    tone: 'blocked',
    between: ['sales', 'warehouse'],
    mapT: 0.3,
  },
  {
    id: 'statusChasing',
    anchor: 'visibility',
    departments: ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'],
    workflow: CHAPTER.routing,
    tone: 'waiting',
    between: ['sales', 'operations'],
  },
  {
    id: 'humanError',
    anchor: 'human-error',
    departments: ['warehouse', 'purchasing', 'accounting'],
    workflow: CHAPTER.humanError,
    tone: 'attention',
    between: ['accounting', 'sales'],
  },
  {
    id: 'approval',
    anchor: 'approval',
    departments: ['purchasing', 'accounting', 'executive'],
    workflow: CHAPTER.approval,
    tone: 'waiting',
    between: ['operations', 'purchasing'],
    mapT: 0.3,
    plan: 'business',
  },
  {
    id: 'stock',
    anchor: 'stock',
    departments: ['warehouse', 'operations', 'sales'],
    workflow: CHAPTER.exceptions,
    tone: 'attention',
    between: ['operations', 'warehouse'],
  },
  {
    id: 'supplier',
    anchor: 'supplier',
    departments: ['purchasing', 'warehouse', 'operations'],
    workflow: CHAPTER.decisions,
    tone: 'attention',
    between: ['warehouse', 'purchasing'],
  },
  {
    id: 'payment',
    anchor: 'payment',
    departments: ['accounting', 'purchasing', 'warehouse'],
    workflow: CHAPTER.approval,
    tone: 'blocked',
    between: ['purchasing', 'accounting'],
  },
  {
    id: 'management',
    anchor: 'management',
    departments: ['executive', 'sales', 'operations', 'warehouse', 'purchasing', 'accounting'],
    workflow: CHAPTER.roles,
    tone: 'attention',
    between: ['executive', 'sales'],
  },
  {
    id: 'crossDepartment',
    anchor: 'cross-department',
    departments: ['sales', 'operations', 'warehouse', 'purchasing', 'accounting', 'executive'],
    workflow: CHAPTER.replay,
    tone: 'attention',
    between: null,
  },
];

export const getSolution = (id: SolutionId) => SOLUTIONS.find((s) => s.id === id)!;

/** Section ids that are not solution stories. */
export const SECTION = { map: 'problem-map', navigator: 'navigator' } as const;

/* ------------------------------------------------------------------ */
/* Problem map geometry (viewBox 0 0 640 440)                           */
/* ------------------------------------------------------------------ */

export const MAP_NODES: Record<MapNode, { x: number; y: number }> = {
  executive: { x: 320, y: 48 },
  sales: { x: 100, y: 150 },
  operations: { x: 540, y: 150 },
  accounting: { x: 90, y: 330 },
  // EP19: spread so the receipt chip between them never covers either name (≥ 768 px map).
  purchasing: { x: 255, y: 405 },
  warehouse: { x: 510, y: 395 },
};

/** CORE sits at the centre of the map. */
export const MAP_CORE = { x: 320, y: 255 } as const;

/** Connections drawn on the map (every friction sits on one of these). */
export const MAP_EDGES: readonly (readonly [MapNode, MapNode])[] = [
  ['executive', 'sales'],
  ['executive', 'operations'],
  ['sales', 'operations'],
  ['sales', 'warehouse'],
  ['operations', 'purchasing'],
  ['operations', 'warehouse'],
  ['warehouse', 'purchasing'],
  ['purchasing', 'accounting'],
  ['accounting', 'sales'],
];

/** Where a solution's friction sits on the map. */
export function frictionPoint(s: Solution): { x: number; y: number } | null {
  if (!s.between) return null;
  const a = MAP_NODES[s.between[0]];
  const b = MAP_NODES[s.between[1]];
  const t = s.mapT ?? 0.5;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/* ------------------------------------------------------------------ */
/* Story data (structure only — numbers are illustrative quantities)   */
/* ------------------------------------------------------------------ */

/** Supplier visibility example: quantities only, no prices. */
export const RECEIPT = { ordered: 100, received: 60 } as const;

/** Stock example: lots on an expiry timeline (days from today). Quantities only. */
export const LOTS = [
  { code: 'LOT-2408-C', qty: 30, days: 24, location: 'A-01-2' },
  { code: 'LOT-2409-B', qty: 40, days: 96, location: 'B-03-1' },
  { code: 'LOT-2410-A', qty: 120, days: 170, location: 'A-02-4' },
] as const;
/** A pick request of 50 units, filled by FEFO. */
export const PICK = 50;
/** FEFO: fill a pick from the earliest-expiring lots first. */
export function fefoPicks<T extends { qty: number; days: number }>(
  lots: readonly T[],
  quantity: number,
) {
  return [...lots]
    .sort((a, b) => a.days - b.days)
    .reduce<{ left: number; picks: (T & { take: number })[] }>(
      (acc, lot) => {
        const take = Math.min(acc.left, lot.qty);
        return { left: acc.left - take, picks: [...acc.picks, { ...lot, take }] };
      },
      { left: quantity, picks: [] },
    ).picks;
}

/** Count example: system vs counted (variance held for review). */
export const COUNT = { system: 40, counted: 38 } as const;

/** Approval request types for the bottleneck story. */
export const APPROVAL_KINDS = ['po', 'payment', 'exception', 'review'] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];
export const APPROVAL_STAGES = [
  'request',
  'rule',
  'approver',
  'waiting',
  'decision',
  'continue',
] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

/** Human-error lifecycle stages and the mistakes it is shown with. */
export const LIFECYCLE = ['mistake', 'check', 'action', 'trace'] as const;
export const MISTAKES = [
  { id: 'wrongQty', principle: 'detect' },
  { id: 'missingLot', principle: 'prevent' },
  { id: 'nearExpiry', principle: 'alert' },
  { id: 'missingDocs', principle: 'control' },
  { id: 'skippedApproval', principle: 'control' },
  { id: 'supplierLate', principle: 'alert' },
] as const;
export type MistakeId = (typeof MISTAKES)[number]['id'];

/** Payment dependency gates. */
export const GATES = ['po', 'receipt', 'invoice', 'approval'] as const;
export type Gate = (typeof GATES)[number];

/** Lenses for the status-chasing story (same item, different details). */
export const LENSES = ['sales', 'warehouse', 'purchasing', 'accounting', 'executive'] as const;
export type Lens = (typeof LENSES)[number];

/* ------------------------------------------------------------------ */
/* Navigator                                                            */
/* ------------------------------------------------------------------ */

export const NAVIGATOR = [
  'fallingThrough',
  'statusChasing',
  'stock',
  'approval',
  'supplier',
  'payment',
  'management',
  'humanError',
] as const satisfies readonly SolutionId[];
