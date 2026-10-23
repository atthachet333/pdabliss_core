import { LinkButton } from '@/components/ui/Button';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

const th = {
  meta: 'ไม่พบหน้านี้',
  title: 'ไม่พบหน้าที่คุณต้องการ',
  body: 'หน้านี้อาจถูกย้าย หรือยังไม่เปิดให้บริการ',
  home: 'กลับหน้าแรก',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    meta: 'Page not found',
    title: 'We couldn’t find that page',
    body: 'It may have moved, or it is not available yet.',
    home: 'Back to home',
  },
  'zh-CN': {
    meta: '页面不存在',
    title: '找不到您要访问的页面',
    body: '该页面可能已移动，或尚未开放。',
    home: '返回首页',
  },
};

export default function NotFoundPage() {
  const c = useCopy(COPY);
  const { href } = useLocale();
  usePageMeta(c.meta);
  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center px-4 pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-h1 text-text-primary">{c.title}</h1>
      <p className="mt-4 max-w-md text-body text-text-secondary">{c.body}</p>
      <div className="mt-8">
        <LinkButton to={href('/')}>{c.home}</LinkButton>
      </div>
    </section>
  );
}
