import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useMediaQuery } from '@/components/core/hooks';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { CoreStage } from '../core-world/CoreStage';
import { DepartmentDetail, DepartmentSelector } from '../core-world/DepartmentSelector';
import type { OrbitDepartmentId } from '../core-world/types';

/** Staggered DOM intro; under reduced motion everything is simply present. */
function useIntro() {
  const reduce = useReducedMotion();
  return (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: DURATION.reveal, ease: EASE_CORE, delay },
        };
}

/** In-page anchor styled as a button, with a restrained magnetic pull (mouse only). */
function HeroCta({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'primary' | 'secondary';
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const x = useSpring(rx, { stiffness: 220, damping: 26 });
  const y = useSpring(ry, { stiffness: 220, damping: 26 });
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    rx.set(((e.clientX - r.left) / r.width - 0.5) * 6);
    ry.set(((e.clientY - r.top) / r.height - 0.5) * 6);
  };
  return (
    <motion.a
      href={href}
      style={{ x, y }}
      onPointerMove={move}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      whileTap={{ scale: 0.98 }}
      className={buttonClasses(variant, 'lg')}
    >
      {variant === 'primary' && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:animate-sweep"
        />
      )}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.a>
  );
}

/**
 * Slide 01 — the CORE World hero (design-locked composition).
 *
 * The opening is a stable, presentation-style scene: the CORE stays anchored;
 * the pointer only moves light, a deliberate drag rotates the world, hover and
 * click focus a department. Scrolling — never the pointer — moves on to the
 * next slide.
 * Desktop (≥ 1024px): copy left, CORE stage right, one viewport tall.
 * Phone / tablet: headline → copy → CTAs → CORE scene → department selector → detail.
 */
export function HeroExperience() {
  const intro = useIntro();
  const reduce = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [hovered, setHovered] = useState<OrbitDepartmentId | null>(null);
  const [selected, setSelected] = useState<OrbitDepartmentId | null>(null);

  const select = useCallback((id: OrbitDepartmentId | null) => {
    setSelected(id);
    setHovered(null);
  }, []);

  // Moving from a 3D node onto its DOM label (or back) reports "leave" from one
  // and "enter" on the other in either order — clearing is deferred briefly so
  // the hover never flickers off between them.
  const clearTimer = useRef<number | undefined>(undefined);
  const hover = useCallback((id: OrbitDepartmentId | null) => {
    window.clearTimeout(clearTimer.current);
    if (id) setHovered(id);
    else clearTimer.current = window.setTimeout(() => setHovered(null), 80);
  }, []);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  // Escape closes the open department (from the canvas, the selector or the panel).
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  const active = hovered ?? selected;
  const detail = (
    <DepartmentDetail
      id={active}
      selected={selected !== null && active === selected}
      onClose={() => select(null)}
    />
  );

  return (
    <div
      id="core-world"
      data-slide="core"
      className="relative isolate overflow-x-clip lg:h-svh lg:min-h-[42rem]"
    >
      {/* Atmosphere: deep navy, emerald light behind the CORE, radial structure, grain. Static. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-clip">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#03080d_0%,#050b12_45%,#050b12_100%)]" />
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_68%_42%,rgb(25_195_154/0.13),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_72%_46%,rgb(43_181_168/0.10),transparent_70%),radial-gradient(ellipse_50%_40%_at_8%_96%,rgb(90_169_255/0.05),transparent_70%)]" />
          <svg
            className="absolute top-1/2 right-[-12%] size-[110vh] -translate-y-1/2 opacity-[0.07] max-lg:hidden"
            viewBox="0 0 200 200"
          >
            {[30, 48, 66, 84, 98].map((r) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="#b9f5e4"
                strokeWidth="0.15"
              />
            ))}
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={100 + Math.cos(a) * 30}
                  y1={100 + Math.sin(a) * 30}
                  x2={100 + Math.cos(a) * 98}
                  y2={100 + Math.sin(a) * 98}
                  stroke="#b9f5e4"
                  strokeWidth="0.08"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-[0.035] mix-blend-overlay" />
        </div>
      </div>

      {/* ---------- Hero copy ---------- */}
      <section
        aria-labelledby="hero-title"
        className="relative z-10 pt-28 pb-8 sm:pt-32 lg:pointer-events-none lg:min-h-svh lg:pt-[max(8.5rem,17svh)] lg:pb-0"
      >
        <Container>
          {/* The section spans the stage on desktop; only the copy column takes pointer
              events so the CORE beneath stays draggable and hoverable. */}
          <div className="max-w-[36rem] lg:pointer-events-auto lg:max-w-[42%] xl:max-w-[41%]">
            <motion.p
              className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-surface-base/50 px-3 py-1 text-caption font-medium tracking-[0.14em] text-brand-soft uppercase"
              {...intro(0.1)}
            >
              <span className="size-1.5 rounded-full bg-brand-glow shadow-glow-sm" aria-hidden />
              Department Operations Platform
            </motion.p>
            <motion.h1
              id="hero-title"
              className="mt-6 text-display text-text-primary lg:text-[clamp(2.5rem,3.25vw,3.5rem)]"
              {...intro(0.2)}
            >
              <span className="block">ทุกแผนกทำงานได้เต็มที่</span>
              <span className="block text-gradient-brand">ทุกงานเชื่อมเป็นระบบเดียว</span>
            </motion.h1>
            <motion.p
              className="mt-6 max-w-[34rem] text-body-lg text-text-secondary"
              {...intro(0.32)}
            >
              PDA BLISS CORE ให้แต่ละแผนกมีพื้นที่ทำงานที่ออกแบบมาเพื่องานของตัวเอง และเชื่อมข้อมูล
              งาน และขั้นตอนของทั้งองค์กรไว้ในระบบเดียว
            </motion.p>
            <motion.div className="mt-9 flex flex-wrap items-center gap-3" {...intro(0.45)}>
              <HeroCta href="#preview" variant="primary">
                ดูภาพรวมระบบ
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </HeroCta>
              <HeroCta href="#core-story" variant="secondary">
                สำรวจ CORE
                <ArrowDown className="size-4" aria-hidden />
              </HeroCta>
            </motion.div>
            {/* Desktop: department detail sits beside the world, never over a node. */}
            {desktop && <div className="mt-10 lg:min-h-48">{detail}</div>}
          </div>
        </Container>
      </section>

      {/* ---------- CORE stage: anchored right on desktop, inline on phone/tablet ---------- */}
      <div className="lg:pointer-events-none lg:absolute lg:inset-y-0 lg:-right-8 lg:w-[60%] xl:w-[62%]">
        <motion.div
          className="relative lg:pointer-events-auto lg:h-full"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: EASE_CORE, delay: 0.1 }}
        >
          <figure
            aria-label="CORE Universe: ฝ่ายขาย ปฏิบัติการ คลังสินค้า จัดซื้อ บัญชี และรายงาน เชื่อมเข้าสู่ PDA BLISS CORE ศูนย์กลางข้อมูลชุดเดียว"
            className="relative mx-auto h-[min(24rem,92vw)] w-full sm:h-[30rem] md:h-[34rem] lg:h-full"
          >
            <CoreStage hovered={hovered} selected={selected} onHover={hover} onSelect={select} />
            <figcaption className="sr-only">
              ใช้ปุ่มแผนกด้านล่างเพื่อดูว่าแต่ละแผนกเชื่อมกับ CORE อย่างไร
            </figcaption>
          </figure>

          {/* Selector: below the scene on phones, over the stage foot on desktop. */}
          <div className="relative z-20 px-4 sm:px-6 lg:absolute lg:inset-x-10 lg:bottom-10 lg:px-0 xl:inset-x-16">
            <div className="mx-auto flex max-w-xl flex-col gap-3 lg:max-w-2xl">
              <DepartmentSelector
                hovered={hovered}
                selected={selected}
                onHover={hover}
                onSelect={select}
              />
              {!desktop && detail}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
