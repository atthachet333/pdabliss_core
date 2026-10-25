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
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { useRef } from 'react';
import { Container } from '@/components/ui/Section';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { ChapterMark } from './ChapterMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const th = {
  fragments: [
    { title: 'ไฟล์ตารางกระจายอยู่ทุกทีม', note: 'ใครถือฉบับล่าสุด?' },
    { title: 'ไล่ถามสถานะในแชต', note: '“งานนี้ถึงไหนแล้วครับ”' },
    { title: 'ข้อมูลเดียวกันกรอกซ้ำหลายที่', note: 'ตัวเลขไม่ตรงกัน' },
    { title: 'ไม่รู้ว่าเอกสารฉบับไหนถูกต้อง', note: 'v3_final_แก้ล่าสุด' },
    { title: 'งานรอโดยไม่มีเจ้าของ', note: 'ค้างมา 4 วัน' },
    { title: 'การอนุมัติล่าช้า', note: 'รอลายเซ็น' },
    { title: 'แผนกต้องถามกันเองตลอด', note: 'ส่งต่อหลายทอด' },
    { title: 'สต็อกและวันหมดอายุ รู้เมื่อสายไป', note: 'พบตอนจะจ่ายของ' },
    { title: 'ไม่มีร่องรอยว่าใครแก้อะไร', note: 'ย้อนดูไม่ได้' },
  ],
  titleA: 'เมื่อองค์กรเติบโต',
  titleB: 'เร็วกว่ากระบวนการ',
  lead: 'ไม่มีใครตั้งใจให้เป็นแบบนี้ — แต่ละทีมหาวิธีของตัวเองเพื่อให้งานเดินต่อ จนข้อมูล เอกสาร และสถานะกระจายอยู่คนละที่',
  note: 'นี่ไม่ใช่ความผิดของคนทำงาน แต่เป็นสัญญาณว่ากระบวนการยังไม่ได้เติบโตไปพร้อมกับองค์กร',
  more: 'ดูว่า CORE ช่วยแก้ปัญหาอะไร',
  listLabel: 'สัญญาณของกระบวนการที่โตไม่ทันองค์กร',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    fragments: [
      { title: 'Spreadsheets scattered across every team', note: 'Who has the latest version?' },
      { title: 'Chasing status in chat', note: '“Where is this order now?”' },
      { title: 'The same data typed in several places', note: 'The numbers don’t match' },
      { title: 'Nobody knows which document is correct', note: 'v3_final_latest_edit' },
      { title: 'Work waiting with no owner', note: 'Stuck for 4 days' },
      { title: 'Slow approvals', note: 'Waiting for a signature' },
      { title: 'Departments always asking each other', note: 'Passed along many times' },
      { title: 'Stock and expiry noticed too late', note: 'Found at dispatch' },
      { title: 'No trace of who changed what', note: 'No way to look back' },
    ],
    titleA: 'When an organization grows',
    titleB: 'faster than its processes',
    lead: 'Nobody plans it this way — each team finds its own way to keep work moving, until data, documents and status are scattered everywhere.',
    note: 'This is not the people’s fault. It is a sign that the process has not grown with the organization.',
    more: 'See the problems CORE helps solve',
    listLabel: 'Signs that process has not kept up with growth',
  },
  'zh-CN': {
    fragments: [
      { title: '表格文件分散在各个团队', note: '谁手上是最新版本？' },
      { title: '在聊天中追问状态', note: '“这项工作进行到哪了？”' },
      { title: '同一份数据在多处重复录入', note: '数字对不上' },
      { title: '不知道哪份单据才是正确的', note: 'v3_final_最新修改' },
      { title: '工作等待却无人负责', note: '已搁置 4 天' },
      { title: '审批迟缓', note: '等待签字' },
      { title: '部门之间总要互相询问', note: '层层转交' },
      { title: '库存与有效期发现得太晚', note: '出货时才发现' },
      { title: '无法追溯谁改了什么', note: '无从查起' },
    ],
    titleA: '当企业成长',
    titleB: '快于流程',
    lead: '没有人故意让事情变成这样——每个团队都用自己的办法让工作继续，最终数据、单据和状态散落各处。',
    note: '这不是员工的错，而是流程没有跟上企业成长的信号。',
    more: '了解 CORE 帮助解决哪些问题',
    listLabel: '流程跟不上企业成长的信号',
  },
};

/** Organizational friction — abstract artefacts, no third-party brands. */
const FRAGMENTS: {
  icon: LucideIcon;
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
    x: 2,
    y: 4,
    r: -4,
    dx: -18,
    dy: -10,
  },
  {
    icon: MessagesSquare,
    x: 52,
    y: 0,
    r: 3,
    dx: 14,
    dy: -14,
  },
  {
    icon: Copy,
    x: 28,
    y: 20,
    r: -2,
    dx: -6,
    dy: -4,
  },
  {
    icon: FileQuestion,
    x: 64,
    y: 24,
    r: 5,
    dx: 20,
    dy: 2,
  },
  {
    icon: Hourglass,
    x: 0,
    y: 42,
    r: 3,
    dx: -22,
    dy: 6,
  },
  { icon: Stamp, x: 36, y: 44, r: -5, dx: 6, dy: 10 },
  {
    icon: Repeat,
    x: 14,
    y: 66,
    r: 4,
    dx: -10,
    dy: 16,
  },
  {
    icon: CalendarX2,
    x: 60,
    y: 62,
    r: -3,
    dx: 16,
    dy: 18,
  },
  {
    icon: Unlink,
    x: 40,
    y: 84,
    r: 6,
    dx: 24,
    dy: 6,
  },
];

function Fragment({
  f,
  text,
  index,
  progress,
  reduce,
}: {
  f: (typeof FRAGMENTS)[number];
  text: { title: string; note: string };
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
        <span className="text-label leading-snug text-[#d7e2e8]">{text.title}</span>
      </div>
      <p className="mt-2 pl-[2.625rem] text-caption text-[#7d97a8] italic">{text.note}</p>
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
  const c = useCopy(COPY);
  const { href } = useLocale();
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
              {c.titleA}
              <span className="block text-[#7d97a8]">{c.titleB}</span>
            </h2>
            <p className="mt-6 max-w-md text-body-lg text-[#9db3c2]">{c.lead}</p>
            <p className="mt-8 max-w-md border-l border-[#7d97a8]/30 pl-5 text-label text-[#7d97a8]">
              {c.note}
            </p>
            <Link
              to={href('/solutions')}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
            >
              {c.more}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
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
              aria-label={c.listLabel}
              className={cn('relative grid gap-3 sm:grid-cols-2 lg:block lg:h-[44rem]')}
            >
              {FRAGMENTS.map((f, i) => (
                <Fragment
                  key={i}
                  f={f}
                  text={c.fragments[i]!}
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
