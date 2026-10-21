import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowRight, Database, Gauge, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import type { PointerEvent } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Badge, Container } from '@/components/ui/Section';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { CoreUniverse } from '../universe/CoreUniverse';

const PILLARS = [
  { icon: Database, label: 'ข้อมูลชุดเดียว', sub: 'One source of truth' },
  { icon: Workflow, label: 'เวิร์กโฟลว์เชื่อมทุกแผนก', sub: 'Connected workflow' },
  { icon: GitBranch, label: 'มาตรฐานเดียวกัน', sub: 'Standardised process' },
  { icon: Gauge, label: 'เห็นสถานะเรียลไทม์', sub: 'Real-time operation' },
  { icon: ShieldCheck, label: 'ลดความผิดพลาดจากคน', sub: 'Error prevention' },
] as const;

const intro = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.reveal, ease: EASE_CORE, delay },
});

export function HeroSection() {
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, { stiffness: 40, damping: 18, mass: 0.8 });
  const pointerY = useSpring(rawY, { stiffness: 40, damping: 18, mass: 0.8 });

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    rawY.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onPointerLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden pt-24 sm:pt-28 lg:pt-32"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* Atmosphere — pure CSS so the hero renders fully even without image assets */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgb(25_195_154/0.16),transparent_65%),radial-gradient(ellipse_60%_50%_at_10%_90%,rgb(90_169_255/0.08),transparent_70%)]" />
        <picture>
          <source srcSet="/hero/atmosphere.avif" type="image/avif" />
          <img
            src="/hero/atmosphere.webp"
            alt=""
            width={1600}
            height={1000}
            fetchPriority="low"
            className="absolute inset-0 size-full object-cover opacity-40 mix-blend-screen"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </picture>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_60%_45%,black,transparent_75%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface-dark" />
      </div>

      <Container className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-4">
        <div className="relative z-10 max-w-[38rem] pt-4 lg:pt-0">
          <motion.div {...intro(0)}>
            <Badge>
              <span className="size-1.5 rounded-full bg-brand-glow shadow-glow-sm" aria-hidden />
              Department Operations Platform
            </Badge>
          </motion.div>
          <motion.h1
            id="hero-title"
            className="mt-6 text-display text-text-primary"
            {...intro(0.08)}
          >
            <span className="block">ทุกแผนกทำงานได้เต็มที่</span>
            <span className="block text-gradient-brand">ทุกงานเชื่อมเป็นระบบเดียว</span>
          </motion.h1>
          <motion.p className="mt-6 max-w-lg text-body-lg text-text-secondary" {...intro(0.16)}>
            PDA BLISS CORE ให้ฝ่ายขาย คลังสินค้า จัดซื้อ ปฏิบัติการ และบัญชี
            มีพื้นที่ทำงานที่ออกแบบมาเพื่องานของตัวเอง —
            ขณะที่ทุกขั้นตอนเชื่อมถึงกันบนข้อมูลชุดเดียวทั้งองค์กร
          </motion.p>
          <motion.div className="mt-9 flex flex-wrap items-center gap-3" {...intro(0.24)}>
            <motion.span whileTap={{ scale: 0.97 }} className="inline-flex">
              <a href="#preview" className={buttonClasses('primary', 'lg')}>
                <span className="relative inline-flex items-center gap-2">
                  ดูภาพรวมระบบ
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </a>
            </motion.span>
            <LinkButton to="/login" variant="secondary" size="lg" magnetic>
              เริ่มทดลองใช้
            </LinkButton>
          </motion.div>
        </div>

        <motion.div
          className="relative -mx-2 sm:mx-0"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE_CORE, delay: 0.1 }}
        >
          <CoreUniverse pointerX={pointerX} pointerY={pointerY} />
        </motion.div>
      </Container>

      <Container className="relative z-10 pb-6">
        <motion.ul
          aria-label="สิ่งที่ CORE เป็นศูนย์กลาง"
          className="-mx-4 no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:gap-0 lg:overflow-visible lg:rounded-card lg:border lg:border-border-soft lg:surface-glass"
          {...intro(0.4)}
        >
          {PILLARS.map(({ icon: Icon, label, sub }, i) => (
            <li
              key={label}
              className={
                'flex min-w-[15rem] snap-start items-center gap-3 rounded-2xl border border-border-soft bg-surface-raised/50 px-4 py-4 lg:min-w-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5' +
                (i > 0 ? ' lg:border-l lg:border-border-soft' : '')
              }
            >
              <Icon className="size-5 shrink-0 text-brand-glow" aria-hidden />
              <span className="flex flex-col">
                <span className="text-label font-medium text-text-primary">{label}</span>
                <span className="text-caption text-text-muted">{sub}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}
