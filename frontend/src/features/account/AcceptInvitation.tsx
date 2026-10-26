import { useState } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { authApi, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError, errorCode } from '@/features/auth/errors';
import { refreshIdentity } from '@/features/auth/session';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Panel, PortalShell } from './PortalShell';

/*
 * /account/invitation (EP23 foundation): accept a company invitation with the
 * signed-in account. The token arrives in the link's fragment; it is taken
 * once (pages/account/InvitationPage.tsx) and held in memory only — it
 * survives the in-app sign-in detour but never a reload or storage.
 */
export function AcceptInvitation({
  identity,
  token,
}: {
  identity: Identity;
  token: string | null;
}) {
  const c = useCopy(AUTH_COPY);
  usePageMeta(c.account.invitationTitle, c.account.meta.description, { index: false });
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const res = await authApi.acceptInvitation(token);
      setDone(c.account.invitationDone(res.company.name));
      await refreshIdentity();
    } catch (e) {
      const code = errorCode(e);
      setError(
        code === 'INVITATION_EMAIL_MISMATCH'
          ? c.account.invitationMismatch
          : code === 'ALREADY_IN_COMPANY'
            ? c.account.invitationAlready
            : code === 'PLATFORM_ACCOUNT'
              ? c.account.invitationPlatform
              : ['TOKEN_EXPIRED', 'TOKEN_USED', 'TOKEN_INVALID'].includes(code)
                ? c.account.invitationBad
                : commonError(e, c),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <PortalShell area={identity.platformRole ? 'platform' : 'account'} identity={identity}>
      <Panel id="invitation-title" title={c.account.invitationTitle} className="max-w-xl">
        <div
          className="space-y-4"
          data-invitation={done ? 'accepted' : token ? 'ready' : 'missing'}
        >
          {!token && !done && <Notice tone="info">{c.account.invitationMissing}</Notice>}
          {token && !done && (
            <>
              <p className="text-label text-text-secondary">{c.account.invitationLead}</p>
              <p className="text-caption text-text-muted">{identity.user.email}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => void accept()}
                className={buttonClasses('primary', 'lg')}
              >
                {pending ? c.account.invitationAccepting : c.account.invitationAccept}
              </button>
            </>
          )}
          {done && <Notice tone="success">{done}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <Link
            to="/account"
            className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
          >
            {c.account.backToAccount}
          </Link>
        </div>
      </Panel>
    </PortalShell>
  );
}
