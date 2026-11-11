import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/locales';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { isLoaded, loadMessages } from '@/i18n/messages';
import { useRequestedLocale } from './localeState';

/**
 * Language provider for the account screens (see ./localeState.ts for the order).
 *
 * EP42.4 `wait`: the shell dictionary (skip link, shell labels) of English and Chinese is a
 * lazy chunk, and until it arrives the shell falls back to Thai — so a Chinese page opened
 * on a slow device flashed a Thai skip link beside Chinese content. With `wait`, nothing is
 * rendered until the dictionary is there (milliseconds; the signed-in areas are not
 * prerendered, so there is no markup to hydrate). If it cannot load, the page renders anyway.
 */
export function AuthLocale({
  fallback,
  wait = false,
  children,
}: {
  fallback?: Locale;
  wait?: boolean;
  children: ReactNode;
}) {
  const locale = useRequestedLocale() ?? fallback ?? DEFAULT_LOCALE;
  const [failed, setFailed] = useState<Locale | null>(null);
  const [, setLoaded] = useState<Locale | null>(null);
  const missing = wait && !isLoaded(locale) && failed !== locale;
  useEffect(() => {
    if (!missing) return;
    let live = true;
    loadMessages(locale).then(
      () => live && setLoaded(locale),
      () => live && setFailed(locale),
    );
    return () => {
      live = false;
    };
  }, [missing, locale]);
  if (missing) return null;
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
