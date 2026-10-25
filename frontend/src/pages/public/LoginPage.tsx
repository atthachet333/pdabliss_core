import { useLocation } from 'react-router';
import { LoginGateway } from '@/features/login/LoginGateway';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/locales';
import { LocaleProvider } from '@/i18n/LocaleProvider';

/**
 * /login (EP15): the CORE Gateway. One sign-in, one unprefixed URL — the
 * auth contract (`/login?next=`) is unchanged. The site language the visitor
 * came from travels in router state (header link, /en/login and /zh/login
 * redirects), so the gateway speaks it and "back to the website" returns to
 * that locale. A direct visit is Thai.
 */
export default function LoginPage() {
  const { state } = useLocation();
  const asked = (state as { locale?: unknown } | null)?.locale;
  return (
    <LocaleProvider locale={isLocale(asked) ? asked : DEFAULT_LOCALE}>
      <LoginGateway />
    </LocaleProvider>
  );
}
