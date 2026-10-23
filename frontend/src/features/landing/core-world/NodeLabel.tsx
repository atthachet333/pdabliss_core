import type { CSSProperties, Ref } from 'react';
import { useDepartment } from '@/config/departments';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import type { OrbitDepartmentId } from './types';

/**
 * A department "world card" anchored to its node in the CORE World (EP05
 * revision): a framed scene of that department's work with its name, so the
 * orbit reads as real departments at a glance. Visual + pointer target only —
 * the accessible controls are the DepartmentSelector buttons, so cards are
 * hidden from assistive tech and skipped by Tab.
 *
 * The outer element is positioned (and depth-scaled) by the scene every
 * frame; hover/active styling lives on the inner card so the two never fight.
 */
export function NodeLabel({
  id,
  active,
  dimmed,
  onHover,
  onSelect,
  ref,
  style,
  className,
}: {
  id: OrbitDepartmentId;
  active: boolean;
  dimmed: boolean;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId) => void;
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  className?: string;
}) {
  const d = useDepartment(id);
  const { locale } = useLocale();
  const Icon = d.icon;
  return (
    <div
      ref={ref}
      aria-hidden
      data-world-card={id}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
      onClick={() => onSelect(id)}
      style={style}
      className={cn('absolute top-0 left-0 cursor-pointer select-none', className)}
    >
      <div
        className={cn(
          'w-[7.5rem] overflow-hidden rounded-xl border bg-surface-base/90 transition-[transform,border-color,box-shadow,opacity,filter] duration-300 ease-out lg:w-[9.25rem] xl:w-[10rem]',
          active
            ? 'scale-[1.08] border-border-brand shadow-[0_0_0_1px_rgb(62_240_192/0.35),0_18px_40px_-14px_rgb(25_195_154/0.55)]'
            : 'border-border-strong shadow-[0_16px_34px_-18px_rgb(0_0_0/0.9)] hover:border-border-brand',
          dimmed && !active && 'saturate-50',
        )}
      >
        <div className="relative aspect-[16/9] bg-surface-dark">
          <img
            src={d.image.sm}
            alt=""
            width={400}
            height={225}
            decoding="async"
            draggable={false}
            className={cn(
              'size-full object-cover transition-[filter] duration-300',
              active ? 'brightness-125' : 'brightness-100',
            )}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/10 to-transparent" />
          <span
            className={cn(
              'absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-md backdrop-blur-sm',
              active ? 'bg-brand-primary/30 text-brand-glow' : 'bg-surface-dark/70 text-brand-soft',
            )}
          >
            <Icon className="size-3" />
          </span>
        </div>
        <div className="-mt-3 px-2.5 pb-2 leading-none">
          <span className="relative block truncate text-[0.8125rem] font-semibold text-text-primary">
            {d.name}
          </span>
          {locale !== 'en' && (
            <span className="relative mt-1 block text-[0.5625rem] tracking-[0.16em] text-text-muted uppercase">
              {d.nameEn}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
