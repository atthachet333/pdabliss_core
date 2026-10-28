import type { DeptKey } from '@/features/departments/catalog';
import type { SolutionId } from '@/features/solutions/model';
import { CHAPTER } from '@/features/workflow/model';

/*
 * Resources (EP16) — the one typed registry behind /resources, search, the
 * mega menu and every guide's "read next". Structure only; words live in
 * meta.ts (titles, summaries, tags) and in each guide's own chunk.
 *
 * Every entry is published, real content. Nothing is listed "coming soon":
 * a guide that isn't ready is simply not in this list.
 */

export const RESOURCE_IDS = [
  'gettingStarted',
  'howCoreWorks',
  'humanError',
  'warehousePrivacy',
  'implementationGuide',
  'securityAndData',
  'coreGlossary',
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

/** Editorial categories (shown on every resource). */
export const CATEGORIES = [
  'start',
  'workflow',
  'control',
  'warehouse',
  'implementation',
  'security',
  'terminology',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** The few library filters. Terminology sits with "start". */
export const FILTERS = [
  'all',
  'start',
  'workflow',
  'control',
  'warehouse',
  'implementation',
  'security',
] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_OF: Record<Category, Exclude<Filter, 'all'>> = {
  start: 'start',
  terminology: 'start',
  workflow: 'workflow',
  control: 'control',
  warehouse: 'warehouse',
  implementation: 'implementation',
  security: 'security',
};

export type Audience = 'owner' | 'manager' | 'team' | 'evaluator';
type WorkflowChapter = (typeof CHAPTER)[keyof typeof CHAPTER];

export interface Resource {
  id: ResourceId;
  slug: string;
  category: Category;
  audience: readonly Audience[];
  relatedDepartments: readonly DeptKey[];
  relatedSolutions: readonly SolutionId[];
  relatedWorkflow: readonly WorkflowChapter[];
  /** "อ่านต่อ" — two or three contextual next reads, never "latest". */
  next: readonly ResourceId[];
  /** Conservative static estimate; a test keeps it honest against the copy. */
  readingMinutes: number;
  featured: boolean;
  status: 'published';
}

export const RESOURCES: readonly Resource[] = [
  {
    id: 'gettingStarted',
    slug: 'getting-started',
    category: 'start',
    audience: ['owner', 'manager', 'evaluator'],
    relatedDepartments: [
      'executive',
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
    ],
    relatedSolutions: ['fallingThrough', 'statusChasing'],
    relatedWorkflow: [CHAPTER.problem],
    next: ['howCoreWorks', 'coreGlossary', 'implementationGuide'],
    readingMinutes: 6,
    featured: true,
    status: 'published',
  },
  {
    id: 'howCoreWorks',
    slug: 'how-core-works',
    category: 'workflow',
    audience: ['owner', 'manager', 'team'],
    relatedDepartments: ['sales', 'warehouse', 'purchasing', 'accounting'],
    relatedSolutions: ['fallingThrough', 'statusChasing', 'approval', 'management'],
    relatedWorkflow: [CHAPTER.handoff, CHAPTER.approval, CHAPTER.exceptions, CHAPTER.trace],
    next: ['humanError', 'warehousePrivacy', 'coreGlossary'],
    readingMinutes: 6,
    featured: true,
    status: 'published',
  },
  {
    id: 'humanError',
    slug: 'human-error',
    category: 'control',
    audience: ['manager', 'team', 'owner'],
    relatedDepartments: ['warehouse', 'purchasing', 'accounting', 'operations'],
    relatedSolutions: ['humanError', 'stock', 'supplier', 'payment'],
    relatedWorkflow: [CHAPTER.humanError, CHAPTER.exceptions],
    next: ['howCoreWorks', 'warehousePrivacy', 'implementationGuide'],
    readingMinutes: 8,
    featured: true,
    status: 'published',
  },
  {
    id: 'warehousePrivacy',
    slug: 'warehouse-privacy',
    category: 'warehouse',
    audience: ['manager', 'owner', 'evaluator'],
    relatedDepartments: ['warehouse', 'accounting', 'executive'],
    relatedSolutions: ['stock', 'management'],
    relatedWorkflow: [CHAPTER.roles],
    next: ['securityAndData', 'humanError'],
    readingMinutes: 6,
    featured: true,
    status: 'published',
  },
  {
    id: 'implementationGuide',
    slug: 'implementation-guide',
    category: 'implementation',
    audience: ['owner', 'evaluator', 'manager'],
    relatedDepartments: ['executive', 'operations'],
    relatedSolutions: ['fallingThrough', 'management'],
    relatedWorkflow: [CHAPTER.adapt],
    next: ['securityAndData', 'gettingStarted', 'howCoreWorks'],
    readingMinutes: 5,
    featured: true,
    status: 'published',
  },
  {
    id: 'securityAndData',
    slug: 'security-and-data',
    category: 'security',
    audience: ['evaluator', 'owner'],
    relatedDepartments: ['executive', 'warehouse', 'accounting'],
    relatedSolutions: ['management'],
    relatedWorkflow: [CHAPTER.roles, CHAPTER.trace],
    next: ['warehousePrivacy', 'implementationGuide'],
    readingMinutes: 6,
    featured: false,
    status: 'published',
  },
  {
    id: 'coreGlossary',
    slug: 'core-glossary',
    category: 'terminology',
    audience: ['team', 'manager', 'owner', 'evaluator'],
    relatedDepartments: [
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
      'executive',
    ],
    relatedSolutions: [],
    relatedWorkflow: [CHAPTER.problem],
    next: ['gettingStarted', 'howCoreWorks'],
    readingMinutes: 7,
    featured: false,
    status: 'published',
  },
];

export const getResource = (id: ResourceId) => RESOURCES.find((r) => r.id === id)!;
export const resourcePath = (id: ResourceId) => `/resources/${getResource(id).slug}`;
export const RESOURCES_HOME = '/resources';

/* ------------------------------------------------------------------ */
/* Guided entries on /resources                                         */
/* ------------------------------------------------------------------ */

/** "ถ้ายังไม่รู้จะเริ่มตรงไหน" — three paths, each 2–3 real guides in order. */
export const START_PATHS = {
  what: ['gettingStarted', 'howCoreWorks', 'coreGlossary'],
  problems: ['humanError', 'howCoreWorks', 'warehousePrivacy'],
  evaluate: ['implementationGuide', 'securityAndData', 'gettingStarted'],
} as const satisfies Record<string, readonly ResourceId[]>;
export type StartPath = keyof typeof START_PATHS;

/** EP09 problems → the guide that explains the mechanism. */
export const PROBLEM_GUIDE = {
  fallingThrough: 'howCoreWorks',
  statusChasing: 'howCoreWorks',
  humanError: 'humanError',
  approval: 'howCoreWorks',
  stock: 'humanError',
  supplier: 'humanError',
  payment: 'humanError',
  management: 'securityAndData',
} as const satisfies Partial<Record<SolutionId, ResourceId>>;
export type ProblemId = keyof typeof PROBLEM_GUIDE;
export const PROBLEMS = Object.keys(PROBLEM_GUIDE) as ProblemId[];

/** EP06 departments → what to read first (2–3). */
export const DEPARTMENT_READING = {
  sales: ['howCoreWorks', 'gettingStarted'],
  operations: ['howCoreWorks', 'humanError', 'implementationGuide'],
  warehouse: ['warehousePrivacy', 'humanError', 'coreGlossary'],
  purchasing: ['humanError', 'howCoreWorks'],
  accounting: ['humanError', 'warehousePrivacy', 'howCoreWorks'],
  executive: ['gettingStarted', 'securityAndData', 'implementationGuide'],
} as const satisfies Record<DeptKey, readonly ResourceId[]>;

/** Organization stages, from first structure to stronger standards. */
export const STAGES = {
  starting: ['gettingStarted', 'howCoreWorks', 'coreGlossary'],
  multiDepartment: ['howCoreWorks', 'humanError'],
  growing: ['warehousePrivacy', 'securityAndData', 'humanError'],
  standardizing: ['implementationGuide', 'securityAndData'],
} as const satisfies Record<string, readonly ResourceId[]>;
export type Stage = keyof typeof STAGES;

/** Links into the rest of the site (locale preserved at render). */
export const RESOURCE_LINKS = {
  consult: '/consultation?topic=consulting',
  implementation: '/consultation?topic=implementation',
  demo: '/demo',
  industries: '/industries',
  security: '/security',
  enterprise: '/enterprise',
  pricing: '/pricing',
  whyCore: '/why-core',
} as const;
