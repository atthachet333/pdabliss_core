import { useEffect } from 'react';
import { SITE } from '@/config/site';
import { useLocale } from '@/i18n/useLocale';
import type { Localized } from '@/i18n/useCopy';

const DEFAULTS: Localized<{ home: string; description: string }> = {
  th: { home: 'แพลตฟอร์มปฏิบัติการสำหรับทุกแผนก', description: SITE.defaultDescription },
  en: {
    home: 'Department Operations Platform',
    description:
      'PDA BLISS CORE is a department operations platform: every department gets its own workspace, and every step is connected through one shared set of data.',
  },
  'zh-CN': {
    home: '面向所有部门的运营平台',
    description:
      'PDA BLISS CORE 部门运营平台：每个部门拥有自己的工作空间，所有环节通过同一套数据相连。',
  },
};

function setMeta(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

/**
 * Sets the document title and description for the current route. Pass
 * localized strings; the defaults follow the public locale (Thai first).
 */
export function usePageMeta(title: string | null, description?: string) {
  const { locale } = useLocale();
  const d = DEFAULTS[locale];
  const desc = description ?? d.description;
  useEffect(() => {
    const full = title ? `${title} | ${SITE.name}` : `${SITE.name} — ${d.home}`;
    document.title = full;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', full);
    setMeta('meta[property="og:description"]', desc);
  }, [title, desc, d.home]);
}
