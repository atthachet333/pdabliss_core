import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router';
import { useDepartment, useDepartments } from '@/config/departments';
import { useLocale } from '@/i18n/useLocale';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { departmentLink } from '@/features/departments/catalog';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { ORBIT_LIST } from './orbitList';
import type { OrbitDepartmentId } from './types';

export const DETAIL_ID = 'core-department-detail';

const th = {
  group: 'แผนกที่เชื่อมกับ CORE',
  close: 'ปิดรายละเอียดแผนก',
  duties: (name: string) => `งานหลักของ${name}`,
  view: 'ดูแผนกนี้',
};

const COPY: Localized<typeof th> = {
  th,
  en: {
    group: 'Departments connected to CORE',
    close: 'Close department details',
    duties: (name) => `${name} key work`,
    view: 'View this department',
  },
  'zh-CN': {
    group: '与 CORE 相连的部门',
    close: '关闭部门详情',
    duties: (name) => `${name}的主要工作`,
    view: '查看该部门',
  },
};

/**
 * The accessible way into the CORE World: one real button per department.
 * Focus previews (same highlight as hovering the 3D node), Enter/Space opens
 * the detail panel and focuses the scene on it, Escape closes (handled by the
 * hero). Canvas and buttons share one state, so they never disagree.
 * Phones (no world cards around the scene) get a scene thumbnail per button.
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
  const c = useCopy(COPY);
  const all = useDepartments();
  return (
    <div role="group" aria-label={c.group} className={className}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ORBIT_LIST.map((id) => {
          const d = all.find((x) => x.id === id)!;
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
                  'group flex min-h-14 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border text-center transition-[background-color,border-color,color] duration-300 max-sm:pb-2 sm:px-1.5 sm:py-2',
                  lit
                    ? 'border-border-brand bg-brand-primary/10 text-text-primary'
                    : 'border-border-soft bg-surface-base/60 text-text-secondary hover:border-border-strong hover:text-text-primary',
                )}
              >
                {/* Phones: a small scene of the department; larger screens use the world cards. */}
                <span aria-hidden className="relative block aspect-[16/9] w-full sm:hidden">
                  <img
                    src={d.image.sm}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={225}
                    className={cn(
                      'size-full object-cover transition-[filter] duration-300',
                      lit ? 'brightness-125' : 'brightness-90',
                    )}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-surface-base/90 to-transparent" />
                </span>
                <Icon
                  className={cn(
                    'size-4 transition-colors max-sm:hidden',
                    lit ? 'text-brand-glow' : 'text-brand-soft/70',
                  )}
                  aria-hidden
                />
                <span className="px-1 text-caption leading-tight font-medium">{d.name}</span>
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
  const c = useCopy(COPY);
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
            className="relative overflow-hidden rounded-card border border-border-strong shadow-raised surface-glass"
          >
            <DetailBody id={id} />
            {selected && (
              <button
                type="button"
                onClick={onClose}
                aria-label={c.close}
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-surface-dark/60 text-text-secondary backdrop-blur-sm transition-colors hover:bg-surface-highlight hover:text-text-primary"
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
  const c = useCopy(COPY);
  const d = useDepartment(id);
  const { locale, href } = useLocale();
  const Icon = d.icon;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* The department's world — decorative, the text carries the meaning. */}
      <div className="relative aspect-[16/7] overflow-hidden bg-surface-dark lg:aspect-auto lg:h-full">
        <img
          src={d.image.lg}
          alt=""
          decoding="async"
          width={960}
          height={540}
          className="size-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-raised via-surface-raised/30 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-surface-raised/80" />
      </div>
      <div className="relative -mt-8 px-5 pb-5 lg:mt-0 lg:py-4 lg:pr-12 lg:pl-4">
        <div className="flex items-center gap-3 pr-8 lg:pr-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border-brand bg-surface-base/90 lg:size-9">
            <Icon className="size-5 text-brand-glow lg:size-4" aria-hidden />
          </span>
          <div>
            <p className="text-body font-semibold text-text-primary">{d.name}</p>
            {locale !== 'en' && (
              <p className="text-[0.6875rem] tracking-[0.2em] text-text-muted uppercase">
                {d.nameEn}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-label text-text-secondary lg:mt-2 lg:text-caption">{d.purpose}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 lg:mt-2" aria-label={c.duties(d.name)}>
          {d.highlights.map((h) => (
            <li
              key={h}
              className="rounded-full border border-border-soft bg-surface-base/70 px-2.5 py-1 text-caption text-text-secondary lg:py-0.5"
            >
              {h}
            </li>
          ))}
        </ul>
        <Link
          to={href(departmentLink(id))}
          className="group mt-4 inline-flex items-center gap-1.5 text-label font-medium text-brand-glow lg:mt-3"
        >
          {c.view}
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
