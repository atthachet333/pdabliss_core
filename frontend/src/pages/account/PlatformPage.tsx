import { SignedInArea } from '@/features/account/PortalShell';
import { PlatformCenter } from '@/features/platform/PlatformCenter';

/** /platform (EP23) — Platform Control Center (PLATFORM_OWNER / PLATFORM_ADMIN only). */
export default function PlatformPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <PlatformCenter identity={identity} />}
    </SignedInArea>
  );
}
