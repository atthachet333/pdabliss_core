import { motion } from 'framer-motion';
import { lazy, Suspense, type CSSProperties } from 'react';
import { Container } from '@/components/ui/Section';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { WORLDS } from './worlds';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const ExecutivePreview = lazy(() =>
  import('./previews').then((m) => ({ default: m.ExecutivePreview })),
);

const SIGNALS = WORLDS.filter((w) => w.id !== 'executive');

const POINTS = [
  {
    t: 'เห็นภาพรวมโดยไม่ต้องถามทีละคน',
    b: 'สถานะของทุกแผนกมาจากงานจริงที่บันทึกอยู่แล้ว ไม่ใช่รายงานที่ต้องรวบรวมทุกสิ้นเดือน',
  },
  {
    t: 'ตัดสินใจจากข้อยกเว้น',
    b: 'สิ่งที่ปกติไม่ต้องรบกวน — ผู้บริหารเห็นเฉพาะเรื่องที่ล่าช้า เสี่ยง หรือรอการตัดสินใจ',
  },
  { t: 'ลงรายละเอียดได้ถึงต้นทาง', b: 'ทุกสัญญาณย้อนกลับไปถึงเอกสารและแผนกที่เกี่ยวข้องได้' },
];

/**
 * Chapter 08 — the command view. Department signals converge on one point
 * and become the executive workspace (real EP02 components, sample data,
 * qualitative states only — no invented financial figures).
 */
export function ExecutiveChapter() {
  const reduce = usePrefersReducedMotion();
  const draw = (i: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 1 },
          viewport: { once: true, amount: 0.5 },
          transition: { duration: 1.4, ease: EASE_CORE, delay: i * 0.12 },
        };

  return (
    <section
      id="executive"
      aria-labelledby="executive-title"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_80%_55%,rgb(62_224_180/0.08),transparent_70%)]" />
      </div>
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
          <div>
            <ChapterMark id="executive" />
            <h2 id="executive-title" className="mt-6 text-h1 text-text-primary">
              ข้อมูลจากทุกแผนก
              <span className="block text-text-secondary">กลายเป็นภาพเดียวสำหรับผู้บริหาร</span>
            </h2>
            <dl className="mt-10 space-y-6">
              {POINTS.map((p) => (
                <div key={p.t} className="border-l border-brand-glow/30 pl-5">
                  <dt className="text-label font-medium text-text-primary">{p.t}</dt>
                  <dd className="mt-1 text-caption text-text-secondary">{p.b}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            {/* Five department signals converge into the command view. */}
            <div aria-hidden className="relative mb-4 flex items-end gap-3 lg:mb-0 lg:h-36">
              <svg
                viewBox="0 0 600 140"
                preserveAspectRatio="none"
                className="absolute inset-0 hidden size-full lg:block"
              >
                {SIGNALS.map((w, i) => {
                  const x = 40 + i * 130;
                  return (
                    <motion.path
                      key={w.id}
                      d={`M ${x} 24 C ${x} 90, 300 70, 300 140`}
                      fill="none"
                      stroke={w.accent}
                      strokeOpacity="0.7"
                      strokeWidth="1.5"
                      {...draw(i)}
                    />
                  );
                })}
              </svg>
              <ul className="relative flex w-full flex-wrap gap-2 lg:absolute lg:top-0 lg:grid lg:grid-cols-5">
                {SIGNALS.map((w) => (
                  <li
                    key={w.id}
                    style={{ '--a': w.accent } as CSSProperties}
                    className="flex items-center justify-center gap-1.5 truncate rounded-full border border-[color-mix(in_oklab,var(--a)_40%,transparent)] bg-surface-dark px-2 py-1 text-[0.6875rem] text-text-secondary"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--a)]" />
                    <span className="truncate">{w.nameTh}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figure aria-label="ตัวอย่างหน้าจอภาพรวมผู้บริหาร (ข้อมูลตัวอย่าง)">
              <div
                aria-hidden
                inert
                className="pointer-events-none h-[24rem] select-none sm:h-[27rem]"
              >
                <Suspense
                  fallback={
                    <div className="h-full rounded-[1.25rem] border border-line bg-canvas/80" />
                  }
                >
                  <ExecutivePreview />
                </Suspense>
              </div>
              <figcaption className="mt-3 text-caption text-text-muted">
                หน้าจอจริงจากระบบต้นแบบ แสดงสถานะด้วยข้อมูลตัวอย่าง — ไม่ใช่ตัวเลขขององค์กรใด
              </figcaption>
            </figure>
          </div>
        </div>
      </Container>
    </section>
  );
}
