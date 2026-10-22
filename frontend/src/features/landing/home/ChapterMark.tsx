import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { chapter, type ChapterId } from './chapters';

/**
 * The thread that ties the chapters together: a data line drops in from the
 * previous chapter and lands on this chapter's index. Drawn once as it enters
 * the viewport (transform only); static under reduced motion.
 */
export function ChapterMark({
  id,
  align = 'left',
  tone = 'brand',
  className,
}: {
  id: ChapterId;
  align?: 'left' | 'center';
  tone?: 'brand' | 'cold' | 'warm' | 'calm';
  className?: string;
}) {
  const c = chapter(id);
  const reduce = useReducedMotion();
  const color = {
    brand: 'from-transparent to-brand-glow',
    cold: 'from-transparent to-[#7d97a8]',
    warm: 'from-transparent to-warning',
    calm: 'from-transparent to-text-muted',
  }[tone];
  const text = {
    brand: 'text-brand-glow',
    cold: 'text-[#9db3c2]',
    warm: 'text-warning',
    calm: 'text-text-secondary',
  }[tone];
  return (
    <div
      className={cn(
        'flex flex-col',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      <motion.span
        aria-hidden
        initial={reduce ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        transition={{ duration: 0.9, ease: EASE_CORE }}
        className={cn('block h-16 w-px origin-top bg-gradient-to-b sm:h-20', color)}
      />
      <p
        className={cn(
          'mt-3 flex items-center gap-3 text-caption font-semibold tracking-[0.2em] uppercase',
          text,
        )}
      >
        <span className="text-text-muted tabular">{c.index}</span>
        <span aria-hidden className="h-px w-6 bg-current opacity-40" />
        <span className="tracking-[0.08em] normal-case">{c.label}</span>
      </p>
    </div>
  );
}
