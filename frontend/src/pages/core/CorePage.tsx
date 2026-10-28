import { SignedInArea } from '@/features/account/PortalShell';
import { CoreArea } from '@/features/company-center/CoreArea';

/** /core/* — branch selection and the CORE Operations entry (EP25), its own lazy chunk. */
export default function CorePage() {
  return <SignedInArea area="core">{(identity) => <CoreArea identity={identity} />}</SignedInArea>;
}
