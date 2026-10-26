import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, EyeOff } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { departmentLink } from '@/features/departments/catalog';
import { ChapterMark } from './ChapterMark';
import { WorldArt } from './WorldArt';
import { useWorlds, type WorldId } from './worlds';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const WorldPreview = lazy(() => import('./previews'));

function PreviewSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-line bg-canvas/80">
      <div className="h-11 border-b border-line bg-nav" />
      <div className="flex-1 space-y-3 p-5">
        <div className="h-4 w-1/3 animate-pulse rounded-full bg-panel-raised" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-panel" />
        <div className="mt-6 h-40 animate-pulse rounded-panel bg-panel" />
      </div>
    </div>
  );
}

const th = {
  titleA: 'หกโลกการทำงาน',
  titleB: 'ที่ออกแบบมาเพื่อหน้าที่ของแต่ละแผนก',
  quoteA: 'แยกประสบการณ์การทำงาน',
  quoteB: 'แต่ไม่แยกข้อมูล',
  tabs: 'เลือกโลกการทำงานของแผนก',
  duties: (name: string) => `หน้าที่ของ${name}`,
  warehouseNote:
    'พื้นที่คลังสินค้าแสดงจำนวน Lot และวันหมดอายุ — ไม่แสดงราคาหรือต้นทุน เพราะไม่เกี่ยวข้องกับหน้าที่',
  details: (name: string) => `ดูรายละเอียด${name}`,
  preview: (name: string) => `ตัวอย่างหน้าจอ${name} (ข้อมูลตัวอย่าง)`,
  previewCaption: 'หน้าจอจริงจากระบบต้นแบบ แสดงด้วยข้อมูลตัวอย่าง',
  shared:
    'ทั้งหกพื้นที่อ่านและเขียนข้อมูลชุดเดียวกัน — สิ่งที่ฝ่ายขายบันทึก คือสิ่งที่คลัง จัดซื้อ บัญชี และผู้บริหารเห็น ตามสิทธิ์ของแต่ละหน้าที่',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    titleA: 'Six worlds of work',
    titleB: 'each designed around a department’s job',
    quoteA: 'Separate ways of working',
    quoteB: 'without separating the data',
    tabs: 'Choose a department world',
    duties: (name) => `${name} responsibilities`,
    warehouseNote:
      'The warehouse workspace shows lot quantities and expiry dates — never prices or costs, because they are not part of the job.',
    details: (name) => `See ${name} in detail`,
    preview: (name) => `${name} screen preview (sample data)`,
    previewCaption:
      'Real screens from the prototype, shown with sample data. The product interface is in Thai.',
    shared:
      'All six workspaces read and write the same data — what Sales records is what the Warehouse, Purchasing, Accounting and Executives see, according to each role’s permissions.',
  },
  'zh-CN': {
    titleA: '六个工作世界',
    titleB: '围绕各部门的职责而设计',
    quoteA: '工作体验各自独立',
    quoteB: '数据却始终相连',
    tabs: '选择部门的工作世界',
    duties: (name) => `${name}的职责`,
    warehouseNote: '仓库工作空间只显示批次数量与有效期——不显示价格或成本，因为这与岗位无关。',
    details: (name) => `查看${name}详情`,
    preview: (name) => `${name}界面预览（示例数据）`,
    previewCaption: '来自原型系统的真实界面，使用示例数据展示。产品界面为泰语。',
    shared:
      '六个空间读写同一套数据——销售部录入的内容，就是仓库、采购、财务与管理层按各自权限看到的内容。',
  },
};

/**
 * Chapter 05 — six operational worlds. One stage, six environments: the
 * light, accent and procedural art shift per department while a real EP02
 * workspace preview sits in front. Native tablist (arrow keys, Home/End).
 */
export function DepartmentWorldsChapter() {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<WorldId>('sales');
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const root = useRef<HTMLElement>(null);
  // The world art loops (CSS + SMIL) hold still while the chapter is offscreen.
  useLoopRegion(root);
  const WORLDS = useWorlds();
  const { locale, href } = useLocale();
  const c = useCopy(COPY);
  const world = WORLDS.find((w) => w.id === active)!;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = WORLDS.findIndex((w) => w.id === active);
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % WORLDS.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + WORLDS.length) % WORLDS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? WORLDS.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = WORLDS[next]!.id;
    setActive(id);
    tabs.current[id]?.focus();
  };

  return (
    <section
      ref={root}
      id="department-worlds"
      aria-labelledby="worlds-title"
      className="relative overflow-x-clip py-24 sm:py-32"
      style={{ '--world': world.accent } as CSSProperties}
    >
      {/* The room's light follows the selected world. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_70%_45%,color-mix(in_oklab,var(--world)_14%,transparent),transparent_72%)] transition-[background] duration-700" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#080e14] to-transparent" />
      </div>

      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <ChapterMark id="department-worlds" />
            <h2 id="worlds-title" className="mt-6 max-w-3xl text-h1 text-text-primary">
              {c.titleA}
              <span className="block text-text-secondary">{c.titleB}</span>
            </h2>
          </div>
          <p className="max-w-sm border-l border-brand-glow/40 pl-5 text-h3 text-brand-soft">
            {c.quoteA}
            <span className="block text-text-primary">{c.quoteB}</span>
          </p>
        </div>

        {/* World selector */}
        <div
          role="tablist"
          aria-label={c.tabs}
          onKeyDown={onKey}
          className="mt-12 grid grid-cols-3 gap-2 sm:grid-cols-6"
        >
          {WORLDS.map((w) => {
            const on = w.id === active;
            return (
              <button
                key={w.id}
                ref={(el) => {
                  tabs.current[w.id] = el;
                }}
                type="button"
                role="tab"
                id={`world-tab-${w.id}`}
                aria-selected={on}
                aria-controls="world-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(w.id)}
                style={{ '--a': w.accent } as CSSProperties}
                className={cn(
                  'group relative flex min-h-14 flex-col items-start justify-center overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors duration-300',
                  on
                    ? 'border-[color-mix(in_oklab,var(--a)_55%,transparent)] bg-[color-mix(in_oklab,var(--a)_10%,transparent)]'
                    : 'border-border-soft bg-surface-base/60 hover:border-border-strong hover:bg-surface-raised/70',
                )}
              >
                <span
                  className={cn(
                    'text-label font-medium',
                    on ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {w.name}
                </span>
                {locale !== 'en' && (
                  <span className="hidden text-[0.6875rem] tracking-[0.14em] text-text-muted uppercase sm:block">
                    {w.nameEn}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-[var(--a)] transition-transform duration-500',
                    on ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Stage */}
        <div
          id="world-panel"
          role="tabpanel"
          aria-labelledby={`world-tab-${active}`}
          className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-border-soft bg-surface-dark/70"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={active}
              aria-hidden
              initial={reduce ? false : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE_CORE }}
              className="absolute inset-0 text-[var(--world)]"
            >
              <WorldArt id={active} className="size-full opacity-35 lg:opacity-70" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_75%_40%,transparent,rgb(5_11_18/0.85))]" />
            </motion.div>
          </AnimatePresence>

          <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10 lg:p-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: EASE_CORE }}
                className="flex flex-col"
              >
                <p className="text-caption font-semibold tracking-[0.2em] text-[var(--world)] uppercase">
                  {world.nameEn} World
                </p>
                <h3 className="mt-3 text-h2 text-text-primary">{world.name}</h3>
                <p className="mt-2 text-caption text-text-muted">{world.mood}</p>
                <p className="mt-6 text-body-lg text-text-secondary">{world.message}</p>
                <ul aria-label={c.duties(world.name)} className="mt-6 flex flex-wrap gap-2">
                  {world.responsibilities.map((r) => (
                    <li
                      key={r}
                      className="rounded-full border border-border-soft bg-surface-base/70 px-3 py-1 text-caption text-text-secondary"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
                {active === 'warehouse' && (
                  <p className="mt-6 flex items-start gap-2.5 rounded-xl border border-border-soft bg-surface-base/70 p-3.5 text-caption text-text-secondary">
                    <EyeOff className="mt-0.5 size-4 shrink-0 text-[var(--world)]" aria-hidden />
                    {c.warehouseNote}
                  </p>
                )}
                <Link
                  to={href(departmentLink(world.id))}
                  // EP19: a 44 px target (was 23 px tall); the visual weight is unchanged.
                  className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-full text-label font-medium text-text-primary underline-offset-4 hover:underline"
                >
                  {c.details(world.name)}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </motion.div>
            </AnimatePresence>

            <figure className="relative" aria-label={c.preview(world.name)}>
              <div
                aria-hidden
                inert
                // The real Thai product UI, in every locale (EP17).
                lang="th"
                className="pointer-events-none h-[23rem] select-none sm:h-[27rem] lg:h-[29rem]"
              >
                <Suspense fallback={<PreviewSkeleton />}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reduce
                          ? { opacity: 0, transition: { duration: 0 } }
                          : { opacity: 0, y: -10 }
                      }
                      transition={{ duration: 0.5, ease: EASE_CORE }}
                      className="h-full"
                    >
                      <WorldPreview id={active} />
                    </motion.div>
                  </AnimatePresence>
                </Suspense>
              </div>
              <figcaption className="mt-3 text-caption text-text-muted">
                {c.previewCaption}
              </figcaption>
            </figure>
          </div>
        </div>

        <p className="mt-6 text-caption text-text-muted">{c.shared}</p>
      </Container>
    </section>
  );
}
