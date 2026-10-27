import { SignedInArea } from '@/features/account/PortalShell';
import { CompanyExplorer } from '@/features/platform/CompanyExplorer';

/** /platform/companies — the Platform Company Explorer (EP24.1). */
export default function PlatformCompaniesPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <CompanyExplorer identity={identity} />}
    </SignedInArea>
  );
}
