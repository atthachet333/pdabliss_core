import { cn } from '@/lib/cn';

/*
 * EP24.1.4.4: the controls and metadata type of /contact and /consultation.
 * Page-local on purpose — the site-wide buttonClasses() stays as it is.
 * Precise corners (10 px), a firm edge, a small arrow that moves on hover;
 * light only on hover and focus. Still the CORE teal, at a calmer scale.
 */

const controlBase =
  'group/ctl inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[10px] px-5 py-2.5 text-label font-semibold text-center transition-[background-color,border-color,box-shadow,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50';

const controlVariants = {
  primary:
    'bg-brand-primary text-text-inverse shadow-[inset_0_0_0_1px_rgb(255_255_255/0.16),inset_0_-2px_0_rgb(0_0_0/0.14)] hover:bg-brand-glow hover:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22),0_12px_32px_-14px_rgb(62_240_192/0.6)]',
  line: 'text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.16)] hover:bg-brand-primary/[0.06] hover:text-brand-soft hover:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]',
  quiet: 'px-3 font-medium text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
} as const;

export function coreControl(variant: keyof typeof controlVariants = 'primary', className?: string) {
  return cn(controlBase, controlVariants[variant], className);
}

/** The arrow inside a control: nudges forward on hover (not under reduced motion). */
export const controlArrow =
  'size-4 shrink-0 transition-transform duration-200 group-hover/ctl:translate-x-0.5 motion-reduce:transition-none';

/**
 * Compact uppercase metadata (section codes, rail labels). Latin text gets the
 * tracked mono look; Thai and Chinese stay in the sans face at caption size,
 * since wide letter spacing breaks Thai clusters and thins Chinese.
 */
export const metaText =
  'font-mono text-[0.6875rem] leading-none font-medium tracking-[0.2em] uppercase [&:lang(th)]:font-sans [&:lang(th)]:text-caption [&:lang(th)]:tracking-normal [&:lang(th)]:leading-snug [&:lang(zh-CN)]:font-sans [&:lang(zh-CN)]:text-caption [&:lang(zh-CN)]:tracking-[0.04em] [&:lang(zh-CN)]:leading-snug';
