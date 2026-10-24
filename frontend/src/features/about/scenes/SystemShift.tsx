import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Kicker } from '@/components/editorial/Layout';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ABOUT } from '../copy';
import { HERO_LANES } from '../model';
import { easeInOut, lerp, segment, useSceneScroll } from '../motion';
import { ABOUT_SCENES } from './copy';

/*
 * Chapter 04 — common system design vs the CORE approach, as a state
 * transformation driven by native scroll. Left: modules keep expanding out
 * of one system and every user is wired to every module. Right: scattered
 * work collapses into focused department workspaces on one shared state.
 * The approved step chains stay as text under each side.
 */

const C = { x: 260, y: 165 };
/** Sixteen module tiles on two rings. */
const TILES = [
  ...Array.from({ length: 6 }, (_, i) => ({ a: (i * 60 - 90) * (Math.PI / 180), r: 92 })),
  ...Array.from({ length: 10 }, (_, i) => ({ a: (i * 36 - 72) * (Math.PI / 180), r: 146 })),
].map((t) => ({ x: C.x + Math.cos(t.a) * t.r * 1.35, y: C.y + Math.sin(t.a) * t.r * 0.95 }));
const USERS = [70, 165, 260].map((y) => ({ x: 22, y }));
const tileWindow = (i: number) => [0.04 + i * 0.04, 0.16 + i * 0.04] as const;

function Tile({ i, p }: { i: number; p: MotionValue<number> }) {
  const t = TILES[i]!;
  const k = useTransform(p, (v) => easeInOut(segment(v, ...tileWindow(i))));
  const x = useTransform(k, (v) => lerp(C.x, t.x, v) - 18);
  const y = useTransform(k, (v) => lerp(C.y, t.y, v) - 9);
  const wire = useTransform(k, (v) => v * 0.22);
  return (
    <>
      {USERS.map((u) => (
        <motion.line
          key={u.y}
          x1={u.x}
          y1={u.y}
          x2={t.x}
          y2={t.y}
          stroke="#a3b8b2"
          strokeWidth="0.8"
          style={{ opacity: wire }}
        />
      ))}
      <motion.rect
        width="36"
        height="18"
        rx="4"
        fill="#0e1922"
        stroke="#a3b8b2"
        strokeOpacity="0.45"
        x={x}
        y={y}
        style={{ opacity: k }}
      />
    </>
  );
}

function CommonScene({ p }: { p: MotionValue<number> }) {
  const s = useCopy(ABOUT_SCENES).systems;
  const [n, setN] = useState(4);
  useMotionValueEvent(p, 'change', (v) =>
    setN(4 + TILES.filter((_, i) => v >= tileWindow(i)[1]).length),
  );
  return (
    <>
      <svg viewBox="0 0 520 330" className="block w-full" aria-hidden>
        {TILES.map((_, i) => (
          <Tile key={i} i={i} p={p} />
        ))}
        <rect
          x={C.x - 54}
          y={C.y - 22}
          width="108"
          height="44"
          rx="10"
          fill="#101c26"
          stroke="#a3b8b2"
          strokeOpacity="0.6"
        />
        <text x={C.x} y={C.y + 5} textAnchor="middle" fill="#a3b8b2" fontSize="13">
          {s.system}
        </text>
        {USERS.map((u) => (
          <circle key={u.y} cx={u.x} cy={u.y} r="7" fill="#e8fff7" fillOpacity="0.8" />
        ))}
      </svg>
      <p data-menu-count className="mt-2 text-right text-caption text-text-muted tabular">
        {s.menus(n)}
      </p>
    </>
  );
}

/** Twenty pieces of work, scattered, then gathered four to a workspace. */
const DOTS = Array.from({ length: 20 }, (_, i) => {
  const ws = Math.floor(i / 4);
  const k = i % 4;
  return {
    ws,
    from: { x: 40 + ((i * 97) % 440), y: 30 + ((i * 53) % 230) },
    to: { x: 48 + ws * 100 + (k % 2) * 22, y: 128 + Math.floor(k / 2) * 22 },
  };
});

function Dot({ i, p }: { i: number; p: MotionValue<number> }) {
  const d = DOTS[i]!;
  const k = useTransform(p, (v) => easeInOut(segment(v, 0.12, 0.62)));
  const cx = useTransform(k, (v) => lerp(d.from.x, d.to.x, v));
  const cy = useTransform(k, (v) => lerp(d.from.y, d.to.y, v));
  const opacity = useTransform(k, (v) => lerp(0.45, 1, v));
  return (
    <motion.circle
      r="5"
      fill={`var(--color-ws-${HERO_LANES[d.ws]})`}
      cx={cx}
      cy={cy}
      style={{ opacity }}
    />
  );
}

function CoreScene({ p }: { p: MotionValue<number> }) {
  const s = useCopy(ABOUT_SCENES).systems;
  const rooms = useTransform(p, (v) => segment(v, 0.35, 0.72));
  const state = useTransform(p, (v) => segment(v, 0.6, 0.95));
  return (
    <svg viewBox="0 0 520 330" className="block w-full" aria-hidden>
      <motion.g style={{ opacity: rooms }}>
        {HERO_LANES.map((l, i) => (
          <g key={l}>
            <rect
              x={26 + i * 100}
              y="100"
              width="88"
              height="92"
              rx="14"
              fill="rgb(25 195 154 / 0.06)"
              stroke={`var(--color-ws-${l})`}
              strokeOpacity="0.6"
            />
            <line
              x1={70 + i * 100}
              y1="192"
              x2={70 + i * 100}
              y2="262"
              stroke="#3ef0c0"
              strokeOpacity="0.4"
            />
          </g>
        ))}
      </motion.g>
      {DOTS.map((_, i) => (
        <Dot key={i} i={i} p={p} />
      ))}
      <motion.path
        d="M 70 262 L 470 262"
        stroke="#3ef0c0"
        strokeWidth="2.5"
        fill="none"
        style={{ pathLength: state }}
      />
      <motion.text
        x="260"
        y="292"
        textAnchor="middle"
        fill="#3ef0c0"
        fontSize="13"
        style={{ opacity: state }}
      >
        {s.shared}
      </motion.text>
    </svg>
  );
}

function Chain({
  kind,
  label,
  steps,
}: {
  kind: 'traditional' | 'core';
  label: string;
  steps: readonly string[];
}) {
  const core = kind === 'core';
  return (
    <div className="mt-5">
      <p className="sr-only">{label}</p>
      <ol
        data-path={kind}
        className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2"
      >
        {steps.map((st, i) => (
          <li key={st} className="flex items-center gap-2 text-label">
            <span
              className={cn(
                core
                  ? i === steps.length - 1
                    ? 'font-semibold text-brand-soft'
                    : 'text-text-primary'
                  : 'text-text-secondary',
              )}
            >
              {core && i === 1 && (
                <span aria-hidden className="mr-1.5 inline-flex gap-0.5 align-middle">
                  {HERO_LANES.map((d) => (
                    <DeptDot key={d} id={d} className="size-1.5" />
                  ))}
                </span>
              )}
              {st}
            </span>
            {i < steps.length - 1 && (
              <>
                <ArrowDown
                  aria-hidden
                  className={cn('size-3.5 sm:hidden', core ? 'text-brand-glow' : 'text-text-muted')}
                />
                <ArrowRight
                  aria-hidden
                  className={cn(
                    'hidden size-3.5 sm:block',
                    core ? 'text-brand-glow' : 'text-text-muted',
                  )}
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SystemShift() {
  const c = useCopy(ABOUT).systems;
  const s = useCopy(ABOUT_SCENES).systems;
  const ref = useRef<HTMLElement>(null);
  const p = useSceneScroll(ref, ['start 0.9', 'center 0.4']);
  return (
    <figure
      ref={ref}
      aria-label={s.visual}
      data-system-shift
      className="m-0 mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
    >
      <div
        data-side="common"
        className="rounded-[2rem] bg-white/[0.02] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:p-8"
      >
        <Kicker tone="muted">{s.common}</Kicker>
        <p className="mt-2 text-label text-text-muted">{c.traditional.label}</p>
        <div className="mt-4">
          <CommonScene p={p} />
        </div>
        <p className="mt-2 text-label text-text-secondary">{s.commonCaption}</p>
        <Chain kind="traditional" label={c.traditional.label} steps={c.traditional.steps} />
      </div>
      <div
        data-side="core"
        className="rounded-[2rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.92),rgb(6_13_20/0.94))] p-5 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.18),0_40px_120px_-60px_rgb(62_240_192/0.5)] sm:p-8"
      >
        <Kicker tone="clear">{s.core}</Kicker>
        <p className="mt-2 text-label text-brand-soft">{c.core.label}</p>
        <div className="mt-4">
          <CoreScene p={p} />
        </div>
        <p className="mt-2 text-label text-text-primary">{s.coreCaption}</p>
        <Chain kind="core" label={c.core.label} steps={c.core.steps} />
      </div>
    </figure>
  );
}
