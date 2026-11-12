import { API_URL } from '@/config/site';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never reached the API (offline, server down, blocked). */
export const NETWORK_ERROR = 'NETWORK_ERROR';
/** EP41: the API did not answer in time. For a write, the outcome is unknown — never retried. */
export const TIMEOUT = 'TIMEOUT';
/** EP41: the bounded wait for any API answer. */
export const REQUEST_TIMEOUT_MS = 30_000;

type Method = 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';

/**
 * EP41 owner override of independent approval. The CORE shell registers a
 * handler that asks the owner — explicitly, with a reason — whether to decide
 * anyway. Only then is the SAME request sent once more, carrying
 * `ownerOverride` (the refused attempt wrote nothing). Never automatic.
 */
/** EP45: fired when a 403 says the tab's permission set is stale (see apiRequest). */
export const AUTHORIZATION_CHANGED = 'core:authorization-changed';
/** Refusals of WHAT the person may do (branch refusals have their own screens). */
const STALE_AUTHORIZATION = new Set([
  'PERMISSION_DENIED',
  'DEPARTMENT_NOT_ALLOWED',
  'MEMBERSHIP_INACTIVE',
  'FORBIDDEN',
]);

type OverrideHandler = (details: Record<string, unknown>) => Promise<string | null>;
let overrideHandler: OverrideHandler | null = null;
export function setOwnerOverrideHandler(handler: OverrideHandler | null) {
  overrideHandler = handler;
}

/**
 * Minimal JSON client. Credentials are included so the HttpOnly session
 * cookie (EP23) travels with every call; the browser adds the Origin header
 * the API checks on state-changing requests. Nothing here stores a token.
 * There is no automatic retry: a consequential request is sent once.
 */
export async function apiRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  // The caller's own abort stays an AbortError; our time limit becomes TIMEOUT.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) throw new ApiError(0, TIMEOUT, 'The service took too long to answer.');
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, NETWORK_ERROR, 'The service could not be reached.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    } | null;
    const code = parsed?.error?.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR');
    const details = parsed?.error?.details;
    if (
      code === 'SELF_APPROVAL_NOT_ALLOWED' &&
      details?.overridable === true &&
      method === 'POST' &&
      overrideHandler &&
      !(body && typeof body === 'object' && 'ownerOverride' in body)
    ) {
      const reason = await overrideHandler(details);
      if (reason) {
        return apiRequest<T>(
          method,
          path,
          { ...(body && typeof body === 'object' ? body : {}), ownerOverride: { reason } },
          signal,
        );
      }
    }
    // EP45: an authorization refusal means what this tab believes it may do is stale
    // (department reassigned, permission or membership removed). The CORE shell
    // listens and re-reads its context; the server stays the only authority.
    if (res.status === 403 && STALE_AUTHORIZATION.has(code) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTHORIZATION_CHANGED, { detail: code }));
    }
    throw new ApiError(res.status, code, parsed?.error?.message ?? res.statusText, details);
  }
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>('GET', path, undefined, signal);
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
}
