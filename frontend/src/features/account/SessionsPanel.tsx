import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi, type SessionRow } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { withLocale } from '@/features/auth/localeState';
import { clearIdentity } from '@/features/auth/session';
import { LOCALE_META } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { describeDevice, formatDateTime } from './format';
import { Panel } from './PortalShell';

/** Signed-in devices of this account, with sign-out per device and everywhere (EP23). */
export function SessionsPanel() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const lang = LOCALE_META[locale].htmlLang;
  const navigate = useNavigate();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      authApi.sessions().then(
        (res) => setRows(res.sessions),
        (e: unknown) => setError(commonError(e, c)),
      ),
    [c],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const signedOut = () => {
    clearIdentity();
    navigate('/login', { replace: true, ...withLocale(locale) });
  };

  const revoke = async (row: SessionRow) => {
    setError(null);
    try {
      await authApi.revokeSession(row.id);
      if (row.current) signedOut();
      else await load();
    } catch (e) {
      setError(commonError(e, c));
    }
  };

  const revokeAll = async () => {
    setError(null);
    try {
      await authApi.logoutAll();
      signedOut();
    } catch (e) {
      setError(commonError(e, c));
    }
  };

  return (
    <Panel id="security-title" title={c.security.title}>
      <p className="text-caption text-text-secondary">{c.security.lead}</p>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {rows === null && !error && (
        <p role="status" className="mt-3 text-caption text-text-muted">
          {c.security.loading}
        </p>
      )}
      {rows && (
        <ul className="mt-4 divide-y divide-white/[0.06]" data-sessions>
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <MonitorSmartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-text-muted" />
                <div className="min-w-0">
                  <p className="text-label text-text-primary">
                    {describeDevice(row.userAgent) ?? c.security.unknownDevice}
                    {row.current && (
                      <span className="ml-2 rounded-full bg-brand-primary/15 px-2 py-0.5 text-[0.75rem] text-brand-soft">
                        {c.security.current}
                      </span>
                    )}
                  </p>
                  <p className="text-caption text-text-muted">
                    {c.security.lastActive}: {formatDateTime(row.lastSeenAt, lang)} ·{' '}
                    {c.security.expires}: {formatDateTime(row.expiresAt, lang)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void revoke(row)}
                className="inline-flex min-h-11 items-center text-caption text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
              >
                {c.security.revoke}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          onClick={() => void revokeAll()}
          className={buttonClasses('secondary', 'md')}
        >
          <LogOut aria-hidden className="size-4" />
          {c.security.revokeAll}
        </button>
        <p className="mt-2 text-caption text-text-muted">{c.security.revokeAllHint}</p>
      </div>
    </Panel>
  );
}
