import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  id?: string;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  align = 'left',
  id,
  className,
}: SectionHeaderProps) {
  return (
    <Reveal className={cn(align === 'center' && 'mx-auto text-center', 'max-w-3xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-4 text-h2 text-text-primary">
        {title}
      </h2>
      {lead && <p className="mt-5 text-body-lg text-text-secondary">{lead}</p>}
    </Reveal>
  );
}

export function Badge({
  children,
  tone = 'brand',
  className,
}: {
  children: ReactNode;
  tone?: 'brand' | 'neutral' | 'warning';
  className?: string;
}) {
  const tones = {
    brand: 'border-border-brand bg-brand-primary/10 text-brand-soft',
    neutral: 'border-border-strong bg-surface-overlay text-text-secondary',
    warning: 'border-warning/40 bg-warning/10 text-warning',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
