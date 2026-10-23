import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

type Kind = 'privacy' | 'terms';

const th = {
  privacy: 'นโยบายความเป็นส่วนตัว',
  terms: 'ข้อกำหนดการใช้งาน',
  lead: (title: string) =>
    `เอกสาร${title}ฉบับทางการของ ${SITE.company} อยู่ระหว่างจัดทำ และจะเผยแพร่ก่อนเปิดให้บริการเชิงพาณิชย์`,
  body: 'เว็บไซต์ในช่วงพัฒนานี้ไม่มีการเก็บข้อมูลส่วนบุคคลผ่านแบบฟอร์ม และไม่มีการใช้คุกกี้เพื่อการติดตาม',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    lead: (title) =>
      `The official ${title} of ${SITE.company} is being prepared and will be published before commercial launch.`,
    body: 'During this development phase, the website collects no personal data through forms and uses no tracking cookies.',
  },
  'zh-CN': {
    privacy: '隐私政策',
    terms: '使用条款',
    lead: (title) => `${SITE.company} 的正式${title}正在制定中，将在商业发布前公布。`,
    body: '在当前开发阶段，本网站不通过表单收集个人数据，也不使用追踪类 Cookie。',
  },
};

export default function LegalPage({ kind }: { kind: Kind }) {
  const c = useCopy(COPY);
  const title = c[kind];
  usePageMeta(title);
  return (
    <>
      <PageHero eyebrow={kind === 'privacy' ? 'Privacy' : 'Terms'} title={title} lead={c.lead(title)} />
      <Container className="pb-24">
        <p className="max-w-2xl text-body text-text-secondary">{c.body}</p>
      </Container>
    </>
  );
}
