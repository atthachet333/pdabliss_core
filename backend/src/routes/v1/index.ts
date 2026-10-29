import type { FastifyPluginAsync } from 'fastify';
import { demoBypassEnabled } from '../../auth/demo-bypass.js';
import { authUnavailable } from '../../auth/errors.js';
import type { InvitationService } from '../../auth/invitations.js';
import type { PlatformService } from '../../auth/platform.js';
import type { AuthService } from '../../auth/service.js';
import { ANNUAL_TERMS, DEPARTMENT_CODES, PLAN_CATALOG, PLAN_CODES } from '../../billing/catalog.js';
import type { CompanyControlService } from '../../company/control.js';
import type { CompanyService } from '../../company/service.js';
import type { Db } from '../../db/client.js';
import type { Env } from '../../config/env.js';
import { DEMO_PERSONAS } from '../../demo/personas.js';
import { API_VERSION, SERVICE_NAME } from '../../meta.js';
import { accountRoutes } from './account.js';
import { authRoutes } from './auth.js';
import { companyRoutes } from './company.js';
import { demoRoutes } from './demo.js';
import { masterDataRoutes } from './master-data.js';
import { operationsRoutes } from './operations.js';
import { platformRoutes } from './platform.js';

export interface AccountServices {
  auth: AuthService;
  platform: PlatformService;
  invitations: InvitationService;
  companies: CompanyService;
  control: CompanyControlService;
  db: Db;
}

export const v1Routes: FastifyPluginAsync<{
  env: Env;
  enableDemoRoutes: boolean;
  services: AccountServices | null;
}> = async (app, opts) => {
  app.get('/', () => ({
    service: SERVICE_NAME,
    apiVersion: API_VERSION,
    demoRoutes: opts.enableDemoRoutes,
    accounts: opts.services !== null,
  }));

  // EP24: the package catalog (public facts; enforcement reads the same source).
  app.get('/packages', () => ({
    packages: PLAN_CODES.map((code) => PLAN_CATALOG[code]),
    departments: DEPARTMENT_CODES,
    annualTerms: ANNUAL_TERMS,
  }));

  if (opts.enableDemoRoutes) {
    await app.register(demoRoutes, { prefix: '/demo' });
  }

  // EP28.1: the demo personas for the development-only list on the sign-in
  // page — addresses and labels, never a password. Exists only where the
  // demo sign-in bypass does (never production, demo routes on, accounts on).
  if (opts.services && demoBypassEnabled(opts.env)) {
    app.get('/demo/personas', () => ({
      personas: DEMO_PERSONAS.map((p) => ({
        key: p.key,
        label: p.label,
        email: p.email,
        role: p.role,
        jobTitle: p.jobTitle,
      })),
    }));
  }

  const { services } = opts;
  if (services) {
    await app.register(authRoutes, { prefix: '/auth', env: opts.env, ...services });
    await app.register(platformRoutes, {
      prefix: '/platform',
      platform: services.platform,
      companies: services.companies,
    });
    await app.register(companyRoutes, {
      prefix: '/company',
      db: services.db,
      invitations: services.invitations,
      companies: services.companies,
      control: services.control,
    });
    await app.register(operationsRoutes, { prefix: '/operations', db: services.db });
    // EP28: operational master data (customers, suppliers, items, units, categories, locations).
    await app.register(masterDataRoutes, { prefix: '/master-data', db: services.db });
    await app.register(accountRoutes, { prefix: '/account', companies: services.companies });
  } else {
    // No DATABASE_URL (development only — production refuses to start without it).
    for (const prefix of [
      '/auth',
      '/platform',
      '/company',
      '/account',
      '/operations',
      '/master-data',
    ]) {
      app.all(`${prefix}/*`, () => {
        throw authUnavailable();
      });
    }
  }
};
