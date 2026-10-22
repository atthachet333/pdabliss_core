import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDismiss } from './hooks';

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"])';

/**
 * Menu-button behaviour (WAI-ARIA menu pattern): opens from a trigger, moves
 * focus into the menu, arrow keys rove, Escape returns focus to the trigger,
 * outside click or Tab closes. Used by overflow menus, the profile menu and
 * the prototype workspace switcher.
 *
 * Wiring:
 *   <div ref={rootRef}>
 *     <button ref={triggerRef} aria-haspopup="menu" aria-expanded={open}
 *             aria-controls={menuId} onClick={toggle} onKeyDown={onTriggerKeyDown} />
 *     <MenuSurface open={open} id={menuId} menuRef={menuRef} onKeyDown={onMenuKeyDown}>…
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useDismiss(open, rootRef, (reason) => close(reason === 'escape'));

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    (items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Tab') close(false);
    if (next !== null) {
      e.preventDefault();
      items[next]?.focus();
    }
  };

  return {
    open,
    close,
    toggle,
    rootRef,
    triggerRef,
    menuRef,
    menuId,
    onTriggerKeyDown,
    onMenuKeyDown,
  };
}
