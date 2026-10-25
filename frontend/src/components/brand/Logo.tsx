import { useId } from 'react';
import { cn } from '@/lib/cn';

/** CORE mark: a luminous core inside an orbit with six department nodes. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden>
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--color-brand-soft)" />
          <stop offset="55%" stopColor="var(--color-brand-glow)" />
          <stop offset="100%" stopColor="var(--color-brand-deep)" />
        </radialGradient>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="17"
        fill="none"
        stroke="var(--color-brand-primary)"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={20 + 17 * Math.cos(a)}
            cy={20 + 17 * Math.sin(a)}
            r="2"
            fill="var(--color-brand-glow)"
          />
        );
      })}
      <circle cx="20" cy="20" r="8" fill={`url(#${id}-core)`} />
      <circle
        cx="20"
        cy="20"
        r="11.5"
        fill="none"
        stroke="var(--color-brand-glow)"
        strokeOpacity="0.25"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-semibold tracking-[0.14em] text-text-primary">
          PDA BLISS <span className="text-brand-glow">CORE</span>
        </span>
        {/* EP19: a real space, so the accessible text reads "… CORE Department Operations". */}{' '}
        {!compact && (
          <span className="mt-1 text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase">
            Department Operations
          </span>
        )}
      </span>
    </span>
  );
}
