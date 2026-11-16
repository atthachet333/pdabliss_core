import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, AUTHORIZATION_CHANGED } from '@/lib/api';

/*
 * Freshness rules shared by the EP47 department dashboards and the EP48
 * Executive Command Center (docs/EP47_METRIC_DEFINITIONS.md §1, EP48 requirements §Refresh):
 *
 *  - loaded on open; refreshed every 2 minutes while the tab is VISIBLE (never while hidden),
 *    on returning to the tab after 30 s, and on the Refresh button;
 *  - one request at a time: a new load aborts the previous one (no duplicate requests);
 *  - when another CORE request is refused (AUTHORIZATION_CHANGED), the data on screen is
 *    re-checked once — but never while this resource's own request is out (its own 403
 *    raises the same event: no refresh loop);
 *  - a refusal (401 / 403 / 404 …) REPLACES the data — numbers the person may no longer see
 *    never stay on screen; a network failure keeps the last result, marked stale;
 *  - `accept` rejects an answer for another scope (e.g. another branch) — it is never shown;
 *  - callers key the component by scope (branch, filter), so a scope change starts empty.
 */

export const REFRESH_EVERY_MS = 120_000;
export const REFRESH_ON_RETURN_AFTER_MS = 30_000;

export type LiveState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; stale: boolean; busy: boolean }
  | { status: 'error'; error: unknown };

const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500;

export function useLiveResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  /** Return false for an answer that belongs to another scope (it is discarded). */
  accept: (data: T) => boolean = () => true,
) {
  const [state, setState] = useState<LiveState<T>>({ status: 'loading' });
  const last = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const shown = useRef(false);
  const fetchRef = useRef(fetcher);
  const acceptRef = useRef(accept);
  useEffect(() => {
    fetchRef.current = fetcher;
    acceptRef.current = accept;
  });

  const load = useCallback(async () => {
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    pending.current = true;
    setState((s) => (s.status === 'ready' ? { ...s, busy: true } : s));
    try {
      const data = await fetchRef.current(ctl.signal);
      if (ctl.signal.aborted) return;
      last.current = Date.now();
      if (!acceptRef.current(data)) {
        // The session's scope changed elsewhere: never show another scope's numbers here.
        shown.current = false;
        setState({ status: 'error', error: new ApiError(409, 'BRANCH_CHANGED', 'branch') });
        window.dispatchEvent(new CustomEvent(AUTHORIZATION_CHANGED, { detail: 'BRANCH' }));
        return;
      }
      shown.current = true;
      setState({ status: 'ready', data, stale: false, busy: false });
    } catch (error) {
      if (ctl.signal.aborted || (error instanceof DOMException && error.name === 'AbortError'))
        return;
      if (refused(error)) shown.current = false;
      setState((s) =>
        s.status === 'ready' && !refused(error)
          ? { ...s, stale: true, busy: false }
          : { status: 'error', error },
      );
    } finally {
      if (inflight.current === ctl) pending.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const visible = () => document.visibilityState === 'visible';
    const timer = window.setInterval(() => {
      if (visible()) void load();
    }, REFRESH_EVERY_MS);
    const onVisible = () => {
      if (visible() && Date.now() - last.current > REFRESH_ON_RETURN_AFTER_MS) void load();
    };
    const onAuthorization = (e: Event) => {
      if ((e as CustomEvent).detail !== 'BRANCH' && !pending.current && shown.current) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(AUTHORIZATION_CHANGED, onAuthorization);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(AUTHORIZATION_CHANGED, onAuthorization);
      inflight.current?.abort();
    };
  }, [load]);

  return { state, load };
}
