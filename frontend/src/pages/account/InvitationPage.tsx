import { AcceptInvitation } from '@/features/account/AcceptInvitation';
import { InvitationSignup } from '@/features/account/InvitationSignup';
import { SignedInArea } from '@/features/account/PortalShell';
import { takeLinkToken } from '@/features/auth/linkToken';
import { AuthLocale } from '@/features/auth/locale';
import { useIdentity } from '@/features/auth/session';

/*
 * /account/invitation#token=… (EP23). The token is taken from the fragment
 * once and kept in this module's memory, so it survives the in-app sign-in
 * detour (/login?next=/account/invitation) without being written anywhere.
 *
 * EP48.5 F1: a visitor who is not signed in and holds a token can create the
 * account from the invitation (public sign-up is closed on the public host);
 * one who already has an account signs in and accepts as before.
 */
let pendingToken: string | null = null;

function invitationToken(): string | null {
  pendingToken = takeLinkToken() ?? pendingToken;
  return pendingToken;
}

export default function InvitationPage() {
  const token = invitationToken();
  const identity = useIdentity();
  if (identity.status === 'anonymous' && token) {
    return (
      <AuthLocale>
        <InvitationSignup token={token} />
      </AuthLocale>
    );
  }
  return (
    <SignedInArea area="account">
      {(identity) => <AcceptInvitation identity={identity} token={token} />}
    </SignedInArea>
  );
}
