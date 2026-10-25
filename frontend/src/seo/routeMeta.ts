import { organizationSchema } from '@/config/company';
import { PUBLIC_ROUTES, type PublicRoute } from '@/config/publicRoutes';
import { ABOUT } from '@/features/about/copy';
import { CONTACT_COPY } from '@/features/contact/copy';
import { DEMO_COPY } from '@/features/demo/copy';
import { ACCOUNTING } from '@/features/departments/accounting/copy';
import { EXECUTIVE } from '@/features/departments/executive/copy';
import { OPERATIONS } from '@/features/departments/operations/copy';
import { OVERVIEW } from '@/features/departments/overview/copy';
import { PURCHASING } from '@/features/departments/purchasing/copy';
import { SALES } from '@/features/departments/sales/copy';
import { WAREHOUSE } from '@/features/departments/warehouse/copy';
import { ENTERPRISE } from '@/features/enterprise/copy';
import { DISTRIBUTION } from '@/features/industries/copy/distribution';
import { MANUFACTURING } from '@/features/industries/copy/manufacturing';
import { PROJECTS } from '@/features/industries/copy/projects';
import { PROPERTY } from '@/features/industries/copy/property';
import { RETAIL } from '@/features/industries/copy/retail';
import { SERVICES } from '@/features/industries/copy/services';
import { INDUSTRIES_SUMMARY } from '@/features/industries/copy/summary';
import { PRICING } from '@/features/pricing/copy';
import { RESOURCES_COPY } from '@/features/resources/copy';
import { RESOURCE_META } from '@/features/resources/meta';
import type { ResourceId } from '@/features/resources/registry';
import { SECURITY_COPY } from '@/features/security/copy';
import { SOLUTIONS_COPY } from '@/features/solutions/copy';
import { WHY_CORE } from '@/features/why-core/copy';
import { WORKFLOW } from '@/features/workflow/copy';
import { LOCALES, type Locale } from '@/i18n/locales';
import type { Localized } from '@/i18n/useCopy';
import { headFor, websiteSchema, type PageHead } from '@/lib/seo';
import { FEATURES_COPY } from '@/pages/public/features.copy';
import { LEGAL_COPY } from '@/pages/public/legal.copy';

/*
 * Build-time route metadata (EP17). For every public route, the title and
 * description its page passes to usePageMeta — read from the SAME copy
 * objects the page renders, never retyped here. The prerender turns these
 * into static <head> markup for all 105 URLs; seo.test.tsx proves the
 * rendered pages produce exactly the same head.
 *
 * This module imports copy data only (no components), so it stays out of
 * the client bundle: nothing in the app imports it.
 */

type PageText = { title: string | null; description?: string };
const meta =
  (copy: Localized<{ meta: { title: string; description: string } }>) =>
  (l: Locale): PageText =>
    copy[l].meta;
const guide =
  (id: ResourceId) =>
  (l: Locale): PageText => ({
    title: RESOURCE_META[l].resources[id].title,
    description: RESOURCE_META[l].resources[id].summary,
  });
const legal =
  (kind: 'privacy' | 'terms') =>
  (l: Locale): PageText => ({
    title: LEGAL_COPY[l][kind],
    description: LEGAL_COPY[l].lead(LEGAL_COPY[l][kind]),
  });

export const ROUTE_TEXT: Record<PublicRoute, (l: Locale) => PageText> = {
  '/': () => ({ title: null }),
  '/features': (l) => ({
    title: FEATURES_COPY[l].metaTitle,
    description: FEATURES_COPY[l].metaDescription,
  }),
  '/departments': meta(OVERVIEW),
  '/departments/executive': meta(EXECUTIVE),
  '/departments/sales': meta(SALES),
  '/departments/operations': meta(OPERATIONS),
  '/departments/warehouse': meta(WAREHOUSE),
  '/departments/purchasing': meta(PURCHASING),
  '/departments/accounting': meta(ACCOUNTING),
  '/solutions': meta(SOLUTIONS_COPY),
  '/how-core-works': meta(WORKFLOW),
  '/enterprise': meta(ENTERPRISE),
  '/industries': meta(INDUSTRIES_SUMMARY),
  '/industries/distribution': meta(DISTRIBUTION),
  '/industries/services': meta(SERVICES),
  '/industries/projects': meta(PROJECTS),
  '/industries/retail': meta(RETAIL),
  '/industries/property': meta(PROPERTY),
  '/industries/manufacturing': meta(MANUFACTURING),
  '/pricing': meta(PRICING),
  '/about': meta(ABOUT),
  '/why-core': meta(WHY_CORE),
  '/contact': meta(CONTACT_COPY),
  '/demo': meta(DEMO_COPY),
  '/security': meta(SECURITY_COPY),
  '/resources': meta(RESOURCES_COPY),
  '/resources/getting-started': guide('gettingStarted'),
  '/resources/how-core-works': guide('howCoreWorks'),
  '/resources/human-error': guide('humanError'),
  '/resources/warehouse-privacy': guide('warehousePrivacy'),
  '/resources/implementation-guide': guide('implementationGuide'),
  '/resources/security-and-data': guide('securityAndData'),
  '/resources/core-glossary': guide('coreGlossary'),
  '/privacy': legal('privacy'),
  '/terms': legal('terms'),
};

/** Structured data per route — the same schemas the pages add at runtime. */
function structuredData(route: PublicRoute, locale: Locale): object[] {
  if (route === '/') return [websiteSchema(locale)];
  if (route === '/about' || route === '/contact') return [organizationSchema()];
  return [];
}

/** The complete head of one public route in one locale. */
export function routeHead(route: PublicRoute, locale: Locale): PageHead {
  return headFor({
    path: route,
    locale,
    ...ROUTE_TEXT[route](locale),
    jsonLd: structuredData(route, locale),
  });
}

/** Every indexable URL: 35 routes × 3 locales. */
export const INDEXABLE = PUBLIC_ROUTES.flatMap((route) =>
  LOCALES.map((locale) => ({ route, locale, head: routeHead(route, locale) })),
);
