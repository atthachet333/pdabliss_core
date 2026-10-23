import {
  BadgeCheck,
  Blocks,
  Building,
  Building2,
  Calculator,
  Compass,
  Crown,
  Eye,
  Factory,
  FileCheck2,
  GitBranch,
  Handshake,
  Hourglass,
  Info,
  KeyRound,
  Layers,
  LifeBuoy,
  Lightbulb,
  Network,
  Plug,
  Radar,
  Route,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Truck,
  Warehouse,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/*
 * Public site information architecture (EP05).
 *
 * This file holds the STRUCTURE only — ids, destinations and icons. Every
 * visible word lives in the locale dictionaries (src/i18n/messages/*), keyed
 * by the ids below, so the same structure renders in Thai, English and
 * Simplified Chinese.
 *
 * No dead links: every `to` is a public route that exists today, a homepage
 * chapter anchor, or an anchor on an existing page. An item without `to` is
 * informational (rendered as text, never a link) — used for capabilities that
 * are planned but not live.
 */

/**
 * Full navigation + mega menus from this width up; the dedicated mobile
 * navigation below it. Mirrors `--breakpoint-nav` in styles/index.css.
 */
export const NAV_DESKTOP_QUERY = '(min-width: 80rem)';

export type MegaGroupId =
  'departments' | 'packages' | 'howItWorks' | 'solutions' | 'enterprise' | 'about';

export interface MegaItem {
  id: string;
  icon: LucideIcon;
  /** Omit for an informational (non-link) item. */
  to?: string;
}

export interface MegaGroup {
  id: MegaGroupId;
  items: readonly MegaItem[];
  /** Destination of the highlight panel's call to action (label in messages). */
  cta?: string;
}

export type TopNavItem =
  { kind: 'link'; id: 'overview' | 'contact'; to: string } | { kind: 'mega'; id: MegaGroupId };

export const MEGA_GROUPS: Record<MegaGroupId, MegaGroup> = {
  departments: {
    id: 'departments',
    items: [
      { id: 'executive', icon: Crown, to: '/departments/executive' },
      { id: 'sales', icon: ShoppingCart, to: '/departments/sales' },
      { id: 'operations', icon: Factory, to: '/departments/operations' },
      { id: 'warehouse', icon: Warehouse, to: '/departments/warehouse' },
      { id: 'purchasing', icon: Truck, to: '/departments/purchasing' },
      { id: 'accounting', icon: Calculator, to: '/departments/accounting' },
    ],
    cta: '/departments',
  },
  packages: {
    id: 'packages',
    items: [
      { id: 'starter', icon: Sprout, to: '/pricing?plan=starter#packages' },
      { id: 'business', icon: Blocks, to: '/pricing?plan=business#packages' },
      { id: 'professional', icon: Layers, to: '/pricing?plan=professional#packages' },
      { id: 'enterprise', icon: Building2, to: '/pricing?plan=enterprise#packages' },
    ],
    cta: '/contact',
  },
  howItWorks: {
    id: 'howItWorks',
    items: [
      { id: 'how', icon: Compass, to: '/how-core-works' },
      { id: 'crossDept', icon: Route, to: '/how-core-works#handoff' },
      { id: 'workflow', icon: Workflow, to: '/how-core-works#approval' },
      { id: 'tracking', icon: Radar, to: '/how-core-works#trace' },
      { id: 'errorPrevention', icon: ShieldCheck, to: '/how-core-works#human-error' },
    ],
    cta: '/how-core-works',
  },
  solutions: {
    id: 'solutions',
    items: [
      { id: 'humanError', icon: ShieldCheck, to: '/solutions#human-error' },
      { id: 'multiDept', icon: Network, to: '/solutions#cross-department' },
      { id: 'workflow', icon: GitBranch, to: '/solutions#approval' },
      { id: 'stock', icon: Hourglass, to: '/solutions#stock' },
      { id: 'visibility', icon: Eye, to: '/solutions#visibility' },
      { id: 'management', icon: Crown, to: '/solutions#management' },
    ],
    cta: '/solutions',
  },
  enterprise: {
    id: 'enterprise',
    items: [
      { id: 'scale', icon: Building, to: '/#enterprise' },
      { id: 'security', icon: KeyRound },
      { id: 'audit', icon: FileCheck2, to: '/#error-control' },
      { id: 'customWorkflow', icon: Workflow, to: '/how-core-works#adapt' },
      { id: 'integration', icon: Plug },
      { id: 'support', icon: LifeBuoy, to: '/contact' },
    ],
    cta: '/contact',
  },
  about: {
    id: 'about',
    items: [
      { id: 'company', icon: Info, to: '/about' },
      { id: 'why', icon: Lightbulb, to: '/#trust' },
      { id: 'approach', icon: BadgeCheck, to: '/about#approach' },
      { id: 'consulting', icon: Handshake, to: '/contact' },
    ],
    cta: '/contact',
  },
};

/** The approved top-level order. */
export const TOP_NAV: readonly TopNavItem[] = [
  { kind: 'link', id: 'overview', to: '/' },
  { kind: 'mega', id: 'departments' },
  { kind: 'mega', id: 'packages' },
  { kind: 'mega', id: 'howItWorks' },
  { kind: 'mega', id: 'solutions' },
  { kind: 'mega', id: 'enterprise' },
  { kind: 'mega', id: 'about' },
  { kind: 'link', id: 'contact', to: '/contact' },
];

export const MEGA_ORDER: readonly MegaGroupId[] = TOP_NAV.flatMap((i) =>
  i.kind === 'mega' ? [i.id] : [],
);

/** Footer link groups — a calm subset of the header IA. */
export const FOOTER_GROUPS = [
  {
    id: 'quick',
    links: [
      { id: 'overview', to: '/' },
      { id: 'departments', to: '/departments' },
      { id: 'packages', to: '/pricing' },
      { id: 'howItWorks', to: '/how-core-works' },
    ],
  },
  {
    id: 'company',
    links: [
      { id: 'solutions', to: '/solutions' },
      { id: 'enterprise', to: '/#enterprise' },
      { id: 'about', to: '/about' },
      { id: 'contact', to: '/contact' },
    ],
  },
] as const;

/** Every internal destination the shell links to (for dead-link tests). */
export function shellLinkTargets(): string[] {
  const targets = new Set<string>();
  for (const item of TOP_NAV) if (item.kind === 'link') targets.add(item.to);
  for (const g of Object.values(MEGA_GROUPS)) {
    for (const i of g.items) if (i.to) targets.add(i.to);
    if (g.cta) targets.add(g.cta);
  }
  for (const g of FOOTER_GROUPS) for (const l of g.links) targets.add(l.to);
  return [...targets];
}
