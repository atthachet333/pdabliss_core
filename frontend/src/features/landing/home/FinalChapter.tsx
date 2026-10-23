import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { Reveal } from '@/motion/Reveal';
import { ChapterMark } from './ChapterMark';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';

const th = {
  titleA: 'ระบบที่ดีควรเข้ากับวิธีที่องค์กรของคุณทำงาน',
  titleB: 'ไม่ใช่บังคับให้องค์กรทำงานตามระบบ',
  lead: 'เล่าให้เราฟังว่าวันนี้แต่ละแผนกทำงานอย่างไร แล้วเราจะช่วยดูว่า CORE จะเริ่มจากตรงไหน',
  consult: 'ขอคำปรึกษา',
  explore: 'สำรวจ CORE เพิ่มเติม',
  departments: 'ดูแผนกทั้งหมด',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    titleA: 'A good system should fit the way your organization works',
    titleB: 'not force your organization to work the system’s way',
    lead: 'Tell us how each department works today, and we’ll help you see where CORE should begin.',
    consult: 'Request a consultation',
    explore: 'Explore CORE further',
    departments: 'See all departments',
  },
  'zh-CN': {
    titleA: '好的系统应该适应企业的工作方式',
    titleB: '而不是强迫企业去适应系统',
    lead: '告诉我们各部门今天如何工作，我们将帮您判断 CORE 应从哪里开始。',
    consult: '申请咨询',
    explore: '进一步了解 CORE',
    departments: '查看全部部门',
  },
};

/**
 * Chapter 11 — begin. The CORE visual language returns quietly: orbits and a
 * breathing light behind the closing statement. CSS only (no second WebGL
 * canvas); the loops stop under reduced motion. No price.
 */
export function FinalChapter() {
  const c = useCopy(COPY);
  const { href } = useLocale();
  return (
    <section
      id="begin"
      aria-labelledby="begin-title"
      className="relative isolate overflow-hidden py-28 sm:py-40"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark">
        <div className="absolute top-1/2 left-1/2 size-[56rem] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 animate-spin-slower rounded-full border border-brand-glow/[0.07]" />
          <div className="absolute inset-[12%] animate-spin-slow rounded-full border border-dashed border-brand-glow/[0.1]" />
          <div className="absolute inset-[26%] rounded-full border border-brand-glow/[0.12]" />
          <div className="absolute inset-[40%] animate-core-breathe rounded-full bg-[radial-gradient(circle,rgb(62_240_192/0.22),rgb(25_195_154/0.06)_45%,transparent_70%)]" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <span
              key={deg}
              className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-brand-glow/50"
              style={{ transform: `rotate(${deg}deg) translateX(19.5rem)` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,transparent,var(--color-surface-dark)_80%)]" />
      </div>

      <Container>
        <div className="mx-auto max-w-4xl text-center">
          <ChapterMark id="begin" align="center" />
          <Reveal>
            <h2 id="begin-title" className="mt-8 text-display text-text-primary">
              {c.titleA}
              <span className="block text-gradient-brand">{c.titleB}</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-body-lg text-text-secondary">{c.lead}</p>
          </Reveal>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link to={href('/contact')} className={buttonClasses('primary', 'lg')}>
              {c.consult}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to={href('/features')} className={buttonClasses('secondary', 'lg')}>
              {c.explore}
            </Link>
          </div>
          <Link
            to={href('/departments')}
            className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            {c.departments}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
