import { AuthLocale } from '@/features/auth/locale';
import { LoginGateway } from '@/features/login/LoginGateway';

/**
 * /login (EP15): the CORE Gateway. One sign-in, one unprefixed URL — the
 * contract (`/login?next=`) is unchanged. The site language the visitor
 * came from travels in router state (header link, /en/login and /zh/login
 * redirects) or as `?lang=` from an email, so the gateway speaks it and
 * "back to the website" returns to that locale. A direct visit is Thai.
 */
export default function LoginPage() {
  return (
    <AuthLocale>
      <LoginGateway />
    </AuthLocale>
  );
}
