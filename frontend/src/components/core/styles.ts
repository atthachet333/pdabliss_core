import { cn } from '@/lib/cn';

/*
 * Class recipes for the internal design system. Kept apart from the
 * components so they can be reused on native elements (links, labels).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const base =
  'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-[background-color,border-color,color,filter] duration-150 select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-text-inverse hover:brightness-110 active:brightness-95 disabled:bg-fill-muted disabled:text-fg-disabled',
  secondary:
    'border border-line-strong bg-panel-raised text-fg-primary hover:border-[color-mix(in_oklab,var(--color-fg-primary)_28%,transparent)] hover:bg-panel-overlay disabled:border-line disabled:bg-transparent disabled:text-fg-disabled',
  ghost:
    'text-fg-secondary hover:bg-fill-hover hover:text-fg-primary active:bg-fill-active disabled:text-fg-disabled disabled:hover:bg-transparent',
  danger:
    'border border-danger/35 bg-danger/10 text-danger hover:bg-danger/15 disabled:border-line disabled:bg-transparent disabled:text-fg-disabled',
};

const sizes: Record<ButtonSize, { text: string; icon: string }> = {
  // Touch screens get 44px targets; pointer layouts tighten to 36–40px.
  sm: { text: 'h-10 px-3 text-caption sm:h-9', icon: 'size-10 sm:size-9' },
  md: { text: 'h-11 px-4 text-label sm:h-10', icon: 'size-11 sm:size-10' },
};

export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    base,
    variants[variant],
    iconOnly ? sizes[size].icon : sizes[size].text,
    block && 'w-full',
    className,
  );
}

/** The department accent at restrained strengths. `--ws-accent` is set by the shell. */
export const accent = {
  text: 'text-[var(--ws-accent)]',
  bg: 'bg-[var(--ws-accent)]',
  soft: 'bg-[color-mix(in_oklab,var(--ws-accent)_12%,transparent)]',
  faint: 'bg-[color-mix(in_oklab,var(--ws-accent)_6%,transparent)]',
  border: 'border-[color-mix(in_oklab,var(--ws-accent)_32%,transparent)]',
  hoverBorder: 'hover:border-[color-mix(in_oklab,var(--ws-accent)_40%,transparent)]',
} as const;

/** Standard panel surface: one hairline, no glow. */
export const panelSurface = 'rounded-panel border border-line bg-panel shadow-panel';

/** Floating surface for menus and popovers. */
export const overlaySurface =
  'rounded-panel border border-line-strong bg-panel-overlay shadow-overlay';

/** Text inputs, selects and textareas. */
export function controlStyles({
  invalid = false,
  multiline = false,
  className,
}: { invalid?: boolean; multiline?: boolean; className?: string } = {}) {
  return cn(
    'w-full min-w-0 rounded-control border bg-panel-raised px-3.5 text-label text-fg-primary transition-[border-color,box-shadow] duration-150 placeholder:text-fg-muted',
    'hover:border-[color-mix(in_oklab,var(--color-fg-primary)_24%,transparent)]',
    'focus:border-focus focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-focus)_18%,transparent)] focus:outline-none',
    'disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-fg-disabled',
    'read-only:border-dashed read-only:bg-transparent read-only:focus:shadow-none',
    multiline ? 'min-h-28 py-2.5 leading-relaxed' : 'h-11 sm:h-10',
    invalid ? 'border-danger/70 focus:border-danger' : 'border-line-strong',
    className,
  );
}
