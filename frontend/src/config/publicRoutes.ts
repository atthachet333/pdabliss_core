/**
 * The public route set (EP11; production source since EP17). Every route is
 * served in th / en / zh. The build-time prerender (src/seo), the sitemap,
 * header, language, SEO and discoverability tests all read this one list, so
 * a new public page is added once here.
 */
export const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/departments',
  '/departments/executive',
  '/departments/sales',
  '/departments/operations',
  '/departments/warehouse',
  '/departments/purchasing',
  '/departments/accounting',
  '/solutions',
  '/how-core-works',
  '/enterprise',
  '/industries',
  '/industries/distribution',
  '/industries/services',
  '/industries/projects',
  '/industries/retail',
  '/industries/property',
  '/industries/manufacturing',
  '/pricing',
  '/about',
  '/why-core',
  '/contact',
  // EP24.1.4.3: the guided consultation, split from /contact (owner-approved).
  '/consultation',
  '/demo',
  '/security',
  // EP16: the knowledge library and its seven guides.
  '/resources',
  '/resources/getting-started',
  '/resources/how-core-works',
  '/resources/human-error',
  '/resources/warehouse-privacy',
  '/resources/implementation-guide',
  '/resources/security-and-data',
  '/resources/core-glossary',
  '/privacy',
  '/terms',
] as const;
export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/** Public locales and their URL prefixes (Thai is unprefixed). */
export const LOCALE_PREFIXES = { th: '', en: '/en', 'zh-CN': '/zh' } as const;
