import { useEffect } from 'react';
import { SITE } from '@/config/site';

function setMeta(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

/** Sets the document title and description for the current route (Thai-first SEO). */
export function usePageMeta(title: string | null, description: string = SITE.defaultDescription) {
  useEffect(() => {
    const full = title
      ? `${title} | ${SITE.name}`
      : `${SITE.name} — แพลตฟอร์มปฏิบัติการสำหรับทุกแผนก`;
    document.title = full;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', full);
    setMeta('meta[property="og:description"]', description);
  }, [title, description]);
}
