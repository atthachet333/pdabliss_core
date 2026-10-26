import { Building2, CircleCheck, CircleDashed, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { planIntent, type Identity } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';
import { PROTOTYPE_ENABLED } from '@/prototype/config';
import { formatDateTime } from './format';
import { Panel, PortalShell } from './PortalShell';
import { SessionsPanel } from './SessionsPanel';

/*
 * Account Portal (EP23 foundation). Where a customer lands after sign-in —
 * not a department. It states the real onboarding position honestly: the
 * account is verified; company setup, package and payment come later
 * (EP24+). No subscription is pretended.
 */
export function AccountPortal({ identity }: { identity: Identity }) {
  const c = useCopy(AUTH_COPY);
  const { href, locale } = useLocale();
  usePageMeta(c.account.meta.title, c.account.meta.description, { index: false });
  const lang = LOCALE_META[locale].htmlLang;
  const { user, company, onboarding } = identity;
  const plan = planIntent(onboarding.planIntent);

  return (
    <PortalShell area="account" identity={identity}>
      <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase">
        CORE · {c.account.kicker}
      </p>
      <h1 className="mt-2 text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] font-semibold tracking-tight text-text-primary">
        {c.account.title}
      </h1>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel id="identity-title" title={c.account.identity}>
          <dl className="grid gap-3 text-label sm:grid-cols-[max-content_1fr] sm:gap-x-6">
            <dt className="text-text-muted">{c.account.name}</dt>
            <dd className="text-text-primary">{user.displayName ?? c.account.noName}</dd>
            <dt className="text-text-muted">{c.common.email}</dt>
            <dd className="break-all text-text-primary">
              {user.email}
              {user.emailVerified && (
                <span className="ml-2 inline-flex items-center gap-1 text-caption text-brand-soft">
                  <CircleCheck aria-hidden className="size-3.5" />
                  {c.account.emailVerified}
                </span>
              )}
            </dd>
            <dt className="text-text-muted">{c.account.memberSince}</dt>
            <dd className="text-text-primary">{formatDateTime(user.createdAt, lang)}</dd>
          </dl>
        </Panel>

        {company ? (
          <Panel id="company-title" title={c.account.company}>
            <div data-onboarding="company_ready" className="space-y-3">
              <p className="flex items-center gap-2 text-body text-text-primary">
                <Building2 aria-hidden className="size-5 text-brand-soft" />
                {company.name}
              </p>
              {company.isDemo && (
                <p className="inline-flex rounded-full bg-warning/15 px-2.5 py-1 text-caption text-warning">
                  {c.account.demoCompany}
                </p>
              )}
              <p className="text-label text-text-secondary">
                {c.account.yourRole}:{' '}
                <span className="text-text-primary">{c.roles[company.role]}</span>
              </p>
              <p className="text-caption text-text-muted">{c.account.workspacesLater}</p>
              {PROTOTYPE_ENABLED && (
                <Link to="/app" className={buttonClasses('secondary', 'md')}>
                  <FlaskConical aria-hidden className="size-4" />
                  {c.account.openPrototype}
                </Link>
              )}
            </div>
          </Panel>
        ) : (
          <Panel id="onboarding-title" title={c.account.onboarding}>
            <ol data-onboarding="onboarding_required" className="space-y-3">
              <li className="flex items-center gap-2 text-label text-text-primary">
                <CircleCheck aria-hidden className="size-4.5 text-brand-soft" />
                {c.account.stepVerified}
              </li>
              <li className="flex items-center gap-2 text-label text-text-secondary">
                <CircleDashed aria-hidden className="size-4.5 text-text-muted" />
                {c.account.stepCompany}
              </li>
              <li className="flex items-center gap-2 text-label text-text-secondary">
                <CircleDashed aria-hidden className="size-4.5 text-text-muted" />
                {c.account.stepPackage}
              </li>
            </ol>
            {plan && (
              <p data-plan={plan} className="mt-4 text-caption text-brand-soft">
                {c.account.planChosen(c.plans[plan])}
              </p>
            )}
            <p className="mt-4 text-caption text-text-muted">{c.account.packagesLater}</p>
            <Link to={href('/pricing')} className={`${buttonClasses('secondary', 'md')} mt-4`}>
              {c.account.viewPricing}
            </Link>
          </Panel>
        )}

        <SessionsPanel />
      </div>
    </PortalShell>
  );
}
