import { SignedInArea } from '@/features/account/PortalShell';
import { CompanyInspection } from '@/features/platform/CompanyInspection';

/** /platform/companies/:companyId — read-only Platform Inspection (EP24.1). */
export default function PlatformCompanyPage() {
  return (
    <SignedInArea area="platform">
      {(identity) => <CompanyInspection identity={identity} />}
    </SignedInArea>
  );
}
