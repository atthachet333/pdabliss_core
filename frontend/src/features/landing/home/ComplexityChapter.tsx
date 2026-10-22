import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import {
  CalendarX2,
  Copy,
  FileQuestion,
  Hourglass,
  MessagesSquare,
  Repeat,
  Stamp,
  Table2,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { ChapterMark } from './ChapterMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Organizational friction — abstract artefacts, no third-party brands. */
const FRAGMENTS: {
  icon: LucideIcon;
  title: string;
  note: string;
  /** Desktop placement (% of the field) and tilt. */
  x: number;
  y: number;
  r: number;
  /** Drift direction as the visitor scrolls. */
  dx: number;
  dy: number;
}[] = [
  {
    icon: Table2,
    title: 'ไฟล์ตารางกระจายอยู่ทุกทีม',
    note: 'ใครถือฉบับล่าสุด?',
    x: 2,
    y: 4,
    r: -4,
    dx: -18,
    dy: -10,
  },
  {
    icon: MessagesSquare,
    title: 'ไล่ถามสถานะในแชต',
    note: '“งานนี้ถึงไหนแล้วครับ”',
    x: 52,
    y: 0,
    r: 3,
    dx: 14,
    dy: -14,
  },
  {
    icon: Copy,
    title: 'ข้อมูลเดียวกันกรอกซ้ำหลายที่',
    note: 'ตัวเลขไม่ตรงกัน',
    x: 28,
    y: 20,
    r: -2,
    dx: -6,
    dy: -4,
  },
  {
    icon: FileQuestion,
    title: 'ไม่รู้ว่าเอกสารฉบับไหนถูกต้อง',
    note: 'v3_final_แก้ล่าสุด',
    x: 64,
    y: 24,
    r: 5,
    dx: 20,
    dy: 2,
  },
  {
    icon: Hourglass,
    title: 'งานรอโดยไม่มีเจ้าของ',
    note: 'ค้างมา 4 วัน',
    x: 0,
    y: 42,
    r: 3,
    dx: -22,
    dy: 6,
  },
  { icon: Stamp, title: 'การอนุมัติล่าช้า', note: 'รอลายเซ็น', x: 36, y: 44, r: -5, dx: 6, dy: 10 },
  {
    icon: Repeat,
    title: 'แผนกต้องถามกันเองตลอด',
    note: 'ส่งต่อหลายทอด',
    x: 14,
    y: 66,
    r: 4,
    dx: -10,
    dy: 16,
  },
  {
    icon: CalendarX2,
    title: 'สต็อกและวันหมดอายุ รู้เมื่อสายไป',
    note: 'พบตอนจะจ่ายของ',
    x: 60,
    y: 62,
    r: -3,
    dx: 16,
    dy: 18,
  },
  {
    icon: Unlink,
    title: 'ไม่มีร่องรอยว่าใครแก้อะไร',
    note: 'ย้อนดูไม่ได้',
    x: 40,
    y: 84,
    r: 6,
    dx: 24,
    dy: 6,
  },
];

function Fragment({
  f,
  index,
  progress,
  reduce,
}: {
  f: (typeof FRAGMENTS)[number];
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  // Fragmentation grows as the visitor moves through the chapter.
  const x = useTransform(progress, [0, 1], [0, reduce ? 0 : f.dx]);
  const y = useTransform(progress, [0, 1], [0, reduce ? 0 : f.dy]);
  const rotate = useTransform(progress, [0, 1], [f.r, reduce ? f.r : f.r * 1.8]);
  const Icon = f.icon;
  return (
    <motion.li
      style={{ ['--fx' as string]: `${f.x}%`, ['--fy' as string]: `${f.y}%`, x, y, rotate }}
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
      transition={{ duration: 0.6, delay: index * 0.06 }}
      className="relative w-full rounded-xl border border-[#7d97a8]/20 bg-[#0b141c]/90 p-3.5 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] sm:w-auto lg:absolute lg:top-[var(--fy)] lg:left-[var(--fx)] lg:w-[min(15rem,34%)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#7d97a8]/25 bg-[#101c26]">
          <Icon className="size-4 text-[#9db3c2]" aria-hidden />
        </span>
        <span className="text-label leading-snug text-[#d7e2e8]">{f.title}</span>
      </div>
      <p className="mt-2 pl-[2.625rem] text-caption text-[#7d97a8] italic">{f.note}</p>
    </motion.li>
  );
}

/**
 * Chapter 03 — before CORE. A deliberately fragmented, colder composition:
 * friction artefacts scattered and tangled, drifting further apart as the
 * visitor scrolls. Phones: the same artefacts as a loose, tilted stack.
 */
export function ComplexityChapter() {
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const tangle = useTransform(scrollYProgress, [0.15, 0.6], [0.12, 0.38]);

  return (
    <section
      ref={ref}
      id="complexity"
      aria-labelledby="complexity-title"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      {/* Colder, desaturated atmosphere with grain: the organization before CORE. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#050b12_0%,#070d13_18%,#080e14_82%,#050b12_100%)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_30%_40%,rgb(125_151_168/0.06),transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('/textures/noise.svg')] opacity-[0.05] mix-blend-overlay" />
      </div>

      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <ChapterMark id="complexity" tone="cold" />
            <h2 id="complexity-title" className="mt-6 text-h1 text-[#e6edf1]">
              เมื่อองค์กรเติบโต
              <span className="block text-[#7d97a8]">เร็วกว่ากระบวนการ</span>
            </h2>
            <p className="mt-6 max-w-md text-body-lg text-[#9db3c2]">
              ไม่มีใครตั้งใจให้เป็นแบบนี้ — แต่ละทีมหาวิธีของตัวเองเพื่อให้งานเดินต่อ จนข้อมูล
              เอกสาร และสถานะกระจายอยู่คนละที่
            </p>
            <p className="mt-8 max-w-md border-l border-[#7d97a8]/30 pl-5 text-label text-[#7d97a8]">
              นี่ไม่ใช่ความผิดของคนทำงาน แต่เป็นสัญญาณว่ากระบวนการยังไม่ได้เติบโตไปพร้อมกับองค์กร
            </p>
          </div>

          <div className="relative lg:min-h-[44rem]">
            {/* Tangled handoffs between fragments (desktop). */}
            <motion.svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ opacity: tangle }}
              className="absolute inset-0 hidden size-full lg:block"
            >
              {[
                'M 14 14 C 40 40, 30 70, 62 60',
                'M 66 8 C 50 30, 20 40, 12 52',
                'M 40 30 C 70 30, 90 50, 70 78',
                'M 84 36 C 60 50, 40 90, 28 78',
                'M 10 52 C 30 60, 60 20, 92 58',
                'M 56 58 C 30 70, 80 90, 74 78',
              ].map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="#7d97a8"
                  strokeWidth="0.18"
                  strokeDasharray="0.8 1.4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </motion.svg>
            <ul
              aria-label="สัญญาณของกระบวนการที่โตไม่ทันองค์กร"
              className={cn('relative grid gap-3 sm:grid-cols-2 lg:block lg:h-[44rem]')}
            >
              {FRAGMENTS.map((f, i) => (
                <Fragment
                  key={f.title}
                  f={f}
                  index={i}
                  progress={scrollYProgress}
                  reduce={reduce}
                />
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
