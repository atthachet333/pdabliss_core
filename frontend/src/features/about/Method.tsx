import { motion } from 'framer-motion';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT } from './copy';
import { ABOUT_CHAPTER, METHOD_STEPS, STAGES, type Stage } from './model';

/*
 * 05 From process to product — the signature PDA BLISS methodology. Ten
 * steps, grouped into the four forms the work takes on the way: notes from
 * the floor → a responsibility map → a workflow → a CORE screen. Each stage
 * is drawn a little more structured than the one before.
 */

const INK = {
  sketch: '#c9b98f',
  warn: '#f5b84b',
  line: '#a3b8b2',
  lit: '#3ef0c0',
  deep: '#0c1822',
};

function NotesSketch() {
  const c = useCopy(ABOUT).approach.sketch;
  return (
    <g>
      <g transform="rotate(-5 90 80)">
        <rect
          x="24"
          y="22"
          width="128"
          height="112"
          rx="4"
          fill="#1a1813"
          stroke={INK.sketch}
          strokeOpacity="0.35"
        />
        {[46, 62, 78, 94, 110].map((y, i) => (
          <path
            key={y}
            d={`M 38 ${y} q 18 -4 36 0 t 36 0 ${i % 2 ? 't 18 -2' : ''}`}
            fill="none"
            stroke={INK.sketch}
            strokeOpacity="0.5"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}
        <circle
          cx="132"
          cy="108"
          r="12"
          fill="none"
          stroke={INK.warn}
          strokeOpacity="0.7"
          strokeDasharray="3 3"
        />
      </g>
      <g transform="rotate(6 205 70)">
        <rect
          x="160"
          y="30"
          width="98"
          height="78"
          rx="3"
          fill="#2a2516"
          stroke={INK.warn}
          strokeOpacity="0.4"
        />
        {c.notes.map((n, i) => (
          <text key={n} x="170" y={54 + i * 20} fill="#f3e3b8" fontSize="12.5">
            {n}
          </text>
        ))}
      </g>
      <path
        d="M 150 140 q 30 14 60 -4"
        fill="none"
        stroke={INK.sketch}
        strokeOpacity="0.45"
        strokeDasharray="4 4"
      />
    </g>
  );
}

function MapSketch() {
  const c = useCopy(ABOUT).approach.sketch;
  const nodes = [
    { x: 60, y: 52, ws: 'sales' },
    { x: 214, y: 52, ws: 'warehouse' },
    { x: 137, y: 132, ws: 'accounting' },
  ];
  return (
    <g>
      <line
        x1="60"
        y1="52"
        x2="214"
        y2="52"
        stroke={INK.line}
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <line
        x1="214"
        y1="52"
        x2="137"
        y2="132"
        stroke={INK.warn}
        strokeOpacity="0.75"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <line
        x1="60"
        y1="52"
        x2="137"
        y2="132"
        stroke={INK.line}
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <circle cx="176" cy="92" r="9" fill={INK.deep} stroke={INK.warn} strokeOpacity="0.8" />
      <text x="176" y="96.5" textAnchor="middle" fill={INK.warn} fontSize="12" fontWeight="600">
        !
      </text>
      {nodes.map((n, i) => (
        <g key={n.ws}>
          <circle
            cx={n.x}
            cy={n.y}
            r="17"
            fill={INK.deep}
            stroke={`var(--color-ws-${n.ws})`}
            strokeOpacity="0.8"
            strokeWidth="1.5"
          />
          <circle cx={n.x} cy={n.y} r="5" fill={`var(--color-ws-${n.ws})`} />
          <text
            x={n.x}
            y={i === 2 ? n.y + 34 : n.y - 26}
            textAnchor="middle"
            fill="#eef6f3"
            fontSize="12.5"
          >
            {c.roles[i]}
          </text>
        </g>
      ))}
    </g>
  );
}

function WorkflowSketch() {
  const xs = [30, 92, 178, 240];
  return (
    <g>
      <line
        x1="30"
        y1="86"
        x2="240"
        y2="86"
        stroke={INK.lit}
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      {xs.map((x, i) => (
        <g key={x}>
          <rect
            x={x - 20}
            y="70"
            width="40"
            height="32"
            rx="8"
            fill={INK.deep}
            stroke={INK.lit}
            strokeOpacity={i < 2 ? 0.8 : 0.4}
          />
          <rect
            x={x - 11}
            y="83"
            width="22"
            height="6"
            rx="3"
            fill={INK.lit}
            fillOpacity={i < 2 ? 0.7 : 0.2}
          />
        </g>
      ))}
      {/* An approval gate between the second and third states */}
      <rect
        x="125"
        y="76"
        width="20"
        height="20"
        rx="3"
        transform="rotate(45 135 86)"
        fill={INK.deep}
        stroke={INK.lit}
        strokeWidth="1.5"
      />
      <path
        d="M 129 86 l 4 4 l 7 -8"
        fill="none"
        stroke={INK.lit}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 92 102 q 0 30 43 30 t 43 -30"
        fill="none"
        stroke={INK.line}
        strokeOpacity="0.35"
        strokeDasharray="3 4"
      />
    </g>
  );
}

function InterfaceSketch() {
  const c = useCopy(ABOUT).approach.sketch;
  return (
    <g>
      <rect
        x="18"
        y="16"
        width="244"
        height="138"
        rx="10"
        fill="#08121b"
        stroke={INK.lit}
        strokeOpacity="0.45"
      />
      <rect x="18" y="16" width="56" height="138" rx="10" fill="#0c1822" />
      {[38, 56, 74, 92].map((y, i) => (
        <rect
          key={y}
          x="30"
          y={y}
          width={i === 0 ? 32 : 26}
          height="6"
          rx="3"
          fill={i === 0 ? INK.lit : INK.line}
          fillOpacity={i === 0 ? 0.8 : 0.25}
        />
      ))}
      <rect x="88" y="30" width="80" height="8" rx="4" fill={INK.line} fillOpacity="0.3" />
      <rect
        x="86"
        y="50"
        width="164"
        height="34"
        rx="8"
        fill="rgb(25 195 154 / 0.16)"
        stroke={INK.lit}
        strokeOpacity="0.6"
      />
      <text x="98" y="71.5" fill="#eef6f3" fontSize="12.5" fontWeight="600">
        {c.next}
      </text>
      <path
        d="M 228 61 l 7 6 l -7 6"
        fill="none"
        stroke={INK.lit}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {[96, 114, 132].map((y) => (
        <rect
          key={y}
          x="88"
          y={y}
          width="150"
          height="8"
          rx="4"
          fill={INK.line}
          fillOpacity="0.14"
        />
      ))}
    </g>
  );
}

const SKETCH: Record<Stage, () => React.JSX.Element> = {
  notes: NotesSketch,
  map: MapSketch,
  workflow: WorkflowSketch,
  interface: InterfaceSketch,
};

const STAGE_TONE: Record<Stage, string> = {
  notes: 'text-warning/80',
  map: 'text-text-secondary',
  workflow: 'text-brand-soft',
  interface: 'text-brand-glow',
};

export function ApproachChapter() {
  const c = useCopy(ABOUT).approach;
  const reduce = usePrefersReducedMotion();
  const stepNo = (id: string) => String(METHOD_STEPS.indexOf(id as never)).padStart(2, '0');
  return (
    <Chapter id={ABOUT_CHAPTER.approach} labelledBy="approach-title" plane="glow" space="lg">
      <Frame width="full">
        <StoryHead
          index="05"
          kicker={c.kicker}
          id="approach-title"
          title={c.title}
          lead={c.lead}
          className="max-w-4xl"
        />

        <figure aria-label={c.visual} className="relative mt-16 lg:mt-24">
          {/* The thread through all four stages */}
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-[0.6875rem] w-px bg-[linear-gradient(to_bottom,rgb(245_184_75/0.45),rgb(62_240_192/0.75))] lg:hidden"
          />
          <ol data-method className="relative grid grid-cols-1 gap-14 lg:grid-cols-4 lg:gap-8">
            {STAGES.map((stage, si) => {
              const Sketch = SKETCH[stage.id];
              return (
                <motion.li
                  key={stage.id}
                  data-stage={stage.id}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                  transition={{ delay: si * 0.12, duration: 0.7, ease: EASE_CORE }}
                  className="relative pl-10 lg:pl-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1 left-0 flex size-[1.375rem] items-center justify-center rounded-full bg-surface-dark lg:hidden',
                      si === 3
                        ? 'shadow-[inset_0_0_0_2px_rgb(62_240_192)]'
                        : 'shadow-[inset_0_0_0_1.5px_rgb(163_184_178/0.5)]',
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current text-brand-glow" />
                  </span>
                  {si < STAGES.length - 1 && (
                    <ChevronRight
                      aria-hidden
                      className="absolute top-[7.5rem] -right-6 hidden size-4 text-brand-glow/60 lg:block"
                    />
                  )}
                  <p className={cn('text-caption font-semibold uppercase', STAGE_TONE[stage.id])}>
                    {String(si + 1).padStart(2, '0')} · {c.stages[stage.id].title}
                  </p>
                  <div
                    className={cn(
                      'mt-4 overflow-hidden rounded-2xl lg:mt-7',
                      si === 3
                        ? 'bg-[linear-gradient(180deg,rgb(13_25_36/0.95),rgb(6_13_20/0.95))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22),0_30px_80px_-40px_rgb(62_240_192/0.45)]'
                        : 'bg-white/[0.025] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]',
                    )}
                  >
                    <svg viewBox="0 0 280 170" className="block w-full" aria-hidden>
                      <Sketch />
                    </svg>
                  </div>
                  <p className="mt-4 text-label text-text-secondary">{c.stages[stage.id].body}</p>
                  <ol className="mt-6 space-y-4 border-t border-border-soft pt-5">
                    {stage.steps.map((step) => (
                      <li
                        key={step}
                        data-step={step}
                        className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2"
                      >
                        <span aria-hidden className="pt-0.5 text-caption text-text-muted tabular">
                          {stepNo(step)}
                        </span>
                        <div>
                          <p className="text-label font-semibold text-text-primary">
                            {c.steps[step].title}
                          </p>
                          <p className="mt-0.5 text-caption text-text-secondary">
                            {c.steps[step].body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </motion.li>
              );
            })}
          </ol>
          <p
            data-loop
            className="mt-12 flex items-center gap-2.5 pl-10 text-label text-brand-soft lg:justify-end lg:pl-0"
          >
            <RotateCcw aria-hidden className="size-4" />
            {c.loop}
          </p>
        </figure>
      </Frame>
    </Chapter>
  );
}
