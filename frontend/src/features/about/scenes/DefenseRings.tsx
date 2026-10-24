import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { Lines, QuietLink } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT } from '../copy';
import { ABOUT_LINKS, GUARDS, type Guard } from '../model';
import { ABOUT_SCENES } from './copy';

/*
 * Signature scene 3 — Human Error as five concentric layers of operational
 * defense around a correct handoff. Choosing a layer sends one work item in
 * from the edge; it passes the outer layers and stops at the chosen one,
 * which shows what happened and what CORE is designed to do about it.
 */

const O = 220;
const RADII = [196, 162, 128, 94, 60];
const ANGLE = (-40 * Math.PI) / 180;
const at = (r: number) => ({ x: O + Math.cos(ANGLE) * r, y: O + Math.sin(ANGLE) * r });

function arc(r: number, spread: number) {
  const a1 = ANGLE - spread;
  const a2 = ANGLE + spread;
  const p1 = { x: O + Math.cos(a1) * r, y: O + Math.sin(a1) * r };
  const p2 = { x: O + Math.cos(a2) * r, y: O + Math.sin(a2) * r };
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

export function DefenseRings() {
  const c = useCopy(ABOUT).systems;
  const d = useCopy(ABOUT_SCENES).defense;
  const reduce = usePrefersReducedMotion();
  const [sel, setSel] = useState<Guard>('guide');
  const index = GUARDS.findIndex((g) => g.id === sel);
  const stop = at(RADII[index]! + 16);
  const start = at(232);

  return (
    <div
      data-human-error
      className="mt-24 grid grid-cols-1 gap-12 border-t border-border-soft pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16"
    >
      <figure
        aria-label={d.visual}
        className="m-0 mx-auto w-full max-w-[34rem]"
        data-defense
        data-selected={sel}
      >
        <svg viewBox="0 0 440 440" className="block w-full overflow-visible" aria-hidden>
          <defs>
            <radialGradient id="defense-core">
              <stop offset="0%" stopColor="#3ef0c0" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3ef0c0" stopOpacity="0" />
            </radialGradient>
          </defs>
          {GUARDS.map((g, i) => {
            const passed = i < index;
            const acting = i === index;
            return (
              <g key={g.id} data-ring={g.id}>
                <circle
                  cx={O}
                  cy={O}
                  r={RADII[i]}
                  fill="none"
                  stroke={acting ? '#3ef0c0' : '#a3b8b2'}
                  strokeOpacity={acting ? 0.9 : passed ? 0.35 : 0.16}
                  strokeWidth={acting ? 2.5 : 1}
                  strokeDasharray={passed ? '2 5' : undefined}
                  style={{ transition: 'stroke-opacity 400ms, stroke-width 400ms' }}
                />
                <text
                  x={O}
                  y={O - RADII[i]! + 14}
                  textAnchor="middle"
                  fontSize="10"
                  letterSpacing="2.5"
                  fill={acting ? '#3ef0c0' : '#758c86'}
                >
                  {g.principle}
                </text>
                {acting && (
                  <motion.path
                    key={`barrier-${g.id}`}
                    d={arc(RADII[i]!, 0.32)}
                    fill="none"
                    stroke="#3ef0c0"
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.9 }}
                    transition={{ duration: 0.6, ease: EASE_CORE, delay: reduce ? 0 : 0.35 }}
                  />
                )}
              </g>
            );
          })}
          <circle cx={O} cy={O} r="44" fill="url(#defense-core)" />
          <circle cx={O} cy={O} r="30" fill="#07141a" stroke="#3ef0c0" strokeOpacity="0.6" />
          <path
            d={`M ${O - 9} ${O} l 6 6 l 12 -12`}
            fill="none"
            stroke="#3ef0c0"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* The work item, coming in from the edge */}
          <motion.g
            initial={false}
            animate={{ x: stop.x, y: stop.y }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 16 }}
          >
            <line
              x1="0"
              y1="0"
              x2={start.x - stop.x}
              y2={start.y - stop.y}
              stroke="#f5b84b"
              strokeOpacity="0.4"
              strokeDasharray="3 4"
            />
            <rect
              x="-112"
              y="-32"
              width="104"
              height="22"
              rx="11"
              fill="#1f1a12"
              stroke="#f5b84b"
              strokeOpacity="0.7"
            />
            <text x="-60" y="-17" textAnchor="middle" fontSize="10.5" fill="#f3e3b8">
              {d.item}
            </text>
            <circle r="6" fill="#f5b84b" />
          </motion.g>
        </svg>
        <figcaption className="mt-2 text-center text-caption text-text-muted">
          {d.center}
        </figcaption>
      </figure>

      <div>
        <h3 className="text-[clamp(1.5rem,1.15rem+1.3vw,2.25rem)] leading-[1.3] font-semibold text-text-primary">
          <Lines text={c.humanError.title} />
        </h3>
        <p className="mt-5 max-w-lg text-body text-text-secondary">{c.humanError.body}</p>

        <p id="defense-select" className="mt-8 text-caption font-semibold text-text-muted">
          {d.select}
        </p>
        <div role="group" aria-labelledby="defense-select" className="mt-3 flex flex-wrap gap-2">
          {GUARDS.map((g) => {
            const on = g.id === sel;
            return (
              <button
                key={g.id}
                type="button"
                data-guard={g.id}
                aria-pressed={on}
                onClick={() => setSel(g.id)}
                className={cn(
                  'inline-flex min-h-11 flex-col items-start justify-center rounded-xl px-4 py-1.5 text-left transition-colors',
                  on
                    ? 'bg-brand-primary/15 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.07]',
                )}
              >
                <span className="text-label font-semibold text-text-primary">
                  {c.humanError.guards[g.id]}
                </span>
                <span
                  className={cn(
                    'text-[0.625rem] font-semibold tracking-[0.2em]',
                    on ? 'text-brand-glow' : 'text-text-muted',
                  )}
                >
                  {g.principle}
                </span>
              </button>
            );
          })}
        </div>

        <motion.dl
          key={sel}
          data-defense-detail
          aria-live="polite"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_CORE }}
          className="mt-6 grid grid-cols-1 gap-4 border-l-2 border-brand-primary/50 pl-5 sm:grid-cols-2"
        >
          <div>
            <dt className="text-caption font-semibold text-warning">{d.issue}</dt>
            <dd className="mt-1 text-label text-text-primary">{d.scenarios[sel].issue}</dd>
          </div>
          <div>
            <dt className="text-caption font-semibold text-brand-soft">{d.response}</dt>
            <dd className="mt-1 text-label text-text-primary">{d.scenarios[sel].response}</dd>
          </div>
        </motion.dl>
        <p className="mt-5 text-caption text-text-muted">{d.note}</p>
        <QuietLink to={ABOUT_LINKS.howCoreWorks} data="how-core-works" className="mt-4">
          {c.link}
        </QuietLink>
      </div>
    </div>
  );
}
