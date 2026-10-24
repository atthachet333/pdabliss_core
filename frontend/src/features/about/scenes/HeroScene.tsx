import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  CheckSquare,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Receipt,
  ShieldQuestion,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useDepartments } from '@/config/departments';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import {
  FRAGMENTS,
  HERO_LANES,
  HERO_LINKS,
  HERO_STAGES,
  type FragmentId,
  type FragmentKind,
  type HeroLane,
} from '../model';
import { easeInOut, lerp, segment, useElementSize, useFinePointer } from '../motion';
import { ABOUT_SCENES } from './copy';

/*
 * Signature scene 1 — real work → CORE. One progress value (0 → 1) drives
 * five states: scattered fragments → aligned by responsibility → linked →
 * compressed into departments → one quiet CORE state. The final state is the
 * calmest one. Positions are in % of the scene box; sizes are measured.
 */

export type SceneLayout = 'wide' | 'compact';
type Depth = 'fg' | 'mid' | 'far';

const CARD = { wide: { w: 184, h: 58 }, compact: { w: 136, h: 50 } } as const;

/** Where each fragment starts: scattered, turned, at three depths. */
const CHAOS: Record<
  SceneLayout,
  Record<FragmentId, { x: number; y: number; r: number; d: Depth }>
> = {
  wide: {
    chat: { x: 55, y: 13, r: -7, d: 'fg' },
    quote: { x: 79, y: 8, r: 5, d: 'mid' },
    grn: { x: 66, y: 29, r: 4, d: 'fg' },
    count: { x: 86, y: 33, r: -5, d: 'mid' },
    po: { x: 53, y: 48, r: -3, d: 'fg' },
    supplier: { x: 72, y: 55, r: 7, d: 'fg' },
    approval: { x: 87, y: 63, r: -4, d: 'mid' },
    ledger: { x: 33, y: 82, r: 6, d: 'far' },
    status: { x: 61, y: 75, r: -6, d: 'fg' },
    plan: { x: 25, y: 6, r: 3, d: 'far' },
  },
  compact: {
    chat: { x: 2, y: 3, r: -6, d: 'fg' },
    quote: { x: 46, y: 9, r: 5, d: 'mid' },
    grn: { x: 18, y: 22, r: 4, d: 'fg' },
    count: { x: 48, y: 30, r: -5, d: 'fg' },
    po: { x: 4, y: 40, r: -3, d: 'fg' },
    supplier: { x: 44, y: 50, r: 6, d: 'mid' },
    approval: { x: 8, y: 60, r: -4, d: 'fg' },
    ledger: { x: 48, y: 69, r: 5, d: 'mid' },
    status: { x: 20, y: 78, r: -6, d: 'fg' },
    plan: { x: 46, y: 86, r: 3, d: 'far' },
  },
};
const DEPTH = {
  fg: { s: 1, o: 1 },
  mid: { s: 0.9, o: 0.72 },
  far: { s: 0.8, o: 0.32 },
} as const;

/** Lanes: one row per department. */
const LANES = {
  wide: {
    label: 51,
    slots: [58.5, 74.5],
    chip: 58.5,
    core: { x: 80, y: 40 },
    y: { sales: 14, warehouse: 28, purchasing: 42, accounting: 56, operations: 70 },
  },
  compact: {
    label: -100,
    slots: [1, 51],
    chip: 2,
    core: { x: 48, y: 37 },
    y: { sales: 4, warehouse: 21, purchasing: 38, accounting: 55, operations: 72 },
  },
} as const satisfies Record<
  SceneLayout,
  {
    label: number;
    slots: readonly number[];
    chip: number;
    core: { x: number; y: number };
    y: Record<HeroLane, number>;
  }
>;

/** Stage windows on the 0 → 1 progress. */
const W = {
  align: [0.12, 0.38],
  link: [0.34, 0.52],
  compress: [0.55, 0.72],
  core: [0.74, 0.92],
} as const;
const STAGE_AT = [0.12, 0.38, 0.55, 0.74];

const KIND_ICON: Record<FragmentKind, LucideIcon> = {
  chat: MessageCircle,
  sheet: FileSpreadsheet,
  slip: Receipt,
  checklist: CheckSquare,
  po: FileText,
  approval: ShieldQuestion,
  note: StickyNote,
};
const KIND_STYLE: Record<FragmentKind, string> = {
  chat: 'rounded-2xl rounded-bl-sm bg-[#0f2230]/95 shadow-[inset_0_0_0_1px_rgb(108_184_255/0.25)]',
  sheet:
    'rounded-lg bg-[#0e1a17]/95 bg-[linear-gradient(rgb(52_211_153/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(52_211_153/0.08)_1px,transparent_1px)] bg-[size:14px_12px] shadow-[inset_0_0_0_1px_rgb(52_211_153/0.22)]',
  slip: 'rounded-md border-b-2 border-dashed border-warning/40 bg-[#1d1b16]/95 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.28)]',
  checklist: 'rounded-lg bg-[#141c22]/95 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.16)]',
  po: 'rounded-md bg-[#121a24]/95 shadow-[inset_0_0_0_1px_rgb(169_154_240/0.3)]',
  approval: 'rounded-lg bg-[#1f1a12]/95 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.4)]',
  note: 'rounded-sm bg-[#2a2516]/90 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.22)]',
};

const LANE_OF: Record<FragmentId, HeroLane> = Object.fromEntries(
  FRAGMENTS.map((f) => [f.id, f.lane]),
) as Record<FragmentId, HeroLane>;
const SLOT_OF: Record<FragmentId, number> = Object.fromEntries(
  FRAGMENTS.map((f) => [f.id, FRAGMENTS.filter((g) => g.lane === f.lane).indexOf(f)]),
) as Record<FragmentId, number>;

interface Geometry {
  layout: SceneLayout;
  w: MotionValue<number>;
  h: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}

function useFragmentState(id: FragmentId, p: MotionValue<number>, g: Geometry, fine: boolean) {
  const card = CARD[g.layout];
  const c = CHAOS[g.layout][id];
  const lane = LANES[g.layout];
  const laneY = lane.y[LANE_OF[id]];
  const slotX = lane.slots[SLOT_OF[id]]!;
  const read = ([pv, w, h, mx, my]: number[]) => {
    const align = easeInOut(segment(pv!, ...W.align));
    const compress = easeInOut(segment(pv!, ...W.compress));
    const xp = lerp(lerp(c.x, slotX, align), lane.chip, compress);
    const yp = lerp(c.y, laneY, align);
    let x = (xp / 100) * w!;
    let y = (yp / 100) * h!;
    // Desktop only: loose fragments lean away from a nearby pointer, a few px.
    if (fine && align < 1) {
      const dx = x + card.w / 2 - mx!;
      const dy = y + card.h / 2 - my!;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 260) {
        const k = (1 - d / 260) * 9 * (1 - align);
        x += (dx / d) * k;
        y += (dy / d) * k;
      }
    }
    const depth = DEPTH[c.d];
    return {
      x,
      y,
      r: lerp(c.r, 0, align),
      s: lerp(lerp(depth.s, 1, align), 0.4, compress),
      o: lerp(lerp(depth.o, 1, align), 0, compress),
    };
  };
  const inputs = [p, g.w, g.h, g.mx, g.my];
  return {
    x: useTransform(inputs, (v: number[]) => read(v).x),
    y: useTransform(inputs, (v: number[]) => read(v).y),
    rotate: useTransform(inputs, (v: number[]) => read(v).r),
    scale: useTransform(inputs, (v: number[]) => read(v).s),
    opacity: useTransform(inputs, (v: number[]) => read(v).o),
  };
}

function Fragment({
  id,
  kind,
  p,
  g,
  fine,
  drifting,
  index,
}: {
  id: FragmentId;
  kind: FragmentKind;
  p: MotionValue<number>;
  g: Geometry;
  fine: boolean;
  drifting: boolean;
  index: number;
}) {
  const c = useCopy(ABOUT_SCENES).hero;
  const s = useFragmentState(id, p, g, fine);
  const Icon = KIND_ICON[kind];
  const card = CARD[g.layout];
  return (
    <motion.div
      data-fragment={id}
      data-lane={LANE_OF[id]}
      className="absolute top-0 left-0 origin-top-left"
      style={{ ...s, width: card.w }}
    >
      <div
        className={cn('px-3 py-2', KIND_STYLE[kind], drifting && 'motion-safe:animate-loose')}
        style={{ animationDelay: `${-index * 0.9}s` }}
      >
        <p className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-wide text-text-muted uppercase">
          <Icon className="size-3 shrink-0" />
          {c.kinds[kind]}
        </p>
        <p
          className={cn(
            'mt-0.5 truncate text-text-primary',
            g.layout === 'wide' ? 'text-[0.8125rem]' : 'text-[0.75rem]',
          )}
        >
          {c.fragments[id]}
        </p>
      </div>
    </motion.div>
  );
}

/** Lane labels (wide), department chips and the final CORE state. */
function Structure({ p, g, fine }: { p: MotionValue<number>; g: Geometry; fine: boolean }) {
  const c = useCopy(ABOUT_SCENES).hero;
  const departments = useDepartments();
  const name = (id: string) => departments.find((d) => d.id === id)!.name;
  const lane = LANES[g.layout];
  const card = CARD[g.layout];

  const align = useTransform(p, (v) => segment(v, ...W.align));
  const compress = useTransform(p, (v) => easeInOut(segment(v, ...W.compress)));
  const labelOpacity = useTransform([align, compress], ([a, k]: number[]) => a! * (1 - k!));
  const link = useTransform(p, (v) => segment(v, ...W.link));
  const linkOpacity = useTransform([link, compress], ([l, k]: number[]) => l! * (1 - k!));
  const core = useTransform(p, (v) => easeInOut(segment(v, ...W.core)));
  const coreScale = useTransform(core, (v) => lerp(0.94, 1, v));
  // The CORE state gains a controlled glow when a fine pointer comes close.
  const glow = useTransform([core, g.mx, g.my, g.w, g.h], ([k, mx, my, w, h]: number[]) => {
    if (!fine) return k! * 0.55;
    const d = Math.hypot(mx! - (lane.core.x / 100) * w! - 110, my! - (lane.core.y / 100) * h!);
    return k! * (0.5 + 0.5 * Math.max(0, 1 - d / 320));
  });

  const [box, setBox] = useState({ w: g.w.get(), h: g.h.get() });
  useMotionValueEvent(g.w, 'change', (w) => setBox((b) => ({ ...b, w })));
  useMotionValueEvent(g.h, 'change', (h) => setBox((b) => ({ ...b, h })));
  const at = (xp: number, yp: number) => ({ x: (xp / 100) * box.w, y: (yp / 100) * box.h });
  /**
   * A relationship line between two aligned cards, drawn edge to edge so it
   * is never hidden under a card: facing edges across slots, or an outward
   * arc along the outer edge when both cards share a slot.
   */
  const linkPath = (from: FragmentId, to: FragmentId) => {
    const sa = SLOT_OF[from];
    const sb = SLOT_OF[to];
    const pa = at(lane.slots[sa]!, lane.y[LANE_OF[from]]);
    const pb = at(lane.slots[sb]!, lane.y[LANE_OF[to]]);
    const ya = pa.y + card.h / 2;
    const yb = pb.y + card.h / 2;
    if (sa !== sb) {
      const [l, r] = sa < sb ? [pa, pb] : [pb, pa];
      const [yl, yr] = sa < sb ? [ya, yb] : [yb, ya];
      const x1 = l.x + card.w;
      const x2 = r.x;
      const mid = (x1 + x2) / 2;
      return `M ${x1} ${yl} C ${mid} ${yl}, ${mid} ${yr}, ${x2} ${yr}`;
    }
    const outer = sa === 0 ? pa.x - 2 : pa.x + card.w + 2;
    const bulge = sa === 0 ? outer - 34 : outer + 34;
    return `M ${outer} ${ya} C ${bulge} ${ya}, ${bulge} ${yb}, ${outer} ${yb}`;
  };
  const corePt = at(lane.core.x, lane.core.y);
  const chipH = g.layout === 'wide' ? 44 : 40;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${box.w || 1} ${box.h || 1}`}
        preserveAspectRatio="none"
      >
        {/* Relationship lines between aligned fragments */}
        <motion.g style={{ opacity: linkOpacity }}>
          {HERO_LINKS.map(([a, b]) => {
            return (
              <motion.path
                key={`${a}-${b}`}
                d={linkPath(a, b)}
                fill="none"
                stroke="#3ef0c0"
                strokeOpacity="0.7"
                strokeWidth="1.2"
                style={{ pathLength: link }}
              />
            );
          })}
        </motion.g>
        {/* Departments → one CORE state */}
        <motion.g style={{ opacity: core }}>
          {HERO_LANES.map((l) => {
            const s = at(lane.chip, lane.y[l]);
            const sx = s.x + (g.layout === 'wide' ? 150 : 128);
            const sy = s.y + chipH / 2;
            const ty = corePt.y + 32;
            return (
              <motion.path
                key={l}
                d={`M ${sx} ${sy} C ${(sx + corePt.x) / 2} ${sy}, ${(sx + corePt.x) / 2} ${ty}, ${corePt.x} ${ty}`}
                fill="none"
                stroke="#3ef0c0"
                strokeOpacity="0.45"
                strokeWidth="1.2"
                style={{ pathLength: core }}
              />
            );
          })}
        </motion.g>
      </svg>

      {HERO_LANES.map((l) => {
        const pt = at(lane.label, lane.y[l]);
        const chip = at(lane.chip, lane.y[l]);
        return (
          <div key={l}>
            {g.layout === 'wide' && (
              <motion.p
                className="absolute flex items-center gap-1.5 text-caption text-text-muted"
                style={{ left: pt.x, top: pt.y + card.h / 2 - 10, opacity: labelOpacity }}
              >
                <DeptDot id={l} className="size-1.5" />
                {name(l)}
              </motion.p>
            )}
            <motion.p
              data-chip={l}
              className={cn(
                'absolute flex items-center gap-2 rounded-full bg-surface-dark/90 px-3.5 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28)]',
                g.layout === 'wide' ? 'h-11 w-[150px]' : 'h-10 w-[128px] text-caption',
              )}
              style={{ left: chip.x, top: chip.y + (card.h - chipH) / 2, opacity: compress }}
            >
              <DeptDot id={l} />
              <span className="truncate">{name(l)}</span>
            </motion.p>
          </div>
        );
      })}

      <motion.div
        data-core-state
        className={cn(
          'absolute rounded-2xl bg-[#07141a]/95 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]',
          g.layout === 'wide' ? 'px-5 py-4 whitespace-nowrap' : 'w-[50%] px-3.5 py-3',
        )}
        style={{ left: corePt.x, top: corePt.y, opacity: core, scale: coreScale }}
      >
        <motion.span
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgb(62_240_192/0.35),transparent_70%)]"
          style={{ opacity: glow }}
        />
        <p className="text-caption font-semibold tracking-[0.28em] text-brand-glow">CORE</p>
        <p className="mt-1 text-label font-semibold text-text-primary tabular">{c.core}</p>
        <p className="mt-0.5 text-caption text-text-secondary">{c.coreNote}</p>
      </motion.div>
    </>
  );
}

/**
 * The scene box. `progress` comes from the caller (scroll on desktop, a
 * one-off play on phones, 1 under reduced motion).
 */
export function HeroScene({
  progress,
  layout,
  className,
}: {
  progress: MotionValue<number>;
  layout: SceneLayout;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  const fine = useFinePointer() && layout === 'wide';
  const w = useMotionValue(size.w);
  const h = useMotionValue(size.h);
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);
  useEffect(() => {
    w.set(size.w);
    h.set(size.h);
  }, [size.w, size.h, w, h]);
  const [stage, setStage] = useState(() => stageOf(progress.get()));
  useMotionValueEvent(progress, 'change', (v) => setStage(stageOf(v)));

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!fine) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const onLeave = () => {
    mx.set(-9999);
    my.set(-9999);
  };

  const g: Geometry = { layout, w, h, mx, my };
  return (
    <div
      ref={ref}
      aria-hidden
      data-scene="hero"
      data-stage={HERO_STAGES[stage]}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={className}
    >
      <Structure p={progress} g={g} fine={fine} />
      {FRAGMENTS.map((f, i) => (
        <Fragment
          key={f.id}
          id={f.id}
          kind={f.kind}
          p={progress}
          g={g}
          fine={fine}
          drifting={stage === 0}
          index={i}
        />
      ))}
    </div>
  );
}

function stageOf(v: number) {
  return STAGE_AT.filter((t) => v >= t).length;
}

/** The five stages as readable text — the scene's text equivalent and progress line. */
export function HeroStages({
  progress,
  className,
}: {
  progress: MotionValue<number>;
  className?: string;
}) {
  const c = useCopy(ABOUT_SCENES).hero;
  const [stage, setStage] = useState(() => stageOf(progress.get()));
  useMotionValueEvent(progress, 'change', (v) => setStage(stageOf(v)));
  return (
    <div className={className}>
      <p id="hero-stages-label" className="sr-only">
        {c.stagesLabel}
      </p>
      <div aria-hidden className="relative h-px w-full bg-white/10">
        <motion.span
          className="absolute inset-y-0 left-0 w-full origin-left bg-[linear-gradient(90deg,rgb(245_184_75/0.8),rgb(62_240_192))]"
          style={{ scaleX: progress }}
        />
      </div>
      <ol
        aria-labelledby="hero-stages-label"
        data-hero-stages
        className="mt-3 grid grid-cols-5 gap-2 sm:gap-4"
      >
        {c.stages.map((s, i) => (
          <li
            key={s}
            data-current={i === stage || undefined}
            aria-current={i === stage ? 'step' : undefined}
            className={cn(
              'text-[0.6875rem] leading-snug transition-colors duration-500 sm:text-caption',
              i === stage
                ? 'text-text-primary'
                : i < stage
                  ? 'text-text-secondary'
                  : 'text-text-muted',
            )}
          >
            <span aria-hidden className="block tabular opacity-60">
              {String(i + 1).padStart(2, '0')}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
