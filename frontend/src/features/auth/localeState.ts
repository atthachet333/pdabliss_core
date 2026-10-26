import { useLocation, useSearchParams } from 'react-router';
import { isLocale, resolveLocale, type Locale } from '@/i18n/locales';

/*
 * Account screens are never locale-prefixed (like /login, EP15). Their
 * language comes from, in order: router state from the page the visitor came
 * from, the `?lang=` an email link carries (th | en | zh), then a fallback
 * (the account's saved language when known, else Thai).
 */

export function useRequestedLocale(): Locale | null {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const asked = (state as { locale?: unknown } | null)?.locale;
  if (isLocale(asked)) return asked;
  const lang = params.get('lang');
  return lang ? resolveLocale(lang) : null;
}

/** Moving between account screens keeps the language (router state, not the URL). */
export function withLocale(locale: Locale) {
  return { state: { locale } };
}
