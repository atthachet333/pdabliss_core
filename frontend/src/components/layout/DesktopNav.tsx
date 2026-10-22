import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { NAV_GROUPS, type NavGroup } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';

const OPEN_DELAY = 70;
const CLOSE_DELAY = 160;

/**
 * Desktop navigation (≥ 1280px) with mega menus. Disclosure pattern: each
 * top-level item is a button controlling a panel of ordinary links (no ARIA
 * menu roles — links stay links). Pointer: hover intent with short delays.
 * Keyboard: ←/→ move between items, ↓ opens and enters the panel, Escape
 * closes and returns focus, tabbing out closes.
 */
export function DesktopNav({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const location = useLocation();

  const set = useCallback(
    (id: string | null) => {
      window.clearTimeout(timer.current);
      setOpen(id);
      onOpenChange(id !== null);
    },
    [onOpenChange],
  );
  const later = (id: string | null, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set(id), ms);
  };

  // Close on navigation and on outside pointer-down.
  const [lastPath, setLastPath] = useState(location.pathname + location.hash);
  if (lastPath !== location.pathname + location.hash) {
    setLastPath(location.pathname + location.hash);
    if (open) {
      setOpen(null);
      onOpenChange(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.closest('header')?.contains(e.target as Node)) set(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, set]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const index = (id: string) => NAV_GROUPS.findIndex((g) => g.id === id);
  const focusFirstLink = () =>
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a')?.focus());

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>, group: NavGroup) => {
    const i = index(group.id);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + NAV_GROUPS.length) % NAV_GROUPS.length;
      triggers.current[next]?.focus();
      if (open) set(NAV_GROUPS[next]!.id);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      set(group.id);
      focusFirstLink();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      set(null);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      const i = index(open);
      set(null);
      triggers.current[i]?.focus();
    }
  };

  const group = NAV_GROUPS.find((g) => g.id === open) ?? null;

  return (
    <div
      ref={rootRef}
      className="hidden xl:block"
      onPointerLeave={(e) => e.pointerType === 'mouse' && open && later(null, CLOSE_DELAY)}
      onBlur={(e) => {
        // Tabbing out of the trigger row and panel closes the menu.
        if (open && !e.currentTarget.contains(e.relatedTarget as Node)) set(null);
      }}
    >
      <nav aria-label="เมนูหลัก">
        <ul className="flex items-center gap-0.5">
          {NAV_GROUPS.map((g, i) => {
            const isOpen = open === g.id;
            return (
              <li key={g.id}>
                <button
                  ref={(el) => {
                    triggers.current[i] = el;
                  }}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`mega-${g.id}`}
                  onClick={() => set(isOpen ? null : g.id)}
                  onKeyDown={(e) => onTriggerKey(e, g)}
                  onPointerEnter={(e) =>
                    e.pointerType === 'mouse' && later(g.id, open ? 0 : OPEN_DELAY)
                  }
                  className={cn(
                    'group relative flex h-10 items-center gap-1 rounded-full px-2.5 text-[0.875rem] whitespace-nowrap transition-colors duration-300 2xl:px-3 2xl:text-label',
                    isOpen ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {g.label}
                  <ChevronDown
                    className={cn(
                      'size-3.5 opacity-60 transition-transform duration-300',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-4 -bottom-0.5 h-px origin-left bg-gradient-to-r from-transparent via-brand-glow to-transparent transition-transform duration-300 ease-out',
                      isOpen ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <AnimatePresence>
        {group && (
          <motion.div
            key="mega"
            ref={panelRef}
            id={`mega-${group.id}`}
            role="region"
            aria-label={`เมนู ${group.label}`}
            onKeyDown={onPanelKey}
            onPointerEnter={() => window.clearTimeout(timer.current)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="absolute inset-x-0 top-full border-b border-border-soft bg-[rgb(5_11_18/0.985)] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]"
          >
            <div className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-10 px-8 py-8">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                {group.links.map((l) => {
                  const Icon = l.icon;
                  return (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        onClick={() => set(null)}
                        className="group flex items-start gap-3.5 rounded-2xl p-3 transition-colors duration-200 hover:bg-white/[0.035] focus-visible:bg-white/[0.035]"
                      >
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-base/80 transition-colors group-hover:border-border-brand">
                          <Icon className="size-4 text-brand-soft" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-label font-medium text-text-primary">
                            {l.label}
                            <ArrowRight
                              className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70"
                              aria-hidden
                            />
                          </span>
                          <span className="mt-0.5 block text-caption text-text-muted">
                            {l.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="relative overflow-hidden rounded-card border border-border-soft bg-[radial-gradient(ellipse_at_80%_0%,rgb(25_195_154/0.12),transparent_60%),linear-gradient(180deg,rgb(12_24_34/0.8),rgb(8_18_27/0.6))] p-6">
                <p className="text-caption font-semibold tracking-[0.18em] text-brand-glow uppercase">
                  {group.label}
                </p>
                <p className="mt-3 text-label text-text-secondary">{group.summary}</p>
                {group.notes && (
                  <div className="mt-5">
                    <p className="text-caption text-text-muted">{group.notes.title}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {group.notes.items.map((n) => (
                        <li
                          key={n}
                          className="rounded-full border border-border-soft px-2.5 py-0.5 text-caption text-text-secondary"
                        >
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Link
                  to={group.cta.to}
                  onClick={() => set(null)}
                  className="group mt-6 inline-flex items-center gap-1.5 text-label font-medium text-brand-glow"
                >
                  {group.cta.label}
                  <ArrowRight
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
