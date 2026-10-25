import { motion } from 'framer-motion';
import { lazy, Suspense, type CSSProperties } from 'react';
import { Container } from '@/components/ui/Section';
import { EASE_CORE } from '@/motion/tokens';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { ChapterMark } from './ChapterMark';
import { useWorlds } from './worlds';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const ExecutivePreview = lazy(() =>
  import('./previews').then((m) => ({ default: m.ExecutivePreview })),
);

const th = {
  points: [
    {
      t: 'เห็นภาพรวมโดยไม่ต้องถามทีละคน',
      b: 'สถานะของทุกแผนกมาจากงานจริงที่บันทึกอยู่แล้ว ไม่ใช่รายงานที่ต้องรวบรวมทุกสิ้นเดือน',
    },
    {
      t: 'ตัดสินใจจากข้อยกเว้น',
      b: 'สิ่งที่ปกติไม่ต้องรบกวน — ผู้บริหารเห็นเฉพาะเรื่องที่ล่าช้า เสี่ยง หรือรอการตัดสินใจ',
    },
    { t: 'ลงรายละเอียดได้ถึงต้นทาง', b: 'ทุกสัญญาณย้อนกลับไปถึงเอกสารและแผนกที่เกี่ยวข้องได้' },
  ],
  titleA: 'ข้อมูลจากทุกแผนก',
  titleB: 'กลายเป็นภาพเดียวสำหรับผู้บริหาร',
  preview: 'ตัวอย่างหน้าจอภาพรวมผู้บริหาร (ข้อมูลตัวอย่าง)',
  caption: 'หน้าจอจริงจากระบบต้นแบบ แสดงสถานะด้วยข้อมูลตัวอย่าง — ไม่ใช่ตัวเลขขององค์กรใด',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    points: [
      {
        t: 'See the whole picture without asking around',
        b: 'Every department’s status comes from work already recorded — not reports compiled at month end.',
      },
      {
        t: 'Decide by exception',
        b: 'What is normal needs no attention — leaders see only what is late, at risk or awaiting a decision.',
      },
      {
        t: 'Drill down to the source',
        b: 'Every signal traces back to the documents and departments behind it.',
      },
    ],
    titleA: 'Data from every department',
    titleB: 'becomes one picture for leaders',
    preview: 'Executive overview screen preview (sample data)',
    caption:
      'A real prototype screen showing status with sample data — not any organization’s figures. The product interface is in Thai.',
  },
  'zh-CN': {
    points: [
      {
        t: '无需逐个询问即可掌握全局',
        b: '各部门的状态来自已记录的真实工作，而不是每月底汇总的报告。',
      },
      { t: '依据异常事项做决策', b: '正常的事无需打扰——管理层只看延迟、有风险或待决策的事项。' },
      { t: '可深入追溯到源头', b: '每一个信号都能追溯到相关的单据和部门。' },
    ],
    titleA: '来自各部门的数据',
    titleB: '汇成管理层的一幅全景',
    preview: '管理层概览界面预览（示例数据）',
    caption: '来自原型系统的真实界面，以示例数据展示状态——并非任何企业的真实数字。产品界面为泰语。',
  },
};

/**
 * Chapter 08 — the command view. Department signals converge on one point
 * and become the executive workspace (real EP02 components, sample data,
 * qualitative states only — no invented financial figures).
 */
export function ExecutiveChapter() {
  const c = useCopy(COPY);
  const SIGNALS = useWorlds().filter((w) => w.id !== 'executive');
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
              {c.titleA}
              <span className="block text-text-secondary">{c.titleB}</span>
            </h2>
            <dl className="mt-10 space-y-6">
              {c.points.map((p) => (
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
                    // EP19: names wrap instead of truncating ("Accounting & Finance" in five columns).
                    className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--a)_40%,transparent)] bg-surface-dark px-2 py-1 text-[0.6875rem] text-text-secondary"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--a)]" />
                    <span className="min-w-0 text-center leading-tight">{w.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <figure aria-label={c.preview}>
              <div
                aria-hidden
                inert
                // The real Thai product UI, in every locale (EP17).
                lang="th"
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
              <figcaption className="mt-3 text-caption text-text-muted">{c.caption}</figcaption>
            </figure>
          </div>
        </div>
      </Container>
    </section>
  );
}
