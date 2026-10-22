import { Compass, Orbit, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const BELIEFS = [
  {
    icon: Compass,
    title: 'เริ่มจากหน้างาน',
    body: 'ระบบที่ดีต้องตอบคำถามของคนทำงานก่อน — วันนี้ฉันต้องทำอะไร และงานไหนรอฉันอยู่',
  },
  {
    icon: Orbit,
    title: 'แยกหน้าที่ แต่ไม่แยกข้อมูล',
    body: 'แต่ละแผนกมีพื้นที่ของตัวเอง แต่ทุกตัวเลขมาจากเอกสารชุดเดียวกันทั้งองค์กร',
  },
  {
    icon: ShieldCheck,
    title: 'ป้องกันดีกว่าแก้ไข',
    body: 'กฎธุรกิจ การอนุมัติ และ audit trail ถูกออกแบบให้ความผิดพลาดเกิดขึ้นยากตั้งแต่แรก',
  },
];

export default function AboutPage() {
  usePageMeta('เกี่ยวกับเรา', `${SITE.name} พัฒนาโดย ${SITE.company}`);
  return (
    <>
      <PageHero
        eyebrow="About"
        title="เราสร้าง CORE เพื่อให้ทุกแผนกทำงานต่อกันได้อย่างราบรื่น"
        lead={`${SITE.name} พัฒนาโดย ${SITE.company} เป็นผลิตภัณฑ์ที่แยกจาก PDA ONE โดยมุ่งเน้นการทำงานระดับแผนก บทบาท และเวิร์กโฟลว์`}
      />
      <Container className="pb-24">
        <Reveal stagger id="approach" className="grid gap-5 md:grid-cols-3">
          {BELIEFS.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title} className="rounded-card border border-border-soft bg-surface-base/80 p-7">
              <Icon className="size-7 text-brand-glow" aria-hidden />
              <h2 className="mt-5 text-h3 text-text-primary">{title}</h2>
              <p className="mt-3 text-body text-text-secondary">{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </>
  );
}
