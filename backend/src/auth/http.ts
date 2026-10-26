import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Env } from '../config/env.js';
import type { RequestMeta } from './audit.js';
import { csrfRejected, forbidden, stepUpRequired, unauthenticated } from './errors.js';
import { AUTH_POLICY } from './policy.js';
import { truncateUserAgent, type AuthContext } from './sessions.js';

/*
 * HTTP side of authentication (EP23): cookies, the cross-site request check
 * and the guards routes use. Guards read only the server-side session — a
 * role sent by the client is never trusted.
 */

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export interface CookieNames {
  session: string;
  device: string;
  pendingLogin: string;
}

/** `__Host-` cookies (Secure, Path=/, no Domain) in production; plain names on http://localhost. */
export function cookieNames(env: Env): CookieNames {
  const prefix = env.NODE_ENV === 'production' ? '__Host-' : '';
  return {
    session: `${prefix}core_sid`,
    device: `${prefix}core_device`,
    pendingLogin: `${prefix}core_pending`,
  };
}

export function cookieOptions(env: Env, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export function setSessionCookie(
  reply: FastifyReply,
  env: Env,
  token: string,
  privileged: boolean,
) {
  const P = AUTH_POLICY.session;
  void reply.setCookie(
    cookieNames(env).session,
    token,
    cookieOptions(env, privileged ? P.privilegedAbsoluteMs : P.customerAbsoluteMs),
  );
}

export function clearCookie(reply: FastifyReply, env: Env, name: string) {
  void reply.clearCookie(name, { ...cookieOptions(env, 0), maxAge: undefined });
}

export function requestMeta(request: FastifyRequest): RequestMeta {
  const ua = request.headers['user-agent'];
  return {
    ip: request.ip || null,
    userAgent: truncateUserAgent(typeof ua === 'string' ? ua : null),
    requestId: request.id,
  };
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Cross-site request forgery defence for cookie-authenticated calls:
 * 1. cookies are SameSite=Lax (no cross-site POST carries them);
 * 2. every state-changing /api request that carries an Origin header must
 *    come from an allow-listed origin, and a request that carries one of our
 *    cookies must carry an allow-listed Origin;
 * 3. bodies must be JSON (the text/plain parser is removed in app.ts), so a
 *    cross-origin call always needs a CORS preflight, which only allow-listed
 *    origins pass.
 */
export function originCheck(env: Env): (request: FastifyRequest) => void {
  const names = cookieNames(env);
  return (request) => {
    if (!UNSAFE.has(request.method) || !request.url.startsWith('/api/')) return;
    const origin = request.headers.origin;
    const cookies = request.cookies ?? {};
    const hasAuthCookie = [names.session, names.device, names.pendingLogin].some(
      (n) => cookies[n] !== undefined,
    );
    if (origin === undefined) {
      if (hasAuthCookie) throw csrfRejected();
      return;
    }
    if (!env.CORS_ORIGINS.includes(origin)) throw csrfRejected();
  };
}

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthenticated();
  return request.auth;
}

export const requireSession: preHandlerAsyncHookHandler = async (request) => {
  requireAuth(request);
  return Promise.resolve();
};

/** Platform Control Center: PLATFORM_OWNER or PLATFORM_ADMIN. */
export const requirePlatform: preHandlerAsyncHookHandler = async (request) => {
  const ctx = requireAuth(request);
  if (!ctx.user.platformRole) throw forbidden();
  return Promise.resolve();
};

/** Owner-only platform actions. */
export const requireOwner: preHandlerAsyncHookHandler = async (request) => {
  const ctx = requireAuth(request);
  if (ctx.user.platformRole?.role !== 'PLATFORM_OWNER') throw forbidden();
  return Promise.resolve();
};

/** Sensitive actions need a one-time code checked within the last few minutes. */
export const requireRecentStepUp: preHandlerAsyncHookHandler = async (request) => {
  const ctx = requireAuth(request);
  const at = ctx.session.stepUpAt?.getTime() ?? 0;
  if (Date.now() - at > AUTH_POLICY.stepUpFreshMs) throw stepUpRequired();
  return Promise.resolve();
};
