import { Check } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the label is not plain text. */
  name?: string;
}

/**
 * A radio group drawn as a segmented control: one tab stop, arrow keys move
 * and select, the selected option carries a check mark (not colour alone).
 */
export function Segmented<T extends string>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  label?: string;
  labelledBy?: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const grid = className?.includes('grid') ?? false;
  const move = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn(
        // A caller-supplied grid layout replaces the default wrapping row.
        grid ? 'gap-1' : 'inline-flex flex-wrap gap-1',
        'rounded-2xl border border-border-soft bg-surface-base/80 p-1',
        className,
      )}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(i + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(i - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          move(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          move(options.length - 1);
        }
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.name}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 text-center font-medium transition-colors duration-200',
              // In a grid the cell width is fixed, so long labels may wrap; in a row they stay on one line.
              grid ? 'py-1.5' : 'whitespace-nowrap',
              size === 'sm' ? 'text-caption' : 'text-label',
              on
                ? 'bg-surface-overlay text-text-primary shadow-[inset_0_0_0_1px_var(--color-border-brand)]'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
            )}
          >
            {on && <Check aria-hidden className="size-3.5 shrink-0 text-brand-glow" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
