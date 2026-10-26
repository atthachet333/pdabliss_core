import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { cookieNames, originCheck } from './auth/http.js';
import { InvitationService } from './auth/invitations.js';
import { PlatformService } from './auth/platform.js';
import { AuthService } from './auth/service.js';
import { CompanyService } from './company/service.js';
import { resolveSession } from './auth/sessions.js';
import type { Env } from './config/env.js';
import { createDb, type Db } from './db/client.js';
import { createMailer, type Mailer } from './mail/mailer.js';
import { registerErrorHandling } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { v1Routes, type AccountServices } from './routes/v1/index.js';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  return {
    level: env.LOG_LEVEL,
    // Request bodies are never logged; cookies and auth headers are redacted.
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    ...(env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

/** Test seams: an isolated database, an in-memory mailer, a captured log stream. */
export interface AppOverrides {
  db?: Db;
  mailer?: Mailer;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp(env: Env, overrides: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: overrides.logger ?? loggerOptions(env),
    requestIdHeader: false,
    // Accept a well-formed upstream request id (e.g. from a proxy); otherwise mint one.
    genReqId: (req) => {
      const incoming = req.headers[REQUEST_ID_HEADER];
      return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
        ? incoming
        : randomUUID();
    },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });

  // JSON only: a text/plain body is a "simple" cross-origin request that skips
  // the CORS preflight, so it is not accepted at all (EP23 CSRF defence).
  app.removeContentTypeParser('text/plain');

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  await app.register(helmet, {
    // JSON API: nothing should ever be rendered or framed from these responses.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  await app.register(cookie);

  registerErrorHandling(app);

  const ownsDb = !overrides.db && !!env.DATABASE_URL;
  const db = overrides.db ?? (env.DATABASE_URL ? createDb(env.DATABASE_URL) : null);
  let services: AccountServices | null = null;
  if (db) {
    const mailer = overrides.mailer ?? createMailer(env);
    services = {
      auth: new AuthService({ db, env, mailer, log: app.log }),
      platform: new PlatformService(db),
      invitations: new InvitationService(db, env, mailer),
      // The manual activation exists only outside production (EP24).
      companies: new CompanyService(db, env.NODE_ENV !== 'production'),
    };
    if (mailer.kind === 'dev') {
      app.log.warn(
        `Mail goes to the local development sink (${env.DEV_MAIL_DIR}); nothing is delivered.`,
      );
    }

    const sessionCookie = cookieNames(env).session;
    const checkOrigin = originCheck(env);
    app.decorateRequest('auth', null);
    // Cross-site check first, then the session (looked up for API calls only).
    app.addHook('onRequest', async (request) => {
      if (!request.url.startsWith('/api/')) return;
      checkOrigin(request);
      const token = request.cookies[sessionCookie];
      request.auth = token ? await resolveSession(db, token) : null;
    });
    if (ownsDb) app.addHook('onClose', async () => db.$disconnect());
  } else {
    app.decorateRequest('auth', null);
  }

  await app.register(healthRoutes, { environment: env.NODE_ENV });
  await app.register(v1Routes, {
    prefix: '/api/v1',
    env,
    enableDemoRoutes: env.ENABLE_DEMO_ROUTES,
    services,
  });

  return app;
}
