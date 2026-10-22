import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { controlStyles } from './styles';

/** Search box for tables and lists. Client-side filtering only in the prototype. */
export function SearchField({
  value,
  onChange,
  placeholder = 'ค้นหา',
  label = 'ค้นหารายการ',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        aria-hidden
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={controlStyles({
          className: 'pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden',
        })}
      />
      {value && (
        <button
          type="button"
          aria-label="ล้างคำค้น"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:text-fg-primary"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Toggle filter. `aria-pressed` carries the state; the check is not colour-only. */
export function FilterChip({
  label,
  pressed,
  onToggle,
  count,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-caption whitespace-nowrap transition-colors',
        pressed
          ? 'border-[color-mix(in_oklab,var(--ws-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_10%,transparent)] text-fg-primary'
          : 'border-line-strong text-fg-secondary hover:bg-fill-hover hover:text-fg-primary',
      )}
    >
      {label}
      {count !== undefined && <span className="text-fg-muted tabular">{count}</span>}
    </button>
  );
}

/**
 * Bar above a table: search on the left, filter chips, actions on the right.
 * On phones the chips scroll horizontally inside their own row (intentional,
 * contained) instead of wrapping into a tall block.
 */
export function TableToolbar({
  search,
  filters,
  actions,
  onClear,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  /** Shown when any filter is active. */
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 pb-4 sm:px-6 lg:flex-row lg:items-center">
      {search}
      {filters && (
        <div
          role="group"
          aria-label="ตัวกรอง"
          className="-mx-5 no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {filters}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="h-9 shrink-0 rounded-full px-2 text-caption text-fg-muted hover:text-fg-primary"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}
      {actions && <div className="flex items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
  );
}

/** Page summary + previous/next. Page numbers are 1-based. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="การแบ่งหน้า"
      className="flex items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
    >
      <p className="text-caption text-fg-muted">
        แสดง{' '}
        <span className="text-fg-secondary tabular">
          {from}–{to}
        </span>{' '}
        จาก <span className="text-fg-secondary tabular">{total}</span> รายการ
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          label="หน้าก่อนหน้า"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="px-2 text-caption text-fg-secondary tabular">
          {page} / {pages}
        </span>
        <IconButton
          icon={ChevronRight}
          label="หน้าถัดไป"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
