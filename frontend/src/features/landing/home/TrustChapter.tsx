import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { SITE } from '@/config/site';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { Reveal } from '@/motion/Reveal';
import { ChapterMark } from './ChapterMark';

const LINK_TARGETS = ['/about', '/why-core', '/contact'] as const;

const th = {
  links: ['รู้จัก PDA BLISS', 'Why We Built CORE', 'ติดต่อเรา'],
  title: (company: string) => `เกี่ยวกับ ${company}`,
  quoteA: '“เราเชื่อว่าระบบที่ดีต้องเริ่มจากหน้างาน —',
  quoteB: 'เข้าใจว่าแต่ละแผนกทำงานอย่างไร ก่อนจะเชื่อมทุกแผนกเข้าด้วยกัน”',
  about: (name: string) =>
    `ผู้พัฒนา ${name} — แพลตฟอร์มปฏิบัติการระดับแผนก ที่ออกแบบจากงานจริงของฝ่ายขาย คลังสินค้า จัดซื้อ ปฏิบัติการ บัญชี และผู้บริหาร`,
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    links: ['About PDA BLISS', 'Why we built CORE', 'Contact us'],
    title: (company) => `About ${company}`,
    quoteA: '“We believe a good system starts where the work happens —',
    quoteB: 'understanding how each department works before connecting them all.”',
    about: (name) =>
      `The developer of ${name} — a department operations platform designed from the real work of sales, warehouse, purchasing, operations, accounting and executive teams.`,
  },
  'zh-CN': {
    links: ['了解 PDA BLISS', '我们为何打造 CORE', '联系我们'],
    title: (company) => `关于 ${company}`,
    quoteA: '“我们相信，好的系统必须从工作现场出发——',
    quoteB: '先理解每个部门如何工作，再把所有部门连接起来。”',
    about: (name) =>
      `${name} 的开发者——一个部门运营平台，基于销售、仓库、采购、运营、财务与管理层的真实工作而设计。`,
  },
};

/**
 * Chapter 10 — who stands behind CORE. Editorial and quiet: no logos wall,
 * no invented customers or certifications. A philosophy and a company name.
 */
export function TrustChapter() {
  const c = useCopy(COPY);
  const { href } = useLocale();
  const LINKS = LINK_TARGETS.map((to, i) => ({ to: href(to), label: c.links[i]! }));
  return (
    <section id="trust" aria-labelledby="trust-title" className="relative py-24 sm:py-36">
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark" />
      <Container>
        <div className="mx-auto max-w-4xl">
          <ChapterMark id="trust" tone="calm" />
          <h2 id="trust-title" className="sr-only">
            {c.title(SITE.company)}
          </h2>
          <Reveal>
            <blockquote className="mt-10">
              <p className="text-h1 leading-snug font-medium text-text-primary">
                {c.quoteA}
                <span className="text-text-secondary"> {c.quoteB}</span>
              </p>
            </blockquote>
          </Reveal>
          <div className="mt-12 grid gap-8 border-t border-border-soft pt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-caption font-semibold tracking-[0.22em] text-text-muted uppercase">
                {SITE.company}
              </p>
              <p className="mt-3 max-w-xl text-body text-text-secondary">{c.about(SITE.name)}</p>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-3 sm:flex-col sm:items-end">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="group inline-flex min-h-11 items-center gap-1.5 text-label text-text-primary underline-offset-4 hover:underline"
                  >
                    {l.label}
                    <ArrowUpRight
                      className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
