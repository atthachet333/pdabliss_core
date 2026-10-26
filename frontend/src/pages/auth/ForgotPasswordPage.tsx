import { AuthLocale } from '@/features/auth/locale';
import { ForgotPassword } from '@/features/auth/PasswordRecovery';

/** /forgot-password (EP23). */
export default function ForgotPasswordPage() {
  return (
    <AuthLocale>
      <ForgotPassword />
    </AuthLocale>
  );
}
