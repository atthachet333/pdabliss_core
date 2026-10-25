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

/** Wrapping buttons grow with their label instead of clipping it (EP14). */
const wrapSizes: Record<ButtonSize, string> = {
  md: 'min-h-11 py-2 px-5 text-label text-center',
  lg: 'min-h-13 py-3 px-7 text-body text-center',
};

/**
 * Class string for button-styled elements, including native anchors (e.g. in-page #hash links).
 * `cn` does not resolve conflicting utilities, so a long label that must wrap on
 * narrow screens passes `whitespace-normal`: the fixed height and `nowrap` are
 * then left out rather than overridden.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  const wrap = className?.split(/\s+/).includes('whitespace-normal') ?? false;
  return cn(
    wrap ? base.replace(' whitespace-nowrap', '') : base,
    variants[variant],
    wrap ? wrapSizes[size] : sizes[size],
    className,
  );
}
