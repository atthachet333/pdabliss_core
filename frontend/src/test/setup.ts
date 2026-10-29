import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetIdentityForTests } from '@/features/auth/session';

afterEach(() => cleanup());

// Route pages are lazy chunks; under a parallel test run the first import can
// take longer than Testing Library's 1s default for findBy* queries. EP30:
// 10 s (below the 15 s test timeout) — the EP24 / EP25 Control Center and
// Explorer tests that pass in ~2 s alone repeatedly crossed 5 s under a full
// parallel run (EP27–EP29 reports). An element that never appears still fails.
configure({ asyncUtilTimeout: 10_000 });

// Per-viewer UI preferences (sidebar width) must not leak between tests.
afterEach(() => window.localStorage.clear());

// jsdom lacks these browser APIs used by motion/layout code.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IO);
vi.stubGlobal('ResizeObserver', IO);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

window.scrollTo = () => {};

// jsdom has no WebGL (or 2D canvas). Returning null mirrors a browser without
// WebGL, so the homepage exercises its static CORE fallback in unit tests.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

// No API in unit tests — fetch rejects so data hooks use their offline fallback.
// Tests that need the account API install a fake one (src/test/fakeApi.ts);
// it is put back to "offline", and the signed-in identity forgotten, after each test.
const offline = () => vi.fn(() => Promise.reject(new Error('network disabled in tests')));
vi.stubGlobal('fetch', offline());
afterEach(() => {
  vi.stubGlobal('fetch', offline());
  resetIdentityForTests();
});
