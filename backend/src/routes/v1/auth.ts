import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { API_LOCALES } from '../../auth/locale.js';
import {
  clearCookie,
  cookieNames,
  cookieOptions,
  requestMeta,
  requireAuth,
  requireSession,
  setSessionCookie,
} from '../../auth/http.js';
import { FullName, JOB_FUNCTIONS, Phone, SignupContext } from '../../auth/profile.js';
import type { InvitationService } from '../../auth/invitations.js';
import { PASSWORD_MAX } from '../../auth/password.js';
import { AUTH_POLICY, AUTH_RATE_LIMITS, PLAN_INTENTS } from '../../auth/policy.js';
import type { AuthService } from '../../auth/service.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/auth — account and session endpoints (EP23). Contracts are in
 * docs/AUTHENTICATION.md. Bodies are strict: an unknown field (for example
 * `role` or `platformRole`) is a 400, never silently accepted.
 */

const email = z.string().trim().max(254).pipe(z.email());
// The policy (10–128) is checked by the service so the error says which rule.
const password = z
  .string()
  .min(1)
  .max(PASSWORD_MAX * 4);
const token = z.string().min(20).max(128);
const code = z.string().regex(/^\d{6}$/);
const challengeId = z.uuid();

const RegisterBody = z
  .object({
    email,
    password,
    // EP24.1: the person behind the account (profile only — never authorization).
    fullName: FullName,
    phone: Phone,
    jobFunction: z.enum(JOB_FUNCTIONS).optional(),
    // Sign-up business context — lead information, not the company record.
    business: SignupContext,
    locale: z.enum(API_LOCALES).optional(),
    plan: z.enum(PLAN_INTENTS).optional(),
    acceptTerms: z.literal(true),
  })
  .strict();
const EmailBody = z.object({ email }).strict();
const TokenBody = z.object({ token }).strict();
const LoginBody = z.object({ email, password }).strict();
const OtpBody = z.object({ challengeId, code, trustDevice: z.boolean().default(false) }).strict();
const StepUpBody = z.object({ challengeId, code }).strict();
const ChallengeBody = z.object({ challengeId }).strict();
const ResetBody = z.object({ token, password }).strict();
const SessionParams = z.object({ id: z.string().min(1).max(64) });

export interface AuthRouteDeps {
  env: Env;
  auth: AuthService;
  invitations: InvitationService;
}

export const authRoutes: FastifyPluginAsync<AuthRouteDeps> = async (
  app,
  { env, auth, invitations },
) => {
  const names = cookieNames(env);
  const limit = (key: keyof typeof AUTH_RATE_LIMITS) => ({
    config: { rateLimit: AUTH_RATE_LIMITS[key] },
    bodyLimit: 16 * 1024,
  });

  app.post('/register', limit('register'), async (request, reply) => {
    const body = parseInput(RegisterBody, request.body);
    await auth.register(body, requestMeta(request));
    return reply.status(202).send({ status: 'verification_sent' });
  });

  app.post('/verify-email', limit('verifyEmail'), async (request) => {
    const { token: value } = parseInput(TokenBody, request.body);
    return { status: await auth.verifyEmail(value, requestMeta(request)) };
  });

  app.post('/verification/resend', limit('resendVerification'), async (request, reply) => {
    const body = parseInput(EmailBody, request.body);
    await auth.resendVerification(body.email, requestMeta(request));
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/login', limit('login'), async (request, reply) => {
    const body = parseInput(LoginBody, request.body);
    const result = await auth.login(body, request.cookies[names.device], requestMeta(request));
    if (result.kind === 'otp') {
      void reply.setCookie(
        names.pendingLogin,
        result.bindingToken,
        cookieOptions(env, AUTH_POLICY.pendingLoginMs),
      );
      return {
        status: 'otp_required',
        challenge: result.challenge,
        trustDeviceAllowed: result.trustDeviceAllowed,
      };
    }
    setSessionCookie(reply, env, result.token, result.context.session.privileged);
    return { status: 'authenticated', identity: await auth.identity(result.context) };
  });

  app.post('/login/otp', limit('otpVerify'), async (request, reply) => {
    const body = parseInput(OtpBody, request.body);
    const { result, deviceToken } = await auth.completeLoginOtp(
      body,
      request.cookies[names.pendingLogin],
      requestMeta(request),
    );
    clearCookie(reply, env, names.pendingLogin);
    setSessionCookie(reply, env, result.token, result.context.session.privileged);
    if (deviceToken) {
      void reply.setCookie(
        names.device,
        deviceToken,
        cookieOptions(env, AUTH_POLICY.trustedDeviceMs),
      );
    }
    return { status: 'authenticated', identity: await auth.identity(result.context) };
  });

  app.post('/login/otp/resend', limit('otpResend'), async (request) => {
    const body = parseInput(ChallengeBody, request.body);
    const challenge = await auth.resendLoginOtp(
      body.challengeId,
      request.cookies[names.pendingLogin],
      requestMeta(request),
    );
    return { status: 'sent', challenge };
  });

  app.post('/password/forgot', limit('forgotPassword'), async (request, reply) => {
    const body = parseInput(EmailBody, request.body);
    await auth.forgotPassword(body.email, requestMeta(request));
    return reply.status(202).send({ status: 'accepted' });
  });

  app.post('/password/reset/check', limit('resetPassword'), async (request) => {
    const body = parseInput(TokenBody, request.body);
    await auth.checkResetToken(body.token);
    return { status: 'valid' };
  });

  app.post('/password/reset', limit('resetPassword'), async (request, reply) => {
    const body = parseInput(ResetBody, request.body);
    await auth.resetPassword(body.token, body.password, requestMeta(request));
    // This browser is signed out too.
    clearCookie(reply, env, names.session);
    clearCookie(reply, env, names.device);
    return { status: 'password_reset' };
  });

  // ---- authenticated ------------------------------------------------------

  app.get('/me', { preHandler: requireSession }, async (request, reply) => {
    const ctx = await auth.refreshIfDue(requireAuth(request));
    if (ctx.rotatedToken) setSessionCookie(reply, env, ctx.rotatedToken, ctx.session.privileged);
    return { identity: await auth.identity(ctx) };
  });

  app.post('/logout', { preHandler: requireSession }, async (request, reply) => {
    await auth.logout(requireAuth(request), requestMeta(request));
    clearCookie(reply, env, names.session);
    return { status: 'signed_out' };
  });

  app.post('/logout-all', { preHandler: requireSession }, async (request, reply) => {
    await auth.logoutAll(requireAuth(request), requestMeta(request));
    clearCookie(reply, env, names.session);
    clearCookie(reply, env, names.device);
    return { status: 'signed_out_everywhere' };
  });

  app.get('/sessions', { preHandler: requireSession }, async (request) => ({
    sessions: await auth.listSessions(requireAuth(request)),
  }));

  app.delete('/sessions/:id', { preHandler: requireSession }, async (request, reply) => {
    const ctx = requireAuth(request);
    const { id } = parseInput(SessionParams, request.params);
    await auth.revokeOwnSession(ctx, id, requestMeta(request));
    if (id === ctx.session.id) clearCookie(reply, env, names.session);
    return { status: 'revoked' };
  });

  app.post('/step-up', { preHandler: requireSession, ...limit('otpResend') }, async (request) => ({
    status: 'otp_required',
    challenge: await auth.startStepUp(requireAuth(request), requestMeta(request)),
  }));

  app.post(
    '/step-up/resend',
    { preHandler: requireSession, ...limit('otpResend') },
    async (request) => {
      const body = parseInput(ChallengeBody, request.body);
      return {
        status: 'sent',
        challenge: await auth.resendStepUp(
          requireAuth(request),
          body.challengeId,
          requestMeta(request),
        ),
      };
    },
  );

  app.post(
    '/step-up/verify',
    { preHandler: requireSession, ...limit('otpVerify') },
    async (request, reply) => {
      const body = parseInput(StepUpBody, request.body);
      const ctx = await auth.completeStepUp(
        requireAuth(request),
        body.challengeId,
        body.code,
        requestMeta(request),
      );
      if (ctx.rotatedToken) setSessionCookie(reply, env, ctx.rotatedToken, ctx.session.privileged);
      return { status: 'confirmed', identity: await auth.identity(ctx) };
    },
  );

  app.post(
    '/invitations/accept',
    { preHandler: requireSession, ...limit('invitationAccept') },
    async (request) => {
      const body = parseInput(TokenBody, request.body);
      return {
        status: 'accepted',
        ...(await invitations.accept(requireAuth(request), body.token, requestMeta(request))),
      };
    },
  );

  return Promise.resolve();
};
