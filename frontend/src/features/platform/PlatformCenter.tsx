import { Crown, ReceiptText, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  platformApi,
  type AuthEventRow,
  type Identity,
  type PlatformOperator,
  type PlatformOverview,
  type PlatformUser,
} from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY, type AuthCopy } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { formatDateTime } from '@/features/account/format';
import { platformCompanyApi, type PlatformCompanyRow } from '@/features/company/api';
import { PlatformCompanies } from '@/features/company/PlatformCompanies';
import { Panel, PortalShell } from '@/features/account/PortalShell';
import { SessionsPanel } from '@/features/account/SessionsPanel';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';

/*
 * Platform Control Center (EP23 foundation) — PDA BLISS platform
 * administration, visibly separate from any customer's Company Control
 * Center. Everything shown is real data from the platform API; areas that do
 * not exist yet say so. Owner-only areas are not rendered for a Platform
 * Admin — and the API refuses them anyway (403), which is the real boundary.
 */

interface Data {
  overview: PlatformOverview;
  companies: PlatformCompanyRow[];
  developmentActivation: boolean;
  users: PlatformUser[];
  events: AuthEventRow[];
  operators: PlatformOperator[] | null;
}

function useData<T>(load: () => Promise<T>, c: AuthCopy) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    load().then(
      (v) => live && setValue(v),
      (e: unknown) => live && setError(commonError(e, c)),
    );
    return () => {
      live = false;
    };
    // Loaded once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { value, error };
}

export function PlatformCenter({ identity }: { identity: Identity }) {
  const c = useCopy(AUTH_COPY);
  const p = c.platform;
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  usePageMeta(p.meta.title, p.meta.description, { index: false });
  const owner = identity.platformRole === 'PLATFORM_OWNER';

  const data = useData<Data>(async () => {
    const [overview, companies, users, audit, operators] = await Promise.all([
      platformApi.overview(),
      platformCompanyApi.list(),
      platformApi.users(),
      platformApi.audit(),
      owner ? platformApi.operators() : Promise.resolve(null),
    ]);
    return {
      overview,
      companies: companies.companies,
      developmentActivation: companies.developmentActivation,
      users: users.users,
      events: audit.events,
      operators: operators?.operators ?? null,
    };
  }, c);
  const d = data.value;

  return (
    <PortalShell area="platform" identity={identity}>
      <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-warning uppercase">
        {p.kicker}
      </p>
      <h1 className="mt-2 text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] font-semibold tracking-tight text-text-primary">
        {p.title}
      </h1>
      <p className="mt-2 max-w-3xl text-label text-text-secondary">{p.notCustomer}</p>

      <div
        data-platform-role={identity.platformRole}
        className={cn(
          'mt-6 flex flex-wrap items-center gap-3 rounded-[1.25rem] p-4',
          owner
            ? 'bg-warning/[0.08] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
            : 'bg-white/[0.04] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
        )}
      >
        {owner ? (
          <Crown aria-hidden className="size-6 text-warning" />
        ) : (
          <ShieldCheck aria-hidden className="size-6 text-brand-soft" />
        )}
        <div className="min-w-0">
          <p className="text-body font-semibold text-text-primary">
            {identity.platformRole ? c.roles[identity.platformRole] : ''}
          </p>
          <p className="text-caption text-text-secondary">{owner ? p.ownerBadge : p.adminBadge}</p>
        </div>
        <p className="ml-auto min-w-0 text-caption text-text-secondary">
          {p.signedInAs} <span className="break-all text-text-primary">{identity.user.email}</span>
        </p>
      </div>

      {data.error && (
        <div className="mt-6">
          <Notice tone="error">{data.error}</Notice>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel id="session-title" title={p.session}>
          <dl className="grid gap-2 text-label sm:grid-cols-[max-content_1fr] sm:gap-x-6">
            <dt className="text-text-muted">{p.sessionExpires}</dt>
            <dd className="text-text-primary">
              {formatDateTime(identity.session.expiresAt, lang)}
            </dd>
            <dt className="text-text-muted">{p.stepUp}</dt>
            <dd className="text-text-primary">
              {identity.session.stepUpValidUntil
                ? formatDateTime(identity.session.stepUpValidUntil, lang)
                : p.stepUpNone}
            </dd>
          </dl>
        </Panel>

        <Panel id="overview-title" title={p.overview}>
          {d ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={p.usersActive} value={d.overview.users.ACTIVE ?? 0} />
              <Stat label={p.usersPending} value={d.overview.users.PENDING_VERIFICATION ?? 0} />
              <Stat label={p.usersSuspended} value={d.overview.users.SUSPENDED ?? 0} />
              <Stat label={p.companiesCustomer} value={d.overview.companies.customer} />
              <Stat label={p.companiesDemo} value={d.overview.companies.demo} />
              <Stat label={p.activeSessions} value={d.overview.activeSessions} />
            </dl>
          ) : (
            <Loading />
          )}
        </Panel>

        {/* EP24: the canonical company list (owner, package, subscription, onboarding). */}
        {d ? (
          <PlatformCompanies
            companies={d.companies}
            developmentActivation={d.developmentActivation}
            p={p}
          />
        ) : (
          <Panel id="companies-title" title={p.companies} className="lg:col-span-2">
            <Loading />
          </Panel>
        )}

        {owner && (
          <Panel
            id="operators-title"
            title={p.operators}
            aside={<span className="text-caption text-warning">{p.operatorsOwnerOnly}</span>}
          >
            <div data-owner-only>
              {d?.operators ? (
                <ul className="divide-y divide-white/[0.06]">
                  {d.operators.map((op) => (
                    <li
                      key={op.userId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <span className="min-w-0 text-label break-all text-text-primary">
                        {op.email}
                      </span>
                      <span className="text-caption text-text-secondary">{c.roles[op.role]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Loading />
              )}
              <p className="mt-4 text-caption text-text-muted">{p.operatorsNote}</p>
            </div>
          </Panel>
        )}

        <Panel id="users-title" title={p.users}>
          {d ? (
            <ul
              className="max-h-80 divide-y divide-white/[0.06] overflow-y-auto"
              tabIndex={0}
              aria-label={p.users}
            >
              {d.users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-label text-text-primary">
                    <Users aria-hidden className="size-4 shrink-0 text-text-muted" />
                    <span className="break-all">{u.email}</span>
                  </span>
                  <span className="text-caption text-text-muted">
                    {u.platformRole
                      ? c.roles[u.platformRole]
                      : u.company
                        ? `${c.roles[u.company.role]} · ${u.company.name}`
                        : u.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Loading />
          )}
        </Panel>

        <Placeholder
          icon={<ReceiptText aria-hidden className="size-5" />}
          title={p.subscriptions}
          text={p.subscriptionsNote}
        />
        <Placeholder
          icon={<ReceiptText aria-hidden className="size-5" />}
          title={p.billing}
          text={p.notYet}
        />

        <Panel id="audit-title" title={p.audit} className="lg:col-span-2">
          <p className="text-caption text-text-secondary">{p.auditLead}</p>
          {d ? (
            <div className="mt-3 max-h-96 overflow-auto" tabIndex={0} aria-label={p.audit}>
              <table className="w-full min-w-[34rem] text-left text-caption">
                <tbody className="divide-y divide-white/[0.06]">
                  {d.events.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 whitespace-nowrap text-text-muted">
                        {formatDateTime(e.occurredAt, lang)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-text-primary">
                        <ScrollText
                          aria-hidden
                          className="mr-1.5 inline size-3.5 text-text-muted"
                        />
                        {e.type}
                      </td>
                      <td className="py-2 break-all text-text-secondary">{e.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Loading />
          )}
        </Panel>

        <SessionsPanel />
      </div>
    </PortalShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="mt-1 text-[1.5rem] font-semibold text-text-primary tabular-nums">{value}</dd>
    </div>
  );
}

function Loading() {
  return <p className="text-caption text-text-muted">…</p>;
}

function Placeholder({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <section
      className="min-w-0 rounded-[1.25rem] border border-dashed border-white/[0.12] p-5 sm:p-6"
      data-placeholder
    >
      <h2 className="flex items-center gap-2 text-body font-semibold text-text-secondary">
        <span className="text-text-muted">{icon}</span>
        {title}
      </h2>
      <p className="mt-3 text-caption text-text-muted">{text}</p>
    </section>
  );
}
