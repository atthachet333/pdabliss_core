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

type Method = 'GET' | 'POST' | 'DELETE';

/**
 * Minimal JSON client. Credentials are included so the HttpOnly session
 * cookie (EP23) travels with every call; the browser adds the Origin header
 * the API checks on state-changing requests. Nothing here stores a token.
 */
export async function apiRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
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
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, NETWORK_ERROR, 'The service could not be reached.');
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    } | null;
    throw new ApiError(
      res.status,
      parsed?.error?.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR'),
      parsed?.error?.message ?? res.statusText,
      parsed?.error?.details,
    );
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
