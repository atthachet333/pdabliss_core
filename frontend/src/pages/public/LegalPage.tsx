import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { usePageMeta } from '@/lib/usePageMeta';

const COPY = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'นโยบายความเป็นส่วนตัว',
  },
  terms: {
    eyebrow: 'Terms',
    title: 'ข้อกำหนดการใช้งาน',
  },
} as const;

export default function LegalPage({ kind }: { kind: keyof typeof COPY }) {
  const copy = COPY[kind];
  usePageMeta(copy.title);
  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        lead={`เอกสาร${copy.title}ฉบับทางการของ ${SITE.company} อยู่ระหว่างจัดทำ และจะเผยแพร่ก่อนเปิดให้บริการเชิงพาณิชย์`}
      />
      <Container className="pb-24">
        <p className="max-w-2xl text-body text-text-secondary">
          เว็บไซต์ในช่วงพัฒนานี้ไม่มีการเก็บข้อมูลส่วนบุคคลผ่านแบบฟอร์ม และไม่มีการใช้คุกกี้เพื่อการติดตาม
        </p>
      </Container>
    </>
  );
}
