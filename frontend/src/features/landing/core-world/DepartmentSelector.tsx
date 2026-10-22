import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router';
import { getDepartment } from '@/config/departments';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { DEPARTMENT_HIGHLIGHTS } from './constants';
import { ORBIT_LIST } from './orbitList';
import type { OrbitDepartmentId } from './types';

export const DETAIL_ID = 'core-department-detail';

/**
 * The accessible way into the CORE World: one real button per department.
 * Focus previews (same highlight as hovering the 3D node), Enter/Space opens
 * the detail panel and focuses the scene on it, Escape closes (handled by the
 * hero). Canvas and buttons share one state, so they never disagree.
 */
export function DepartmentSelector({
  hovered,
  selected,
  onHover,
  onSelect,
  className,
}: {
  hovered: OrbitDepartmentId | null;
  selected: OrbitDepartmentId | null;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId | null) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="แผนกที่เชื่อมกับ CORE" className={className}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ORBIT_LIST.map((id) => {
          const d = getDepartment(id);
          const Icon = d.icon;
          const isSelected = selected === id;
          const lit = isSelected || hovered === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-controls={DETAIL_ID}
                onClick={() => onSelect(isSelected ? null : id)}
                onFocus={() => onHover(id)}
                onBlur={() => onHover(null)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(id)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
                className={cn(
                  'group flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-[background-color,border-color,color] duration-300',
                  lit
                    ? 'border-border-brand bg-brand-primary/10 text-text-primary'
                    : 'border-border-soft bg-surface-base/60 text-text-secondary hover:border-border-strong hover:text-text-primary',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 transition-colors',
                    lit ? 'text-brand-glow' : 'text-brand-soft/70',
                  )}
                  aria-hidden
                />
                <span className="text-caption leading-tight font-medium">{d.nameTh}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** What a department does in CORE — shown for the hovered / focused / selected one. */
export function DepartmentDetail({
  id,
  selected,
  onClose,
  className,
}: {
  id: OrbitDepartmentId | null;
  selected: boolean;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div id={DETAIL_ID} aria-live="polite" className={className}>
      <AnimatePresence mode="wait" initial={false}>
        {id && (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="relative rounded-card border border-border-strong p-5 shadow-raised surface-glass"
          >
            <DetailBody id={id} />
            {selected && (
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิดรายละเอียดแผนก"
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-highlight hover:text-text-primary"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailBody({ id }: { id: OrbitDepartmentId }) {
  const d = getDepartment(id);
  const Icon = d.icon;
  return (
    <>
      <div className="flex items-center gap-3 pr-8">
        <span className="flex size-10 items-center justify-center rounded-2xl border border-border-brand bg-brand-primary/10">
          <Icon className="size-5 text-brand-glow" aria-hidden />
        </span>
        <div>
          <p className="text-body font-semibold text-text-primary">{d.nameTh}</p>
          <p className="text-[0.6875rem] tracking-[0.2em] text-text-muted uppercase">{d.nameEn}</p>
        </div>
      </div>
      <p className="mt-3 text-label text-text-secondary">{d.purpose}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`งานหลักของ${d.nameTh}`}>
        {DEPARTMENT_HIGHLIGHTS[id].map((h) => (
          <li
            key={h}
            className="rounded-full border border-border-soft bg-surface-base/70 px-2.5 py-1 text-caption text-text-secondary"
          >
            {h}
          </li>
        ))}
      </ul>
      <Link
        to={`/departments#${id}`}
        className="group mt-4 inline-flex items-center gap-1.5 text-label font-medium text-brand-glow"
      >
        ดูแผนกนี้
        <ArrowRight
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </>
  );
}
