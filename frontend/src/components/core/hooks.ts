import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

/*
 * Behaviour hooks shared by the internal design system (menus, drawers,
 * dialogs, the shell). Kept dependency-free so every overlay behaves the same.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Keeps the latest callback without re-subscribing effects on every render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Closes a popup on pointer-down outside `ref` or on Escape. */
export function useDismiss(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: (reason: 'outside' | 'escape') => void,
) {
  const latest = useLatest(onDismiss);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) latest.current('outside');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current('escape');
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, latest]);
}

/**
 * Modal focus management: moves focus into `container` on open, keeps Tab
 * inside it, and returns focus to whatever opened it on close.
 */
export function useFocusTrap(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = container.current;
    if (root) {
      const target = initialFocus?.current ?? focusableIn(root)[0] ?? root;
      target.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !container.current) return;
      const items = focusableIn(container.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open, container, initialFocus]);
}

let scrollLocks = 0;

/** Stops the page behind an overlay from scrolling. Nested overlays share one lock. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (scrollLocks++ === 0) root.style.overflow = 'hidden';
    return () => {
      if (--scrollLocks === 0) root.style.overflow = '';
    };
  }, [active]);
}

/** Subscribes to a CSS media query. Returns false where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.('change', notify);
      return () => mql.removeEventListener?.('change', notify);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Global keyboard shortcut (ignored while typing in a field, except with a modifier). */
export function useHotkey(match: (e: KeyboardEvent) => boolean, handler: () => void) {
  const latest = useLatest(handler);
  const matcher = useLatest(match);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matcher.current(e)) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (typing && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [latest, matcher]);
}
