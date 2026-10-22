import { useSyncExternalStore } from 'react';

/*
 * Sidebar width preference. 'auto' = full sidebar from 1280px, icon rail on
 * tablet widths. Once the user toggles, their choice is remembered on this
 * device (a per-viewer convenience — never business state).
 */

export type NavPreference = 'auto' | 'expanded' | 'collapsed';

const KEY = 'pbc.app.nav';
const listeners = new Set<() => void>();

function read(): NavPreference {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'expanded' || v === 'collapsed' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let current: NavPreference | undefined;

export function setNavPreference(next: NavPreference) {
  current = next;
  try {
    if (next === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // Storage unavailable (private mode) — the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

export function useNavPreference(): NavPreference {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (current ??= read()),
    () => 'auto',
  );
}
