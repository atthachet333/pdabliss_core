import { render } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getIdentityState,
  refreshIdentity,
  resetIdentityForTests,
  useIdentity,
} from '@/features/auth/session';
import { fakeApi, identity, ok } from './fakeApi';

/*
 * EP42.3.1 — test isolation of the signed-in identity (src/test/setup.ts, features/auth/session.ts).
 * The intermittent full-suite failures ("The service could not be reached" on a page that had
 * not even asked yet) came from one test's late work landing in the next one. These cases make
 * that late work happen on purpose, every time.
 */

// A page whose lazy chunk is still loading when its test ends, released during teardown.
let release: (() => void) | null = null;
const LatePage = lazy(
  () =>
    new Promise<{ default: () => null }>((resolve) => {
      release = () =>
        resolve({
          default: function Page() {
            useIdentity(); // like every signed-in page: loads /auth/me when the identity is idle
            return null;
          },
        });
    }),
);
// Registered in this file, so it runs BEFORE the shared teardown in setup.ts ('stack' order).
afterEach(() => {
  release?.();
  release = null;
});

describe('test isolation (EP42.3.1)', () => {
  it('1 · a test ends while its page is still loading', () => {
    fakeApi({ 'GET /api/v1/auth/me': ok({ identity: identity() }) });
    render(
      <Suspense fallback={null}>
        <LatePage />
      </Suspense>,
    );
    expect(getIdentityState()).toEqual({ status: 'idle' });
  });

  it('2 · the next test starts signed out and offline — nothing of test 1 leaked in', async () => {
    // Give any late work of test 1 every chance to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(getIdentityState()).toEqual({ status: 'idle' });
    await expect(fetch('http://x.test/')).rejects.toThrow('network disabled in tests');
  });

  it('an answer to a request made before a reset is not kept', async () => {
    let answer: (() => void) | null = null;
    fakeApi({
      'GET /api/v1/auth/me': () =>
        new Promise((resolve) => {
          answer = () => resolve(ok({ identity: identity() }));
        }),
    });
    const pending = refreshIdentity();
    await new Promise((r) => setTimeout(r, 0));
    resetIdentityForTests();
    answer!();
    await pending;
    expect(getIdentityState()).toEqual({ status: 'idle' });
  });
});
