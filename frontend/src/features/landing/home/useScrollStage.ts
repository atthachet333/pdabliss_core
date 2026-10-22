import { useMotionValueEvent, useScroll, type MotionValue } from 'framer-motion';
import { useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Scroll progress through a (pinned) chapter, plus a discrete stage derived
 * from it. Native scrolling only — this observes the scroll position and
 * never intercepts wheel or touch input.
 */
export function useScrollStage(
  target: RefObject<HTMLElement | null>,
  stages: number,
): { progress: MotionValue<number>; stage: number; reduce: boolean } {
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next = Math.min(stages - 1, Math.max(0, Math.floor(p * stages * 0.999 + 0.0001)));
    setStage((s) => (s === next ? s : next));
  });
  return { progress: scrollYProgress, stage, reduce };
}
