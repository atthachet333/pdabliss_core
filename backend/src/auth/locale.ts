import type { AppLocale } from '../generated/prisma/enums.js';
import type { MailLocale } from '../mail/templates.js';

/** API locale codes ↔ the database enum (Prisma enums cannot contain "-"). */
export const API_LOCALES = ['th', 'en', 'zh-CN'] as const;
export type ApiLocale = (typeof API_LOCALES)[number];

export function toDbLocale(locale: ApiLocale | undefined): AppLocale {
  return locale === 'zh-CN' ? 'zh_CN' : (locale ?? 'th');
}

export function toApiLocale(locale: AppLocale): ApiLocale {
  return locale === 'zh_CN' ? 'zh-CN' : locale;
}

/** The recipient's language for email; Thai when unknown. */
export function mailLocale(locale: AppLocale | null | undefined): MailLocale {
  return locale ? toApiLocale(locale) : 'th';
}
