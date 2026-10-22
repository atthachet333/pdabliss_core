import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { buttonStyles, overlaySurface } from './styles';
import { useMenu } from './useMenu';

/** Animated floating panel for a menu. */
export function MenuSurface({
  open,
  id,
  menuRef,
  onKeyDown,
  label,
  align = 'end',
  className,
  children,
}: {
  open: boolean;
  id: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  label: string;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: DURATION.fast, ease: EASE_CORE }}
          className={cn(
            'absolute top-full z-50 mt-2 w-60 p-1.5',
            overlaySurface,
            align === 'end' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  disabled?: boolean;
  /** Secondary text shown to the right, e.g. "เร็ว ๆ นี้". */
  hint?: string;
  danger?: boolean;
}

export function MenuItem({ item, onDone }: { item: MenuAction; onDone: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={item.disabled || undefined}
      onClick={() => {
        if (item.disabled) return;
        onDone();
        item.onSelect?.();
      }}
      className={cn(
        'flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-label outline-none',
        item.disabled
          ? 'cursor-not-allowed text-fg-disabled'
          : item.danger
            ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10'
            : 'text-fg-secondary hover:bg-fill-hover hover:text-fg-primary focus-visible:bg-fill-active focus-visible:text-fg-primary',
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.hint && <span className="shrink-0 text-caption text-fg-muted">{item.hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

/** Overflow ("…") menu with a list of secondary actions. */
export function OverflowMenu({
  label = 'การทำงานเพิ่มเติม',
  items,
  align = 'end',
}: {
  label?: string;
  items: readonly (MenuAction | 'separator')[];
  align?: 'start' | 'end';
}) {
  const {
    open,
    close,
    toggle,
    rootRef,
    triggerRef,
    menuRef,
    menuId,
    onTriggerKeyDown,
    onMenuKeyDown,
  } = useMenu();
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={buttonStyles({ variant: 'secondary', iconOnly: true })}
      >
        <MoreHorizontal className="size-[1.125rem]" aria-hidden />
      </button>
      <MenuSurface
        open={open}
        id={menuId}
        menuRef={menuRef}
        onKeyDown={onMenuKeyDown}
        label={label}
        align={align}
      >
        {items.map((item, i) =>
          item === 'separator' ? (
            <MenuSeparator key={`sep-${i}`} />
          ) : (
            <MenuItem key={item.label} item={item} onDone={() => close(true)} />
          ),
        )}
      </MenuSurface>
    </div>
  );
}
