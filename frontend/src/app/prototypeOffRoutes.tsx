import type { RouteObject } from 'react-router';
import { PrototypeGate } from '@/prototype/PrototypeGate';

/*
 * /app/* in a build WITHOUT the prototype (EP30). The prototype workspaces
 * (src/app/appRoutes.tsx) are not part of such a build at all; /app keeps
 * behaving exactly as before: PrototypeGate sends an anonymous visitor to
 * /login?next=… and a signed-in person to their Account Portal / Platform
 * Control Center. Same route id as the prototype tree, so the router patches
 * it once.
 */
export function prototypeOffRoutes(): RouteObject[] {
  return [
    {
      id: 'app',
      element: <PrototypeGate />,
      children: [
        { path: 'app', element: null },
        { path: 'app/*', element: null },
      ],
    },
  ];
}
