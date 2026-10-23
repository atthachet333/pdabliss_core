import type { Locale } from './locales';
import { useLocale } from './useLocale';

/*
 * Page content localization (EP05 revision).
 *
 * Public page copy lives next to the component that renders it, as one object
 * per locale. The Thai object is the source: declare it first and type the
 * whole record with `Localized<typeof th>` so English and Simplified Chinese
 * must have exactly the same shape.
 *
 *   const th = { title: 'แผนก', items: ['…'] };
 *   const COPY: Localized<typeof th> = { th, en: { … }, 'zh-CN': { … } };
 *   const c = useCopy(COPY);
 */

export type Localized<T> = Record<Locale, T>;

export function useCopy<T>(copy: Localized<T>): T {
  return copy[useLocale().locale];
}
