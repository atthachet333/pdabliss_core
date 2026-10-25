/**
 * The permanent public regression route set (EP11). Header, language and
 * sitemap tests all read this list, so a new public page is added once here.
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

/** Public locales and their URL prefixes (Thai is unprefixed). */
export const LOCALE_PREFIXES = { th: '', en: '/en', 'zh-CN': '/zh' } as const;
