import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/locales';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { useRequestedLocale } from './localeState';

/** Language provider for the account screens (see ./localeState.ts for the order). */
export function AuthLocale({ fallback, children }: { fallback?: Locale; children: ReactNode }) {
  const locale = useRequestedLocale() ?? fallback ?? DEFAULT_LOCALE;
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
