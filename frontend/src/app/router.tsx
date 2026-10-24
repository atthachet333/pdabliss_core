import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  type RouteObject,
} from 'react-router';
import { PublicLayout } from '@/components/layout/PublicLayout';
import HomePage from '@/pages/public/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';
import { AppShell } from '@/components/shell/AppShell';
import { localizePath, resolveLocale, type Locale } from '@/i18n/locales';
import { loadMessages } from '@/i18n/messages';
import { PrototypeGate } from '@/prototype/PrototypeGate';
import { lastWorkspace } from '@/prototype/session';
import ModulePage from '@/workspaces/ModulePage';
import { WORKSPACE_ORDER, WORKSPACES, type WorkspaceId } from '@/workspaces/registry';
import { RouteError, WorkspaceNotFound } from '@/workspaces/RouteStates';

// Public pages other than the landing page are code-split.
const FeaturesPage = lazy(() => import('@/pages/public/FeaturesPage'));
const DepartmentsPage = lazy(() => import('@/pages/public/DepartmentsPage'));
// EP06: one chunk per department page.
const DEPARTMENT_PAGES = {
  executive: lazy(() => import('@/features/departments/executive/ExecutivePage')),
  sales: lazy(() => import('@/features/departments/sales/SalesPage')),
  operations: lazy(() => import('@/features/departments/operations/OperationsPage')),
  warehouse: lazy(() => import('@/features/departments/warehouse/WarehousePage')),
  purchasing: lazy(() => import('@/features/departments/purchasing/PurchasingPage')),
  accounting: lazy(() => import('@/features/departments/accounting/AccountingPage')),
} as const;
const SolutionsPage = lazy(() => import('@/pages/public/SolutionsPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const HowCoreWorksPage = lazy(() => import('@/pages/public/HowCoreWorksPage'));
const EnterprisePage = lazy(() => import('@/pages/public/EnterprisePage'));
const IndustriesPage = lazy(() => import('@/pages/public/IndustriesPage'));
// EP11: one chunk per industry page.
const INDUSTRY_PAGES = {
  distribution: lazy(() => import('@/features/industries/pages/DistributionPage')),
  services: lazy(() => import('@/features/industries/pages/ServicesPage')),
  projects: lazy(() => import('@/features/industries/pages/ProjectsPage')),
  retail: lazy(() => import('@/features/industries/pages/RetailPage')),
  property: lazy(() => import('@/features/industries/pages/PropertyPage')),
  manufacturing: lazy(() => import('@/features/industries/pages/ManufacturingPage')),
} as const;
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const LegalPage = lazy(() => import('@/pages/public/LegalPage'));

// Each workspace dashboard is its own chunk.
const DASHBOARDS: Record<WorkspaceId, LazyExoticComponent<ComponentType>> = {
  executive: lazy(() => import('@/workspaces/executive/ExecutiveDashboard')),
  sales: lazy(() => import('@/workspaces/sales/SalesDashboard')),
  warehouse: lazy(() => import('@/workspaces/warehouse/WarehouseDashboard')),
  purchasing: lazy(() => import('@/workspaces/purchasing/PurchasingDashboard')),
  operations: lazy(() => import('@/workspaces/operations/OperationsDashboard')),
  accounting: lazy(() => import('@/workspaces/accounting/AccountingDashboard')),
  admin: lazy(() => import('@/workspaces/admin/AdminDashboard')),
};

// Modules with their own page; every other module renders the generic ModulePage blueprint.
const MODULE_PAGES: Partial<Record<string, LazyExoticComponent<ComponentType>>> = {
  'executive/departments': lazy(() => import('@/workspaces/executive/DepartmentsPage')),
  'admin/departments': lazy(() =>
    import('@/workspaces/admin/ConfigPages').then((m) => ({ default: m.AdminDepartmentsPage })),
  ),
  'admin/roles': lazy(() =>
    import('@/workspaces/admin/ConfigPages').then((m) => ({ default: m.AdminRolesPage })),
  ),
  'admin/settings': lazy(() =>
    import('@/workspaces/admin/ConfigPages').then((m) => ({ default: m.AdminSettingsPage })),
  ),
};

// EP02-PROTOTYPE: component gallery for design review. Reachable by URL (and the
// prototype profile menu) only — never part of a workspace's navigation.
const DesignLab = lazy(() => import('@/prototype/lab/DesignLab'));

function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-[70dvh]" aria-busy="true" />}>{children}</Suspense>
  );
}

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const lazyPage = (Page: LazyExoticComponent<ComponentType>) => (
  <PageSuspense>
    <Page />
  </PageSuspense>
);

/**
 * Workspace route groups: /app/executive, /app/sales, /app/warehouse, …
 * Route visibility is navigation only. It is NOT security — every API call is
 * authorized server-side (see docs/ARCHITECTURE.md).
 */
function AppIndex() {
  return <Navigate to={`/app/${lastWorkspace()}`} replace />;
}

function workspaceRoutes(): RouteObject[] {
  return WORKSPACE_ORDER.map((id) => {
    const Dashboard = DASHBOARDS[id];
    return {
      path: `app/${id}`,
      element: <AppShell workspace={id} />,
      children: [
        { index: true, element: <Dashboard />, errorElement: <RouteError /> },
        ...WORKSPACES[id].nav
          .filter((item) => item.path !== '')
          .map((item) => {
            const Custom = MODULE_PAGES[`${id}/${item.path}`];
            return {
              path: item.path,
              element: Custom ? <Custom /> : <ModulePage workspace={id} path={item.path} />,
              errorElement: <RouteError />,
            };
          }),
        { path: '*', element: <WorkspaceNotFound workspace={id} /> },
      ],
    };
  });
}

/** The lab renders inside the shell of the reviewer's last workspace. */
function LabShell() {
  return <AppShell workspace={lastWorkspace()} />;
}

/** Public pages, shared by every locale (EP05). Page bodies are Thai for now. */
function publicPages(): RouteObject[] {
  return [
    { index: true, element: <HomePage /> },
    { path: 'features', element: lazyPage(FeaturesPage) },
    { path: 'departments', element: lazyPage(DepartmentsPage) },
    ...Object.entries(DEPARTMENT_PAGES).map(([id, Page]) => ({
      path: `departments/${id}`,
      element: lazyPage(Page),
    })),
    { path: 'solutions', element: lazyPage(SolutionsPage) },
    { path: 'pricing', element: lazyPage(PricingPage) },
    { path: 'how-core-works', element: lazyPage(HowCoreWorksPage) },
    { path: 'enterprise', element: lazyPage(EnterprisePage) },
    { path: 'industries', element: lazyPage(IndustriesPage) },
    ...Object.entries(INDUSTRY_PAGES).map(([id, Page]) => ({
      path: `industries/${id}`,
      element: lazyPage(Page),
    })),
    { path: 'about', element: lazyPage(AboutPage) },
    { path: 'contact', element: lazyPage(ContactPage) },
    {
      path: 'privacy',
      element: (
        <PageSuspense>
          <LegalPage kind="privacy" />
        </PageSuspense>
      ),
    },
    {
      path: 'terms',
      element: (
        <PageSuspense>
          <LegalPage kind="terms" />
        </PageSuspense>
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
 * loaded before the route renders — Thai visitors never download it.
 * /en/login and /zh/login redirect: sign-in is never locale-prefixed.
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
      { path: 'login', element: <Navigate to="/login" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  };
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      // Thai — default locale, unprefixed.
      {
        element: <PublicLayout />,
        children: [
          ...publicPages(),
          { path: 'login', element: lazyPage(LoginPage) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // English and Simplified Chinese — the public shell is localized; page
      // bodies follow in the localization episode (docs/PUBLIC_SHELL.md).
      localeRoutes('en', 'en'),
      localeRoutes('zh', 'zh-CN'),
      ...['th', 'zh-CN', 'zh-hans'].map((alias) => ({
        path: `${alias}/*`,
        element: <LocaleAlias alias={alias} />,
      })),
      // EP01-PROTOTYPE: workspaces sit behind the demo-only sign-in (src/prototype/).
      // There is no company picker. The prototype's workspace switcher is review-only;
      // production sign-in will open the user's assigned workspace directly.
      {
        element: <PrototypeGate />,
        children: [
          { path: 'app', element: <AppIndex /> },
          {
            path: 'app/prototype',
            element: <LabShell />,
            children: [
              { path: 'ui', element: <DesignLab />, errorElement: <RouteError /> },
              { path: '*', element: <Navigate to="/app/prototype/ui" replace /> },
            ],
          },
          ...workspaceRoutes(),
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
