import { useEffect, useId, useRef } from 'react';
import { useBodyScrollLock, useFocusTrap } from './hooks';

// Only the top-most overlay reacts to Escape.
const stack: string[] = [];

/** Shared modal behaviour: scroll lock, focus trap, Escape for the top-most layer. */
export function useOverlay(open: boolean, onClose: () => void) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useFocusTrap(open, panelRef);
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) {
        e.stopPropagation();
        latest.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
    };
  }, [open, id]);
  return { id, panelRef };
}
