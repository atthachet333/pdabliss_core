import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { PatchRoutesOnNavigationFunction } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/router';
import { homeFor } from '@/features/auth/session';
import { fakeApi, identity, signedIn, signedOut } from '@/test/fakeApi';
import { prototypeOffRoutes } from './prototypeOffRoutes';

// A build without the prototype (EP30): the gate reads the flag as false.
vi.mock('@/prototype/config', () => ({
  PROTOTYPE_ENABLED: false,
  PROTOTYPE_LAST_WORKSPACE_KEY: 'pbc.prototype.lastWorkspace',
}));

const patch: PatchRoutesOnNavigationFunction = ({ path, patch: add }) => {
  if (path === '/app' || path.startsWith('/app/')) add('root', prototypeOffRoutes());
};

function renderOff(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
    patchRoutesOnNavigation: patch,
  });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe('/app in a build without the prototype (EP30)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends an anonymous visitor to sign in, keeping where they were going', async () => {
    fakeApi(signedOut);
    const router = renderOff('/app/warehouse');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/app/warehouse')}`);
  });

  it('sends a signed-in person to their own home, for /app and any workspace', async () => {
    const who = identity();
    for (const path of ['/app', '/app/purchasing']) {
      fakeApi(signedIn(who));
      const router = renderOff(path);
      await waitFor(() => expect(router.state.location.pathname).toBe(homeFor(who)));
    }
  });
});
