import { afterEach, describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, ok } from '@/test/fakeApi';
import {
  ApiError,
  apiRequest,
  AUTHORIZATION_CHANGED,
  NETWORK_ERROR,
  REQUEST_TIMEOUT_MS,
  setOwnerOverrideHandler,
  TIMEOUT,
} from './api';

/*
 * EP41 API client: a bounded wait (TIMEOUT), the caller's own abort, and an
 * unreachable service are three different outcomes — and nothing is ever
 * retried on its own. The only second send is the owner override, after the
 * owner explicitly confirmed it with a reason.
 */

afterEach(() => {
  setOwnerOverrideHandler(null);
  vi.useRealTimers();
});

/** A fetch that never answers until it is aborted. */
const hanging = () =>
  vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        );
      }),
  );

describe('API client timeouts (EP41)', () => {
  it('gives up after the time limit with TIMEOUT, and sends a write only once', async () => {
    vi.useFakeTimers();
    const fetchMock = hanging();
    vi.stubGlobal('fetch', fetchMock);
    const pending = apiRequest('POST', '/api/v1/sales/orders/x/confirm', {});
    const settled = expect(pending).rejects.toMatchObject({ status: 0, code: TIMEOUT });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    await settled;
    // Still once, even long after.
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the caller’s own abort an AbortError — not a timeout, not a network error', async () => {
    vi.stubGlobal('fetch', hanging());
    const controller = new AbortController();
    const pending = apiRequest('GET', '/api/v1/company/control', undefined, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });

  it('reports an unreachable service as NETWORK_ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(apiRequest('GET', '/api/v1/company/control')).rejects.toMatchObject({
      code: NETWORK_ERROR,
    });
  });

  it('never retries a failed write', async () => {
    const api = fakeApi({ 'POST /api/v1/purchase-orders/x/issue': fail(500, 'INTERNAL') });
    await expect(apiRequest('POST', '/api/v1/purchase-orders/x/issue')).rejects.toMatchObject({
      status: 500,
    });
    expect(api.calls).toHaveLength(1);
  });
});

describe('Owner override (EP41)', () => {
  const PATH = '/api/v1/sales/orders/so1/confirm';
  const REASON = 'The owner is the only approver';

  it('asks the owner and, only on confirmation, sends the same request once more with the reason', async () => {
    let n = 0;
    const api = fakeApi({
      [`POST ${PATH}`]: (body) =>
        ++n === 1
          ? fail(409, 'SELF_APPROVAL_NOT_ALLOWED', {
              decision: 'confirm',
              roles: ['creator'],
              overridable: true,
            })
          : ok({ order: { id: 'so1', status: 'CONFIRMED' }, body }),
    });
    const handler = vi.fn(() => Promise.resolve(REASON));
    setOwnerOverrideHandler(handler);
    const res = await apiRequest<{ body: unknown }>('POST', PATH, { note: 'x' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ decision: 'confirm' }));
    expect(api.calls.map((c) => c.body)).toEqual([
      { note: 'x' },
      { note: 'x', ownerOverride: { reason: REASON } },
    ]);
    expect(res.body).toEqual({ note: 'x', ownerOverride: { reason: REASON } });
  });

  it('leaves the document as it was when the owner cancels', async () => {
    const api = fakeApi({
      [`POST ${PATH}`]: fail(409, 'SELF_APPROVAL_NOT_ALLOWED', { overridable: true }),
    });
    setOwnerOverrideHandler(() => Promise.resolve(null));
    await expect(apiRequest('POST', PATH)).rejects.toMatchObject({
      status: 409,
      code: 'SELF_APPROVAL_NOT_ALLOWED',
    });
    expect(api.calls).toHaveLength(1);
  });

  it('never offers an override to someone who has none, and never loops', async () => {
    const api = fakeApi({
      [`POST ${PATH}`]: fail(409, 'SELF_APPROVAL_NOT_ALLOWED', { overridable: false }),
      'POST /api/v1/sales/orders/so2/confirm': fail(409, 'SELF_APPROVAL_NOT_ALLOWED', {
        overridable: true,
      }),
    });
    const handler = vi.fn(() => Promise.resolve(REASON));
    setOwnerOverrideHandler(handler);
    await expect(apiRequest('POST', PATH)).rejects.toMatchObject({
      code: 'SELF_APPROVAL_NOT_ALLOWED',
    });
    expect(handler).not.toHaveBeenCalled();
    // Refused again even with the override: the error is shown, the owner is not asked again.
    await expect(apiRequest('POST', '/api/v1/sales/orders/so2/confirm')).rejects.toMatchObject({
      code: 'SELF_APPROVAL_NOT_ALLOWED',
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(api.calls).toHaveLength(3);
  });
});

describe('EP45 stale authorization signal', () => {
  it('announces a 403 that means the permission set changed — never a branch refusal or another status', async () => {
    const seen: unknown[] = [];
    const listen = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(AUTHORIZATION_CHANGED, listen);
    try {
      fakeApi({
        'GET /api/v1/sales/orders': fail(403, 'PERMISSION_DENIED'),
        'GET /api/v1/warehouse/stock': fail(403, 'DEPARTMENT_NOT_ALLOWED'),
        'POST /api/v1/company/context/branch': fail(403, 'BRANCH_NOT_ALLOWED'),
        'GET /api/v1/sales/orders/x': fail(404, 'SO_NOT_FOUND'),
        'GET /api/v1/sales/context': ok({}),
      });
      for (const [m, url] of [
        ['GET', '/api/v1/sales/orders'],
        ['GET', '/api/v1/warehouse/stock'],
        ['POST', '/api/v1/company/context/branch'],
        ['GET', '/api/v1/sales/orders/x'],
      ] as const)
        await expect(apiRequest(m, url, m === 'POST' ? {} : undefined)).rejects.toBeInstanceOf(
          ApiError,
        );
      await apiRequest('GET', '/api/v1/sales/context');
      expect(seen).toEqual(['PERMISSION_DENIED', 'DEPARTMENT_NOT_ALLOWED']);
    } finally {
      window.removeEventListener(AUTHORIZATION_CHANGED, listen);
    }
  });
});
