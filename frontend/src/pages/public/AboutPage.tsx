import { Compass, Orbit, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';

const ICONS = [Compass, Orbit, ShieldCheck];

const th = {
  metaTitle: 'เกี่ยวกับเรา',
  metaDescription: `${SITE.name} พัฒนาโดย ${SITE.company}`,
  title: 'เราสร้าง CORE เพื่อให้ทุกแผนกทำงานต่อกันได้อย่างราบรื่น',
  lead: `${SITE.name} พัฒนาโดย ${SITE.company} เป็นผลิตภัณฑ์ที่แยกจาก PDA ONE โดยมุ่งเน้นการทำงานระดับแผนก บทบาท และเวิร์กโฟลว์`,
  beliefs: [
    {
      title: 'เริ่มจากหน้างาน',
      body: 'ระบบที่ดีต้องตอบคำถามของคนทำงานก่อน — วันนี้ฉันต้องทำอะไร และงานไหนรอฉันอยู่',
    },
    {
      title: 'แยกหน้าที่ แต่ไม่แยกข้อมูล',
      body: 'แต่ละแผนกมีพื้นที่ของตัวเอง แต่ทุกตัวเลขมาจากเอกสารชุดเดียวกันทั้งองค์กร',
    },
    {
      title: 'ป้องกันดีกว่าแก้ไข',
      body: 'กฎธุรกิจ การอนุมัติ และ audit trail ถูกออกแบบให้ความผิดพลาดเกิดขึ้นยากตั้งแต่แรก',
    },
  ],
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    metaTitle: 'About us',
    metaDescription: `${SITE.name} is developed by ${SITE.company}`,
    title: 'We built CORE so every department can hand work to the next, smoothly',
    lead: `${SITE.name} is developed by ${SITE.company}. It is a separate product from PDA ONE, focused on departments, roles and workflows.`,
    beliefs: [
      {
        title: 'Start where the work happens',
        body: 'A good system answers the people doing the work first — what do I need to do today, and which work is waiting for me?',
      },
      {
        title: 'Separate duties, not data',
        body: 'Each department has its own space, but every number comes from the same documents across the organization.',
      },
      {
        title: 'Prevent rather than fix',
        body: 'Business rules, approvals and the audit trail are designed so mistakes are hard to make in the first place.',
      },
    ],
  },
  'zh-CN': {
    metaTitle: '关于我们',
    metaDescription: `${SITE.name} 由 ${SITE.company} 开发`,
    title: '我们打造 CORE，让每个部门都能顺畅地衔接工作',
    lead: `${SITE.name} 由 ${SITE.company} 开发，是独立于 PDA ONE 的产品，专注于部门、角色与工作流。`,
    beliefs: [
      {
        title: '从工作现场出发',
        body: '好的系统首先要回答一线人员的问题——我今天要做什么？哪些工作在等我？',
      },
      {
        title: '职责分开，数据不分开',
        body: '每个部门有自己的空间，但所有数字都来自全公司同一套单据。',
      },
      {
        title: '预防胜于补救',
        body: '业务规则、审批与审计记录的设计，让错误从一开始就难以发生。',
      },
    ],
  },
};

export default function AboutPage() {
  const c = useCopy(COPY);
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="About" title={c.title} lead={c.lead} />
      <Container className="pb-24">
        <Reveal stagger id="approach" className="grid gap-5 md:grid-cols-3">
          {c.beliefs.map(({ title, body }, i) => {
            const Icon = ICONS[i]!;
            return (
              <RevealItem
                key={i}
                className="rounded-card border border-border-soft bg-surface-base/80 p-7"
              >
                <Icon className="size-7 text-brand-glow" aria-hidden />
                <h2 className="mt-5 text-h3 text-text-primary">{title}</h2>
                <p className="mt-3 text-body text-text-secondary">{body}</p>
              </RevealItem>
            );
          })}
        </Reveal>
      </Container>
    </>
  );
}
