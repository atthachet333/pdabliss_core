import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Tablist with roving focus (Arrow/Home/End). Scrolls inside its own row on
 * narrow screens rather than wrapping. Renders only the active panel.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  children,
  className,
}: {
  tabs: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  /** Content of the active tab. */
  children: ReactNode;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="-mx-1 no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-1"
      >
        {tabs.map((t, i) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={cn(
                'relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-label whitespace-nowrap transition-colors',
                selected ? 'text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-fill-muted px-1.5 text-[0.75rem] text-fg-secondary tabular">
                  {t.count}
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity',
                  selected ? 'bg-[var(--ws-accent)] opacity-100' : 'opacity-0',
                )}
              />
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${value}`}
        tabIndex={0}
        className="pt-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        {children}
      </div>
    </div>
  );
}
