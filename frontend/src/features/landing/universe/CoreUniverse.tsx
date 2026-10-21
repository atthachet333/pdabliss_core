import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getDepartment, ORBIT_DEPARTMENTS, type DepartmentId } from '@/config/departments';
import { cn } from '@/lib/cn';
import { EASE_CALM, PARALLAX_MAX_PX } from '@/motion/tokens';
import { CENTER, CORE_RADIUS, VIEW, connectionPath, nodePoint, seeded } from './geometry';

interface CoreUniverseProps {
  /** Pointer position over the hero, normalised to -1…1. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
}

const ORIGIN = { transformOrigin: `${CENTER}px ${CENTER}px`, transformBox: 'view-box' } as const;

function useStars(count: number) {
  return useMemo(() => {
    const rand = seeded(20261021);
    return Array.from({ length: count }, () => ({
      x: rand() * VIEW,
      y: rand() * VIEW,
      r: 0.6 + rand() * 1.6,
      o: 0.15 + rand() * 0.55,
    }));
  }, [count]);
}

export function CoreUniverse({ pointerX, pointerY }: CoreUniverseProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<DepartmentId | null>(null);
  const stars = useStars(72);

  const nodes = useMemo(
    () =>
      ORBIT_DEPARTMENTS.map((id, i) => {
        const point = nodePoint(i, ORBIT_DEPARTMENTS.length);
        return { dept: getDepartment(id), point, path: connectionPath(point) };
      }),
    [],
  );

  // Depth-based parallax: the far field drifts opposite, the node layer leads. Max ±12px.
  const farX = useTransform(pointerX, (v) => v * -PARALLAX_MAX_PX * 0.5);
  const farY = useTransform(pointerY, (v) => v * -PARALLAX_MAX_PX * 0.5);
  const coreX = useTransform(pointerX, (v) => v * PARALLAX_MAX_PX * 0.35);
  const coreY = useTransform(pointerY, (v) => v * PARALLAX_MAX_PX * 0.35);
  const nearX = useTransform(pointerX, (v) => v * PARALLAX_MAX_PX * 0.7);
  const nearY = useTransform(pointerY, (v) => v * PARALLAX_MAX_PX * 0.7);

  const g = (name: string) => `${uid}-${name}`;

  return (
    <figure
      className="relative mx-auto aspect-square w-full max-w-[min(680px,92vw)] select-none"
      aria-label="แผนภาพ CORE Universe: ฝ่ายขาย ปฏิบัติการ คลังสินค้า จัดซื้อ บัญชี และรายงาน เชื่อมเข้าสู่ PDA BLISS CORE ศูนย์กลางข้อมูลชุดเดียว"
    >
      {/* Far field: stars + orbit rings */}
      <motion.div aria-hidden className="absolute inset-0" style={{ x: farX, y: farY }}>
        <div className="absolute inset-0 animate-drift">
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="size-full overflow-visible">
            {stars.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill="var(--color-brand-soft)"
                opacity={s.o * 0.6}
              />
            ))}
          </svg>
        </div>
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <radialGradient id={g('field')}>
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.16" />
              <stop offset="60%" stopColor="var(--color-brand-deep)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--color-surface-dark)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={CENTER} cy={CENTER} r={480} fill={`url(#${g('field')})`} />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={455}
            fill="none"
            stroke="var(--color-brand-soft)"
            strokeOpacity="0.05"
          />
          <g className="animate-spin-slower" style={ORIGIN}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={342}
              fill="none"
              stroke="var(--color-brand-glow)"
              strokeOpacity="0.2"
              strokeDasharray="2 12"
            />
          </g>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={250}
            fill="none"
            stroke="var(--color-brand-cool)"
            strokeOpacity="0.08"
          />
        </svg>
      </motion.div>

      {/* Near layer: connections, pulses, data particles */}
      <motion.div aria-hidden className="absolute inset-0" style={{ x: nearX, y: nearY }}>
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="size-full overflow-visible">
          <defs>
            <linearGradient id={g('line')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-glow)" />
              <stop offset="100%" stopColor="var(--color-brand-cool)" />
            </linearGradient>
          </defs>
          {nodes.map(({ dept, path }, i) => {
            const lit = active === dept.id;
            return (
              <g key={dept.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="var(--color-brand-primary)"
                  strokeOpacity={lit ? 0.7 : 0.22}
                  strokeWidth={lit ? 2.2 : 1.4}
                  className="transition-[stroke-opacity,stroke-width] duration-300"
                />
                {/* Slow flowing pulse along the connection */}
                <path
                  d={path}
                  fill="none"
                  stroke={`url(#${g('line')})`}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray="22 218"
                  strokeOpacity={lit ? 1 : 0.65}
                  className="animate-flow"
                  style={{
                    animationDelay: `${i * -0.9}s`,
                    animationDirection: i % 2 ? 'reverse' : 'normal',
                  }}
                />
                {!reduce && (
                  <circle r={3.2} fill="var(--color-brand-soft)">
                    <animateMotion
                      dur={`${5.5 + i * 0.45}s`}
                      begin={`${i * 0.8}s`}
                      repeatCount="indefinite"
                      path={path}
                      keyPoints={i % 2 ? '1;0' : '0;1'}
                      keyTimes="0;1"
                      calcMode="linear"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur={`${5.5 + i * 0.45}s`}
                      begin={`${i * 0.8}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      </motion.div>

      {/* The CORE */}
      <motion.div aria-hidden className="absolute inset-0" style={{ x: coreX, y: coreY }}>
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="size-full overflow-visible">
          <defs>
            <radialGradient id={g('halo')}>
              <stop offset="0%" stopColor="var(--color-brand-glow)" stopOpacity="0.5" />
              <stop offset="45%" stopColor="var(--color-brand-primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g('body')} cx="50%" cy="40%" r="62%">
              <stop offset="0%" stopColor="var(--color-surface-highlight)" />
              <stop offset="62%" stopColor="var(--color-surface-raised)" />
              <stop offset="100%" stopColor="var(--color-brand-deep)" />
            </radialGradient>
            <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-soft)" />
              <stop offset="50%" stopColor="var(--color-brand-glow)" />
              <stop offset="100%" stopColor="var(--color-brand-cool)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={230}
            fill={`url(#${g('halo')})`}
            className="animate-core-breathe"
            style={ORIGIN}
          />
          <g className="animate-spin-slow" style={ORIGIN}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={164}
              fill="none"
              stroke="var(--color-brand-glow)"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeDasharray="70 28 8 28"
            />
          </g>
          <g className="animate-spin-slower" style={ORIGIN}>
            {Array.from({ length: 60 }, (_, i) => {
              const a = (Math.PI * 2 * i) / 60;
              const r1 = 140;
              const r2 = i % 5 === 0 ? 150 : 145;
              return (
                <line
                  key={i}
                  x1={CENTER + r1 * Math.cos(a)}
                  y1={CENTER + r1 * Math.sin(a)}
                  x2={CENTER + r2 * Math.cos(a)}
                  y2={CENTER + r2 * Math.sin(a)}
                  stroke="var(--color-brand-soft)"
                  strokeOpacity={i % 5 === 0 ? 0.45 : 0.18}
                />
              );
            })}
          </g>
          <circle cx={CENTER} cy={CENTER} r={CORE_RADIUS} fill={`url(#${g('body')})`} />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CORE_RADIUS}
            fill="none"
            stroke={`url(#${g('rim')})`}
            strokeWidth="2.5"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CORE_RADIUS - 16}
            fill="none"
            stroke="var(--color-brand-glow)"
            strokeOpacity="0.18"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[clamp(0.5rem,1.3vw,0.6875rem)] font-semibold tracking-[0.32em] text-brand-soft/80">
            PDA BLISS
          </span>
          <span className="mt-0.5 text-[clamp(1.25rem,3.8vw,2.125rem)] leading-none font-bold tracking-[0.12em] text-text-primary">
            CORE
          </span>
          <span className="mt-1.5 text-[clamp(0.5rem,1.15vw,0.625rem)] tracking-[0.2em] text-text-muted">
            ONE SOURCE OF TRUTH
          </span>
        </div>
      </motion.div>

      {/* Department nodes (interactive, keyboard reachable) */}
      <motion.ul className="absolute inset-0" style={{ x: nearX, y: nearY }}>
        {nodes.map(({ dept, point }, i) => {
          const Icon = dept.icon;
          const lit = active === dept.id;
          return (
            <li key={dept.id} className="absolute" style={{ left: point.left, top: point.top }}>
              <motion.div
                className="-translate-x-1/2 -translate-y-1/2"
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{
                  duration: 7 + i * 0.6,
                  repeat: Infinity,
                  ease: EASE_CALM,
                  delay: i * 0.5,
                }}
              >
                <Link
                  to={`/departments#${dept.id}`}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center"
                  onPointerEnter={() => setActive(dept.id)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(dept.id)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-2xl border surface-glass transition-[border-color,box-shadow,transform] duration-300 sm:size-14',
                      lit ? 'scale-105 border-border-brand shadow-glow-md' : 'border-border-strong',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-5 transition-colors duration-300 sm:size-6',
                        lit ? 'text-brand-glow' : 'text-brand-soft',
                      )}
                      aria-hidden
                    />
                  </span>
                  <span className="rounded-md bg-surface-dark/60 px-1.5 text-[0.75rem] leading-tight font-medium text-text-primary sm:text-label">
                    {dept.nameTh}
                  </span>
                  <span className="hidden text-[0.6875rem] tracking-[0.12em] text-text-muted uppercase sm:block">
                    {dept.nameEn}
                  </span>
                </Link>
              </motion.div>
            </li>
          );
        })}
      </motion.ul>
    </figure>
  );
}
