import { useId, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { logoInner, markInner, type MarkSize, type MarkVariant } from './geometry';

/*
 * EP24.1.3: both components render the production brand geometry
 * (geometry.ts) — the same vectors as /public/brand and the favicon.
 * The markup is generated from constants only (never user input).
 */

/** Gradient ids must be unique per instance (a hidden duplicate would break `url(#…)`). */
function useSvgId() {
  return `cm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * CORE brand mark (symbol only): a luminous core held by a silver ring and a
 * teal orbit. `size` is the optical size — 'micro' (tile) below ~24 px,
 * 'mark' for navigation and headers, 'large' for showcase tiles.
 */
export function LogoMark({
  className,
  variant = 'dark',
  size = 'mark',
}: {
  className?: string;
  variant?: MarkVariant;
  size?: MarkSize;
}) {
  const id = useSvgId();
  const html = useMemo(() => markInner(id, variant, size), [id, variant, size]);
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-9', className)}
      aria-hidden
      focusable="false"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Primary logo: mark + "PDA BLISS / CORE" vector wordmark. Not compact adds the
 * "Department Operations" lockup. The artwork is decorative; one text name
 * (sr-only) keeps a single, meaningful accessible name — callers that label
 * their link override it, so nothing is announced twice.
 */
export function Logo({
  className,
  compact = false,
  variant = 'dark',
}: {
  className?: string;
  compact?: boolean;
  variant?: MarkVariant;
}) {
  const id = useSvgId();
  const logo = useMemo(() => logoInner(id, variant), [id, variant]);
  return (
    <span className={cn('inline-flex items-center gap-3.5', className)}>
      <svg
        viewBox={`0 0 ${logo.width} 64`}
        className="h-9 w-auto shrink-0 sm:h-10"
        aria-hidden
        focusable="false"
        dangerouslySetInnerHTML={{ __html: logo.markup }}
      />
      <span className="sr-only">PDA BLISS CORE</span>
      {/* EP19: a real space, so the accessible text reads "… CORE Department Operations". */}{' '}
      {/* Secondary: quieter than the wordmark, and only where callers have room (not compact). */}
      {!compact && (
        <span className="border-l border-white/[0.1] pl-3.5 text-[0.5625rem] leading-[1.4] font-medium tracking-[0.22em] text-text-muted uppercase">
          Department <br aria-hidden />
          Operations
        </span>
      )}
    </span>
  );
}
