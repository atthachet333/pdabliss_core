import { Navigate, Route, Routes } from 'react-router';
import { SignedInArea } from '@/features/account/PortalShell';
import { BranchesPage } from '@/features/company-center/BranchesPage';
import { CompanyShell } from '@/features/company-center/CompanyShell';
import { DepartmentsPage } from '@/features/company-center/DepartmentsPage';
import { Overview } from '@/features/company-center/Overview';
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
            <Route path="users" element={<UsersPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/company" replace />} />
          </Routes>
        </CompanyShell>
      )}
    </SignedInArea>
  );
}
