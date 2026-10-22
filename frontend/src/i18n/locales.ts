/*
 * Public-site locales (EP05).
 *
 * URL strategy (SEO-ready): Thai is the default and unprefixed; other locales
 * live under a short path prefix.
 *   th     →  /            /departments
 *   en     →  /en          /en/departments
 *   zh-CN  →  /zh          /zh/departments
 *
 * Sign-in and the internal application are not localized by URL: /login and
 * /app/* are never prefixed.
 */

export const LOCALES = ['th', 'en', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'th';

export interface LocaleMeta {
  /** URL prefix; '' for the default locale. */
  prefix: '' | '/en' | '/zh';
  /** Name in its own language, for the selector. */
  nativeName: string;
  /** Compact label for the header button. */
  short: string;
  /** BCP 47 tag for `lang` attributes. */
  htmlLang: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  th: { prefix: '', nativeName: 'ภาษาไทย', short: 'TH', htmlLang: 'th' },
  en: { prefix: '/en', nativeName: 'English', short: 'EN', htmlLang: 'en' },
  'zh-CN': { prefix: '/zh', nativeName: '简体中文', short: '中文', htmlLang: 'zh-CN' },
};

/** Paths that always stay unprefixed, whatever the current locale. */
const UNLOCALIZED = ['/login', '/app'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Maps any locale-ish string (a stored value, a URL segment, a browser tag) to
 * a supported locale. Anything unknown safely falls back to Thai.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const v = value.trim().toLowerCase();
  if (v === 'th' || v.startsWith('th-')) return 'th';
  if (v === 'en' || v.startsWith('en-')) return 'en';
  // Simplified Chinese only. Traditional variants are not offered and fall back.
  if (v === 'zh' || v === 'zh-cn' || v === 'zh-hans' || v === 'zh-sg') return 'zh-CN';
  return DEFAULT_LOCALE;
}

/** The locale encoded in a pathname (`/en/...` → en). */
export function localeFromPath(pathname: string): Locale {
  for (const locale of LOCALES) {
    const { prefix } = LOCALE_META[locale];
    if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) return locale;
  }
  return DEFAULT_LOCALE;
}

/** Removes a locale prefix: `/en/departments` → `/departments`, `/zh` → `/`. */
export function stripLocale(pathname: string): string {
  const { prefix } = LOCALE_META[localeFromPath(pathname)];
  if (!prefix) return pathname || '/';
  return pathname.slice(prefix.length) || '/';
}

/**
 * Builds the locale's version of an internal path. Accepts a path with an
 * optional hash (`/#why-core`, `/departments#sales`). External URLs and
 * unlocalized areas are returned unchanged.
 */
export function localizePath(to: string, locale: Locale): string {
  if (!to.startsWith('/')) return to;
  const { prefix } = LOCALE_META[locale];
  if (!prefix) return to;
  const hashAt = to.indexOf('#');
  const path = hashAt === -1 ? to : to.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : to.slice(hashAt);
  if (UNLOCALIZED.some((p) => path === p || path.startsWith(`${p}/`))) return to;
  return `${prefix}${path === '/' ? '' : path}${hash}`;
}

/** The same page in another locale (used by the language selector). */
export function switchLocalePath(pathname: string, hash: string, target: Locale): string {
  return localizePath(`${stripLocale(pathname)}${hash}`, target);
}
