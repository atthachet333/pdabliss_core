import { Navigate, Outlet, useLocation } from 'react-router';
import { usePrototypeSession } from './session';

/**
 * Prototype-only gate for /app/*. Keeps the workspaces behind the demo sign-in
 * so they are not browsable anonymously. This is NOT security — real
 * authentication and server-side authorization replace it in a later episode.
 */
export function PrototypeGate() {
  const session = usePrototypeSession();
  const location = useLocation();
  if (!session) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
