import type { PublicRoute } from '@/config/publicRoutes';
import type { Locale } from '@/i18n/locales';

/*
 * EP20 — the source module behind each route, for build-time preloading.
 * scripts/prerender.mjs looks each one up in the Vite manifest and writes a
 * <link rel="modulepreload"> for the route's own chunk (and its static
 * imports) into that route's HTML, so the page code downloads in parallel with
 * the entry instead of after it has run. Only the current page is preloaded —
 * other routes are never prefetched.
 *
 * Kept in step with the dynamic imports in src/app/router.tsx (and the locale
 * loaders in src/i18n/messages) by src/test/performance.test.ts.
 */
export const ROUTE_MODULES: Record<PublicRoute | '/login', string> = {
  '/': 'src/pages/public/HomePage.tsx',
  '/features': 'src/pages/public/FeaturesPage.tsx',
  '/departments': 'src/pages/public/DepartmentsPage.tsx',
  '/departments/executive': 'src/features/departments/executive/ExecutivePage.tsx',
  '/departments/sales': 'src/features/departments/sales/SalesPage.tsx',
  '/departments/operations': 'src/features/departments/operations/OperationsPage.tsx',
  '/departments/warehouse': 'src/features/departments/warehouse/WarehousePage.tsx',
  '/departments/purchasing': 'src/features/departments/purchasing/PurchasingPage.tsx',
  '/departments/accounting': 'src/features/departments/accounting/AccountingPage.tsx',
  '/solutions': 'src/pages/public/SolutionsPage.tsx',
  '/pricing': 'src/pages/public/PricingPage.tsx',
  '/how-core-works': 'src/pages/public/HowCoreWorksPage.tsx',
  '/enterprise': 'src/pages/public/EnterprisePage.tsx',
  '/industries': 'src/pages/public/IndustriesPage.tsx',
  '/industries/distribution': 'src/features/industries/pages/DistributionPage.tsx',
  '/industries/services': 'src/features/industries/pages/ServicesPage.tsx',
  '/industries/projects': 'src/features/industries/pages/ProjectsPage.tsx',
  '/industries/retail': 'src/features/industries/pages/RetailPage.tsx',
  '/industries/property': 'src/features/industries/pages/PropertyPage.tsx',
  '/industries/manufacturing': 'src/features/industries/pages/ManufacturingPage.tsx',
  '/about': 'src/pages/public/AboutPage.tsx',
  '/why-core': 'src/pages/public/WhyCorePage.tsx',
  '/contact': 'src/pages/public/ContactPage.tsx',
  '/consultation': 'src/pages/public/ConsultationPage.tsx',
  '/demo': 'src/pages/public/DemoPage.tsx',
  '/security': 'src/pages/public/SecurityPage.tsx',
  '/resources': 'src/pages/public/ResourcesPage.tsx',
  '/resources/getting-started': 'src/features/resources/guides/GettingStarted.tsx',
  '/resources/how-core-works': 'src/features/resources/guides/HowCoreWorksGuide.tsx',
  '/resources/human-error': 'src/features/resources/guides/HumanErrorGuide.tsx',
  '/resources/warehouse-privacy': 'src/features/resources/guides/WarehousePrivacyGuide.tsx',
  '/resources/implementation-guide': 'src/features/resources/guides/ImplementationGuide.tsx',
  '/resources/security-and-data': 'src/features/resources/guides/SecurityAndDataGuide.tsx',
  '/resources/core-glossary': 'src/features/resources/guides/GlossaryGuide.tsx',
  '/privacy': 'src/pages/public/LegalPage.tsx',
  '/terms': 'src/pages/public/LegalPage.tsx',
  '/login': 'src/pages/public/LoginPage.tsx',
};

/** The shell dictionary chunk a prefixed locale loads before rendering. */
export const LOCALE_MODULES: Partial<Record<Locale, string>> = {
  en: 'src/i18n/messages/en.ts',
  'zh-CN': 'src/i18n/messages/zh-CN.ts',
};

/** The prototype workspaces' routes (preloaded by the /app shell only). */
export const APP_MODULE = 'src/app/appRoutes.tsx';
