import { cn } from '@/lib/cn';

/*
 * The shared overlay and disclosure language of the public site (EP18.1).
 * One vocabulary for every surface that opens: header menus, the language
 * list, mobile menu groups, FAQs, comparison groups and guide examples.
 *
 *   surface   a layered, opaque panel — hairline edge, inner top light, soft depth
 *   row       an interactive line: padding, hover surface, focus surface, current state
 *   label     a section title with a short emerald tick
 *   chip      a compact index entry (departments, industries, reference guides)
 *   item      a contained disclosure (FAQ, comparison group, example)
 *
 * Focus rings come from the global :focus-visible style; these classes add a
 * surface under it, never remove it. Every transition is disabled under
 * reduced motion.
 */

/** Floating panels (header menus, language list). Opaque — the page never ghosts through. */
export const overlaySurface =
  'border border-white/[0.07] bg-[linear-gradient(180deg,rgb(12_23_33),rgb(6_13_20)_70%)] shadow-[0_36px_80px_-36px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.045)]';

/** An interactive row inside an overlay. `current` marks the page you are on. */
export function overlayRow(current = false, className?: string) {
  return cn(
    'group relative rounded-xl transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none',
    'hover:bg-white/[0.045] hover:shadow-[inset_0_0_0_1px_rgb(190_235_222/0.09)]',
    'focus-visible:bg-white/[0.05]',
    current &&
      'bg-brand-primary/[0.09] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.26)] hover:bg-brand-primary/[0.12]',
    className,
  );
}

/** A section title inside an overlay: muted words led by a short emerald tick. */
export const overlayLabel =
  'flex items-center gap-2 text-caption font-semibold text-text-muted before:h-px before:w-3 before:shrink-0 before:bg-brand-glow/60';

/** A compact index entry — an outlined chip, not loose text. */
export function overlayChip(current = false, className?: string) {
  return cn(
    'inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-label transition-[background-color,box-shadow,color] duration-200 motion-reduce:transition-none',
    current
      ? 'bg-brand-primary/[0.1] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
      : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.09)] hover:bg-white/[0.04] hover:text-text-primary hover:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]',
    className,
  );
}

/**
 * A contained disclosure: a quiet frame that brightens when open. Pass `open`
 * for a stateful button disclosure; omit it inside <details> (uses `open:`).
 */
export function disclosureItem(open?: boolean, className?: string) {
  return cn(
    'group rounded-2xl border transition-[background-color,border-color] duration-300 motion-reduce:transition-none',
    open === undefined
      ? 'border-border-soft bg-white/[0.015] hover:border-border-strong open:border-border-brand/40 open:bg-white/[0.035]'
      : open
        ? 'border-border-brand/40 bg-white/[0.035]'
        : 'border-border-soft bg-white/[0.015] hover:border-border-strong',
    className,
  );
}

/** The trigger row of a disclosure item (button or <summary>). */
export const disclosureTrigger =
  'flex min-h-14 w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-left [&::-webkit-details-marker]:hidden';
