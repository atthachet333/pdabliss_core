import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { CHAPTERS, type ChapterId } from './chapters';

/**
 * Quiet chapter indicator (wide screens only): a column of dots, the label
 * appears on hover/focus. Plain anchor links — native scrolling, no snap.
 */
export function ChapterProgress() {
  const [current, setCurrent] = useState<ChapterId>('core-world');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id as ChapterId);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const c of CHAPTERS) {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // Hidden over the hero so it never sits on top of the CORE stage.
  const atHero = current === 'core-world';

  return (
    <nav
      aria-label="บทของหน้า"
      className={cn(
        'fixed top-1/2 right-4 z-30 hidden -translate-y-1/2 transition-opacity duration-500 2xl:block',
        atHero && 'pointer-events-none invisible opacity-0',
      )}
    >
      <ol className="flex flex-col items-center gap-1">
        {CHAPTERS.map((c) => {
          const on = c.id === current;
          return (
            <li key={c.id}>
              {/* Only the 24px dot is a hit target; the label floats beside it. */}
              <a
                href={`#${c.id}`}
                aria-current={on ? 'location' : undefined}
                className="group relative flex size-6 items-center justify-center rounded-full"
              >
                <span className="pointer-events-none absolute right-full mr-2 text-caption whitespace-nowrap text-text-secondary opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="mr-2 text-text-muted tabular">{c.index}</span>
                  {c.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'block rounded-full transition-all duration-300',
                    on
                      ? 'h-4 w-1 bg-brand-glow'
                      : 'size-1 bg-text-muted/60 group-hover:bg-text-secondary',
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
