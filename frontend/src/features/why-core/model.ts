import type { DeptKey } from '@/features/departments/catalog';

/*
 * /why-core structure (EP12). Ids, order and destinations only — words live
 * in copy.ts. /about says who PDA BLISS is; this page says why CORE exists.
 */

export const WHY_CHAPTER = {
  origin: 'origin',
  shift: 'one-system',
  departments: 'departments',
  connected: 'connected',
  humanError: 'human-error',
  executive: 'executive',
  nextAction: 'next-action',
  see: 'see-it-work',
} as const;

/** What happens as an organization grows — the reality CORE was designed around. */
export const GROWTH = [
  'roles',
  'departments',
  'handoffs',
  'approvals',
  'systems',
  'visibility',
] as const;
export type Growth = (typeof GROWTH)[number];

/** The departments a visitor can "view as", in the order the story names them. */
export const VIEWERS = [
  'sales',
  'warehouse',
  'operations',
  'purchasing',
  'accounting',
  'executive',
] as const satisfies readonly DeptKey[];
export type Viewer = (typeof VIEWERS)[number];

/** The modules of ONE LARGE SYSTEM — everyone sees all of them. */
export const MODULES = [
  'sales',
  'warehouse',
  'operations',
  'purchasing',
  'accounting',
  'pricing',
  'executive',
  'settings',
] as const;
export type Module = (typeof MODULES)[number];

/**
 * What each viewer is shown in one large system without needing it. For the
 * Warehouse this is pricing — which CORE never sends to the Warehouse.
 */
export const EXCESS: Record<Viewer, Module> = {
  sales: 'warehouse',
  warehouse: 'pricing',
  operations: 'accounting',
  purchasing: 'sales',
  accounting: 'warehouse',
  executive: 'operations',
};

/** "Different responsibilities require different interfaces." */
export const NOT_NEEDED = [
  'sales',
  'warehouse',
  'accounting',
  'executive',
] as const satisfies readonly Viewer[];

/** Signals management should see instead of operational noise. */
export const SIGNALS = ['bottlenecks', 'exceptions', 'waiting', 'risk', 'health'] as const;
export type Signal = (typeof SIGNALS)[number];

/** Cross-links (unlocalized; pass through `href()`). */
export const WHY_LINKS = {
  howCoreWorks: '/how-core-works',
  humanErrorChapter: '/how-core-works#human-error',
  departments: '/departments',
  executive: '/departments/executive',
  solutions: '/solutions#human-error',
  demo: '/consultation?topic=demo',
  /** EP14: the interactive demo. */
  tryDemo: '/demo',
  about: '/about',
} as const;
