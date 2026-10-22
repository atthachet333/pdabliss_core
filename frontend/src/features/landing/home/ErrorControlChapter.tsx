import { motion, useInView } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  Check,
  History,
  Lock,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type PrincipleId = 'prevent' | 'detect' | 'alert' | 'control' | 'trace';

const PRINCIPLES: { id: PrincipleId; en: string; th: string; body: string; icon: LucideIcon }[] = [
  {
    id: 'prevent',
    en: 'PREVENT',
    th: 'ป้องกัน',
    body: 'ทำให้ทางที่ถูกต้องเป็นทางที่ง่ายที่สุด',
    icon: ShieldCheck,
  },
  {
    id: 'detect',
    en: 'DETECT',
    th: 'ตรวจพบ',
    body: 'เห็นความไม่ตรงกันตั้งแต่ตอนที่เกิด',
    icon: ScanSearch,
  },
  {
    id: 'alert',
    en: 'ALERT',
    th: 'แจ้งเตือน',
    body: 'บอกคนที่ต้องรู้ ก่อนปัญหาจะลามต่อ',
    icon: BellRing,
  },
  {
    id: 'control',
    en: 'CONTROL',
    th: 'ควบคุม',
    body: 'งานสำคัญผ่านเงื่อนไขและการอนุมัติ',
    icon: Lock,
  },
  {
    id: 'trace',
    en: 'TRACE',
    th: 'ย้อนรอย',
    body: 'รู้ว่าใครทำอะไร เมื่อไร และเพราะอะไร',
    icon: History,
  },
];

/**
 * Scenarios: the flow is interrupted → the problem is named → a correction
 * appears → the flow continues. Wording describes what CORE is designed to
 * support; it does not claim every safeguard is live today.
 */
const SCENARIOS: {
  principle: PrincipleId;
  title: string;
  track: [string, string, string, string];
  /** Index of the stage where the flow is interrupted. */
  at: 1 | 2;
  problem: string;
  fix: string;
}[] = [
  {
    principle: 'prevent',
    title: 'จ่ายสินค้าผิด Lot',
    track: ['ใบเบิก', 'เลือก Lot', 'จ่ายออก', 'ส่งต่อ'],
    at: 1,
    problem: 'กำลังจะจ่าย Lot ที่หมดอายุช้ากว่า ขณะที่ Lot เก่ายังเหลือในคลัง',
    fix: 'CORE ถูกออกแบบมาเพื่อแนะนำ Lot ตามลำดับ FEFO ก่อนยืนยันการจ่าย',
  },
  {
    principle: 'detect',
    title: 'รับสินค้าไม่ครบ',
    track: ['PO', 'รับสินค้า', 'ตรวจนับ', 'เข้าคลัง'],
    at: 2,
    problem: 'จำนวนที่รับจริงน้อยกว่าที่สั่งใน PO',
    fix: 'CORE ถูกออกแบบมาเพื่อเทียบยอดรับกับ PO และแสดงส่วนที่ยังขาดให้จัดซื้อติดตาม',
  },
  {
    principle: 'alert',
    title: 'ของจาก Supplier ล่าช้า',
    track: ['PO', 'รอรับ', 'Work Order', 'ส่งมอบ'],
    at: 1,
    problem: 'PO เลยกำหนดส่ง และมี Work Order ที่รอวัตถุดิบนี้อยู่',
    fix: 'CORE ถูกออกแบบมาเพื่อแจ้งจัดซื้อ ปฏิบัติการ และผู้บริหาร ก่อนกระทบกำหนดส่งลูกค้า',
  },
  {
    principle: 'control',
    title: 'จ่ายเงินก่อนเอกสารครบ',
    track: ['คำขอจ่าย', 'ตรวจเอกสาร', 'อนุมัติ', 'จ่ายเงิน'],
    at: 1,
    problem: 'คำขอจ่ายยังไม่มีใบรับสินค้าและใบแจ้งหนี้ครบชุด',
    fix: 'CORE ถูกออกแบบมาเพื่อรองรับเงื่อนไขก่อนจ่าย — คำขอไม่ไปต่อจนกว่าเอกสารครบและได้รับอนุมัติ',
  },
  {
    principle: 'trace',
    title: 'ยอดสต็อกไม่ตรง',
    track: ['ตรวจนับ', 'พบส่วนต่าง', 'ย้อนดู', 'ปรับปรุง'],
    at: 1,
    problem: 'ยอดที่นับได้ไม่ตรงกับยอดในระบบ',
    fix: 'CORE ถูกออกแบบมาเพื่อรองรับประวัติการเคลื่อนไหวของทุกรายการ — ย้อนดูได้ว่าเปลี่ยนเมื่อไร โดยใคร',
  },
];

/** 0 flowing · 1 interrupted · 2 identified · 3 corrected · 4 continued */
type Phase = 0 | 1 | 2 | 3 | 4;
const PHASE_MS = [1400, 1100, 1500, 1600, 2600];

function useScenarioPlayer(active: boolean, reduce: boolean) {
  const [phase, setPhase] = useState<Phase>(0);
  useEffect(() => {
    if (reduce || !active || phase === 4) return;
    const t = window.setTimeout(() => setPhase((p) => (p + 1) as Phase), PHASE_MS[phase]);
    return () => window.clearTimeout(t);
  }, [phase, active, reduce]);
  // Under reduced motion the finished, annotated state is shown at once.
  return { phase: reduce ? (4 as Phase) : phase, restart: () => setPhase(0) };
}

/**
 * Chapter 07 — human error. Not a list of features: a short scenario plays
 * when the chapter is in view, showing where the flow breaks and how it is
 * caught. Under reduced motion the finished, annotated state is shown.
 */
export function ErrorControlChapter() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [index, setIndex] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { phase, restart } = useScenarioPlayer(inView, reduce);
  const select = (i: number) => {
    setIndex(i);
    restart();
  };
  const s = SCENARIOS[index]!;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = SCENARIOS.length;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (index + 1) % n
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (index - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  };

  const broken = phase >= 1 && phase < 3;
  // How far the flow has progressed along the 4-stage track (0–3).
  const reached = phase === 0 ? 0 : phase < 4 ? s.at : 3;

  return (
    <section
      id="error-control"
      aria-labelledby="error-title"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-surface-dark">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_0%,rgb(245_184_75/0.06),transparent_70%)]" />
      </div>

      <Container>
        <ChapterMark id="error-control" tone="warm" align="center" />
        <h2
          id="error-title"
          className="mx-auto mt-6 max-w-4xl text-center text-h1 text-text-primary"
        >
          ระบบที่ดี ไม่ควรรอให้ความผิดพลาดเกิดขึ้น
          <span className="block text-text-secondary">แล้วค่อยบอกว่าใครเป็นคนผิด</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-center text-body-lg text-text-secondary">
          คนทำงานผิดพลาดได้เสมอ สิ่งที่ระบบควรทำคือช่วยให้ความผิดพลาดเกิดยากขึ้น ถูกพบเร็วขึ้น
          และแก้ไขได้ก่อนส่งผลต่อแผนกถัดไป
        </p>

        {/* The five principles as one continuous band. */}
        <ol
          aria-label="หลักการป้องกันความผิดพลาด"
          className="mt-14 grid grid-cols-1 border-y border-border-soft sm:grid-cols-5"
        >
          {PRINCIPLES.map((p) => {
            const on = p.id === s.principle;
            return (
              <li
                key={p.id}
                className={cn(
                  'relative border-border-soft px-4 py-5 transition-colors duration-500 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0',
                  on && 'bg-warning/[0.06]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 top-0 h-0.5 origin-left bg-warning transition-transform duration-700',
                    on ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
                <p className="flex items-center gap-2">
                  <p.icon
                    className={cn('size-4', on ? 'text-warning' : 'text-text-muted')}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'text-caption font-semibold tracking-[0.18em]',
                      on ? 'text-warning' : 'text-text-secondary',
                    )}
                  >
                    {p.en}
                  </span>
                </p>
                <p className="mt-2 text-label text-text-primary">{p.th}</p>
                <p className="mt-1 text-caption text-text-muted">{p.body}</p>
              </li>
            );
          })}
        </ol>

        <div
          ref={ref}
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"
        >
          <div
            role="tablist"
            aria-label="สถานการณ์ตัวอย่าง"
            aria-orientation="vertical"
            onKeyDown={onKey}
            className="flex flex-col gap-1.5"
          >
            {SCENARIOS.map((sc, i) => {
              const on = i === index;
              const p = PRINCIPLES.find((x) => x.id === sc.principle)!;
              return (
                <button
                  key={sc.title}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`scenario-tab-${i}`}
                  aria-selected={on}
                  aria-controls="scenario-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  className={cn(
                    'flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    on
                      ? 'border-warning/40 bg-warning/[0.07] text-text-primary'
                      : 'border-transparent text-text-secondary hover:border-border-soft hover:bg-surface-raised/50',
                  )}
                >
                  <span className="text-label">{sc.title}</span>
                  <span
                    className={cn(
                      'text-[0.6875rem] font-semibold tracking-[0.16em]',
                      on ? 'text-warning' : 'text-text-muted',
                    )}
                  >
                    {p.en}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="scenario-panel"
            role="tabpanel"
            aria-labelledby={`scenario-tab-${index}`}
            className="relative overflow-hidden rounded-[1.5rem] border border-border-soft bg-surface-base/70 p-5 sm:p-8"
          >
            {/* The track: four stages; the flow stops at the interruption. */}
            <div aria-hidden className="relative">
              <div className="grid grid-cols-4 gap-2">
                {s.track.map((label, i) => {
                  const isBreak = i === s.at;
                  const passed = i < reached || (i === reached && !broken);
                  return (
                    <div
                      key={`${index}-${label}`}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <motion.span
                        animate={
                          isBreak && broken
                            ? {
                                scale: reduce ? 1 : [1, 1.12, 1],
                                borderColor: 'var(--color-warning)',
                              }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.5 }}
                        className={cn(
                          'flex size-11 items-center justify-center rounded-full border-2 transition-colors duration-500 sm:size-12',
                          isBreak && broken
                            ? 'border-warning bg-warning/15 text-warning'
                            : passed
                              ? 'border-success/70 bg-success/12 text-success'
                              : 'border-border-strong bg-surface-dark text-text-muted',
                        )}
                      >
                        {isBreak && broken ? (
                          <AlertTriangle className="size-5" />
                        ) : passed ? (
                          <Check className="size-5" />
                        ) : (
                          <span className="size-2 rounded-full bg-current" />
                        )}
                      </motion.span>
                      <span className="text-caption text-text-secondary">{label}</span>
                    </div>
                  );
                })}
              </div>
              {/* Connector line and progress. */}
              <div className="absolute top-[1.375rem] right-[12.5%] left-[12.5%] -z-0 h-0.5 -translate-y-1/2 bg-border-soft sm:top-6">
                <motion.div
                  className={cn('h-full origin-left', broken ? 'bg-warning' : 'bg-success/70')}
                  initial={false}
                  animate={{ scaleX: reached / 3 }}
                  transition={{ duration: reduce ? 0 : 1, ease: EASE_CORE }}
                />
              </div>
            </div>

            <dl className="mt-8 grid gap-3">
              <motion.div
                initial={false}
                animate={{ opacity: phase >= 2 ? 1 : 0.15, y: phase >= 2 || reduce ? 0 : 8 }}
                transition={{ duration: 0.5, ease: EASE_CORE }}
                className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4"
              >
                <dt className="text-caption font-semibold tracking-[0.12em] text-warning">
                  พบปัญหา
                </dt>
                <dd className="mt-1 text-label text-text-primary">{s.problem}</dd>
              </motion.div>
              <motion.div
                initial={false}
                animate={{ opacity: phase >= 3 ? 1 : 0.15, y: phase >= 3 || reduce ? 0 : 8 }}
                transition={{ duration: 0.5, ease: EASE_CORE }}
                className="rounded-xl border border-brand-glow/30 bg-brand-primary/[0.07] p-4"
              >
                <dt className="text-caption font-semibold tracking-[0.12em] text-brand-glow">
                  แนวทางแก้ไข
                </dt>
                <dd className="mt-1 text-label text-text-primary">{s.fix}</dd>
              </motion.div>
              <motion.div
                initial={false}
                animate={{ opacity: phase >= 4 ? 1 : 0.15 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 px-1 text-caption text-success"
              >
                <dt className="sr-only">ผลลัพธ์</dt>
                <dd className="flex items-center gap-2">
                  <Check className="size-4" aria-hidden />
                  งานเดินต่อ — แผนกถัดไปได้รับข้อมูลที่ถูกต้อง
                </dd>
              </motion.div>
            </dl>

            {!reduce && (
              <button
                type="button"
                onClick={restart}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
              >
                <RotateCcw className="size-4" aria-hidden />
                เล่นสถานการณ์อีกครั้ง
              </button>
            )}
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-caption text-text-muted">
          สถานการณ์ข้างต้นเป็นตัวอย่างเพื่ออธิบายแนวคิด — ความสามารถบางส่วนอยู่ในระบบต้นแบบแล้ว
          และบางส่วนอยู่ในแผนการพัฒนา
        </p>
      </Container>
    </section>
  );
}
