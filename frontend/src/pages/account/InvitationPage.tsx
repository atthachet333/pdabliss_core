import { AcceptInvitation } from '@/features/account/AcceptInvitation';
import { SignedInArea } from '@/features/account/PortalShell';
import { takeLinkToken } from '@/features/auth/linkToken';

/*
 * /account/invitation#token=… (EP23). The token is taken from the fragment
 * once and kept in this module's memory, so it survives the in-app sign-in
 * detour (/login?next=/account/invitation) without being written anywhere.
 */
let pendingToken: string | null = null;

function invitationToken(): string | null {
  pendingToken = takeLinkToken() ?? pendingToken;
  return pendingToken;
}

export default function InvitationPage() {
  const token = invitationToken();
  return (
    <SignedInArea area="account">
      {(identity) => <AcceptInvitation identity={identity} token={token} />}
    </SignedInArea>
  );
}
