import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Checkbox } from './form/controls';
import { OverflowMenu, type MenuAction } from './Menu';
import { TableSkeleton } from './Skeleton';

/*
 * CORE enterprise table.
 *
 * Desktop (≥ 768px): a real <table>. Columns declare a priority so narrower
 * screens drop the least important ones instead of scrolling sideways:
 *   primary — row title, always shown
 *   status  — always shown
 *   high    — always shown
 *   medium  — from 1024px
 *   low     — from 1280px (and in the record detail drawer)
 *
 * Phone (< 768px): each row becomes a card — title + status on top, up to
 * three high/medium fields as label/value pairs below, tap opens the detail
 * drawer. No horizontal page scroll, ever.
 */

export type ColumnPriority = 'primary' | 'status' | 'high' | 'medium' | 'low';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  priority?: ColumnPriority;
  align?: 'start' | 'end';
  /** Tailwind width class for the header cell, e.g. 'w-40'. */
  width?: string;
  sortable?: boolean;
}

export interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

const VISIBILITY: Record<ColumnPriority, string> = {
  primary: '',
  status: '',
  high: '',
  medium: 'hidden lg:table-cell',
  low: 'hidden xl:table-cell',
};

export function DataTable<T>({
  label,
  columns,
  rows,
  getRowId,
  onRowClick,
  rowActions,
  selection,
  sort,
  onSortChange,
  loading = false,
  empty,
  footer,
  bulkActions,
}: {
  /** Accessible table name (rendered as a visually hidden caption). */
  label: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** Opens the record — usually a detail Drawer. */
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => readonly (MenuAction | 'separator')[];
  selection?: { selected: ReadonlySet<string>; onChange: (next: Set<string>) => void };
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  loading?: boolean;
  /** Rendered instead of rows when there are none (an EmptyState). */
  empty?: ReactNode;
  /** Pagination or summary line. */
  footer?: ReactNode;
  /** Shown in a bar when at least one row is selected. */
  bulkActions?: ReactNode;
}) {
  const captionId = useId();
  if (loading) return <TableSkeleton columns={Math.min(columns.length, 5)} />;

  const primary = columns.find((c) => c.priority === 'primary') ?? columns[0]!;
  const status = columns.find((c) => c.priority === 'status');
  const details = columns
    .filter((c) => c !== primary && c !== status && (c.priority ?? 'high') !== 'low')
    .slice(0, 3);
  const ids = rows.map(getRowId);
  const selectedCount = selection ? ids.filter((id) => selection.selected.has(id)).length : 0;
  const allSelected = selection && rows.length > 0 && selectedCount === rows.length;

  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };
  const toggleAll = () => selection?.onChange(new Set(allSelected ? [] : ids));

  const sortFor = (col: Column<T>) =>
    sort?.columnId === col.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const nextSort = (col: Column<T>): SortState => ({
    columnId: col.id,
    direction: sort?.columnId === col.id && sort.direction === 'asc' ? 'desc' : 'asc',
  });

  return (
    <div className="min-w-0">
      {selection && selectedCount > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[color-mix(in_oklab,var(--ws-accent)_7%,transparent)] px-5 py-2.5"
        >
          <p className="text-label text-fg-primary">
            เลือกแล้ว <span className="font-semibold tabular">{selectedCount}</span> รายการ
          </p>
          <div className="flex items-center gap-2">
            {bulkActions}
            <button
              type="button"
              onClick={() => selection.onChange(new Set())}
              className="rounded-md px-2 py-1 text-caption text-fg-secondary hover:text-fg-primary"
            >
              ยกเลิกการเลือก
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        empty
      ) : (
        <>
          {/* Desktop / tablet table */}
          <table
            aria-labelledby={captionId}
            className="hidden w-full border-collapse text-left md:table"
          >
            <caption id={captionId} className="sr-only">
              {label}
            </caption>
            <thead>
              <tr className="border-y border-line bg-panel-raised/50">
                {selection && (
                  <th scope="col" className="w-12 py-2.5 pr-0 pl-5">
                    <Checkbox
                      aria-label="เลือกทุกรายการ"
                      checked={!!allSelected}
                      indeterminate={selectedCount > 0 && !allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={col.sortable ? sortFor(col) : undefined}
                    className={cn(
                      'px-4 py-2.5 text-caption font-medium whitespace-nowrap text-fg-muted first:pl-5 last:pr-5',
                      col.align === 'end' && 'text-right',
                      VISIBILITY[col.priority ?? 'high'],
                      col.width,
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(nextSort(col))}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm hover:text-fg-primary',
                          sort?.columnId === col.id && 'text-fg-secondary',
                        )}
                      >
                        {col.header}
                        {sort?.columnId === col.id ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
                {rowActions && (
                  <th scope="col" className="w-14 pr-5">
                    <span className="sr-only">การทำงาน</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = getRowId(row);
                const selected = selection?.selected.has(id) ?? false;
                return (
                  <tr
                    key={id}
                    data-selected={selected || undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-line transition-colors last:border-0',
                      onRowClick && 'cursor-pointer',
                      selected
                        ? 'bg-[color-mix(in_oklab,var(--ws-accent)_7%,transparent)]'
                        : 'hover:bg-fill-hover',
                    )}
                  >
                    {selection && (
                      <td className="py-3.5 pr-0 pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`เลือก ${id}`}
                          checked={selected}
                          onChange={() => toggle(id)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          'px-4 py-3.5 align-middle text-label first:pl-5 last:pr-5',
                          col === primary ? 'font-medium text-fg-primary' : 'text-fg-secondary',
                          col.align === 'end' && 'text-right tabular',
                          VISIBILITY[col.priority ?? 'high'],
                        )}
                      >
                        {col === primary && onRowClick ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRowClick(row);
                            }}
                            className="rounded-sm text-left hover:underline hover:decoration-line-strong hover:underline-offset-4"
                          >
                            {col.cell(row)}
                          </button>
                        ) : (
                          col.cell(row)
                        )}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="py-2 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <OverflowMenu label={`การทำงานสำหรับ ${id}`} items={rowActions(row)} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Phone card rows */}
          <ul aria-label={label} className="divide-y divide-line md:hidden">
            {rows.map((row) => {
              const id = getRowId(row);
              const selected = selection?.selected.has(id) ?? false;
              // Spans only: the card body may sit inside a <button>.
              const body = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-label font-medium text-fg-primary">
                      {primary.cell(row)}
                    </span>
                    {status && <span className="shrink-0">{status.cell(row)}</span>}
                  </span>
                  {details.length > 0 && (
                    <span className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                      {details.map((col) => (
                        <span key={col.id} className="block min-w-0">
                          <span className="block text-[0.75rem] text-fg-muted">{col.header}</span>
                          <span className="block truncate text-caption text-fg-secondary">
                            {col.cell(row)}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </>
              );
              return (
                <li
                  key={id}
                  data-selected={selected || undefined}
                  className={cn(
                    'flex items-start gap-3 px-4 py-4',
                    selected && 'bg-[color-mix(in_oklab,var(--ws-accent)_7%,transparent)]',
                  )}
                >
                  {selection && (
                    <Checkbox
                      aria-label={`เลือก ${id}`}
                      checked={selected}
                      onChange={() => toggle(id)}
                      className="mt-0.5"
                    />
                  )}
                  {onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-control text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">{body}</span>
                      <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-col">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {footer && rows.length > 0 && <div className="border-t border-line">{footer}</div>}
    </div>
  );
}
