import { useEffect } from 'react';
import { useLocale } from '@/i18n/useLocale';
import { websiteSchema } from '@/lib/seo';

/** EP17: adds the homepage WebSite JSON-LD (see lib/seo.ts) while it is shown. */
export function WebSiteSchema() {
  const { locale } = useLocale();
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.schema = 'website';
    script.textContent = JSON.stringify(websiteSchema(locale));
    document.head.append(script);
    return () => script.remove();
  }, [locale]);
  return null;
}
