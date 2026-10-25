import { ArrowRight, Check } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { CATEGORY_ACCENT } from './accent';
import { RESOURCE_META } from './meta';
import { getResource, resourcePath, type Category, type ResourceId } from './registry';

/*
 * Small shared pieces of the EP16 reading system: a category mark, the
 * reading-time label and the editorial resource row (not a thumbnail card).
 */

export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  const c = useCopy(RESOURCE_META);
  return (
    <span
      data-category={category}
      className={cn(
        'inline-flex items-center gap-2 text-caption font-medium text-text-secondary',
        className,
      )}
    >
      <span
        aria-hidden
        className="h-2.5 w-[3px] shrink-0 rounded-full"
        style={{ background: CATEGORY_ACCENT[category] }}
      />
      {c.categories[category]}
    </span>
  );
}

export function Minutes({ id, className }: { id: ResourceId; className?: string }) {
  const c = useCopy(RESOURCE_META);
  return (
    <span className={cn('text-caption text-text-muted tabular', className)}>
      {fill(c.minutes, { n: getResource(id).readingMinutes })}
    </span>
  );
}

/**
 * An editorial row: category, title, one line, reading time. The rule under
 * it draws across on hover / focus (instant under reduced motion).
 */
export function ResourceRow({
  id,
  index,
  note,
  summary = false,
  className,
}: {
  id: ResourceId;
  index?: number;
  note?: string;
  summary?: boolean;
  className?: string;
}) {
  const m = useCopy(RESOURCE_META).resources[id];
  const { href } = useLocale();
  const r = getResource(id);
  return (
    <Link
      to={href(resourcePath(id))}
      data-resource-link={id}
      className={cn(
        'group relative grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 py-4 outline-offset-4',
        className,
      )}
    >
      <span aria-hidden className="pt-0.5 font-mono text-caption text-text-muted tabular">
        {index !== undefined ? String(index + 1).padStart(2, '0') : '·'}
      </span>
      <span className="min-w-0">
        <CategoryTag category={r.category} />
        <span className="mt-1 block text-body font-semibold text-text-primary transition-colors group-hover:text-brand-soft">
          {m.title}
        </span>
        <span className="mt-1 block text-label text-text-secondary">
          {note ?? (summary ? m.summary : m.short)}
        </span>
        {summary && <Minutes id={id} className="mt-2 block" />}
      </span>
      <ArrowRight
        aria-hidden
        className="mt-6 size-4 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-soft motion-reduce:transition-none"
      />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-brand-glow/60 transition-transform duration-500 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
      />
    </Link>
  );
}

/**
 * A row of filter chips that behaves as one radio group: a single tab stop,
 * arrow keys / Home / End move and select, and the selected chip carries a
 * check mark as well as its fill (never colour alone).
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  dataKey,
  className,
  chipClassName,
}: {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  /** Data attribute carrying each option's value, e.g. `data-filter`. */
  dataKey: `data-${string}`;
  className?: string;
  chipClassName?: (on: boolean) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={className}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        const to =
          e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? i + 1
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
              ? i - 1
              : e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? options.length - 1
                  : null;
        if (to === null) return;
        e.preventDefault();
        move(to);
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
            tabIndex={on ? 0 : -1}
            {...{ [dataKey]: o.value }}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-label transition-colors',
              // cn() does not merge, so wrapping is decided here or by chipClassName — never both.
              chipClassName
                ? chipClassName(on)
                : cn(
                    'whitespace-nowrap',
                    on
                      ? 'bg-brand-primary font-medium text-text-inverse'
                      : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] hover:text-text-primary',
                  ),
            )}
          >
            {on && <Check aria-hidden className="size-3.5 shrink-0" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
