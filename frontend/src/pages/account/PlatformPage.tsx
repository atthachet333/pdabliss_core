import { SignedInArea } from '@/features/account/PortalShell';
import { PlatformOverview } from '@/features/platform/PlatformOverview';

/** /platform — Platform Control Center overview (PLATFORM_OWNER / PLATFORM_ADMIN only). */
export default function PlatformPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <PlatformOverview identity={identity} />}
    </SignedInArea>
  );
}
