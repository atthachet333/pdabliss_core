import {
  useInView,
  useMotionValue,
  useScroll,
  type MotionValue,
  type UseScrollOptions,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useMediaQuery } from '@/components/core/hooks';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';

/*
 * Motion primitives for the /about scenes (EP13). Story data lives in
 * model.ts / copy files; these helpers only turn progress into state.
 *
 * The motion language is *state transformation*: a scene has one progress
 * value (0 → 1) and every element derives its state from it. Progress comes
 * from native scroll (never intercepted), from a one-off play when a scene
 * enters view, or — with reduced motion — is simply 1: the final state.
 */

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Local progress of `p` inside the window [start, end]. */
export const segment = (p: number, start: number, end: number) =>
  clamp01((p - start) / (end - start));
/** Calm in-out easing for state changes. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** True on devices with a precise hovering pointer — the only place proximity responds. */
export function useFinePointer() {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}

/** The rendered size of an element, kept current with a ResizeObserver. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** Scroll progress through `target` — or a constant 1 when motion is reduced or disabled. */
export function useSceneScroll(
  target: RefObject<HTMLElement | null>,
  offset: UseScrollOptions['offset'],
  enabled = true,
): MotionValue<number> {
  const reduce = usePrefersReducedMotion();
  // A disabled scene never hands an unmounted ref to useScroll.
  const { scrollYProgress } = useScroll(enabled ? { target, offset } : {});
  const done = useMotionValue(1);
  return reduce || !enabled ? done : scrollYProgress;
}

/**
 * Plays 0 → 1 once when `target` enters view (for scenes that are not
 * scroll-driven, e.g. on phones). Reduced motion: already 1.
 */
export function usePlayOnce(
  target: RefObject<HTMLElement | null>,
  duration: number,
  enabled = true,
): MotionValue<number> {
  const reduce = usePrefersReducedMotion();
  const value = useMotionValue(reduce || !enabled ? 1 : 0);
  const inView = useInView(target, { once: true, margin: '0px 0px -20% 0px' });
  useEffect(() => {
    if (reduce || !enabled) {
      value.set(1);
      return;
    }
    if (!inView) return;
    // A plain rAF loop keeps framer's imperative animation engine out of the entry chunk.
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      value.set(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, enabled, duration, value]);
  return value;
}
