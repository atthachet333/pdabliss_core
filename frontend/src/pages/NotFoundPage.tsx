import { LinkButton } from '@/components/ui/Button';
import { usePageMeta } from '@/lib/usePageMeta';

export default function NotFoundPage() {
  usePageMeta('ไม่พบหน้านี้');
  return (
    <section className="flex min-h-[70dvh] flex-col items-center justify-center px-4 pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-h1 text-text-primary">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="mt-4 max-w-md text-body text-text-secondary">
        หน้านี้อาจถูกย้าย หรือยังไม่เปิดให้บริการ
      </p>
      <div className="mt-8">
        <LinkButton to="/">กลับหน้าแรก</LinkButton>
      </div>
    </section>
  );
}
