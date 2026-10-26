import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { NavLink, useLocation } from 'react-router';
import { activeGroup, TOP_NAV, type MegaGroupId } from '@/config/navigation';
import { stripLocale } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { MegaPanel } from './MegaPanel';

const OPEN_DELAY = 90;
const CLOSE_DELAY = 180;
const HOVER_CLICK_GRACE = 450;

// EP18: five items leave room for comfortable padding at every desktop width.
const itemClass =
  'group relative flex h-10 items-center gap-1 rounded-full px-3.5 text-[0.9375rem] whitespace-nowrap transition-colors duration-300 2xl:px-4';

/** The section you are in: a quiet dot under the label (EP18), not a bar. */
function CurrentDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      data-current-dot
      className={cn(
        'absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand-glow transition-opacity duration-300',
        on ? 'opacity-90' : 'opacity-0',
      )}
    />
  );
}

function Underline({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute inset-x-3 -bottom-0.5 h-px origin-center bg-gradient-to-r from-transparent via-brand-glow to-transparent transition-transform duration-300 ease-out',
        on ? 'scale-x-100' : 'scale-x-0',
      )}
    />
  );
}

/**
 * Desktop navigation (≥ nav breakpoint) with editorial mega menus.
 *
 * Disclosure pattern: each mega item is a button controlling a panel of
 * ordinary links (no ARIA menu roles — links stay links); ภาพรวม is a direct
 * link (ติดต่อเรา is a header action since EP16). Pointer: hover intent with
 * short delays. EP18: four menus; the menu whose family holds the current
 * page is marked (aria-current and a dot), e.g. a guide marks ความรู้.
 * Keyboard: ←/→ move along the bar, ↓ opens and enters a panel, Escape closes
 * and returns focus, tabbing out or clicking outside closes.
 */
export function DesktopNav({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, href } = useLocale();
  const [open, setOpen] = useState<MegaGroupId | null>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  /** When the current panel opened — a click right after hover-open must not close it. */
  const openedAt = useRef(0);
  const location = useLocation();
  const current = activeGroup(stripLocale(location.pathname));

  const set = useCallback(
    (id: MegaGroupId | null) => {
      window.clearTimeout(timer.current);
      setOpen(id);
      openedAt.current = id ? performance.now() : 0;
      onOpenChange(id !== null);
    },
    [onOpenChange],
  );
  const toggle = useCallback(
    (id: MegaGroupId) => {
      if (open === id && performance.now() - openedAt.current > HOVER_CLICK_GRACE) set(null);
      else set(id);
    },
    [open, set],
  );
  const later = (id: MegaGroupId | null, ms: number) => {
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

  const focusFirstLink = () =>
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a')?.focus());

  const onItemKey = (e: KeyboardEvent<HTMLElement>, i: number) => {
    const entry = TOP_NAV[i]!;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + TOP_NAV.length) % TOP_NAV.length;
      items.current[next]?.focus();
      const target = TOP_NAV[next]!;
      if (open) set(target.kind === 'mega' ? target.id : null);
    } else if (e.key === 'ArrowDown' && entry.kind === 'mega') {
      e.preventDefault();
      set(entry.id);
      focusFirstLink();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      set(null);
    } else if (e.key === 'Tab' && !e.shiftKey && entry.kind === 'mega' && open === entry.id) {
      // EP21: the panel follows its trigger in the Tab order (it is rendered after
      // the whole bar, so the browser would otherwise visit the other triggers first).
      e.preventDefault();
      focusFirstLink();
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    const i = TOP_NAV.findIndex((n) => n.kind === 'mega' && n.id === open);
    if (e.key === 'Escape') {
      e.preventDefault();
      set(null);
      items.current[i]?.focus();
    } else if (e.key === 'Tab') {
      const links = [...(panelRef.current?.querySelectorAll<HTMLElement>('a[href]') ?? [])];
      if (e.shiftKey && document.activeElement === links[0]) {
        // Shift+Tab from the first link returns to the trigger.
        e.preventDefault();
        items.current[i]?.focus();
      } else if (!e.shiftKey && document.activeElement === links.at(-1) && items.current[i + 1]) {
        // Tab from the last link closes the panel and continues with the next item.
        e.preventDefault();
        set(null);
        items.current[i + 1]?.focus();
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className="hidden min-w-0 nav:block"
      onPointerLeave={(e) => e.pointerType === 'mouse' && open && later(null, CLOSE_DELAY)}
      onBlur={(e) => {
        // Tabbing out of the bar and panel closes the menu.
        const next = e.relatedTarget as Node | null;
        if (open && next && !e.currentTarget.contains(next)) set(null);
      }}
    >
      <nav aria-label={t.header.primaryNav}>
        <ul className="flex items-center">
          {TOP_NAV.map((entry, i) => {
            const ref = (el: HTMLElement | null) => {
              items.current[i] = el;
            };
            if (entry.kind === 'link') {
              return (
                <li key={entry.id}>
                  <NavLink
                    ref={ref}
                    to={href(entry.to)}
                    end
                    onKeyDown={(e) => onItemKey(e, i)}
                    onPointerEnter={(e) =>
                      e.pointerType === 'mouse' && open && later(null, OPEN_DELAY)
                    }
                    className={({ isActive }) =>
                      cn(
                        itemClass,
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {t.nav[entry.id]}
                        <CurrentDot on={isActive && !open} />
                      </>
                    )}
                  </NavLink>
                </li>
              );
            }
            const isOpen = open === entry.id;
            const isCurrent = current === entry.id;
            const label = t.nav.groups[entry.id].label;
            return (
              <li key={entry.id}>
                <button
                  ref={ref}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`mega-${entry.id}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => toggle(entry.id)}
                  onKeyDown={(e) => onItemKey(e, i)}
                  onPointerEnter={(e) =>
                    e.pointerType === 'mouse' && later(entry.id, open ? 0 : OPEN_DELAY)
                  }
                  className={cn(
                    itemClass,
                    isOpen || isCurrent
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary',
                    // EP18.1: the open trigger sits on a soft pill, joined to its panel.
                    isOpen ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
                  )}
                >
                  {label}
                  <ChevronDown
                    className={cn(
                      'size-3.5 opacity-55 transition-transform duration-300 motion-reduce:transition-none',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                  <Underline on={isOpen} />
                  <CurrentDot on={isCurrent && !isOpen} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mega"
            ref={panelRef}
            id={`mega-${open}`}
            role="region"
            aria-label={t.header.megaRegion(t.nav.groups[open].label)}
            onKeyDown={onPanelKey}
            onPointerEnter={() => window.clearTimeout(timer.current)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="absolute inset-x-0 top-full overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(180deg,rgb(9_18_27),rgb(5_11_18)_75%)] shadow-[0_40px_80px_-40px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.04)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/35 to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-40 left-[8%] size-[26rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.07),transparent_70%)]"
            />
            <MegaPanel id={open} onNavigate={() => set(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
