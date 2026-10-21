import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Container, SectionHeader } from '@/components/ui/Section';
import { getDepartment, type DepartmentId } from '@/config/departments';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE, swap } from '@/motion/tokens';
import {
  AccountingPreview,
  ExecutivePreview,
  OperationsPreview,
  PurchasingPreview,
  SalesPreview,
  WarehousePreview,
} from '../previews/DepartmentPreviews';

const TABS: { id: DepartmentId; Preview: (p: { className?: string }) => React.JSX.Element }[] = [
  { id: 'executive', Preview: ExecutivePreview },
  { id: 'sales', Preview: SalesPreview },
  { id: 'warehouse', Preview: WarehousePreview },
  { id: 'purchasing', Preview: PurchasingPreview },
  { id: 'operations', Preview: OperationsPreview },
  { id: 'accounting', Preview: AccountingPreview },
];

export function ProductPreviewSection() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = TABS[active] ?? TABS[0]!;
  const dept = getDepartment(current.id);

  // WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = TABS.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : e.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      id="preview"
      aria-labelledby="preview-title"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 -z-10 h-[40rem] w-[min(70rem,100%)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgb(25_195_154/0.13),transparent_65%)]"
      />
      <Container>
        <SectionHeader
          id="preview-title"
          align="center"
          eyebrow="Product preview"
          title="ภาพรวมระบบ จากมุมของแต่ละแผนก"
          lead="เลือกแผนกเพื่อดูว่าพื้นที่ทำงานของแต่ละฝ่ายหน้าตาเป็นอย่างไร"
        />

        <div
          role="tablist"
          aria-label="เลือกแผนกเพื่อดูตัวอย่างหน้าจอ"
          onKeyDown={onKeyDown}
          className="-mx-4 mt-10 no-scrollbar flex gap-1 overflow-x-auto px-4 sm:mx-auto sm:w-fit sm:rounded-full sm:border sm:border-border-soft sm:bg-surface-raised/50 sm:p-1"
        >
          {TABS.map((tab, i) => {
            const d = getDepartment(tab.id);
            const Icon = d.icon;
            const selected = i === active;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`preview-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls="preview-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-label transition-colors',
                  selected ? 'text-text-inverse' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="preview-tab"
                    className="absolute inset-0 rounded-full bg-brand-primary"
                    transition={{ duration: DURATION.base, ease: EASE_CORE }}
                  />
                )}
                <Icon className="relative size-4" aria-hidden />
                <span className="relative">{d.nameTh}</span>
              </button>
            );
          })}
        </div>

        <div
          id="preview-panel"
          role="tabpanel"
          aria-labelledby={`preview-tab-${current.id}`}
          className="relative mx-auto mt-8 max-w-4xl"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              variants={swap}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <current.Preview />
              <p className="mt-4 text-center text-caption text-text-muted">
                {dept.nameTh} · {dept.visibility}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}
