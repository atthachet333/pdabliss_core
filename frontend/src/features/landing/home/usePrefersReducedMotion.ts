import { useMediaQuery } from '@/components/core/hooks';

/**
 * Live `prefers-reduced-motion` preference. Chapters use it to choose their
 * finished, static state (no autoplay, no scroll-driven transforms).
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
