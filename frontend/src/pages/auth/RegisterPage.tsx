import { RegisterForm } from '@/features/auth/RegisterForm';
import { AuthLocale } from '@/features/auth/locale';

/** /register (EP23) — self-registration. Never locale-prefixed; noindex. */
export default function RegisterPage() {
  return (
    <AuthLocale>
      <RegisterForm />
    </AuthLocale>
  );
}
