import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { Reveal } from '@/motion/Reveal';
import { ChapterMark } from './ChapterMark';

/**
 * Chapter 11 — begin. The CORE visual language returns quietly: orbits and a
 * breathing light behind the closing statement. CSS only (no second WebGL
 * canvas); the loops stop under reduced motion. No price.
 */
export function FinalChapter() {
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
              ระบบที่ดีควรเข้ากับวิธีที่องค์กรของคุณทำงาน
              <span className="block text-gradient-brand">ไม่ใช่บังคับให้องค์กรทำงานตามระบบ</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-body-lg text-text-secondary">
              เล่าให้เราฟังว่าวันนี้แต่ละแผนกทำงานอย่างไร แล้วเราจะช่วยดูว่า CORE จะเริ่มจากตรงไหน
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link to="/contact" className={buttonClasses('primary', 'lg')}>
              ขอคำปรึกษา
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/features" className={buttonClasses('secondary', 'lg')}>
              สำรวจ CORE เพิ่มเติม
            </Link>
          </div>
          <Link
            to="/departments"
            className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            ดูแผนกทั้งหมด
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
