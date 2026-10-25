import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

const base =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium transition-[background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-text-inverse shadow-glow-sm hover:bg-brand-glow hover:shadow-glow-md',
  secondary:
    'border border-border-strong bg-surface-raised/60 text-text-primary hover:border-border-brand hover:bg-surface-overlay',
  ghost: 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary',
};

/**
 * Buttons grow with their label instead of clipping it. EP14 made this opt-in;
 * EP19 makes it the default: a label that fits stays on one line at the same
 * height, and one that does not (narrow column, 200 % zoom, larger text) wraps
 * instead of being cut off by `overflow-hidden`.
 */
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 py-2 px-5 text-label text-center',
  lg: 'min-h-13 py-3 px-7 text-body text-center',
};

/**
 * Class string for button-styled elements, including native anchors (e.g. in-page #hash links).
 * `whitespace-normal` (EP14's opt-in) is still accepted and is now the default behaviour.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}
