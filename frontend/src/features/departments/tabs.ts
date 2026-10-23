import type { KeyboardEvent, RefObject } from 'react';

/**
 * Arrow / Home / End handling for the tablists in the department pages
 * (selector, order stages, drill-down …). Moves selection and focus together.
 */
export function tabKeys(
  count: number,
  active: number,
  select: (i: number) => void,
  refs: RefObject<(HTMLElement | null)[]>,
) {
  return (e: KeyboardEvent) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (active + 1) % count
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (active - 1 + count) % count
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? count - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };
}
