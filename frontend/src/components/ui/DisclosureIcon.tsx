import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The one open/closed affordance of the public site (EP18.1): a chevron in a
 * small ring. Closed: quiet ring, brightens on hover. Open: turned, with an
 * emerald ring and tint — state shown by shape and colour together.
 *
 * Pass `open` for button disclosures. Omit it inside a <details> group (or any
 * `group` element whose open state is `[open]`) to follow `group-open`.
 * Decorative: the trigger carries `aria-expanded` / the native open state.
 */
export function DisclosureIcon({
  open,
  size = 'md',
  className,
}: {
  open?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const following = open === undefined;
  return (
    <span
      aria-hidden
      data-disclosure-icon={following ? undefined : open ? 'open' : 'closed'}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border transition-[rotate,border-color,background-color,color] duration-300 motion-reduce:transition-none',
        size === 'sm' ? 'size-6' : 'size-8',
        following
          ? 'border-border-soft text-text-muted group-open:rotate-180 group-open:border-border-brand/70 group-open:bg-brand-primary/[0.12] group-open:text-brand-glow group-hover:border-border-strong group-hover:text-text-primary'
          : open
            ? 'rotate-180 border-border-brand/70 bg-brand-primary/[0.12] text-brand-glow'
            : 'border-border-soft text-text-muted group-hover:border-border-strong group-hover:text-text-primary',
        className,
      )}
    >
      <ChevronDown className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </span>
  );
}
