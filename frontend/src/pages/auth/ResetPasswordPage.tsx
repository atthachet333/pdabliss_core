import { AuthLocale } from '@/features/auth/locale';
import { ResetPassword } from '@/features/auth/PasswordRecovery';

/** /reset-password#token=… (EP23) — the link from the reset email. */
export default function ResetPasswordPage() {
  return (
    <AuthLocale>
      <ResetPassword />
    </AuthLocale>
  );
}
