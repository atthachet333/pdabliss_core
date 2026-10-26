import { useEffect, useState, type RefObject } from 'react';

/**
 * EP20: a region with endless decorative loops (CSS keyframes, SVG SMIL,
 * timers) that should not run while nobody can see it. Measured on the
 * homepage: offscreen CSS/SMIL loops kept style + layout running every frame
 * even with the page scrolled to the footer.
 *
 * While the region is more than `margin` outside the viewport it gets
 * `data-offscreen` (index.css pauses every CSS animation inside it) and its SVG
 * timelines are paused; both resume exactly where they stopped. The returned
 * flag is `true` while the region is near the viewport and the tab is
 * visible — gate interval-driven sequences on it.
 */
export function useLoopRegion(ref: RefObject<Element | null>, margin = '200px'): boolean {
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const off = !entry?.isIntersecting;
        el.toggleAttribute('data-offscreen', off);
        const svgs = el instanceof SVGSVGElement ? [el] : [...el.querySelectorAll('svg')];
        for (const svg of svgs) {
          if (off) svg.pauseAnimations?.();
          else svg.unpauseAnimations?.();
        }
        setInView(!off);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return inView && pageVisible;
}
