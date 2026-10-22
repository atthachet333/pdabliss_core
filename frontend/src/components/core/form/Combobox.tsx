import { Check, ChevronsUpDown } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useDismiss } from '../hooks';
import { controlStyles, overlaySurface } from '../styles';
import { useFieldProps } from './fieldContext';

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary text, e.g. a code. Also searched. */
  detail?: string;
}

/**
 * Searchable select (WAI-ARIA combobox + listbox). Visual foundation for
 * customer / supplier / product pickers: filters a local option list; a
 * server-backed search can replace `options` later without changing the UI.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'พิมพ์เพื่อค้นหา',
  emptyText = 'ไม่พบรายการที่ตรงกัน',
}: {
  options: readonly ComboOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const { invalid, ...inputField } = useFieldProps();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.detail ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useDismiss(open, rootRef, () => setOpen(false));

  const choose = (opt: ComboOption) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        {...inputField}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && open && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={controlStyles({ invalid, className: 'pr-10' })}
      />
      <ChevronsUpDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            'absolute inset-x-0 top-full z-40 mt-1.5 max-h-64 overflow-y-auto p-1.5',
            overlaySurface,
          )}
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-caption text-fg-muted">{emptyText}</li>
          ) : (
            results.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-control px-3 py-2',
                  i === active && 'bg-fill-active',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label text-fg-primary">{o.label}</span>
                  {o.detail && (
                    <span className="block truncate text-caption text-fg-muted">{o.detail}</span>
                  )}
                </span>
                {o.value === value && <Check className="size-4 text-brand-primary" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
