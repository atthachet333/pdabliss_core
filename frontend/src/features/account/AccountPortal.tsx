import { CircleCheck, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import type { Identity } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { CompanyOnboarding } from '@/features/company/Onboarding';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';
import { PROTOTYPE_ENABLED } from '@/prototype/config';
import { formatDateTime } from './format';
import { Panel, PortalShell } from './PortalShell';
import { SessionsPanel } from './SessionsPanel';

/*
 * Account Portal — where a customer lands after sign-in; not a department.
 * EP23: identity and devices. EP24: the company onboarding position — choose a
 * package, create the company and Head Office, then the subscription awaits
 * activation. Nothing is paid in EP24 and the page never says otherwise.
 */
export function AccountPortal({ identity }: { identity: Identity }) {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  usePageMeta(c.account.meta.title, c.account.meta.description, { index: false });
  const lang = LOCALE_META[locale].htmlLang;
  const { user, company } = identity;

  return (
    <PortalShell area="account" identity={identity}>
      <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase">
        CORE · {c.account.kicker}
      </p>
      <h1 className="mt-2 text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] font-semibold tracking-tight text-text-primary">
        {c.account.title}
      </h1>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <CompanyOnboarding identity={identity} />

        <Panel id="identity-title" title={c.account.identity}>
          <dl className="grid gap-3 text-label sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-6">
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
            {company && (
              <>
                <dt className="text-text-muted">{c.account.yourRole}</dt>
                <dd className="text-text-primary">{c.roles[company.role]}</dd>
              </>
            )}
          </dl>
          {company && PROTOTYPE_ENABLED && (
            <Link to="/app" className={`${buttonClasses('secondary', 'md')} mt-5`}>
              <FlaskConical aria-hidden className="size-4" />
              {c.account.openPrototype}
            </Link>
          )}
        </Panel>

        <SessionsPanel />
      </div>
    </PortalShell>
  );
}
