import { SignedInArea } from '@/features/account/PortalShell';
import { PlatformOperators } from '@/features/platform/PlatformOperators';

/** /platform/operators — the platform team by authority (EP24.1.2). */
export default function PlatformOperatorsPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <PlatformOperators identity={identity} />}
    </SignedInArea>
  );
}
