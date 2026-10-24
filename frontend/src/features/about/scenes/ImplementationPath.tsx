import { motion, useMotionValueEvent } from 'framer-motion';
import { useRef, useState } from 'react';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ABOUT } from '../copy';
import { IMPLEMENTATION } from '../model';
import { useSceneScroll } from '../motion';

/*
 * Chapter 07 — implementation as one continuous blueprint path, drawn by
 * native scroll. Wide screens: a wave across the page with nine points;
 * phones: the same path runs down the left edge. Every step is plain text.
 */

const N = IMPLEMENTATION.length;
/** Point i on the wave, in % of the path box. */
const POINT = (i: number) => ({ x: 4 + (i * 92) / (N - 1), y: i % 2 ? 30 : 70 });

function wavePath() {
  let d = '';
  for (let i = 0; i < N; i++) {
    const p = POINT(i);
    const x = p.x * 10;
    const y = p.y * 2;
    if (i === 0) d = `M ${x} ${y}`;
    else {
      const q = POINT(i - 1);
      const mx = ((q.x + p.x) / 2) * 10;
      d += ` C ${mx} ${q.y * 2}, ${mx} ${y}, ${x} ${y}`;
    }
  }
  return d;
}
const WAVE = wavePath();

export function ImplementationPath() {
  const c = useCopy(ABOUT).implementation;
  const ref = useRef<HTMLDivElement>(null);
  const p = useSceneScroll(ref, ['start 0.85', 'end 0.55']);
  const [reached, setReached] = useState(() => Math.round(p.get() * (N - 1)));
  useMotionValueEvent(p, 'change', (v) => setReached(Math.round(v * (N - 1))));
  return (
    <div ref={ref} className="relative mt-14">
      {/* Wide: the blueprint wave */}
      <svg
        aria-hidden
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 hidden h-56 w-full lg:block"
      >
        <path
          d={WAVE}
          fill="none"
          stroke="#a3b8b2"
          strokeOpacity="0.12"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          vectorEffect="non-scaling-stroke"
        />
        <motion.path
          d={WAVE}
          fill="none"
          stroke="#3ef0c0"
          strokeOpacity="0.8"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: p }}
        />
      </svg>
      {/* Phones / tablets: one line down the side */}
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.7),rgb(62_240_192/0.2))] lg:hidden"
      />
      <ol data-implementation className="relative grid grid-cols-1 gap-5 lg:block lg:h-56">
        {IMPLEMENTATION.map((s, i) => {
          const pt = POINT(i);
          const lit = i <= reached;
          const below = pt.y > 50;
          return (
            <li
              key={s}
              data-implementation-step={s}
              data-reached={lit || undefined}
              style={{ ['--x' as string]: `${pt.x}%`, ['--y' as string]: `${pt.y}%` }}
              className="relative flex items-baseline gap-4 pl-8 lg:absolute lg:top-(--y) lg:left-(--x) lg:block lg:w-28 lg:-translate-x-1/2 lg:-translate-y-[0.4375rem] lg:pl-0 lg:text-center"
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-1.5 left-0 size-[0.875rem] rounded-full bg-surface-dark transition-shadow duration-500 lg:static lg:mx-auto lg:block',
                  lit
                    ? 'shadow-[inset_0_0_0_2px_rgb(62_240_192),0_0_14px_rgb(62_240_192/0.6)]'
                    : 'shadow-[inset_0_0_0_2px_rgb(163_184_178/0.4)]',
                )}
              />
              <span className={cn('lg:absolute lg:inset-x-0', below ? 'lg:top-6' : 'lg:bottom-6')}>
                <span aria-hidden className="text-caption text-text-muted tabular lg:block">
                  {String(i + 1).padStart(2, '0')}
                </span>{' '}
                <span
                  className={cn(
                    'text-label font-semibold transition-colors duration-500 lg:block',
                    lit ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {c.steps[s]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
