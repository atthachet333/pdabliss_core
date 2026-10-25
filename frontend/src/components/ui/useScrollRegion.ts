import { useEffect, useRef, useState } from 'react';

/**
 * A horizontally scrolling container (a wide table on a phone) must be reachable
 * by keyboard when its content has nothing focusable (EP19). While — and only
 * while — the content overflows, the container becomes a labelled, focusable
 * region, so arrow keys scroll it and screen readers name it. On wide screens
 * nothing scrolls and no extra tab stop is added.
 */
export function useScrollRegion<T extends HTMLElement = HTMLDivElement>(labelledBy: string) {
  const ref = useRef<T>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return {
    ref,
    'data-scroll-region': scrolls ? 'scrolls' : 'fits',
    ...(scrolls ? { tabIndex: 0, role: 'region' as const, 'aria-labelledby': labelledBy } : {}),
  };
}
