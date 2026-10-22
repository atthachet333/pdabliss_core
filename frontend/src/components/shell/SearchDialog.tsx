import { AnimatePresence, motion } from 'framer-motion';
import {
  Boxes,
  Building2,
  ClipboardList,
  CornerDownLeft,
  FileText,
  FlaskConical,
  PackageCheck,
  Search,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Backdrop, useOverlay } from '@/components/core';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { workspacePath, type WorkspaceDefinition } from '@/workspaces/registry';

/** Future search targets. Shown so the structure is reviewable; not searchable yet. */
const FUTURE_TARGETS: { label: string; icon: LucideIcon }[] = [
  { label: 'เอกสาร', icon: FileText },
  { label: 'Sales Order', icon: ShoppingCart },
  { label: 'PO', icon: ClipboardList },
  { label: 'GR', icon: PackageCheck },
  { label: 'สินค้า', icon: Boxes },
  { label: 'ลูกค้า', icon: Users },
  { label: 'Supplier', icon: Building2 },
];

/**
 * Global search / command dialog (Ctrl+K or "/"). In the prototype it jumps
 * between pages of the current workspace; record search is clearly marked as
 * not yet available.
 */
export function SearchDialog({
  open,
  onClose,
  ws,
}: {
  open: boolean;
  onClose: () => void;
  ws: WorkspaceDefinition;
}) {
  const listId = useId();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ws.nav.filter((n) => !q || n.label.toLowerCase().includes(q) || n.path.includes(q));
  }, [query, ws.nav]);

  const close = () => {
    setQuery('');
    setActive(0);
    onClose();
  };
  const { id, panelRef } = useOverlay(open, close);
  const go = (path: string) => {
    close();
    navigate(workspacePath(ws.id, path));
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[8vh] sm:pt-[12vh]">
          <Backdrop onClick={close} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="relative flex max-h-[76dvh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line-strong bg-panel-overlay shadow-overlay"
          >
            <h2 id={`${id}-title`} className="sr-only">
              ค้นหา
            </h2>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
              <input
                type="text"
                role="combobox"
                aria-label="ค้นหาหน้า เอกสาร หรือคำสั่ง"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={pages[active] ? `${listId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                placeholder={`ค้นหาใน${ws.shortTh}…`}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, pages.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && pages[active]) {
                    e.preventDefault();
                    go(pages[active].path);
                  }
                }}
                className="h-14 min-w-0 flex-1 bg-transparent text-body text-fg-primary placeholder:text-fg-muted focus:outline-none"
              />
              <kbd className="hidden rounded-md border border-line-strong px-1.5 py-0.5 text-[0.75rem] text-fg-muted sm:block">
                Esc
              </kbd>
            </div>

            <div className="overflow-y-auto p-2">
              <p className="px-3 pt-2 pb-1.5 text-[0.75rem] text-fg-muted">
                ไปที่หน้า · {ws.shortTh}
              </p>
              <ul id={listId} role="listbox" aria-label="หน้าในพื้นที่ทำงาน">
                {pages.length === 0 && (
                  <li className="px-3 py-3 text-caption text-fg-muted">
                    ไม่พบหน้าที่ตรงกับ “{query}”
                  </li>
                )}
                {pages.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <li
                      key={p.path}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onClick={() => go(p.path)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-label',
                        i === active ? 'bg-fill-active text-fg-primary' : 'text-fg-secondary',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
                      <span className="flex-1 truncate">{p.label}</span>
                      {i === active && (
                        <CornerDownLeft className="size-3.5 text-fg-muted" aria-hidden />
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 border-t border-line px-3 pt-3 pb-2">
                <p className="flex items-center gap-1.5 text-[0.75rem] text-fg-muted">
                  <FlaskConical className="size-3.5 text-warning" aria-hidden />
                  ค้นหาข้อมูล · ต้นแบบ — การค้นหาเอกสารจริงจะเปิดใช้เมื่อเชื่อมข้อมูล
                </p>
                <ul
                  className="mt-2.5 flex flex-wrap gap-1.5"
                  aria-label="ประเภทข้อมูลที่จะค้นหาได้"
                >
                  {FUTURE_TARGETS.map(({ label, icon: Icon }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-caption text-fg-muted"
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
