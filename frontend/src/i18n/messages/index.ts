import type { Locale } from '../locales';
import type { ShellMessages } from '../types';
import { th } from './th';

/*
 * Thai ships in the main bundle (default locale). English and Simplified
 * Chinese are separate chunks, loaded by their route before it renders
 * (app/router.tsx), so Thai visitors never download them.
 */

const loaded: Partial<Record<Locale, ShellMessages>> = { th };

const loaders: Record<Exclude<Locale, 'th'>, () => Promise<ShellMessages>> = {
  en: () => import('./en').then((m) => m.en),
  'zh-CN': () => import('./zh-CN').then((m) => m.zhCN),
};

export async function loadMessages(locale: Locale): Promise<ShellMessages> {
  const ready = loaded[locale];
  if (ready) return ready;
  const messages = await loaders[locale as Exclude<Locale, 'th'>]();
  loaded[locale] = messages;
  return messages;
}

/** The dictionary for `locale` if loaded; Thai otherwise. */
export function getMessages(locale: Locale): ShellMessages {
  return loaded[locale] ?? th;
}

export function isLoaded(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}
