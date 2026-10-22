import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, EyeOff } from 'lucide-react';
import { lazy, Suspense, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { WorldArt } from './WorldArt';
import { WORLDS, type WorldId } from './worlds';
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

/**
 * Chapter 05 — six operational worlds. One stage, six environments: the
 * light, accent and procedural art shift per department while a real EP02
 * workspace preview sits in front. Native tablist (arrow keys, Home/End).
 */
export function DepartmentWorldsChapter() {
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState<WorldId>('sales');
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
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
              หกโลกการทำงาน
              <span className="block text-text-secondary">ที่ออกแบบมาเพื่อหน้าที่ของแต่ละแผนก</span>
            </h2>
          </div>
          <p className="max-w-sm border-l border-brand-glow/40 pl-5 text-h3 text-brand-soft">
            แยกประสบการณ์การทำงาน
            <span className="block text-text-primary">แต่ไม่แยกข้อมูล</span>
          </p>
        </div>

        {/* World selector */}
        <div
          role="tablist"
          aria-label="เลือกโลกการทำงานของแผนก"
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
                  {w.nameTh}
                </span>
                <span className="hidden text-[0.6875rem] tracking-[0.14em] text-text-muted uppercase sm:block">
                  {w.nameEn}
                </span>
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
                <h3 className="mt-3 text-h2 text-text-primary">{world.nameTh}</h3>
                <p className="mt-2 text-caption text-text-muted">{world.mood}</p>
                <p className="mt-6 text-body-lg text-text-secondary">{world.message}</p>
                <ul aria-label={`หน้าที่ของ${world.nameTh}`} className="mt-6 flex flex-wrap gap-2">
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
                    พื้นที่คลังสินค้าแสดงจำนวน Lot และวันหมดอายุ — ไม่แสดงราคาหรือต้นทุน
                    เพราะไม่เกี่ยวข้องกับหน้าที่
                  </p>
                )}
                <Link
                  to={`/departments#${world.id}`}
                  className="mt-8 inline-flex w-fit items-center gap-2 rounded-full text-label font-medium text-text-primary underline-offset-4 hover:underline"
                >
                  ดูรายละเอียด{world.nameTh}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </motion.div>
            </AnimatePresence>

            <figure
              className="relative"
              aria-label={`ตัวอย่างหน้าจอ${world.nameTh} (ข้อมูลตัวอย่าง)`}
            >
              <div
                aria-hidden
                inert
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
                หน้าจอจริงจากระบบต้นแบบ แสดงด้วยข้อมูลตัวอย่าง
              </figcaption>
            </figure>
          </div>
        </div>

        <p className="mt-6 text-caption text-text-muted">
          ทั้งหกพื้นที่อ่านและเขียนข้อมูลชุดเดียวกัน — สิ่งที่ฝ่ายขายบันทึก คือสิ่งที่คลัง จัดซื้อ
          บัญชี และผู้บริหารเห็น ตามสิทธิ์ของแต่ละหน้าที่
        </p>
      </Container>
    </section>
  );
}
