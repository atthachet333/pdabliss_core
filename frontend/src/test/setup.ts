import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// Route pages are lazy chunks; under a parallel test run the first import can
// take longer than Testing Library's 1s default for findBy* queries.
configure({ asyncUtilTimeout: 5000 });

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
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.reject(new Error('network disabled in tests'))),
);
