import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

const base =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-text-inverse shadow-glow-sm hover:bg-brand-glow hover:shadow-glow-md',
  secondary:
    'border border-border-strong bg-surface-raised/60 text-text-primary hover:border-border-brand hover:bg-surface-overlay',
  ghost: 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-label',
  lg: 'h-13 px-7 text-body',
};

/** Class string for button-styled elements, including native anchors (e.g. in-page #hash links). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}
