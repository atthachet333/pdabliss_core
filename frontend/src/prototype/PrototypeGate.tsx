import { Navigate, Outlet, useLocation } from 'react-router';
import { homeFor, useIdentity } from '@/features/auth/session';
import { PROTOTYPE_ENABLED } from './config';

/**
 * Gate for the /app/* prototype workspaces (EP23): a real server session is
 * required (anonymous → /login?next=…), and the workspaces exist only where
 * the prototype is enabled — otherwise the signed-in person goes to their
 * Account Portal / Platform Control Center. Rendering only: the sample
 * workspaces call no protected API, and every real API authorizes itself.
 */
export function PrototypeGate() {
  const identity = useIdentity();
  const location = useLocation();
  if (identity.status === 'anonymous' || identity.status === 'error') {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (identity.status !== 'ready') {
    return <div className="min-h-dvh bg-surface-dark" aria-busy="true" />;
  }
  if (!PROTOTYPE_ENABLED) return <Navigate to={homeFor(identity.identity)} replace />;
  return <Outlet />;
}
