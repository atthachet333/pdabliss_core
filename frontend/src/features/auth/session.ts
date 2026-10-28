import { useEffect, useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api';
import { authApi, planIntent, type Identity } from './api';

/*
 * Client view of "who is signed in" (EP23). Only the safe identity the API
 * returns from GET /auth/me is kept, in memory — never a token, a password or
 * a code, and nothing in localStorage. It is a convenience for rendering:
 * every protected call is authorized by the server from its own session.
 */

export type IdentityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'ready'; identity: Identity }
  | { status: 'error'; error: ApiError };

let state: IdentityState = { status: 'idle' };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: IdentityState) {
  state = next;
  listeners.forEach((l) => l());
}

export function getIdentityState(): IdentityState {
  return state;
}

/** Asks the server who is signed in (deduplicated). */
export function refreshIdentity(): Promise<void> {
  inflight ??= (async () => {
    if (state.status !== 'ready') set({ status: 'loading' });
    try {
      const { identity } = await authApi.me();
      set({ status: 'ready', identity });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ status: 'anonymous' });
      else
        set({
          status: 'error',
          error: e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', String(e)),
        });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function setIdentity(identity: Identity) {
  set({ status: 'ready', identity });
}

export function clearIdentity() {
  set({ status: 'anonymous' });
}

/** Test seam: forget everything between test cases. */
export function resetIdentityForTests() {
  state = { status: 'idle' };
  inflight = null;
}

/** The identity state; loads it once when first needed. */
export function useIdentity(): IdentityState {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getIdentityState,
    getIdentityState,
  );
  useEffect(() => {
    if (getIdentityState().status === 'idle') void refreshIdentity();
  }, []);
  return current;
}

/** The signed-in areas (EP23 account / platform; EP25 company / core). */
export type SignedInAreaId = 'account' | 'platform' | 'company' | 'core';

/**
 * The areas an identity may open, its home first (EP25):
 * - platform operators: the Platform Control Center only;
 * - an active member of an active company: the Company Control Center, CORE
 *   Operations and their Account Portal (profile, devices);
 * - everyone else (no company yet, pending activation, deactivated): the
 *   Account Portal, which shows where they stand.
 * Rendering only — the API checks the same facts on every request.
 */
export function areasFor(identity: Identity): SignedInAreaId[] {
  if (identity.platformRole) return ['platform'];
  if (identity.company?.canEnterCore) return ['company', 'core', 'account'];
  return ['account'];
}

/** Where a signed-in identity belongs by default. */
export function homeFor(identity: Identity): `/${SignedInAreaId}` {
  return `/${areasFor(identity)[0]!}`;
}

/**
 * Only same-app destinations are accepted after sign-in — never another
 * origin, a protocol-relative URL or a path with odd characters.
 */
export function safeNext(next: string | null): string | null {
  if (!next) return null;
  return /^\/(account|platform|company|core|app)(\/[a-z0-9-]+){0,3}$/.test(next) ? next : null;
}

/**
 * EP24: a package picked on the public site (`/login?plan=business`) is carried
 * to the customer's Account Portal, where the package step preselects it. Only
 * a known plan id, and only onto /account — never into another path or query.
 */
export function withPlan(destination: string, plan: string | null): string {
  const id = planIntent(plan);
  return id && destination === '/account' ? `/account?plan=${id}` : destination;
}

/** The post-sign-in destination: a safe `next` the identity may use, else its home. */
export function destinationFor(identity: Identity, next: string | null): string {
  const safe = safeNext(next);
  if (!safe) return homeFor(identity);
  const area = safe.split('/')[1] as SignedInAreaId | 'app';
  if (area !== 'app' && !areasFor(identity).includes(area)) return homeFor(identity);
  return safe;
}
