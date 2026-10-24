import { motion, useScroll } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { ABOUT_CHAPTER } from './model';

/*
 * A thin chapter rail on wide screens (EP13): one hairline that fills with
 * page progress, and the ten chapter numbers with the current one lit.
 * Decorative — every chapter already carries its number and title.
 */

const IDS = Object.values(ABOUT_CHAPTER);

export function ChapterRail() {
  const { scrollYProgress } = useScroll();
  const [current, setCurrent] = useState(-1);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = IDS.findIndex((id) => seen.get(id));
        setCurrent(first);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const id of IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return (
    <div
      aria-hidden
      data-chapter-rail
      className={cn(
        'pointer-events-none fixed top-1/2 left-5 z-20 hidden -translate-y-1/2 transition-opacity duration-500 2xl:block',
        current < 0 ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="relative flex gap-3">
        <div className="relative w-px bg-white/10">
          <motion.span
            className="absolute inset-x-0 top-0 h-full origin-top bg-brand-glow/70"
            style={{ scaleY: scrollYProgress }}
          />
        </div>
        <ol className="space-y-2.5">
          {IDS.map((id, i) => (
            <li
              key={id}
              className={cn(
                'font-mono text-[0.625rem] tabular transition-colors duration-300',
                i === current ? 'text-brand-glow' : 'text-text-muted/50',
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
