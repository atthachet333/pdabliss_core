import type { Transition, Variants } from 'framer-motion';

/**
 * Motion system — PDA BLISS CORE. Mirrors the CSS motion tokens in
 * styles/index.css. Every animation in the product draws from these values;
 * see docs/MOTION.md for the principles behind them.
 */

/** Calm, decelerating — the default for entrances and UI response. */
export const EASE_CORE = [0.22, 1, 0.36, 1] as const;
/** Symmetric, slow — for ambient loops (breathing, floating). */
export const EASE_CALM = [0.45, 0, 0.25, 1] as const;

export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  base: 0.4,
  reveal: 0.75,
  draw: 1.6,
  ambient: 7,
} as const;

/** Maximum pointer parallax travel in px — motion must stay restrained. */
export const PARALLAX_MAX_PX = 12;

export const STAGGER = 0.08;

export const revealTransition: Transition = { duration: DURATION.reveal, ease: EASE_CORE };

/** Section / block reveal on entering the viewport (runs once). */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

export const revealContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } },
};

/** Shared viewport config: animate once, slightly before fully in view. */
export const VIEWPORT_ONCE = { once: true, margin: '0px 0px -12% 0px' } as const;

/** Crossfade + slight slide for swapping previews/tabs. */
export const swap: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DURATION.base, ease: EASE_CORE },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: { duration: DURATION.fast, ease: EASE_CORE },
  },
};

/** Hover/press feedback for interactive surfaces. */
export const HOVER_LIFT = { y: -4, transition: { duration: DURATION.fast, ease: EASE_CORE } };
export const PRESS = { scale: 0.97 };
