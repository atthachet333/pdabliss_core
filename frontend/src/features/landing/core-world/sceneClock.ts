/**
 * Scene timing shared by every CORE World component.
 *  - `time`   real seconds since the scene mounted (drives the intro)
 *  - `motion` animated time; frozen under reduced motion, so loops stop
 */
export interface SceneClock {
  time: number;
  motion: number;
}

export function createClock(reduced: boolean): SceneClock {
  // Reduced motion skips the intro: everything is fully revealed from frame one.
  return { time: reduced ? 100 : 0, motion: 0 };
}

/** 0→1 eased reveal starting at `start` seconds, lasting `duration`. */
export function reveal(time: number, start: number, duration: number): number {
  const x = Math.min(1, Math.max(0, (time - start) / duration));
  return 1 - Math.pow(1 - x, 3);
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
