import type { FastifyPluginAsync } from 'fastify';
import { requestMeta, requireAuth, requireSession } from '../../auth/http.js';
import type { InvitationService } from '../../auth/invitations.js';
import { AUTH_RATE_LIMITS } from '../../auth/policy.js';
import { branchContext, selectBranch } from '../../company/context.js';
import type { CompanyControlService } from '../../company/control.js';
import {
  ActivityQuery,
  BranchContextBody,
  BranchCreateBody,
  BranchUpdateBody,
  CreateCompanyBody,
  DepartmentsBody,
  IdParams,
  InvitationBody,
  InvitationListQuery,
  LogoBody,
  MemberBranchesBody,
  MemberDepartmentsBody,
  MemberListQuery,
  MemberUpdateBody,
  ProfileBody,
  SettingsBody,
} from '../../company/input.js';
import type { CompanyService } from '../../company/service.js';
import type { Db } from '../../db/client.js';
import { parseInput } from '../../lib/validation.js';

/*
 * /api/v1/company — the signed-in customer's own company.
 *
 * EP23: invitations. EP24: onboarding and the current-company context.
 * EP25: the Company Control Center (profile, logo, branches, people,
 * departments, settings, activity) and the branch context. EP26: branch
 * detail, branch access, the people list with search / filters / pages, one
 * member's detail, and the invitation lifecycle (list, resend).
 *
 * There is no endpoint that takes a company id: the company is resolved from
 * the caller's membership, and every id in a path (branch, member, invitation,
 * subscription) is looked up inside that company only. Role rules live in
 * src/company/policy.ts and are checked by the services, never by the UI.
 */

export const companyRoutes: FastifyPluginAsync<{
  db: Db;
  invitations: InvitationService;
  companies: CompanyService;
  control: CompanyControlService;
}> = async (app, { db, invitations, companies, control }) => {
  app.addHook('preHandler', requireSession);
  const auth = requireAuth;
  const meta = requestMeta;

  // ---- onboarding (EP24) ----------------------------------------------------
  app.post(
    '/onboarding',
    { bodyLimit: 32 * 1024, config: { rateLimit: AUTH_RATE_LIMITS.companyCreate } },
    async (request, reply) => {
      const body = parseInput(CreateCompanyBody, request.body);
      const created = await companies.createCompany(auth(request), body, meta(request));
      return reply.status(201).send(created);
    },
  );

  // ---- current company (EP24 reads) ----------------------------------------
  app.get('/current', async (request) => companies.current(auth(request)));
  app.get('/current/branches', async (request) => control.branches(auth(request)));
  app.get('/current/branches/:id', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return { branch: await companies.branch(auth(request), id) };
  });
  app.get('/current/subscription', async (request) => companies.subscription(auth(request)));
  app.get('/current/subscriptions/:id', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return companies.subscription(auth(request), id);
  });
  app.get('/current/departments', async (request) => companies.departments(auth(request)));

  // ---- Company Control Center (EP25) ---------------------------------------
  app.get('/control', async (request) => control.overview(auth(request)));

  app.patch('/current/profile', { bodyLimit: 16 * 1024 }, async (request) =>
    control.updateProfile(auth(request), parseInput(ProfileBody, request.body), meta(request)),
  );

  // Logo: JSON base64 (≤ 256 KB decoded), raster only, served back with its own type.
  app.get('/current/logo', async (request, reply) => {
    const logo = await control.logo(auth(request));
    const etag = `"${logo.sha256}"`;
    void reply
      .header('cache-control', 'private, max-age=300')
      .header('etag', etag)
      // The app (another port / subdomain of the same site) shows it in an <img>.
      .header('cross-origin-resource-policy', 'same-site')
      .header('content-disposition', 'inline; filename="logo"');
    if (request.headers['if-none-match'] === etag) return reply.status(304).send();
    return reply.type(logo.contentType).send(Buffer.from(logo.data));
  });
  app.put(
    '/current/logo',
    { bodyLimit: 400 * 1024, config: { rateLimit: AUTH_RATE_LIMITS.logoUpload } },
    async (request) =>
      control.setLogo(auth(request), parseInput(LogoBody, request.body), meta(request)),
  );
  app.delete('/current/logo', async (request) => control.removeLogo(auth(request), meta(request)));

  // Branches: create, edit, deactivate / reactivate. There is no delete.
  app.post('/current/branches', { bodyLimit: 16 * 1024 }, async (request, reply) => {
    const body = parseInput(BranchCreateBody, request.body);
    return reply.status(201).send(await control.createBranch(auth(request), body, meta(request)));
  });
  app.patch('/current/branches/:id', { bodyLimit: 16 * 1024 }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(BranchUpdateBody, request.body);
    return control.updateBranch(auth(request), id, body, meta(request));
  });
  app.post('/current/branches/:id/deactivate', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.setBranchStatus(auth(request), id, 'INACTIVE', meta(request));
  });
  app.post('/current/branches/:id/reactivate', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.setBranchStatus(auth(request), id, 'ACTIVE', meta(request));
  });
  // EP26: one branch with its access configuration.
  app.get('/current/branches/:id/detail', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.branchDetail(auth(request), id);
  });

  // People (EP26: ?q, ?role, ?status, ?department, ?branch, ?page, ?pageSize).
  app.get('/current/members', async (request) =>
    control.members(auth(request), parseInput(MemberListQuery, request.query)),
  );
  app.get('/current/members/:id', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.member(auth(request), id);
  });
  app.put('/current/members/:id/branches', { bodyLimit: 32 * 1024 }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(MemberBranchesBody, request.body);
    return control.setMemberBranches(auth(request), id, body, meta(request));
  });
  app.patch('/current/members/:id', { bodyLimit: 4 * 1024 }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(MemberUpdateBody, request.body);
    return control.updateMember(auth(request), id, body, meta(request));
  });
  app.post('/current/members/:id/deactivate', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.setMemberStatus(auth(request), id, 'DEACTIVATED', meta(request));
  });
  app.post('/current/members/:id/reactivate', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    return control.setMemberStatus(auth(request), id, 'ACTIVE', meta(request));
  });
  app.put('/current/members/:id/departments', { bodyLimit: 4 * 1024 }, async (request) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(MemberDepartmentsBody, request.body);
    return control.setMemberDepartments(auth(request), id, body, meta(request));
  });

  // Departments (within the package; the server decides).
  app.put('/current/departments', { bodyLimit: 4 * 1024 }, async (request) => {
    const { departments } = parseInput(DepartmentsBody, request.body);
    await control.setDepartments(auth(request), departments, meta(request));
    return companies.departments(auth(request));
  });

  app.get('/current/settings', async (request) => control.settings(auth(request)));
  app.patch('/current/settings', { bodyLimit: 4 * 1024 }, async (request) =>
    control.updateSettings(auth(request), parseInput(SettingsBody, request.body), meta(request)),
  );

  app.get('/current/activity', async (request) =>
    control.activity(auth(request), parseInput(ActivityQuery, request.query)),
  );

  // ---- branch context (EP25): kept on the server-side session ---------------
  app.get('/context', async (request) => branchContext(db, auth(request)));
  app.post('/context/branch', { bodyLimit: 1024 }, async (request) => {
    const { branchId } = parseInput(BranchContextBody, request.body);
    return selectBranch(db, auth(request), branchId);
  });

  // ---- invitations (EP23, completed in EP25) -------------------------------
  app.post(
    '/invitations',
    { bodyLimit: 16 * 1024, config: { rateLimit: AUTH_RATE_LIMITS.invitationCreate } },
    async (request, reply) => {
      const body = parseInput(InvitationBody, request.body);
      const created = await invitations.create(auth(request), body, meta(request));
      return reply.status(201).send(created);
    },
  );

  // EP26: the lifecycle (?state=PENDING|EXPIRED|ACCEPTED|REVOKED|ALL) and resend.
  app.get('/current/invitations', async (request) =>
    control.invitations(auth(request), parseInput(InvitationListQuery, request.query)),
  );
  app.post(
    '/invitations/:id/resend',
    { config: { rateLimit: AUTH_RATE_LIMITS.invitationResend } },
    async (request, reply) => {
      const { id } = parseInput(IdParams, request.params);
      return reply.status(201).send(await invitations.resend(auth(request), id, meta(request)));
    },
  );

  app.post('/invitations/:id/revoke', async (request) => {
    const { id } = parseInput(IdParams, request.params);
    await invitations.revoke(auth(request), id, meta(request));
    return { status: 'revoked' };
  });

  return Promise.resolve();
};
