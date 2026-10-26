import { Building2, Eye } from 'lucide-react';
import { useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { formatDateTime } from '@/features/account/format';
import { Panel } from '@/features/account/PortalShell';
import type { AuthCopy } from '@/features/auth/copy';
import { Notice } from '@/features/auth/AuthFrame';
import { getPlan } from '@/features/pricing/plans';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { planId, platformCompanyApi, type PlatformCompanyRow } from './api';
import { COMPANY_COPY } from './copy';

/*
 * The canonical company list for platform operators (EP24): company, owner,
 * package, subscription and onboarding status, created date — real rows only,
 * no metrics. Outside production a pending company can be activated manually
 * (labelled development/test, audited, never a payment).
 */
export function PlatformCompanies({
  companies,
  developmentActivation,
  p,
}: {
  companies: PlatformCompanyRow[];
  developmentActivation: boolean;
  p: AuthCopy['platform'];
}) {
  const c = useCopy(COMPANY_COPY);
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const [rows, setRows] = useState(companies);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const activate = async (row: PlatformCompanyRow) => {
    setBusy(row.id);
    setMessage(null);
    try {
      const detail = await platformCompanyApi.activateForDevelopment(row.id);
      setRows((all) =>
        all.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: detail.company.status,
                subscriptionStatus: detail.subscriptions[0]?.status ?? r.subscriptionStatus,
              }
            : r,
        ),
      );
      setMessage({ tone: 'success', text: c.platform.activated(row.name) });
    } catch (e) {
      setMessage({
        tone: 'error',
        text:
          e instanceof ApiError && e.code === 'STEP_UP_REQUIRED'
            ? c.platform.stepUpNeeded
            : c.platform.activateFailed,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel id="companies-title" title={p.companies} className="lg:col-span-2">
      {message && (
        <div className="mb-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {rows.length ? (
        <ul className="divide-y divide-white/[0.06]" data-platform-companies>
          {rows.map((co) => (
            <li
              key={co.id}
              className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              data-company-row={co.id}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-label text-text-primary">
                  <Building2 aria-hidden className="size-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 break-words">{co.name}</span>
                  {co.isDemo && (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[0.75rem] text-warning">
                      {p.demo}
                    </span>
                  )}
                </p>
                <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-caption">
                  <dt className="text-text-muted">{c.platform.owner}</dt>
                  <dd className="break-all text-text-secondary">{co.owner ?? c.platform.none}</dd>
                  <dt className="text-text-muted">{c.platform.plan}</dt>
                  <dd className="text-text-secondary" data-company-plan={co.plan ?? ''}>
                    {co.plan ? getPlan(planId(co.plan)).name : c.platform.none}
                  </dd>
                  <dt className="text-text-muted">{c.platform.subscription}</dt>
                  <dd
                    className="text-text-secondary"
                    data-subscription-status={co.subscriptionStatus ?? ''}
                  >
                    {co.subscriptionStatus
                      ? c.summary.subscriptionStatuses[co.subscriptionStatus]
                      : c.platform.none}
                  </dd>
                  <dt className="text-text-muted">{c.platform.status}</dt>
                  <dd className="text-text-secondary">{c.summary.statuses[co.status]}</dd>
                  <dt className="text-text-muted">{c.platform.onboarding}</dt>
                  <dd className="text-text-secondary">
                    {c.platform.onboardingStatuses[co.onboardingStatus]}
                  </dd>
                  <dt className="text-text-muted">{c.platform.created}</dt>
                  <dd className="text-text-secondary">{formatDateTime(co.createdAt, lang)}</dd>
                </dl>
                <p className="mt-1 text-caption text-text-muted">
                  {co.members} {p.members} · {co.departments} {p.departments}
                </p>
              </div>
              {developmentActivation &&
                co.subscriptionStatus === 'PENDING' &&
                co.onboardingStatus === 'COMPLETED' && (
                  <div className="sm:text-right">
                    <button
                      type="button"
                      onClick={() => void activate(co)}
                      disabled={busy === co.id}
                      aria-describedby="development-activation-hint"
                      className={buttonClasses('secondary', 'md')}
                      data-development-activation={co.id}
                    >
                      {busy === co.id ? c.platform.activating : c.platform.activate}
                    </button>
                  </div>
                )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-text-muted">{p.companiesEmpty}</p>
      )}
      {developmentActivation && (
        <p id="development-activation-hint" className="mt-3 text-caption text-warning">
          {c.platform.activateHint}
        </p>
      )}
      <p className="mt-4 flex items-start gap-2 text-caption text-text-muted">
        <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
        {p.inspection}
      </p>
    </Panel>
  );
}
