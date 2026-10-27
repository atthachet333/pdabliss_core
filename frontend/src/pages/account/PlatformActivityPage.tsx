import { SignedInArea } from '@/features/account/PortalShell';
import { PlatformActivity } from '@/features/platform/PlatformActivity';

/** /platform/activity — the platform activity timeline (EP24.1.2). */
export default function PlatformActivityPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <PlatformActivity identity={identity} />}
    </SignedInArea>
  );
}
