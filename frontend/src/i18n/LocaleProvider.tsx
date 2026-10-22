import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_META, localizePath, type Locale } from './locales';
import { getMessages, isLoaded, loadMessages } from './messages';
import { LocaleContext, type LocaleValue } from './useLocale';

/**
 * Provides the public-shell locale. The locale comes from the route (see
 * app/router.tsx), never from browser sniffing, so every URL renders the same
 * language for every visitor and crawler.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // Routes preload their dictionary; this only covers a provider rendered
  // outside the router's lazy loading (e.g. an isolated test).
  const [, setReady] = useState(() => isLoaded(locale));
  useEffect(() => {
    if (!isLoaded(locale)) void loadMessages(locale).then(() => setReady(true));
  }, [locale]);

  const t = getMessages(locale);
  const value = useMemo<LocaleValue>(
    () => ({ locale, t, href: (to) => localizePath(to, locale) }),
    [locale, t],
  );

  // <html lang> follows the shell locale; leaving the public site restores Thai.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = LOCALE_META[locale].htmlLang;
    return () => {
      root.lang = LOCALE_META[DEFAULT_LOCALE].htmlLang;
    };
  }, [locale]);

  return <LocaleContext value={value}>{children}</LocaleContext>;
}
