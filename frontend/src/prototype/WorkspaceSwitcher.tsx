import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { WORKSPACE_ORDER, WORKSPACES, type WorkspaceId } from '@/workspaces/registry';

/**
 * PROTOTYPE-ONLY. Lets the reviewer move between department workspaces.
 * In production there is no switcher: sign-in opens the user's assigned workspace.
 */
export function WorkspaceSwitcher({ current }: { current: WorkspaceId }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const ws = WORKSPACES[current];
  const Icon = ws.icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    const index = WORKSPACE_ORDER.indexOf(current);
    itemRefs.current[index]?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, current]);

  const choose = (id: WorkspaceId) => {
    setOpen(false);
    if (id !== current) navigate(`/app/${id}`);
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current;
    const i = items.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-border-soft bg-surface-raised/60 pr-3 pl-2.5 text-left transition-colors hover:border-border-strong"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--ws-accent)_14%,transparent)]">
          <Icon className="size-4 text-[var(--ws-accent)]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[0.6875rem] tracking-[0.12em] text-text-muted uppercase">
            สลับพื้นที่ทำงาน · ต้นแบบ
          </span>
          <span className="truncate text-label font-medium text-text-primary">{ws.shortTh}</span>
        </span>
        <ChevronDown
          className={cn('size-4 text-text-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="สลับพื้นที่ทำงาน (เฉพาะต้นแบบ)"
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="absolute top-full left-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border-strong bg-surface-overlay p-2 shadow-raised"
          >
            <p className="px-3 pt-2 pb-2 text-caption text-text-muted">
              เฉพาะต้นแบบ — ในระบบจริง ผู้ใช้จะเข้าสู่พื้นที่ทำงานของแผนกตนเองโดยอัตโนมัติ
            </p>
            {WORKSPACE_ORDER.map((id, i) => {
              const w = WORKSPACES[id];
              const WIcon = w.icon;
              const selected = id === current;
              return (
                <button
                  key={id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => choose(id)}
                  style={{ ['--item-accent' as string]: w.accent }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:bg-surface-highlight',
                    selected ? 'bg-surface-highlight' : 'hover:bg-surface-highlight/70',
                  )}
                >
                  <WIcon className="size-4.5 shrink-0 text-[var(--item-accent)]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label text-text-primary">{w.shortTh}</span>
                    <span className="block truncate text-caption text-text-muted">{w.nameEn}</span>
                  </span>
                  {selected && <Check className="size-4 text-text-secondary" aria-hidden />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
