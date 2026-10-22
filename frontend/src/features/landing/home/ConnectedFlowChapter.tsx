import { animate, motion, useInView, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Container } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ChapterMark } from './ChapterMark';
import { CORE_POINT, FLOWS, routeFor, STATIONS } from './flows';
import { WORLDS, type WorldId } from './worlds';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const STEP_MS = 2400;
const NAME: Record<WorldId, string> = Object.fromEntries(
  WORLDS.map((w) => [w.id, w.nameTh]),
) as Record<WorldId, string>;
const ACCENT: Record<WorldId, string> = Object.fromEntries(
  WORLDS.map((w) => [w.id, w.accent]),
) as Record<WorldId, string>;

/**
 * Chapter 06 — the organization as a route map. Pick a flow; its route draws
 * through CORE and a pulse travels station to station while the chapter is in
 * view. Illustrative only: real work runs in parallel and organizations shape
 * their own steps. Phones get the same route as a vertical line.
 */
export function ConnectedFlowChapter() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [flowId, setFlowId] = useState(FLOWS[0]!.id);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const flow = FLOWS.find((f) => f.id === flowId)!;
  const route = useMemo(() => routeFor(flow), [flow]);
  const playing = inView && !reduce && !paused;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % (flow.steps.length + 1)), STEP_MS);
    return () => window.clearInterval(t);
  }, [playing, flow.steps.length]);

  // The pulse follows the route geometry (measured on the drawn path), not a straight line.
  const pathRef = useRef<SVGPathElement>(null);
  const dist = useMotionValue(0);
  const cx = useMotionValue<number>(STATIONS[flow.steps[0]!.at].x);
  const cy = useMotionValue<number>(STATIONS[flow.steps[0]!.at].y);
  useMotionValueEvent(dist, 'change', (v) => {
    const path = pathRef.current;
    if (!path || typeof path.getTotalLength !== 'function') return;
    const p = path.getPointAtLength((path.getTotalLength() * v) / 100);
    cx.set(p.x);
    cy.set(p.y);
  });
  const shown = Math.min(step, flow.steps.length - 1);
  useEffect(() => {
    const target = route.at[shown] ?? 0;
    if (reduce || step === 0) {
      dist.set(target);
      return;
    }
    const c = animate(dist, target, { duration: 1.1, ease: EASE_CORE });
    return () => c.stop();
  }, [shown, step, route, reduce, dist]);

  const visited = new Set(flow.steps.slice(0, reduce ? undefined : shown + 1).map((s) => s.at));
  const involved = new Set(flow.steps.map((s) => s.at));

  return (
    <section
      ref={ref}
      id="connected-flow"
      aria-labelledby="flow-title"
      className="relative overflow-x-clip py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--color-surface-dark),#06101a_50%,var(--color-surface-dark))]"
      >
        <div className="absolute inset-0 bg-[url('/textures/grid.svg')] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)] bg-center opacity-[0.07]" />
      </div>

      <Container>
        <div className="max-w-3xl">
          <ChapterMark id="connected-flow" />
          <h2 id="flow-title" className="mt-6 text-h1 text-text-primary">
            งานหนึ่งชิ้น เดินผ่านหลายแผนก
            <span className="block text-text-secondary">โดยไม่หลุดระหว่างทาง</span>
          </h2>
          <p className="mt-6 text-body-lg text-text-secondary">
            ทุกการส่งต่อผ่าน CORE — แผนกถัดไปเห็นงานทันทีพร้อมข้อมูลที่ต้องใช้ ไม่ต้องรอข้อความ
            ไม่ต้องกรอกซ้ำ
          </p>
        </div>

        <fieldset className="mt-10">
          <legend className="sr-only">เลือกเส้นทางงาน</legend>
          <div className="flex flex-wrap gap-2">
            {FLOWS.map((f) => (
              <label
                key={f.id}
                className={cn(
                  'relative flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-glow',
                  f.id === flowId
                    ? 'border-brand-glow/60 bg-brand-primary/12 text-text-primary'
                    : 'border-border-soft bg-surface-base/60 text-text-secondary hover:border-border-strong hover:text-text-primary',
                )}
              >
                <input
                  type="radio"
                  name="connected-flow"
                  value={f.id}
                  checked={f.id === flowId}
                  onChange={() => {
                    // Restart at the first station whenever the flow changes.
                    setFlowId(f.id);
                    setStep(0);
                  }}
                  className="sr-only"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-center">
          {/* Route map (tablet/desktop) */}
          <div aria-hidden className="relative hidden sm:block">
            <svg viewBox="0 0 1000 600" className="w-full">
              {/* Ambient connections: every station is always linked to CORE. */}
              {(Object.keys(STATIONS) as WorldId[]).map((id) => (
                <line
                  key={id}
                  x1={STATIONS[id].x}
                  y1={STATIONS[id].y}
                  x2={CORE_POINT.x}
                  y2={CORE_POINT.y}
                  stroke="var(--color-text-muted)"
                  strokeOpacity="0.14"
                  strokeDasharray="2 7"
                />
              ))}
              <motion.path
                ref={pathRef}
                key={flowId}
                d={route.d}
                fill="none"
                stroke="var(--color-brand-glow)"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0, opacity: 0.3 }}
                animate={{ pathLength: 1, opacity: 0.85 }}
                transition={{ duration: 1.6, ease: EASE_CORE }}
              />

              <circle
                cx={CORE_POINT.x}
                cy={CORE_POINT.y}
                r="64"
                fill="var(--color-brand-primary)"
                fillOpacity="0.06"
                stroke="var(--color-brand-glow)"
                strokeOpacity="0.35"
              />
              <circle
                cx={CORE_POINT.x}
                cy={CORE_POINT.y}
                r="34"
                fill="#0a2a24"
                stroke="var(--color-brand-glow)"
                strokeOpacity="0.6"
              />
              <text
                x={CORE_POINT.x}
                y={CORE_POINT.y + 6}
                textAnchor="middle"
                fontSize="18"
                fontWeight="600"
                fill="var(--color-brand-soft)"
                letterSpacing="2"
              >
                CORE
              </text>

              {(Object.keys(STATIONS) as WorldId[]).map((id) => {
                const p = STATIONS[id];
                const on = involved.has(id);
                const lit = visited.has(id);
                const current = !reduce && flow.steps[shown]?.at === id;
                return (
                  <g key={id} style={{ '--a': ACCENT[id] } as CSSProperties}>
                    {current && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="34"
                        fill="none"
                        stroke="var(--a)"
                        strokeOpacity="0.5"
                        className="origin-center animate-ping [transform-box:fill-box]"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="22"
                      fill={lit ? 'var(--a)' : 'var(--color-surface-raised)'}
                      fillOpacity={lit ? 0.22 : 1}
                      stroke={on ? 'var(--a)' : 'var(--color-text-muted)'}
                      strokeOpacity={on ? 0.9 : 0.3}
                      strokeWidth="1.5"
                      style={{ transition: 'fill 400ms, fill-opacity 400ms' }}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="6"
                      fill={on ? 'var(--a)' : 'var(--color-text-muted)'}
                      fillOpacity={on ? 1 : 0.4}
                    />
                    <text
                      x={p.x}
                      y={p.y + (p.y < CORE_POINT.y ? -36 : 50)}
                      textAnchor="middle"
                      fontSize="20"
                      fill={on ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
                    >
                      {NAME[id]}
                    </text>
                  </g>
                );
              })}

              {!reduce && (
                <motion.circle
                  r="8"
                  cx={cx}
                  cy={cy}
                  fill="var(--color-brand-glow)"
                  className="drop-shadow-[0_0_10px_var(--color-brand-glow)]"
                />
              )}
            </svg>
          </div>

          {/* Steps: the accessible route (and the phone layout). */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-h3 text-text-primary">เส้นทาง{flow.label}</h3>
                <p className="mt-1 text-caption text-text-secondary">{flow.summary}</p>
              </div>
              {!reduce && (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-pressed={paused}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  {paused ? (
                    <Play className="size-4" aria-hidden />
                  ) : (
                    <Pause className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">
                    {paused ? 'เล่นภาพเคลื่อนไหวเส้นทาง' : 'หยุดภาพเคลื่อนไหวเส้นทาง'}
                  </span>
                </button>
              )}
            </div>
            <ol aria-label={`ขั้นตอนเส้นทาง${flow.label}`} className="relative mt-6 space-y-1">
              <span
                aria-hidden
                className="absolute top-4 bottom-4 left-[0.9375rem] w-px bg-border-soft"
              />
              {flow.steps.map((s, i) => {
                const active = !reduce && i === shown;
                const done = reduce || i <= shown;
                return (
                  <li
                    key={`${flowId}-${i}`}
                    aria-current={active ? 'step' : undefined}
                    style={{ '--a': ACCENT[s.at] } as CSSProperties}
                    className={cn(
                      'relative flex gap-4 rounded-xl px-0 py-2.5 transition-colors duration-300',
                      active && 'bg-surface-raised/60',
                    )}
                  >
                    <span
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular transition-colors duration-300',
                        done
                          ? 'border-[var(--a)] bg-[color-mix(in_oklab,var(--a)_18%,var(--color-surface-dark))] text-text-primary'
                          : 'border-border-soft bg-surface-dark text-text-muted',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className="block text-caption font-medium text-[var(--a)]">
                        {NAME[s.at]}
                      </span>
                      <span
                        className={cn(
                          'block text-label',
                          done ? 'text-text-primary' : 'text-text-secondary',
                        )}
                      >
                        {s.text}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <p className="mt-10 max-w-3xl border-l border-border-strong pl-5 text-caption text-text-muted">
          เส้นทางนี้เป็นภาพประกอบ — งานจริงหลายส่วนเกิดขึ้นพร้อมกัน และแต่ละองค์กรกำหนดขั้นตอน
          ลำดับการอนุมัติ และแผนกที่เกี่ยวข้องได้ต่างกัน CORE
          ถูกออกแบบมาเพื่อรองรับเส้นทางตามที่องค์กรทำงานจริง
        </p>
      </Container>
    </section>
  );
}
