import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { AppShell } from '@/components/shell/AppShell';
import { PrototypeGate } from '@/prototype/PrototypeGate';
import { lastWorkspace } from '@/prototype/session';
import ModulePage from '@/workspaces/ModulePage';
import { WORKSPACE_ORDER, WORKSPACES, type WorkspaceId } from '@/workspaces/registry';
import { RouteError, WorkspaceNotFound } from '@/workspaces/RouteStates';

/*
 * The /app/* prototype workspaces (EP20: their own chunk). The router patches
 * these routes in on the first navigation into /app (see router.tsx), so the
 * public website never downloads the shell, the workspace registry or the
 * query client.
 */

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

/** Server-state cache for the workspaces. Public pages never fetch, so it lives here. */
function AppProviders() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Outlet />
    </QueryClientProvider>
  );
}

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

/**
 * EP01-PROTOTYPE: workspaces sit behind the demo-only sign-in (src/prototype/).
 * There is no company picker. The prototype's workspace switcher is review-only;
 * production sign-in will open the user's assigned workspace directly.
 * The stable `id` lets the router patch these in once per router.
 */
export function appRoutes(): RouteObject[] {
  return [
    {
      id: 'app',
      element: <AppProviders />,
      children: [
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
}
