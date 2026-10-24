import { motion } from 'framer-motion';
import { useState } from 'react';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT } from '../copy';
import { EXCHANGE, type Exchange } from '../model';
import { ABOUT_SCENES } from './copy';

/*
 * Signature scene 4 — consulting as a working session. Five artifacts lie on
 * one table between three sides: your organization (left), PDA BLISS (near
 * side) and CORE (right). Picking one brings it to the middle of the table;
 * each side then shows what it contributes to that topic.
 */

/** Where each artifact rests on the table (lg), in % of the surface. */
const REST: Record<Exchange, { x: number; y: number; r: number }> = {
  processes: { x: 8, y: 12, r: -5 },
  responsibilities: { x: 62, y: 8, r: 4 },
  problems: { x: 4, y: 66, r: 3 },
  controls: { x: 66, y: 70, r: -4 },
  outcome: { x: 36, y: 80, r: 2 },
};
const CENTRE = { x: 33, y: 36, r: 0 };

type Side = 'org' | 'us' | 'core';

function Contribution({ side, topic }: { side: Side; topic: Exchange }) {
  const c = useCopy(ABOUT).consulting;
  const w = useCopy(ABOUT_SCENES).work;
  const reduce = usePrefersReducedMotion();
  const verb = side === 'org' ? w.brings : side === 'us' ? w.does : w.becomes;
  return (
    <div
      data-side={side}
      className={cn(side === 'core' && 'lg:text-right', side === 'us' && 'lg:text-center')}
    >
      <p
        className={cn(
          'text-caption font-semibold',
          side === 'core'
            ? 'text-brand-glow'
            : side === 'us'
              ? 'text-text-primary'
              : 'text-text-secondary',
        )}
      >
        {c.columns[side]}
      </p>
      <p className="mt-1 text-caption text-text-muted">{verb}</p>
      <motion.p
        key={topic}
        data-contribution={side}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_CORE }}
        className={cn(
          'mt-2 text-[clamp(1.0625rem,0.98rem+0.4vw,1.3125rem)] leading-snug font-semibold',
          side === 'core' ? 'text-brand-soft' : 'text-text-primary',
        )}
      >
        {c.exchange[topic][side]}
      </motion.p>
    </div>
  );
}

export function WorkTable() {
  const c = useCopy(ABOUT).consulting;
  const w = useCopy(ABOUT_SCENES).work;
  const reduce = usePrefersReducedMotion();
  const [topic, setTopic] = useState<Exchange>('processes');
  return (
    <figure aria-label={c.tableCaption} data-work-table data-topic={topic} className="m-0 mt-16">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] lg:gap-10">
        <div className="order-2 lg:order-1">
          <Contribution side="org" topic={topic} />
        </div>

        {/* The table */}
        <div className="relative order-1 lg:order-2">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_70%_60%_at_50%_45%,rgb(62_240_192/0.09),transparent_70%),linear-gradient(180deg,rgb(14_26_36/0.95),rgb(7_14_20/0.95))] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08),0_60px_120px_-60px_rgb(0_0_0/0.9)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[2.5rem] bg-grid [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)] opacity-30"
          />
          <p className="sr-only" id="work-table-select">
            {w.select}
          </p>
          <div
            role="group"
            aria-labelledby="work-table-select"
            className="flex flex-wrap gap-2 p-5 sm:p-6 lg:relative lg:block lg:h-[24rem] lg:p-0"
          >
            {EXCHANGE.map((e) => {
              const on = e === topic;
              const pos = on ? CENTRE : REST[e];
              return (
                <motion.button
                  key={e}
                  type="button"
                  data-artifact={e}
                  aria-pressed={on}
                  onClick={() => setTopic(e)}
                  initial={false}
                  animate={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    rotate: pos.r,
                    scale: on ? 1.08 : 1,
                  }}
                  transition={
                    reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18 }
                  }
                  className={cn(
                    'min-h-11 rounded-xl px-4 py-2.5 text-left text-label transition-[background-color,box-shadow,color] lg:absolute lg:w-[34%]',
                    on
                      ? 'z-10 bg-[#0b1f20] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.6),0_20px_60px_-20px_rgb(62_240_192/0.5)]'
                      : 'bg-[#141c22] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] hover:text-text-primary',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[0.6875rem] font-semibold',
                      on ? 'text-brand-glow' : 'text-text-muted',
                    )}
                  >
                    {c.exchange[e].topic}
                  </span>
                  <span className="mt-0.5 block font-semibold">{w.artifacts[e]}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="order-3">
          <Contribution side="core" topic={topic} />
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-md">
        <Contribution side="us" topic={topic} />
      </div>
    </figure>
  );
}
