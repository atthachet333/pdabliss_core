import { useSyncExternalStore } from 'react';
import { WORKSPACE_ORDER, type WorkspaceId } from '@/workspaces/registry';
import {
  DEMO_ACCOUNT,
  PROTOTYPE_ENABLED,
  PROTOTYPE_LAST_WORKSPACE_KEY,
  PROTOTYPE_SESSION_KEY,
} from './config';

/*
 * Prototype-only session flag (see ./config.ts). Stored in sessionStorage so it
 * ends when the tab closes. Storage access is guarded: private modes may throw.
 */

export interface PrototypeSession {
  username: string;
}

const listeners = new Set<() => void>();
let cached: PrototypeSession | null | undefined;

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the prototype session simply won't persist.
  }
}

function load(): PrototypeSession | null {
  if (!PROTOTYPE_ENABLED) return null;
  const username = read(PROTOTYPE_SESSION_KEY);
  return username ? { username } : null;
}

function emit() {
  cached = load();
  listeners.forEach((l) => l());
}

export function getPrototypeSession(): PrototypeSession | null {
  if (cached === undefined) cached = load();
  return cached;
}

/** Checks the demo-only reviewer account. Returns false for anything else. */
export function prototypeSignIn(username: string, password: string): boolean {
  if (!PROTOTYPE_ENABLED) return false;
  const ok = username.trim() === DEMO_ACCOUNT.username && password === DEMO_ACCOUNT.password;
  if (ok) {
    write(PROTOTYPE_SESSION_KEY, DEMO_ACCOUNT.username);
    emit();
  }
  return ok;
}

export function prototypeSignOut() {
  write(PROTOTYPE_SESSION_KEY, null);
  emit();
}

export function usePrototypeSession(): PrototypeSession | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPrototypeSession,
    () => null,
  );
}

/** The workspace the reviewer last opened, so sign-in returns them there. */
export function rememberWorkspace(id: WorkspaceId) {
  write(PROTOTYPE_LAST_WORKSPACE_KEY, id);
}

export function lastWorkspace(): WorkspaceId {
  const stored = read(PROTOTYPE_LAST_WORKSPACE_KEY);
  return (WORKSPACE_ORDER as readonly string[]).includes(stored ?? '')
    ? (stored as WorkspaceId)
    : 'executive';
}
