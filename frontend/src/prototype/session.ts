import { WORKSPACE_ORDER, type WorkspaceId } from '@/workspaces/registry';
import { PROTOTYPE_LAST_WORKSPACE_KEY } from './config';

/*
 * Prototype review convenience: which workspace the reviewer last opened.
 * (Who is signed in comes from the real session — src/features/auth/session.ts.)
 * Storage access is guarded: private modes may throw.
 */

/** The workspace the reviewer last opened, so /app returns them there. */
export function rememberWorkspace(id: WorkspaceId) {
  try {
    window.sessionStorage.setItem(PROTOTYPE_LAST_WORKSPACE_KEY, id);
  } catch {
    // Storage unavailable — the preference simply won't persist.
  }
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(PROTOTYPE_LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

export function lastWorkspace(): WorkspaceId {
  const stored = readStored();
  return (WORKSPACE_ORDER as readonly string[]).includes(stored ?? '')
    ? (stored as WorkspaceId)
    : 'executive';
}
