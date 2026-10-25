import { motion } from 'framer-motion';
import { useId } from 'react';
import { departmentsFor } from '@/config/departments';
import type { DeptKey } from '@/features/departments/catalog';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLocale } from '@/i18n/useLocale';
import { EASE_CORE } from '@/motion/tokens';

/*
 * The CORE Gateway (EP15). Outside: six department signals and their work
 * lanes. On the seam: one CORE gate. Inside: the focused workspace (the form
 * panel beside it). Sign-in is the transition between the two.
 *
 * Symbolic only — the scene never implies it knows the visitor's role.
 * Decorative (aria-hidden); every state is also stated in words by the panel.
 */

export type GatePhase = 'idle' | 'user' | 'pass' | 'submit' | 'success' | 'fail';

/** Top-to-bottom order of the signals (wide) / left-to-right (compact). */
const ORDER: readonly DeptKey[] = [
  'executive',
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
];

type P = { x: number; y: number };
type Geometry = {
  w: number;
  h: number;
  gate: P;
  /** Outer ring, gate ring, inner ring, core. */
  r: [number, number, number, number];
  signals: (P & { id: DeptKey; label: boolean })[];
  exit: string;
  fail: [P, P];
  pull: P;
  workspace: { w: number; h: number };
  fragments: (P & { t: string })[];
};

const deg = (d: number) => (d * Math.PI) / 180;

const WIDE: Geometry = {
  w: 760,
  h: 600,
  gate: { x: 650, y: 300 },
  r: [92, 68, 44, 22],
  signals: ORDER.map((id, i) => {
    const y = 70 + i * 92;
    return { id, x: 92 + Math.abs(y - 300) * 0.24, y, label: true };
  }),
  exit: 'M742,300 L760,300',
  fail: [
    { x: 380, y: 300 },
    { x: 540, y: 300 },
  ],
  pull: { x: 30, y: 0 },
  workspace: { w: 168, h: 116 },
  fragments: [
    { x: 250, y: 118, t: 'SO-1042' },
    { x: 330, y: 214, t: 'PO-2215 · 80/100' },
    { x: 238, y: 392, t: 'LOT-B2410' },
    { x: 318, y: 492, t: 'INV-5521' },
    { x: 452, y: 150, t: 'GR-3307' },
    { x: 440, y: 452, t: 'DO-0588' },
  ],
};

const COMPACT: Geometry = {
  w: 360,
  h: 150,
  gate: { x: 180, y: 96 },
  r: [40, 30, 19, 10],
  signals: ORDER.map((id, i) => {
    const a = deg(195 + i * 30);
    return {
      id,
      x: 180 + 150 * Math.cos(a),
      y: 96 + 76 * Math.sin(a),
      label: id === 'sales' || id === 'warehouse',
    };
  }),
  exit: 'M180,136 L180,150',
  fail: [
    { x: 180, y: 6 },
    { x: 180, y: 46 },
  ],
  pull: { x: 0, y: 8 },
  workspace: { w: 76, h: 52 },
  fragments: [],
};

/** A work lane from a signal to the gate ring, bending toward the gate. */
function lane(s: P, g: P, ring: number): string {
  const dx = g.x - s.x;
  const dy = g.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const e = { x: g.x - (dx / len) * ring, y: g.y - (dy / len) * ring };
  const c1 = { x: s.x + (e.x - s.x) * 0.55, y: s.y };
  const c2 = { x: s.x + (e.x - s.x) * 0.8, y: s.y + (e.y - s.y) * 0.85 };
  return `M${s.x.toFixed(1)},${s.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
}

/** How each layer reads in each phase (intensity: idle 3 → success 7). */
const LOOK: Record<
  GatePhase,
  { signals: number; labels: number; lanes: number; frags: number; ring: number; core: number }
> = {
  idle: { signals: 0.55, labels: 0.55, lanes: 0.16, frags: 0.22, ring: 1, core: 0.7 },
  user: { signals: 1, labels: 1, lanes: 0.3, frags: 0.3, ring: 1, core: 0.8 },
  pass: { signals: 0.9, labels: 0.72, lanes: 0.42, frags: 0.1, ring: 0.9, core: 0.88 },
  submit: { signals: 0.45, labels: 0.3, lanes: 0.5, frags: 0.05, ring: 0.78, core: 1 },
  success: { signals: 0.12, labels: 0, lanes: 0.2, frags: 0, ring: 0.3, core: 1 },
  fail: { signals: 0.8, labels: 0.7, lanes: 0.3, frags: 0.12, ring: 0.9, core: 0.7 },
};

export function GatewayScene({
  phase,
  variant,
  className,
}: {
  phase: GatePhase;
  variant: 'wide' | 'compact';
  className?: string;
}) {
  const { locale } = useLocale();
  const reduce = usePrefersReducedMotion();
  const id = useId();
  const g = variant === 'wide' ? WIDE : COMPACT;
  const look = LOOK[phase];
  const names = departmentsFor(locale);
  const dept = (k: DeptKey) => names.find((d) => d.id === k)!;
  const lanes = g.signals.map((s) => ({ ...s, d: lane(s, g.gate, g.r[0] + 4) }));
  const t = (duration: number, delay = 0) =>
    reduce ? { duration: 0 } : { duration, delay, ease: EASE_CORE };
  const drawing = phase === 'submit' || phase === 'success';
  const tight = phase === 'pass' || phase === 'fail' || phase === 'submit';
  const ws = g.workspace;
  const k = g.r[1] / 68; // scale of small details

  return (
    <svg
      aria-hidden
      data-gateway={variant}
      data-phase={phase}
      viewBox={`0 0 ${g.w} ${g.h}`}
      preserveAspectRatio={variant === 'wide' ? 'xMaxYMid meet' : 'xMidYMax meet'}
      className={className}
    >
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--color-brand-soft)" />
          <stop offset="55%" stopColor="var(--color-brand-glow)" />
          <stop offset="100%" stopColor="var(--color-brand-deep)" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor="rgb(62 240 192 / 0.28)" />
          <stop offset="100%" stopColor="rgb(62 240 192 / 0)" />
        </radialGradient>
      </defs>

      {/* The seam between the organization outside and the workspace inside */}
      {variant === 'wide' && (
        <line
          x1={g.gate.x}
          x2={g.gate.x}
          y1={14}
          y2={g.h - 14}
          stroke="rgb(190 235 222 / 0.07)"
          strokeDasharray="2 6"
        />
      )}

      {/* Faint operational fragments */}
      <motion.g animate={{ opacity: look.frags }} transition={t(0.5)}>
        {g.fragments.map((f) => (
          <text
            key={f.t}
            x={f.x}
            y={f.y}
            fill="rgb(190 235 222 / 0.9)"
            fontSize="10"
            fontFamily="var(--font-mono, ui-monospace)"
            letterSpacing="0.08em"
          >
            {f.t}
          </text>
        ))}
      </motion.g>

      {/* Work lanes, then the moving signals */}
      <motion.g animate={tight ? { x: g.pull.x, y: g.pull.y } : { x: 0, y: 0 }} transition={t(0.6)}>
        <motion.g animate={{ opacity: look.lanes }} transition={t(0.4)}>
          {lanes.map((l) => (
            <path key={l.id} d={l.d} fill="none" stroke="rgb(62 240 192)" strokeWidth={1} />
          ))}
        </motion.g>

        {/* Submit: every lane lights toward the one gate */}
        {lanes.map((l, i) => (
          <motion.path
            key={`draw-${l.id}`}
            data-align={l.id}
            d={l.d}
            fill="none"
            stroke={`var(--color-ws-${l.id})`}
            strokeWidth={1.6}
            strokeLinecap="round"
            initial={false}
            animate={drawing ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
            transition={t(0.45, i * 0.03)}
          />
        ))}

        {/* Idle: a slow state pulse on three lanes (none under reduced motion) */}
        {!reduce &&
          (phase === 'idle' || phase === 'user' || phase === 'pass') &&
          lanes
            .filter((_, i) => i % 2 === 1)
            .map((l, i) => (
              <circle key={`pulse-${l.id}`} r={1.8 * Math.max(k, 0.7)} fill="rgb(62 240 192 / 0.7)">
                <animateMotion
                  dur="8s"
                  // Negative offsets start mid-lane, never parked at the SVG origin.
                  begin={`-${i * 2.7}s`}
                  repeatCount="indefinite"
                  path={l.d}
                  keyPoints="0;1"
                  keyTimes="0;1"
                />
              </circle>
            ))}

        <motion.g animate={{ opacity: look.signals }} transition={t(0.4)}>
          {lanes.map((s) => (
            <g key={s.id} data-signal={s.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r={10 * Math.max(k, 0.6)}
                fill={`var(--color-ws-${s.id})`}
                opacity={0.12}
              />
              <circle
                cx={s.x}
                cy={s.y}
                r={4.5 * Math.max(k, 0.7)}
                fill={`var(--color-ws-${s.id})`}
              />
            </g>
          ))}
        </motion.g>

        <motion.g animate={{ opacity: look.labels }} transition={t(0.4)}>
          {lanes
            .filter((s) => s.label)
            .map((s) => {
              const d = dept(s.id);
              const wide = variant === 'wide';
              const right = wide || s.x > g.gate.x;
              return (
                <g key={`label-${s.id}`}>
                  <text
                    x={wide ? s.x + 16 : right ? s.x + 9 : s.x - 9}
                    y={wide ? s.y - 15 : s.y - 7}
                    textAnchor={right ? 'start' : 'end'}
                    fill="var(--color-text-primary)"
                    fontSize={wide ? 14 : 11}
                    fontWeight={600}
                  >
                    {d.name}
                  </text>
                  {wide && (
                    <text
                      x={s.x + 16}
                      y={s.y - 2}
                      fill="var(--color-text-muted)"
                      fontSize="9"
                      letterSpacing="0.14em"
                    >
                      {d.nameEn.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
        </motion.g>
      </motion.g>

      {/* A failed attempt: one amber line stops before the gate */}
      <motion.g
        data-failed-line
        initial={false}
        animate={{ opacity: phase === 'fail' ? 1 : 0 }}
        transition={t(0.3)}
      >
        <line
          x1={g.fail[0].x}
          y1={g.fail[0].y}
          x2={g.fail[1].x}
          y2={g.fail[1].y}
          stroke="rgb(245 184 75 / 0.75)"
          strokeWidth={1.4}
          strokeDasharray="4 4"
        />
        {variant === 'wide' ? (
          <line
            x1={g.fail[1].x}
            x2={g.fail[1].x}
            y1={g.fail[1].y - 7}
            y2={g.fail[1].y + 7}
            stroke="rgb(245 184 75)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : (
          <line
            x1={g.fail[1].x - 6}
            x2={g.fail[1].x + 6}
            y1={g.fail[1].y}
            y2={g.fail[1].y}
            stroke="rgb(245 184 75)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
      </motion.g>

      {/* The gate */}
      <g data-gate>
        <circle cx={g.gate.x} cy={g.gate.y} r={g.r[0] * 1.6} fill={`url(#${id}-halo)`} />
        <motion.circle
          cx={g.gate.x}
          cy={g.gate.y}
          fill="none"
          stroke="rgb(62 240 192 / 0.3)"
          strokeDasharray="3 7"
          initial={false}
          animate={{ r: g.r[0] * look.ring, opacity: phase === 'success' ? 0 : 1 }}
          transition={t(0.55)}
        />
        <motion.g
          initial={false}
          animate={{ opacity: phase === 'success' ? 0 : 1 }}
          transition={t(0.35, phase === 'success' ? 0.05 : 0)}
        >
          <motion.circle
            cx={g.gate.x}
            cy={g.gate.y}
            fill="none"
            stroke={phase === 'fail' ? 'rgb(245 184 75 / 0.55)' : 'rgb(62 240 192 / 0.5)'}
            strokeWidth={1.2}
            initial={false}
            animate={{ r: g.r[1] * (phase === 'submit' ? 0.86 : 1) }}
            transition={t(0.5)}
          />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i - Math.PI / 2;
            return (
              <circle
                key={i}
                cx={g.gate.x + g.r[1] * Math.cos(a)}
                cy={g.gate.y + g.r[1] * Math.sin(a)}
                r={3 * Math.max(k, 0.7)}
                fill="var(--color-brand-glow)"
                opacity={0.85}
              />
            );
          })}
          <circle
            cx={g.gate.x}
            cy={g.gate.y}
            r={g.r[2]}
            fill="none"
            stroke="rgb(62 240 192 / 0.22)"
          />
          <motion.circle
            cx={g.gate.x}
            cy={g.gate.y}
            r={g.r[3]}
            fill={`url(#${id}-core)`}
            initial={false}
            animate={{ opacity: look.core }}
            transition={t(0.4)}
          />
        </motion.g>

        {/* Success: the gate resolves into one focused workspace */}
        <motion.g
          data-workspace
          initial={false}
          animate={phase === 'success' ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
          transition={t(0.5, 0.12)}
          style={{ transformOrigin: `${g.gate.x}px ${g.gate.y}px` }}
        >
          <rect
            x={g.gate.x - ws.w / 2}
            y={g.gate.y - ws.h / 2}
            width={ws.w}
            height={ws.h}
            rx={12 * Math.max(k, 0.6)}
            fill="rgb(10 24 33 / 0.95)"
            stroke="rgb(62 240 192 / 0.7)"
            strokeWidth={1.2}
          />
          <rect
            x={g.gate.x - ws.w / 2}
            y={g.gate.y - ws.h / 2}
            width={ws.w}
            height={ws.h * 0.2}
            rx={12 * Math.max(k, 0.6)}
            fill="rgb(62 240 192 / 0.14)"
          />
          {[0.42, 0.6, 0.78].map((f, i) => (
            <rect
              key={f}
              x={g.gate.x - ws.w / 2 + ws.w * 0.1}
              y={g.gate.y - ws.h / 2 + ws.h * f}
              width={ws.w * (i === 0 ? 0.62 : i === 1 ? 0.78 : 0.48)}
              height={Math.max(2, ws.h * 0.06)}
              rx={2}
              fill="rgb(190 235 222 / 0.25)"
            />
          ))}
        </motion.g>
      </g>

      {/* The way inside — toward the workspace panel */}
      <motion.path
        d={g.exit}
        stroke="rgb(62 240 192)"
        strokeWidth={1.4}
        initial={false}
        animate={{ opacity: phase === 'success' ? 1 : phase === 'idle' ? 0.25 : 0.5 }}
        transition={t(0.4)}
      />
    </svg>
  );
}
