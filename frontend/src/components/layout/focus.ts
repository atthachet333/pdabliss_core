const focusMain = () => document.getElementById('main')?.focus({ preventScroll: true });

/**
 * After a control that had focus disappears (a dismissed banner, a closed
 * dialog whose opener is gone), keep keyboard users in the page: focus moves
 * to the main landmark instead of falling back to <body>.
 *
 * `leaving` is the element about to disappear: if focus is inside it, focus
 * moves now. A later check covers exit animations and focus-restore hooks
 * whose target no longer exists.
 */
export function keepFocusInPage(leaving?: Element | null) {
  if (leaving?.contains(document.activeElement)) focusMain();
  window.setTimeout(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !document.contains(active)) focusMain();
  }, 500);
}
