import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';

const ProductWindow = lazy(() => import('../product/ProductWindow'));

/** Rows of the product UI the data lines settle onto (fractions of the window height). */
const RULES = [0.06, 0.2, 0.38, 0.56, 0.74, 0.9];

function Rule({ progress, index }: { progress: MotionValue<number>; index: number }) {
  // Lines leave the CORE node bunched together, then flatten and spread into interface rules.
  const y = useTransform(progress, [0.05, 0.5], ['0%', `${RULES[index]! * 100}%`]);
  const scaleX = useTransform(progress, [0.05, 0.45], [0.04, 1]);
  const opacity = useTransform(progress, [0.05, 0.2, 0.55, 0.7], [0, 0.7, 0.5, 0]);
  return (
    <motion.span
      aria-hidden
      style={{ top: y, scaleX, opacity }}
      className="absolute inset-x-0 h-px origin-center bg-gradient-to-r from-transparent via-brand-glow to-transparent"
    />
  );
}

/**
 * Story stage 4 — from concept to product. A CORE node opens into the actual
 * EP02 workspace UI: data connections flatten into interface lines, the node
 * expands (clip-path circle) into the window. Scroll-linked, native scrolling,
 * final state shown immediately under reduced motion.
 */
export function ProductTransitionSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const clip = useTransform(
    scrollYProgress,
    [0.3, 0.85],
    ['circle(2.5% at 50% 0%)', 'circle(150% at 50% 0%)'],
  );
  const nodeOpacity = useTransform(scrollYProgress, [0.25, 0.6], [1, 0]);
  const windowY = useTransform(scrollYProgress, [0.3, 1], [24, 0]);

  return (
    <section
      ref={ref}
      id="from-core-to-product"
      data-slide="workspace"
      aria-labelledby="product-transition-title"
      className="relative py-24 sm:py-32"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold tracking-[0.18em] text-brand-glow uppercase">
            <span className="text-text-muted tabular">04</span> · Workspace — from concept to
            product
          </p>
          <h2 id="product-transition-title" className="mt-4 text-h2 text-text-primary">
            จากแนวคิด สู่หน้าจอที่ใช้งานจริง
          </h2>
          <p className="mt-4 text-body-lg text-text-secondary">
            นี่คือพื้นที่ทำงานคลังสินค้าของ PDA BLISS CORE
            ประกอบจากชิ้นส่วนเดียวกับระบบที่ผู้ใช้เห็นหลังเข้าสู่ระบบ — เห็นเฉพาะจำนวน Lot และวันที่
            ตามสิทธิ์ของแผนก
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-6xl">
          {/* The CORE node that opens into the product */}
          {!reduce && (
            <motion.span
              aria-hidden
              style={{ opacity: nodeOpacity }}
              className="absolute top-0 left-1/2 z-10 size-4 -translate-1/2 rounded-full bg-brand-glow shadow-glow-md"
            />
          )}
          {!reduce && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
              {RULES.map((_, i) => (
                <Rule key={i} progress={scrollYProgress} index={i} />
              ))}
            </div>
          )}
          <motion.figure
            aria-label="ตัวอย่างหน้าจอพื้นที่ทำงานคลังสินค้าของ PDA BLISS CORE (ข้อมูลตัวอย่าง)"
            style={reduce ? undefined : { clipPath: clip, y: windowY }}
            className="relative"
          >
            <div inert>
              <Suspense
                fallback={
                  <div className="aspect-[16/10] rounded-[1.375rem] border border-line-strong bg-canvas" />
                }
              >
                <ProductWindow />
              </Suspense>
            </div>
            <figcaption className="mt-4 text-center text-caption text-text-muted">
              ข้อมูลในภาพเป็นตัวอย่าง · หน้าจอจริงจากระบบออกแบบเดียวกับพื้นที่ทำงานทั้ง 7 แผนก
            </figcaption>
          </motion.figure>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/departments"
            className="group inline-flex items-center gap-2 text-label font-medium text-brand-glow"
          >
            ดูพื้นที่ทำงานของทุกแผนก
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </Container>
    </section>
  );
}
