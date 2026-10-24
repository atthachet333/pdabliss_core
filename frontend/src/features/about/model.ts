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

/** Product, not a custom codebase: one foundation, adapted on top. */
export const LAYERS = ['integration', 'configuration', 'foundation'] as const;
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
} as const;
