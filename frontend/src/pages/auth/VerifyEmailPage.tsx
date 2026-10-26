import { AuthLocale } from '@/features/auth/locale';
import { VerifyEmail } from '@/features/auth/VerifyEmail';

/** /verify-email#token=… (EP23) — the link from the verification email. */
export default function VerifyEmailPage() {
  return (
    <AuthLocale>
      <VerifyEmail />
    </AuthLocale>
  );
}
