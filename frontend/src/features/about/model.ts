/*
 * /about structure (EP12). Ids, order and destinations only — every visible
 * word lives in copy.ts, keyed by these ids.
 */

/** Section anchors. `approach` and `consulting` are mega-menu destinations. */
export const ABOUT_CHAPTER = {
  company: 'pda-bliss',
  belief: 'belief',
  problem: 'problem',
  systems: 'systems',
  approach: 'approach',
  consulting: 'consulting',
  /** EP24.1: S2 — accounting and business-process insight. */
  partner: 'business-insight',
  implementation: 'implementation-approach',
  longTerm: 'long-term',
  info: 'company-information',
  talk: 'talk',
} as const;

/** What PDA BLISS believes — one lead principle, seven that follow. */
export const PRINCIPLES = [
  'responsibility',
  'ownership',
  'status',
  'sees',
  'early',
  'humanError',
  'exceptions',
  'simplify',
] as const;
export type Principle = (typeof PRINCIPLES)[number];

/** What organizations actually suffer from (not a lack of software). */
export const SYMPTOMS = [
  'tools',
  'information',
  'chat',
  'ownership',
  'duplicate',
  'visibility',
  'modules',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

/** Human Error by design: what a system does → the CORE principle it serves. */
export const GUARDS = [
  { id: 'guide', principle: 'PREVENT' },
  { id: 'validate', principle: 'DETECT' },
  { id: 'reveal', principle: 'ALERT' },
  { id: 'control', principle: 'CONTROL' },
  { id: 'preserve', principle: 'TRACE' },
] as const;
export type Guard = (typeof GUARDS)[number]['id'];

/**
 * The signature methodology: ten steps from real work to a working system,
 * grouped into the four forms the work takes on the way.
 */
export const STAGES = [
  { id: 'notes', steps: ['realWork', 'observe'] },
  { id: 'map', steps: ['responsibility', 'process', 'failure'] },
  { id: 'workflow', steps: ['workflow', 'interface'] },
  { id: 'interface', steps: ['build', 'test', 'improve'] },
] as const;
export type Stage = (typeof STAGES)[number]['id'];
export type MethodStep = (typeof STAGES)[number]['steps'][number];
export const METHOD_STEPS: readonly MethodStep[] = STAGES.flatMap((s) => s.steps);

/** The working session: what moves between the organization, PDA BLISS and CORE. */
export const EXCHANGE = [
  'processes',
  'responsibilities',
  'problems',
  'controls',
  'outcome',
] as const;
export type Exchange = (typeof EXCHANGE)[number];

export const ACTIVITIES = [
  'mapping',
  'workflowReview',
  'responsibilityReview',
  'planning',
  'data',
  'training',
  'customWorkflow',
  'integration',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Implementation, from the company's side. Details live on /enterprise. */
export const IMPLEMENTATION = [
  'listen',
  'understand',
  'map',
  'design',
  'build',
  'validate',
  'train',
  'launch',
  'improve',
] as const;
export type ImplementationStep = (typeof IMPLEMENTATION)[number];

/** Product, not a custom codebase: one foundation, adapted on top (top → bottom). */
export const LAYERS = ['integration', 'workflow', 'configuration', 'foundation'] as const;
export type Layer = (typeof LAYERS)[number];

export const TRUST = ['identity', 'status', 'boundaries', 'noClaims'] as const;
export type Trust = (typeof TRUST)[number];

/** Cross-links (unlocalized; pass through `href()`). */
export const ABOUT_LINKS = {
  whyCore: '/why-core',
  solutions: '/solutions',
  howCoreWorks: '/how-core-works',
  implementation: '/enterprise#implementation',
  industries: '/industries',
  contact: '/contact',
  /** EP13: About conversations open the consultation path. */
  consult: '/consultation?topic=consulting',
} as const;

/* ------------------------------------------------------------------ */
/* EP13 scenes                                                          */
/* ------------------------------------------------------------------ */

/** The five departments the hero's fragments resolve into, in lane order. */
export const HERO_LANES = ['sales', 'warehouse', 'purchasing', 'accounting', 'operations'] as const;
export type HeroLane = (typeof HERO_LANES)[number];

export type FragmentKind = 'chat' | 'sheet' | 'slip' | 'checklist' | 'po' | 'approval' | 'note';

/** Real-work fragments in the hero: what they are and who owns them. */
export const FRAGMENTS = [
  { id: 'chat', kind: 'chat', lane: 'sales' },
  { id: 'quote', kind: 'sheet', lane: 'sales' },
  { id: 'grn', kind: 'slip', lane: 'warehouse' },
  { id: 'count', kind: 'checklist', lane: 'warehouse' },
  { id: 'po', kind: 'po', lane: 'purchasing' },
  { id: 'supplier', kind: 'chat', lane: 'purchasing' },
  { id: 'approval', kind: 'approval', lane: 'accounting' },
  { id: 'ledger', kind: 'sheet', lane: 'accounting' },
  { id: 'status', kind: 'note', lane: 'operations' },
  { id: 'plan', kind: 'checklist', lane: 'operations' },
] as const satisfies readonly { id: string; kind: FragmentKind; lane: HeroLane }[];
export type FragmentId = (typeof FRAGMENTS)[number]['id'];

/** Disorder → structure, in five readable stages. */
export const HERO_STAGES = ['scattered', 'aligned', 'linked', 'departments', 'core'] as const;

/** The path a piece of work takes across the lanes once it is linked. */
export const HERO_LINKS: readonly (readonly [FragmentId, FragmentId])[] = [
  ['chat', 'po'],
  ['po', 'grn'],
  ['grn', 'status'],
  ['status', 'approval'],
  ['quote', 'chat'],
  ['supplier', 'po'],
  ['count', 'grn'],
  ['ledger', 'approval'],
  ['plan', 'status'],
];

/** Which zone of the design table each methodology step works on. */
export const STEP_ZONE: Record<MethodStep, 'notes' | 'map' | 'screen'> = {
  realWork: 'notes',
  observe: 'notes',
  responsibility: 'map',
  process: 'map',
  failure: 'map',
  workflow: 'map',
  interface: 'screen',
  build: 'screen',
  test: 'screen',
  improve: 'screen',
};
