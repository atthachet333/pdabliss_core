import { AccountPortal } from '@/features/account/AccountPortal';
import { SignedInArea } from '@/features/account/PortalShell';

/** /account (EP23) — the Account Portal, where customers land after sign-in. */
export default function AccountPage() {
  return (
    <SignedInArea area="account">
      {(identity) => <AccountPortal identity={identity} />}
    </SignedInArea>
  );
}
