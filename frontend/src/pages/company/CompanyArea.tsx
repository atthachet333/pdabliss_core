import { Navigate, Route, Routes } from 'react-router';
import { SignedInArea } from '@/features/account/PortalShell';
import { BranchDetailPage } from '@/features/company-center/BranchDetailPage';
import { BranchesPage } from '@/features/company-center/BranchesPage';
import { CompanyShell } from '@/features/company-center/CompanyShell';
import { DepartmentsPage } from '@/features/company-center/DepartmentsPage';
import { InvitationsPage } from '@/features/company-center/InvitationsPage';
import { MemberDetailPage } from '@/features/company-center/MemberDetailPage';
import { Overview } from '@/features/company-center/Overview';
import { PermissionsPage } from '@/features/company-center/PermissionsPage';
import { ProfilePage } from '@/features/company-center/ProfilePage';
import { SecurityPage } from '@/features/company-center/SecurityPage';
import { SettingsPage } from '@/features/company-center/SettingsPage';
import { SubscriptionPage } from '@/features/company-center/SubscriptionPage';
import { UsersPage } from '@/features/company-center/UsersPage';

/*
 * /company/* — the Company Control Center (EP25), one lazy chunk: the public
 * website and the Account Portal never load it. Only an active member of an
 * active company gets here (SignedInArea); each API call is authorized again
 * by the server.
 *
 * EP26 adds the branch detail (/company/branches/:id), one member's page
 * (/company/users/:id) and the invitation lifecycle (/company/users/invitations).
 * EP27 adds permission profiles and member exceptions (/company/permissions).
 */
export default function CompanyArea() {
  return (
    <SignedInArea area="company">
      {(identity) => (
        <CompanyShell identity={identity}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="branches/:branchId" element={<BranchDetailPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/invitations" element={<InvitationsPage />} />
            <Route path="users/:memberId" element={<MemberDetailPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="permissions" element={<PermissionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/company" replace />} />
          </Routes>
        </CompanyShell>
      )}
    </SignedInArea>
  );
}
