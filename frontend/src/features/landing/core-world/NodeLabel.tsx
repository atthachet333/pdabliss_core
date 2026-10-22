import type { CSSProperties, Ref } from 'react';
import { getDepartment } from '@/config/departments';
import { cn } from '@/lib/cn';
import type { OrbitDepartmentId } from './types';

/**
 * A department name tag floating under its node. Visual + pointer target only:
 * the accessible controls are the DepartmentSelector buttons, so tags are
 * hidden from assistive tech and skipped by Tab.
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
  const d = getDepartment(id);
  const Icon = d.icon;
  return (
    <div
      ref={ref}
      aria-hidden
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
      onClick={() => onSelect(id)}
      style={style}
      className={cn(
        'absolute top-0 left-0 flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 whitespace-nowrap transition-[background-color,border-color,box-shadow,opacity] duration-300 select-none',
        active
          ? 'border-border-brand bg-surface-overlay/85 shadow-glow-sm'
          : 'border-border-soft bg-surface-base/70 hover:border-border-strong',
        dimmed && !active && 'opacity-60',
        'backdrop-blur-md',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full',
          active ? 'bg-brand-primary/25 text-brand-glow' : 'bg-surface-highlight text-brand-soft',
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.8125rem] font-medium text-text-primary">{d.nameTh}</span>
        <span className="mt-0.5 text-[0.625rem] tracking-[0.16em] text-text-muted uppercase">
          {d.nameEn}
        </span>
      </span>
    </div>
  );
}
