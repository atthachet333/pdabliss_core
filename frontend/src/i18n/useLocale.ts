import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locales';
import { th } from './messages/th';
import type { ShellMessages } from './types';

export interface LocaleValue {
  locale: Locale;
  /** The public-shell dictionary for the current locale. */
  t: ShellMessages;
  /** Localizes an internal path (`/departments` → `/en/departments`). */
  href: (to: string) => string;
}

export const LocaleContext = createContext<LocaleValue | null>(null);

const FALLBACK: LocaleValue = {
  locale: DEFAULT_LOCALE,
  t: th,
  href: (to) => to,
};

/** Current public locale. Outside a LocaleProvider it is Thai. */
export function useLocale(): LocaleValue {
  return useContext(LocaleContext) ?? FALLBACK;
}
