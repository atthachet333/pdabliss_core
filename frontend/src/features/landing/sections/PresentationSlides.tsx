import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, Database, Gauge, GitBranch, ShieldCheck, Workflow } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Container } from '@/components/ui/Section';
import { getDepartment } from '@/config/departments';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { DEPARTMENT_HIGHLIGHTS } from '../core-world/constants';
import { ORBIT_LIST } from '../core-world/orbitList';
import type { OrbitDepartmentId } from '../core-world/types';
import { SLIDES } from './slides';

/*
 * Slides 02–03 of the homepage presentation. Each is one full-height scene with
 * a clear beginning and end, activated as it enters the viewport (native
 * scrolling — no snapping, no wheel handling) and with its own animation language:
 *   02 Departments — workspaces unfold outward from a central CORE
 *   03 Flow        — a document travels a route, station by station
 * Slide 01 (CORE World) and 04 (Workspace) live in their own modules.
 */

function SlideHeading({
  id,
  index,
  kicker,
  title,
  body,
  align = 'left',
}: {
  id: string;
  index: string;
  kicker: string;
  title: string;
  body: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p
        className={cn(
          'flex items-center gap-3 text-caption font-semibold tracking-[0.18em] text-brand-glow uppercase',
          align === 'center' && 'justify-center',
        )}
      >
        <span className="text-text-muted tabular">{index}</span>
        <span aria-hidden className="h-px w-8 bg-border-brand" />
        {kicker}
      </p>
      <h2 id={id} className="mt-4 text-h2 text-text-primary">
        {/* Thai has no spaces between words: keep each space-separated phrase whole so
            a title never breaks inside a compound such as "ทุกคน". */}
        {title.split(' ').map((phrase, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className="inline-block">{phrase}</span>
          </Fragment>
        ))}
      </h2>
      <p className="mt-4 text-body-lg text-text-secondary">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* 02 — Departments                                                          */
/* ------------------------------------------------------------------------ */

const VALUES = [
  { icon: Database, label: 'ข้อมูลชุดเดียว', sub: 'One source of truth' },
  { icon: Workflow, label: 'งานเชื่อมทุกแผนก', sub: 'Connected workflow' },
  { icon: GitBranch, label: 'มาตรฐานเดียวกัน', sub: 'Standardised process' },
  { icon: Gauge, label: 'เห็นสถานะทันที', sub: 'Real-time operation' },
  { icon: ShieldCheck, label: 'กันความผิดพลาดตั้งแต่ต้นทาง', sub: 'Error prevention' },
] as const;

function WorkspaceCard({
  id,
  row,
  index,
  show,
}: {
  id: OrbitDepartmentId;
  row: 'top' | 'bottom';
  index: number;
  show: boolean;
}) {
  const d = getDepartment(id);
  const Icon = d.icon;
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: row === 'top' ? 36 : -36, scale: 0.96 }}
      animate={show || reduce ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ duration: DURATION.reveal, ease: EASE_CORE, delay: 0.25 + index * 0.08 }}
      className="relative"
    >
      {/* Connector to the shared CORE (desktop). */}
      <motion.span
        aria-hidden
        initial={reduce ? false : { scaleY: 0 }}
        animate={show || reduce ? { scaleY: 1 } : undefined}
        transition={{ duration: 0.6, ease: EASE_CORE, delay: 0.55 + index * 0.08 }}
        className={cn(
          'absolute left-1/2 hidden h-10 w-px bg-gradient-to-b from-border-brand to-transparent lg:block',
          row === 'top' ? 'top-full origin-top' : 'bottom-full origin-bottom rotate-180',
        )}
      />
      <article className="h-full rounded-card border border-border-soft bg-surface-base/70 p-5 backdrop-blur-sm transition-colors duration-300 hover:border-border-strong">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl border border-border-brand/60 bg-brand-primary/10">
            <Icon className="size-4.5 text-brand-glow" aria-hidden />
          </span>
          <div>
            <h3 className="text-label font-semibold text-text-primary">{d.nameTh}</h3>
            <p className="text-[0.6875rem] tracking-[0.18em] text-text-muted uppercase">
              {d.nameEn}
            </p>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`พื้นที่ทำงานของ${d.nameTh}`}>
          {DEPARTMENT_HIGHLIGHTS[id].map((h) => (
            <li
              key={h}
              className="rounded-full border border-border-soft px-2.5 py-0.5 text-caption text-text-secondary"
            >
              {h}
            </li>
          ))}
        </ul>
      </article>
    </motion.li>
  );
}

export function DepartmentsSlide() {
  const ref = useRef<HTMLDivElement>(null);
  const show = useInView(ref, { once: true, amount: 0.25 });
  const reduce = useReducedMotion();
  const top = ORBIT_LIST.slice(0, 3);
  const bottom = ORBIT_LIST.slice(3);

  return (
    <section
      id="core-story"
      data-slide="departments"
      aria-labelledby="slide-departments-title"
      className="relative flex items-center py-24 sm:py-28 lg:min-h-svh"
    >
      <Container>
        <SlideHeading
          id="slide-departments-title"
          index="02"
          kicker="Departments"
          title="ทุกแผนกมีพื้นที่ทำงานของตัวเอง บนข้อมูลชุดเดียวกัน"
          body="คลังสินค้าเห็นงานรับเข้า Lot และวันหมดอายุ ฝ่ายขายเห็นคำสั่งซื้อและกำหนดส่ง — แต่ละทีมได้หน้าจอที่ตรงกับงานของตัวเอง ขณะที่ทุกแผนกบันทึกและอ่านจากแหล่งข้อมูลเดียว ตัวเลขจึงตรงกันโดยไม่ต้องกระทบยอด"
        />

        <div ref={ref} className="relative mt-14">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {top.map((id, i) => (
              <WorkspaceCard key={id} id={id} row="top" index={i} show={show} />
            ))}
            {/* The shared CORE between the two rows of workspaces. */}
            <li aria-hidden className="order-first sm:col-span-2 lg:order-none lg:col-span-3">
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                animate={show || reduce ? { opacity: 1, scale: 1 } : undefined}
                transition={{ duration: DURATION.reveal, ease: EASE_CORE }}
                className="mx-auto flex items-center justify-center gap-4 py-2 lg:py-10"
              >
                <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-border-brand lg:block" />
                <span className="relative flex size-20 items-center justify-center rounded-full border border-border-brand bg-[radial-gradient(circle_at_35%_30%,#123a3a,#0a1620_60%,#050b12)] shadow-glow-md">
                  <span className="text-gradient-brand text-[0.75rem] font-semibold tracking-[0.2em]">
                    CORE
                  </span>
                  <span className="absolute -inset-3 rounded-full border border-border-soft" />
                </span>
                <span className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-border-brand lg:block" />
              </motion.div>
            </li>
            {bottom.map((id, i) => (
              <WorkspaceCard key={id} id={id} row="bottom" index={i + 3} show={show} />
            ))}
          </ul>
        </div>

        {/* What CORE is the centre of — one constellation line rather than a row of cards. */}
        <ul
          aria-label="สิ่งที่ CORE เป็นศูนย์กลาง"
          className="relative mt-16 grid grid-cols-2 gap-x-4 gap-y-5 pt-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-brand to-transparent"
          />
          {VALUES.map(({ icon: Icon, label, sub }) => (
            <li key={label} className="group flex items-start gap-3 lg:px-4 lg:first:pl-0">
              <span className="relative mt-0.5 shrink-0">
                <span
                  aria-hidden
                  className="absolute -top-[calc(1.625rem+3px)] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-brand-glow/70 shadow-glow-sm transition-transform duration-300 group-hover:scale-150"
                />
                <Icon
                  className="size-[1.125rem] text-brand-glow/80 transition-colors duration-300 group-hover:text-brand-glow"
                  aria-hidden
                />
              </span>
              <span className="flex flex-col">
                <span className="text-label font-medium text-text-primary">{label}</span>
                <span className="text-caption text-text-muted">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* 03 — Connected process                                                    */
/* ------------------------------------------------------------------------ */

const ROUTE: { dept: OrbitDepartmentId; doc: string; note: string }[] = [
  { dept: 'sales', doc: 'Sales Order', note: 'ยืนยันคำสั่งซื้อลูกค้า' },
  { dept: 'operations', doc: 'Work Order', note: 'วางแผนและเริ่มงาน' },
  { dept: 'purchasing', doc: 'PR → PO', note: 'สั่งวัตถุดิบที่ขาด' },
  { dept: 'warehouse', doc: 'รับสินค้า (GR)', note: 'รับเข้า ตรวจ QC บันทึก Lot' },
  { dept: 'accounting', doc: 'คำขอจ่าย', note: 'จ่ายเมื่อเอกสารครบ' },
  { dept: 'reports', doc: 'รายงาน', note: 'ตัวเลขตรงกันทุกฝ่าย' },
];

const STEP_MS = 1100;

/** Advances the route one station at a time while the slide is on screen. */
function useRouteProgress(active: boolean, reduce: boolean) {
  const [step, setStep] = useState(reduce ? ROUTE.length : 0);
  useEffect(() => {
    if (reduce || !active) return;
    const t = window.setInterval(
      () => setStep((s) => (s >= ROUTE.length + 1 ? 0 : s + 1)),
      STEP_MS,
    );
    return () => window.clearInterval(t);
  }, [active, reduce]);
  return reduce ? ROUTE.length : Math.min(step, ROUTE.length);
}

export function ProcessSlide() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = Boolean(useReducedMotion());
  const step = useRouteProgress(inView, reduce);
  const progress =
    ROUTE.length > 1 ? Math.max(0, Math.min(step, ROUTE.length) - 1) / (ROUTE.length - 1) : 0;

  return (
    <section
      id="core-flow"
      data-slide="flow"
      aria-labelledby="slide-flow-title"
      className="relative flex items-center overflow-hidden py-24 sm:py-28 lg:min-h-svh"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_60%,rgb(25_195_154/0.07),transparent_70%)]"
      />
      <Container>
        <SlideHeading
          id="slide-flow-title"
          index="03"
          kicker="Connected process"
          title="งานส่งต่อกันเอง ทุกคนเห็นสถานะเดียวกัน"
          body="เมื่อฝ่ายขายยืนยันคำสั่งซื้อ งานจะไหลต่อไปยังปฏิบัติการ จัดซื้อ คลังสินค้า และบัญชีตามลำดับ ใครถึงคิวก็เห็นทันทีว่าต้องทำอะไรต่อ — โดยไม่ต้องถามต่อกันเป็นทอด"
          align="center"
        />

        <div ref={ref} className="relative mx-auto mt-16 max-w-6xl">
          {/* Track: horizontal on desktop, vertical on phones. The data pulse rides on it. */}
          <div
            aria-hidden
            className="absolute top-[1.375rem] right-[8.33%] left-[8.33%] hidden h-px bg-border-strong lg:block"
          >
            <div
              className="h-full origin-left bg-gradient-to-r from-brand-primary to-brand-glow transition-transform duration-1000 ease-out"
              style={{ transform: `scaleX(${progress})` }}
            />
            <span
              className={cn(
                'absolute top-1/2 size-3 -translate-1/2 rounded-full bg-brand-glow shadow-glow-md transition-[left,opacity] duration-1000 ease-out',
                step === 0 || reduce ? 'opacity-0' : 'opacity-100',
              )}
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[1.375rem] w-px bg-border-strong lg:hidden"
          >
            <div
              className="w-full origin-top bg-gradient-to-b from-brand-primary to-brand-glow transition-transform duration-1000 ease-out"
              style={{ height: '100%', transform: `scaleY(${progress})` }}
            />
          </div>

          <ol
            aria-label="ลำดับงานที่ส่งต่อกันระหว่างแผนก"
            className="relative grid gap-6 lg:grid-cols-6 lg:gap-4"
          >
            {ROUTE.map((r, i) => {
              const d = getDepartment(r.dept);
              const Icon = d.icon;
              const done = i < step - 1 || (reduce && i < ROUTE.length);
              const current = !reduce && i === step - 1;
              return (
                <li
                  key={r.dept}
                  className="flex gap-4 lg:flex-col lg:items-center lg:gap-3 lg:text-center"
                >
                  <span
                    className={cn(
                      'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,box-shadow] duration-500',
                      current
                        ? 'border-brand-glow bg-brand-primary/20 shadow-glow-md'
                        : done
                          ? 'border-border-brand bg-surface-overlay'
                          : 'border-border-strong bg-surface-base',
                    )}
                  >
                    {done && !current ? (
                      <Check className="size-4.5 text-brand-glow" aria-hidden />
                    ) : (
                      <Icon
                        className={cn('size-4.5', current ? 'text-brand-glow' : 'text-text-muted')}
                        aria-hidden
                      />
                    )}
                  </span>
                  <div className="pt-1 lg:pt-0">
                    <p className="text-caption text-text-muted">{d.nameTh}</p>
                    <p
                      className={cn(
                        'text-label font-semibold transition-colors duration-500',
                        current || done ? 'text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {r.doc}
                    </p>
                    <p className="mt-0.5 text-caption text-text-muted">{r.note}</p>
                    <span className="sr-only">
                      {done ? 'เสร็จแล้ว' : current ? 'กำลังดำเนินการ' : 'ยังไม่ถึง'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Presentation progress (desktop)                                           */
/* ------------------------------------------------------------------------ */

/**
 * Quiet slide indicator: four dots on the right edge, labels on hover/focus.
 * Active slide via IntersectionObserver; hidden once the visitor scrolls past
 * the presentation. Links are real anchors (work without JS).
 */
export function PresentationProgress() {
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let best: string | null = null;
        let bestRatio = 0;
        ratios.forEach((r, id) => {
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        });
        setActive(bestRatio > 0.15 ? best : null);
      },
      { threshold: [0, 0.15, 0.3, 0.5, 0.7, 1] },
    );
    SLIDES.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="ส่วนของการนำเสนอ"
      className={cn(
        'fixed top-1/2 right-5 z-40 hidden -translate-y-1/2 transition-opacity duration-500 lg:block xl:right-7',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <ol className="flex flex-col gap-1.5">
        {SLIDES.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? 'step' : undefined}
                onClick={(e) => {
                  const el = document.getElementById(s.id);
                  if (!el) return;
                  e.preventDefault();
                  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
                }}
                // The hit area is the dot only; the label floats to its left without
                // taking pointer space over the hero's department labels.
                className="group relative flex size-6 items-center justify-center rounded-full focus-visible:outline-offset-2"
              >
                <span
                  className={cn(
                    'pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 text-[0.6875rem] tracking-[0.16em] whitespace-nowrap uppercase transition-opacity duration-300',
                    on ? 'text-text-secondary' : 'text-text-muted',
                    'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                  )}
                >
                  <span className="tabular">{s.index}</span> — {s.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'block rounded-full transition-all duration-300',
                    on
                      ? 'h-5 w-1 bg-brand-glow'
                      : 'size-1 bg-text-muted group-hover:bg-text-secondary',
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
