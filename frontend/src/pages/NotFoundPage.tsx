import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { LinkButton } from '@/components/ui/Button';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

const th = {
  meta: 'ไม่พบหน้านี้',
  description: 'ไม่พบหน้าที่ต้องการบนเว็บไซต์ PDA BLISS CORE',
  title: 'ไม่พบหน้าที่คุณต้องการ',
  body: 'หน้านี้อาจถูกย้าย หรือยังไม่เปิดให้บริการ',
  home: 'กลับหน้าแรก',
  onward: 'หรือไปต่อที่',
  resources: 'คลังความรู้ CORE',
  contact: 'ติดต่อทีม PDA BLISS',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    meta: 'Page not found',
    description: 'This page could not be found on the PDA BLISS CORE website.',
    title: 'We couldn’t find that page',
    body: 'It may have moved, or it is not available yet.',
    home: 'Back to home',
    onward: 'Or continue to',
    resources: 'the CORE Resource Center',
    contact: 'Contact the PDA BLISS team',
  },
  'zh-CN': {
    meta: '页面不存在',
    description: '在 PDA BLISS CORE 网站上找不到该页面。',
    title: '找不到您要访问的页面',
    body: '该页面可能已移动，或尚未开放。',
    home: '返回首页',
    onward: '或者前往',
    resources: 'CORE 资源中心',
    contact: '联系 PDA BLISS 团队',
  },
};

/**
 * The public 404, inside the public shell and in the visitor's locale. It is
 * `noindex` with no canonical (EP17) and offers a few useful ways onward.
 */
export default function NotFoundPage() {
  const c = useCopy(COPY);
  const { href } = useLocale();
  usePageMeta(c.meta, c.description, { index: false });
  return (
    <section
      data-not-found
      className="flex min-h-[70dvh] flex-col items-center justify-center px-4 pt-24 text-center"
    >
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-h1 text-text-primary">{c.title}</h1>
      <p className="mt-4 max-w-md text-body text-text-secondary">{c.body}</p>
      <div className="mt-8">
        <LinkButton to={href('/')}>{c.home}</LinkButton>
      </div>
      <p className="mt-8 text-caption text-text-muted">{c.onward}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-x-6">
        {/* Plain links: this page ships in the entry bundle, so it avoids feature modules. */}
        {(
          [
            ['/resources', c.resources],
            ['/contact', c.contact],
          ] as const
        ).map(([to, label]) => (
          <Link
            key={to}
            to={href(to)}
            className="group inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft underline-offset-4 hover:underline"
          >
            {label}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
