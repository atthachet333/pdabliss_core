import type { ComponentType } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  type PatchRoutesOnNavigationFunction,
  type RouteObject,
} from 'react-router';
import { PublicLayout } from '@/components/layout/PublicLayout';
import NotFoundPage from '@/pages/NotFoundPage';
import { localizePath, resolveLocale, type Locale } from '@/i18n/locales';
import { loadMessages } from '@/i18n/messages';

type PageModule = { default: ComponentType };

/*
 * EP20: every public page — the homepage included — is its own chunk, loaded
 * by the router (route `lazy`) rather than by React.lazy + Suspense. The router
 * loads the chunk before it renders the route, so a client navigation keeps
 * the current page on screen until the next one is ready (no blank state),
 * and a direct visit shows the header and footer with a full-height
 * placeholder (the footer stays below the fold — no layout shift). Each
 * prerendered HTML file also preloads its own page chunk (scripts/prerender.mjs
 * via src/seo/routeModules.ts), so the chunk downloads alongside the entry.
 */
const PAGES: Record<string, () => Promise<PageModule>> = {
  '/': () => import('@/pages/public/HomePage'),
  '/features': () => import('@/pages/public/FeaturesPage'),
  '/departments': () => import('@/pages/public/DepartmentsPage'),
  // EP06: one chunk per department page.
  '/departments/executive': () => import('@/features/departments/executive/ExecutivePage'),
  '/departments/sales': () => import('@/features/departments/sales/SalesPage'),
  '/departments/operations': () => import('@/features/departments/operations/OperationsPage'),
  '/departments/warehouse': () => import('@/features/departments/warehouse/WarehousePage'),
  '/departments/purchasing': () => import('@/features/departments/purchasing/PurchasingPage'),
  '/departments/accounting': () => import('@/features/departments/accounting/AccountingPage'),
  '/solutions': () => import('@/pages/public/SolutionsPage'),
  '/pricing': () => import('@/pages/public/PricingPage'),
  '/how-core-works': () => import('@/pages/public/HowCoreWorksPage'),
  '/enterprise': () => import('@/pages/public/EnterprisePage'),
  '/industries': () => import('@/pages/public/IndustriesPage'),
  // EP11: one chunk per industry page.
  '/industries/distribution': () => import('@/features/industries/pages/DistributionPage'),
  '/industries/services': () => import('@/features/industries/pages/ServicesPage'),
  '/industries/projects': () => import('@/features/industries/pages/ProjectsPage'),
  '/industries/retail': () => import('@/features/industries/pages/RetailPage'),
  '/industries/property': () => import('@/features/industries/pages/PropertyPage'),
  '/industries/manufacturing': () => import('@/features/industries/pages/ManufacturingPage'),
  '/about': () => import('@/pages/public/AboutPage'),
  '/why-core': () => import('@/pages/public/WhyCorePage'),
  '/contact': () => import('@/pages/public/ContactPage'),
  // EP14: the public interactive demo.
  '/demo': () => import('@/pages/public/DemoPage'),
  // EP15: the public Security / Trust Center.
  '/security': () => import('@/pages/public/SecurityPage'),
  // EP16: the CORE knowledge library and its guides (each guide its own chunk).
  '/resources': () => import('@/pages/public/ResourcesPage'),
  '/resources/getting-started': () => import('@/features/resources/guides/GettingStarted'),
  '/resources/how-core-works': () => import('@/features/resources/guides/HowCoreWorksGuide'),
  '/resources/human-error': () => import('@/features/resources/guides/HumanErrorGuide'),
  '/resources/warehouse-privacy': () => import('@/features/resources/guides/WarehousePrivacyGuide'),
  '/resources/implementation-guide': () =>
    import('@/features/resources/guides/ImplementationGuide'),
  '/resources/security-and-data': () => import('@/features/resources/guides/SecurityAndDataGuide'),
  '/resources/core-glossary': () => import('@/features/resources/guides/GlossaryGuide'),
};

const loadLegal = () => import('@/pages/public/LegalPage');

/** Page area while a direct visit loads its chunk: full height, so nothing below it shifts. */
const pageFallback = <div className="min-h-dvh" aria-busy="true" />;

const lazyRoute = (load: () => Promise<{ Component: ComponentType }>) => ({
  lazy: load,
  hydrateFallbackElement: pageFallback,
});

const pageRoute = (load: () => Promise<PageModule>) =>
  lazyRoute(() => load().then((m) => ({ Component: m.default })));

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

/** Public pages, shared by every locale (EP05). */
function publicPages(): RouteObject[] {
  return [
    ...Object.entries(PAGES).map(([path, load]): RouteObject =>
      path === '/'
        ? { index: true, ...pageRoute(load) }
        : { path: path.slice(1), ...pageRoute(load) },
    ),
    {
      path: 'privacy',
      ...lazyRoute(() =>
        loadLegal().then(({ default: LegalPage }) => ({
          Component: () => <LegalPage kind="privacy" />,
        })),
      ),
    },
    {
      path: 'terms',
      ...lazyRoute(() =>
        loadLegal().then(({ default: LegalPage }) => ({
          Component: () => <LegalPage kind="terms" />,
        })),
      ),
    },
  ];
}

/**
 * Alias prefixes (/th/…, /zh-CN/…, /zh-hans/…) redirect to the canonical
 * locale URL, keeping the rest of the path and the hash.
 */
function LocaleAlias({ alias }: { alias: string }) {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.slice(alias.length + 1) || '/';
  return <Navigate to={`${localizePath(rest, resolveLocale(alias))}${search}${hash}`} replace />;
}

/**
 * A prefixed locale (/en, /zh). Its shell dictionary is a separate chunk,
 * loaded before the route renders — Thai visitors never download it. The
 * router loads it in parallel with the page chunk.
 * /en/login and /zh/login redirect: sign-in is never locale-prefixed, but the
 * visitor's language travels in router state so the gateway speaks it (EP15).
 * The same holds for the EP23 account screens (register, forgot password).
 */
function localeRoutes(path: string, locale: Locale): RouteObject {
  return {
    path,
    // Shown for the moment the dictionary chunk loads on a direct visit.
    hydrateFallbackElement: <div className="min-h-dvh bg-surface-dark" aria-busy="true" />,
    lazy: async () => {
      await loadMessages(locale);
      return { element: <PublicLayout locale={locale} /> };
    },
    children: [
      ...publicPages(),
      ...['login', 'register', 'forgot-password'].map((page) => ({
        path: page,
        element: <Navigate to={`/${page}`} replace state={{ locale }} />,
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  };
}

export const routes: RouteObject[] = [
  {
    // The /app/* workspaces are patched in under this id (patchRoutesOnNavigation).
    id: 'root',
    element: <Root />,
    // A direct /app/* visit, while its routes are discovered.
    hydrateFallbackElement: <div className="min-h-dvh bg-surface-dark" aria-busy="true" />,
    children: [
      // Thai — default locale, unprefixed.
      {
        element: <PublicLayout />,
        children: [...publicPages(), { path: '*', element: <NotFoundPage /> }],
      },
      // EP15: the CORE Gateway sign-in has its own focused chrome (logo + back
      // to the website), outside the public header and footer.
      { path: 'login', ...pageRoute(() => import('@/pages/public/LoginPage')) },
      // EP23: account screens (noindex, never locale-prefixed, own chunks —
      // the public pages never load their code).
      { path: 'register', ...pageRoute(() => import('@/pages/auth/RegisterPage')) },
      { path: 'verify-email', ...pageRoute(() => import('@/pages/auth/VerifyEmailPage')) },
      { path: 'forgot-password', ...pageRoute(() => import('@/pages/auth/ForgotPasswordPage')) },
      { path: 'reset-password', ...pageRoute(() => import('@/pages/auth/ResetPasswordPage')) },
      { path: 'account', ...pageRoute(() => import('@/pages/account/AccountPage')) },
      {
        path: 'account/invitation',
        ...pageRoute(() => import('@/pages/account/InvitationPage')),
      },
      { path: 'platform', ...pageRoute(() => import('@/pages/account/PlatformPage')) },
      // English and Simplified Chinese.
      localeRoutes('en', 'en'),
      localeRoutes('zh', 'zh-CN'),
      ...['th', 'zh-CN', 'zh-hans'].map((alias) => ({
        path: `${alias}/*`,
        element: <LocaleAlias alias={alias} />,
      })),
    ],
  },
];

/**
 * EP20: the prototype workspaces (src/app/appRoutes.tsx) are discovered on the
 * first navigation into /app — until then /app/* only matches the public 404
 * splat, which is what makes the router ask. Public URLs return immediately.
 */
export const patchRoutesOnNavigation: PatchRoutesOnNavigationFunction = async ({ path, patch }) => {
  if (path !== '/app' && !path.startsWith('/app/')) return;
  const { appRoutes } = await import('./appRoutes');
  patch('root', appRoutes());
};

export function createAppRouter() {
  return createBrowserRouter(routes, { patchRoutesOnNavigation });
}
