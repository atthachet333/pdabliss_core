import { existsSync } from 'node:fs';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Development/test-only HMAC key. Production refuses to start without its own
 * AUTH_SECRET (see the refinement below).
 */
export const DEV_AUTH_SECRET = 'core-development-only-auth-secret-do-not-use-in-production';

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('localhost'),
    PORT: z.coerce.number().int().min(1).max(65535).default(1112),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:1111')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),
    ENABLE_DEMO_ROUTES: z.stringbool().optional(),
    /** PostgreSQL. Without it (development only) the auth API answers 503. */
    DATABASE_URL: z.url().optional(),

    // --- EP23: accounts and authentication -----------------------------------
    /** Public web app origin — every link in an email is built from it. */
    PUBLIC_APP_URL: z.url().optional(),
    /** HMAC key for one-time codes and throttling keys (≥ 32 characters). */
    AUTH_SECRET: z.string().min(32).optional(),
    MAIL_FROM: z.string().min(3).default('PDA BLISS CORE <notify@pdabliss.com>'),
    /** smtp = real delivery; dev = local mail sink (files in DEV_MAIL_DIR). */
    MAIL_TRANSPORT: z.enum(['smtp', 'dev']).optional(),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    /** true = implicit TLS (port 465); false = STARTTLS required. */
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    DEV_MAIL_DIR: z.string().min(1).default('.mail'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const require = (key: keyof typeof env, why: string) => {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: `required in production (${why})` });
    };
    require('DATABASE_URL', 'accounts are stored in PostgreSQL');
    require('PUBLIC_APP_URL', 'email links');
    require('AUTH_SECRET', 'one-time code hashing');
    require('SMTP_HOST', 'email delivery');
    if (env.MAIL_TRANSPORT === 'dev') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_TRANSPORT'],
        message: 'the development mail sink cannot be used in production',
      });
    }
    if (env.AUTH_SECRET === DEV_AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'must not be the development value',
      });
    }
  })
  .transform((env) => ({
    ...env,
    // Demo routes serve mock data only; they default off in production.
    ENABLE_DEMO_ROUTES: env.ENABLE_DEMO_ROUTES ?? env.NODE_ENV !== 'production',
    PUBLIC_APP_URL: (env.PUBLIC_APP_URL ?? 'http://localhost:1111').replace(/\/+$/, ''),
    AUTH_SECRET: env.AUTH_SECRET ?? DEV_AUTH_SECRET,
    MAIL_TRANSPORT: env.MAIL_TRANSPORT ?? (env.SMTP_HOST ? 'smtp' : 'dev'),
  }));

export type Env = z.infer<typeof EnvSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  // `KEY=` in a copied .env.example means "not set", not "set to empty".
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = EnvSchema.safeParse(present);
  if (!result.success) {
    // Messages name the variable and the rule — never the value.
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

/** Loads `.env` (if present) into process.env, then validates. */
export function loadEnv(): Env {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  return parseEnv(process.env);
}
