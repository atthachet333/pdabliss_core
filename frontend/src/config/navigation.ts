import {
  BookOpen,
  Building,
  EyeOff,
  Info,
  KeyRound,
  Layers,
  Lightbulb,
  MousePointerClick,
  Network,
  Route,
  ShieldCheck,
  Store,
  Tags,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/*
 * Public site information architecture (EP05; consolidated in EP18).
 *
 * This file holds the STRUCTURE only — ids, destinations and icons. Every
 * visible word lives in the locale dictionaries (src/i18n/messages/*), keyed
 * by the ids below, so the same structure renders in Thai, English and
 * Simplified Chinese.
 *
 * EP18: four menus answer four questions instead of seven menus listing
 * every page — Product (what CORE is and how to use it), Solutions (where it
 * fits a business), Resources (learn it), About (who builds it and why).
 * Every public route keeps a discovery path: see
 * docs/PUBLIC_ROUTE_DISCOVERABILITY.md and test/discoverability.ts.
 *
 * No dead links: every `to` is a public route that exists today or an anchor
 * on an existing page.
 */

/**
 * Full navigation + mega menus from this width up; the dedicated mobile
 * navigation below it. Mirrors `--breakpoint-nav` in styles/index.css.
 */
export const NAV_DESKTOP_QUERY = '(min-width: 80rem)';

export type MegaGroupId = 'product' | 'solutions' | 'resources' | 'about';

export interface MegaItem {
  id: string;
  /** Shown on `feature` rows only. */
  icon?: LucideIcon;
  to: string;
}

/**
 * A titled block inside a menu. `feature` rows carry an icon and a one-line
 * description; `index` rows are compact name-only links (the six departments,
 * the six industries, reference guides) so a menu never becomes a card wall.
 */
export interface MegaSection {
  id: string;
  kind: 'feature' | 'index';
  items: readonly MegaItem[];
}

export interface MegaGroup {
  id: MegaGroupId;
  sections: readonly MegaSection[];
  /** Every item, in order (derived from `sections`). */
  items: readonly MegaItem[];
  /** The featured destination in the menu's highlight panel (label in messages). */
  cta: string;
  /** Route prefixes that make this menu the current section in the header. */
  family: readonly string[];
}

const group = (g: Omit<MegaGroup, 'items'>): MegaGroup => ({
  ...g,
  items: g.sections.flatMap((s) => s.items),
});

export type TopNavItem =
  { kind: 'link'; id: 'overview'; to: string } | { kind: 'mega'; id: MegaGroupId };

const DEPARTMENT_IDS = [
  'executive',
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
] as const;
const INDUSTRY_IDS = [
  'distribution',
  'services',
  'projects',
  'retail',
  'property',
  'manufacturing',
] as const;

export const MEGA_GROUPS: Record<MegaGroupId, MegaGroup> = {
  product: group({
    id: 'product',
    sections: [
      {
        id: 'understand',
        kind: 'feature',
        items: [
          { id: 'how', icon: Workflow, to: '/how-core-works' },
          { id: 'departments', icon: Layers, to: '/departments' },
        ],
      },
      {
        id: 'start',
        kind: 'feature',
        items: [
          { id: 'demo', icon: MousePointerClick, to: '/demo' },
          { id: 'pricing', icon: Tags, to: '/pricing' },
        ],
      },
      {
        id: 'byDepartment',
        kind: 'index',
        items: DEPARTMENT_IDS.map((id) => ({ id, to: `/departments/${id}` })),
      },
    ],
    cta: '/demo',
    family: ['/departments', '/how-core-works', '/demo', '/pricing', '/features'],
  }),
  solutions: group({
    id: 'solutions',
    sections: [
      {
        id: 'fit',
        kind: 'feature',
        items: [
          { id: 'problems', icon: Network, to: '/solutions' },
          { id: 'industries', icon: Store, to: '/industries' },
          { id: 'enterprise', icon: Building, to: '/enterprise' },
        ],
      },
      {
        id: 'byIndustry',
        kind: 'index',
        items: INDUSTRY_IDS.map((id) => ({ id, to: `/industries/${id}` })),
      },
    ],
    cta: '/industries',
    family: ['/solutions', '/industries', '/enterprise'],
  }),
  // EP16: the CORE knowledge library — real guides only, never "coming soon".
  resources: group({
    id: 'resources',
    sections: [
      {
        id: 'start',
        kind: 'feature',
        items: [{ id: 'start', icon: BookOpen, to: '/resources/getting-started' }],
      },
      {
        id: 'concepts',
        kind: 'feature',
        items: [
          { id: 'workflow', icon: Route, to: '/resources/how-core-works' },
          { id: 'humanError', icon: ShieldCheck, to: '/resources/human-error' },
          { id: 'warehousePrivacy', icon: EyeOff, to: '/resources/warehouse-privacy' },
        ],
      },
      {
        id: 'reference',
        kind: 'index',
        items: [
          { id: 'implementation', to: '/resources/implementation-guide' },
          { id: 'security', to: '/resources/security-and-data' },
          { id: 'glossary', to: '/resources/core-glossary' },
        ],
      },
    ],
    cta: '/resources',
    family: ['/resources'],
  }),
  about: group({
    id: 'about',
    sections: [
      {
        id: 'company',
        kind: 'feature',
        items: [
          { id: 'company', icon: Info, to: '/about' },
          { id: 'why', icon: Lightbulb, to: '/why-core' },
          { id: 'security', icon: KeyRound, to: '/security' },
        ],
      },
      {
        id: 'more',
        kind: 'index',
        items: [{ id: 'approach', to: '/about#approach' }],
      },
    ],
    cta: '/about#consulting',
    family: ['/about', '/why-core', '/security'],
  }),
};

/** The approved top-level order (EP18): overview + four menus. */
export const TOP_NAV: readonly TopNavItem[] = [
  { kind: 'link', id: 'overview', to: '/' },
  { kind: 'mega', id: 'product' },
  { kind: 'mega', id: 'solutions' },
  { kind: 'mega', id: 'resources' },
  { kind: 'mega', id: 'about' },
];

/** EP16: the header's contact call to action, beside language and sign-in. */
export const HEADER_CONTACT = '/contact';

export const MEGA_ORDER: readonly MegaGroupId[] = TOP_NAV.flatMap((i) =>
  i.kind === 'mega' ? [i.id] : [],
);

/** The menu whose family contains a (locale-free) path, if any. */
export function activeGroup(path: string): MegaGroupId | null {
  for (const id of MEGA_ORDER) {
    const hit = MEGA_GROUPS[id].family.some((f) => path === f || path.startsWith(`${f}/`));
    if (hit) return id;
  }
  return null;
}

/**
 * Footer link groups (EP18) — Product and Explore only; brand, contact
 * details and legal links have their own zones. A closing summary, not a
 * sitemap: anchors, every department and every guide live in the menus.
 */
export const FOOTER_GROUPS = [
  {
    id: 'product',
    links: [
      { id: 'departments', to: '/departments' },
      { id: 'howItWorks', to: '/how-core-works' },
      { id: 'demo', to: '/demo' },
      { id: 'pricing', to: '/pricing' },
    ],
  },
  {
    id: 'explore',
    links: [
      { id: 'solutions', to: '/solutions' },
      { id: 'industries', to: '/industries' },
      { id: 'enterprise', to: '/enterprise' },
      { id: 'resources', to: '/resources' },
      { id: 'about', to: '/about' },
    ],
  },
] as const;

export type FooterLinkId = (typeof FOOTER_GROUPS)[number]['links'][number]['id'];

/** Every internal destination the shell links to (for dead-link tests). */
export function shellLinkTargets(): string[] {
  const targets = new Set<string>();
  for (const item of TOP_NAV) if (item.kind === 'link') targets.add(item.to);
  targets.add(HEADER_CONTACT);
  for (const g of Object.values(MEGA_GROUPS)) {
    for (const i of g.items) targets.add(i.to);
    targets.add(g.cta);
  }
  for (const g of FOOTER_GROUPS) for (const l of g.links) targets.add(l.to);
  for (const legal of ['/privacy', '/terms']) targets.add(legal);
  return [...targets];
}
