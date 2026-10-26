import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messagesSource from '@/i18n/messages/index.ts?raw';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { APP_MODULE, LOCALE_MODULES, ROUTE_MODULES } from '@/seo/routeModules';
import routerSource from '../app/router.tsx?raw';
import { PUBLIC_ROUTES } from './publicRoutes';

/*
 * EP20 performance regression guards that need no build and no timing.
 * Bundle sizes and the built chunk graph are checked by scripts/perf-budget.mjs.
 */

const files = import.meta.glob('/src/**/*.{ts,tsx}');
const toSource = (spec: string) =>
  Object.keys(files)
    .map((f) => f.slice(1))
    .find((f) => f === `src/${spec.slice(2)}.tsx` || f === `src/${spec.slice(2)}.ts`);

describe('route preloading (src/seo/routeModules.ts)', () => {
  // `'/pricing': () => import('@/pages/public/PricingPage')` in router.tsx.
  const routerPages = Object.fromEntries(
    [...routerSource.matchAll(/'(\/[^']*)':\s*\(\)\s*=>\s*import\('(@\/[^']+)'\)/g)].map(
      ([, route, spec]) => [route, toSource(spec!)],
    ),
  );

  it('maps every routed page to the module the router loads', () => {
    for (const route of Object.keys(routerPages))
      expect(ROUTE_MODULES[route as keyof typeof ROUTE_MODULES], route).toBe(routerPages[route]);
    expect(routerSource).toContain(`import('@/${ROUTE_MODULES['/privacy'].slice(4, -4)}')`);
    expect(routerSource).toContain(`import('@/${ROUTE_MODULES['/login'].slice(4, -4)}')`);
  });

  it('covers every public route and points at real files', () => {
    for (const route of PUBLIC_ROUTES) expect(ROUTE_MODULES[route], route).toBeTruthy();
    for (const src of [
      ...Object.values(ROUTE_MODULES),
      ...Object.values(LOCALE_MODULES),
      APP_MODULE,
    ])
      expect(files[`/${src}`], src).toBeDefined();
  });

  it('preloads the dictionary each prefixed locale loads', () => {
    expect(messagesSource).toContain(`en: () => import('./en')`);
    expect(messagesSource).toContain(`'zh-CN': () => import('./zh-CN')`);
    expect(LOCALE_MODULES).toEqual({
      en: 'src/i18n/messages/en.ts',
      'zh-CN': 'src/i18n/messages/zh-CN.ts',
    });
  });

  it('keeps every page, and the /app workspaces, out of the router module', () => {
    const staticImports = [...routerSource.matchAll(/^import [^;]*? from '([^']+)';$/gm)].map(
      ([, spec]) => spec,
    );
    expect(staticImports.sort()).toEqual(
      [
        'react',
        'react-router',
        '@/components/layout/PublicLayout',
        '@/pages/NotFoundPage',
        '@/i18n/locales',
        '@/i18n/messages',
      ].sort(),
    );
    expect(routerSource).toContain(`await import('./appRoutes')`);
  });
});

describe('useLoopRegion', () => {
  let fire: (visible: boolean) => void = () => {};
  class ControlledIO {
    constructor(private cb: IntersectionObserverCallback) {
      fire = (isIntersecting) =>
        this.cb(
          [{ isIntersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
    }
    observe() {}
    disconnect() {}
  }
  afterEach(() => vi.unstubAllGlobals());

  function Region({ onLive }: { onLive: (live: boolean) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    onLive(useLoopRegion(ref));
    return (
      <div ref={ref} data-testid="region">
        <svg />
      </div>
    );
  }

  it('pauses CSS and SVG loops offscreen and resumes them in view', () => {
    vi.stubGlobal('IntersectionObserver', ControlledIO);
    const pause = vi.fn();
    const resume = vi.fn();
    Object.assign(SVGSVGElement.prototype, { pauseAnimations: pause, unpauseAnimations: resume });
    const live: boolean[] = [];
    const { getByTestId } = render(<Region onLive={(v) => live.push(v)} />);
    const region = getByTestId('region');

    act(() => fire(false));
    expect(region).toHaveAttribute('data-offscreen');
    expect(pause).toHaveBeenCalledTimes(1);
    expect(live.at(-1)).toBe(false);

    act(() => fire(true));
    expect(region).not.toHaveAttribute('data-offscreen');
    expect(resume).toHaveBeenCalledTimes(1);
    expect(live.at(-1)).toBe(true);
  });

  it('reports a hidden tab so timed sequences stop', () => {
    vi.stubGlobal('IntersectionObserver', ControlledIO);
    const live: boolean[] = [];
    render(<Region onLive={(v) => live.push(v)} />);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(live.at(-1)).toBe(false);
    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(live.at(-1)).toBe(true);
    hidden.mockRestore();
  });
});
