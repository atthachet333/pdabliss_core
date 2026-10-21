import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  ScrollRestoration,
  type RouteObject,
} from 'react-router';
import { PublicLayout } from '@/components/layout/PublicLayout';
import HomePage from '@/pages/public/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';
import { WorkspaceLayout } from '@/components/app/WorkspaceLayout';
import ModulePage from '@/workspaces/ModulePage';
import { WORKSPACE_ORDER, WORKSPACES, type WorkspaceId } from '@/workspaces/registry';

// Public pages other than the landing page are code-split.
const FeaturesPage = lazy(() => import('@/pages/public/FeaturesPage'));
const DepartmentsPage = lazy(() => import('@/pages/public/DepartmentsPage'));
const SolutionsPage = lazy(() => import('@/pages/public/SolutionsPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const LegalPage = lazy(() => import('@/pages/public/LegalPage'));

// Each workspace dashboard is its own chunk (Recharts only loads with Executive).
const DASHBOARDS: Record<WorkspaceId, LazyExoticComponent<ComponentType>> = {
  executive: lazy(() => import('@/workspaces/executive/ExecutiveDashboard')),
  sales: lazy(() => import('@/workspaces/sales/SalesDashboard')),
  warehouse: lazy(() => import('@/workspaces/warehouse/WarehouseDashboard')),
  purchasing: lazy(() => import('@/workspaces/purchasing/PurchasingDashboard')),
  operations: lazy(() => import('@/workspaces/operations/OperationsDashboard')),
  accounting: lazy(() => import('@/workspaces/accounting/AccountingDashboard')),
  admin: lazy(() => import('@/workspaces/admin/AdminDashboard')),
};

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
function workspaceRoutes(): RouteObject[] {
  return WORKSPACE_ORDER.map((id) => {
    const Dashboard = DASHBOARDS[id];
    return {
      path: `app/${id}`,
      element: <WorkspaceLayout workspace={id} />,
      children: [
        { index: true, element: <Dashboard /> },
        ...WORKSPACES[id].nav
          .filter((item) => item.path !== '')
          .map((item) => ({
            path: item.path,
            element: <ModulePage workspace={id} path={item.path} />,
          })),
        { path: '*', element: <Navigate to={`/app/${id}`} replace /> },
      ],
    };
  });
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'features', element: lazyPage(FeaturesPage) },
          { path: 'departments', element: lazyPage(DepartmentsPage) },
          { path: 'solutions', element: lazyPage(SolutionsPage) },
          { path: 'pricing', element: lazyPage(PricingPage) },
          { path: 'about', element: lazyPage(AboutPage) },
          { path: 'contact', element: lazyPage(ContactPage) },
          { path: 'login', element: lazyPage(LoginPage) },
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
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // There is no company or workspace picker: a signed-in user lands directly in their workspace.
      { path: 'app', element: <Navigate to="/login" replace /> },
      ...workspaceRoutes(),
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
