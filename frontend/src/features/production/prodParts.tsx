import { useEffect, useId, useState, type ReactNode } from 'react';
import { CELL } from '@/features/company-center/model';
import { AreaLink, AreaNavLink, Pill } from '@/features/company-center/parts';
import { SearchBox } from '@/features/company-center/SearchBox';
import { useDebounced } from '@/features/warehouse/whModel';
import { cn } from '@/lib/cn';
import {
  productionApi,
  type Availability,
  type BomStatus,
  type MaterialState,
  type Material,
  type MoStatus,
  type ProductionContext,
  type ProductionItem,
} from './productionApi';
import { useProd } from './productionCopy';

/*
 * Pieces shared by the EP36 Production screens and the Purchasing shortage
 * page: copy hook, status pills (text first, tone second — never colour
 * alone), the responsive table (cards below md), the materials table and the
 * item search. Presentation only: the server decides every number and action.
 */

export const PROD = '/core/production';
export const LINK =
  'inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-7';

const MO_TONE: Record<MoStatus, 'neutral' | 'teal' | 'muted' | 'warning'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'teal',
  READY: 'teal',
  IN_PRODUCTION: 'teal',
  COMPLETION_REVIEW: 'warning',
  COMPLETED: 'teal',
  PAUSED: 'warning',
  REJECTED: 'muted',
  CANCELLED: 'muted',
};

export function MoStatusPill({ status }: { status: MoStatus }) {
  const { c } = useProd();
  return (
    <Pill
      tone={MO_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-mo-status={status}
    >
      {c.statuses[status]}
    </Pill>
  );
}

export function BomStatusPill({ status }: { status: BomStatus }) {
  const { c } = useProd();
  return (
    <Pill
      tone={status === 'ACTIVE' ? 'teal' : status === 'DRAFT' ? 'neutral' : 'muted'}
      data-bom-status={status}
    >
      {c.bomStatuses[status]}
    </Pill>
  );
}

export function MaterialStatePill({ state }: { state: MaterialState }) {
  const { c } = useProd();
  return (
    <Pill
      tone={
        state === 'MATERIALS_AVAILABLE' ? 'teal' : state === 'MATERIALS_SHORT' ? 'warning' : 'muted'
      }
      data-material-state={state}
    >
      {c.materialStates[state]}
    </Pill>
  );
}

export function AvailPill({ state }: { state: Availability }) {
  const { c } = useProd();
  return (
    <Pill tone={state === 'AVAILABLE' ? 'teal' : 'warning'} data-availability={state}>
      {c.avail[state]}
    </Pill>
  );
}

/** The Production section links this person may open (presentation only). */
export function ProductionNav({ ctx }: { ctx: ProductionContext }) {
  const { c } = useProd();
  const links: [string, string, boolean][] = [
    [PROD, c.nav.overview, true],
    [`${PROD}/orders`, c.nav.orders, false],
    ...(ctx.bom.view ? [[`${PROD}/boms`, c.nav.boms, false] as [string, string, boolean]] : []),
    [`${PROD}/requirements`, c.nav.requirements, false],
    [`${PROD}/demand`, c.nav.demand, false],
    // EP37
    [`${PROD}/reservations`, c.nav.reservations, false],
    [`${PROD}/issues`, c.nav.issues, false],
    [`${PROD}/execution`, c.nav.execution, false],
    [`${PROD}/output`, c.nav.output, false],
  ];
  return (
    <nav
      aria-label={c.nav.label}
      className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-white/[0.07]"
      data-production-nav
    >
      {links.map(([to, label, end]) => (
        <AreaNavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              isActive
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )
          }
        >
          {label}
        </AreaNavLink>
      ))}
    </nav>
  );
}

export function BackLink({ to = PROD }: { to?: string }) {
  const { c } = useProd();
  return (
    <AreaLink
      to={to}
      className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
    >
      ← {c.back}
    </AreaLink>
  );
}

export interface Col<T> {
  head: string;
  minor?: boolean;
  end?: boolean;
  cell: (r: T) => ReactNode;
}

/** Layout classes per breakpoint (literal strings so Tailwind generates them). */
const LAYOUT = {
  md: {
    table: 'max-md:block',
    head: 'max-md:sr-only',
    body: 'max-md:grid max-md:grid-cols-1 max-md:gap-2',
    row: 'max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4',
    cell: CELL,
    minor: 'md:max-xl:hidden',
    end: 'md:text-right',
  },
  lg: {
    table: 'max-lg:block',
    head: 'max-lg:sr-only',
    body: 'max-lg:grid max-lg:grid-cols-1 max-lg:gap-2',
    row: 'max-lg:grid max-lg:grid-cols-1 max-lg:gap-1 max-lg:rounded-xl max-lg:border-0 max-lg:bg-white/[0.02] max-lg:p-4',
    cell: 'block px-0 py-1 align-top lg:table-cell lg:px-3 lg:py-3 lg:first:pl-4 max-lg:before:block max-lg:before:text-caption max-lg:before:text-text-muted max-lg:before:content-[attr(data-label)]',
    minor: 'lg:max-xl:hidden',
    end: 'lg:text-right',
  },
};

/**
 * A real table on wide screens, labelled cards below md — or below lg for the
 * widest lists (`wide`), so no page ever scrolls sideways. Each cell names its column.
 */
export function Table<T>({
  rows,
  cols,
  rowKey,
  data,
  wide = false,
}: {
  rows: readonly T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  data?: string;
  wide?: boolean;
}) {
  const L = LAYOUT[wide ? 'lg' : 'md'];
  return (
    <table className={cn('w-full text-left text-label', L.table)} data-table={data}>
      <thead className={L.head}>
        <tr className="text-caption text-text-muted">
          {cols.map((col) => (
            <th
              key={col.head}
              scope="col"
              className={cn(
                'px-3 pb-2 font-medium first:pl-4',
                col.minor && L.minor,
                col.end && L.end,
              )}
            >
              {col.head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={L.body}>
        {rows.map((r) => (
          <tr
            key={rowKey(r)}
            className={cn('border-t border-white/[0.06]', L.row)}
            data-row={rowKey(r)}
          >
            {cols.map((col) => (
              <td
                key={col.head}
                data-label={col.head}
                className={cn(L.cell, col.minor && L.minor, col.end && cn('tabular-nums', L.end))}
              >
                {col.cell(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ItemCell = ({ code, name }: { code: string; name: string }) => (
  <span className="break-words">
    <span className="font-mono text-caption text-text-muted">{code}</span> {name}
  </span>
);
export { ItemCell };

/** Required / available / shortage per material (availability null when not assessed). */
export function MaterialsTable({ materials }: { materials: Material[] }) {
  const { c } = useProd();
  const q = (v: string | null, unit: string) => (v === null ? '—' : `${v} ${unit}`);
  return (
    <Table
      data="materials"
      rows={materials}
      rowKey={(m) => String(m.lineNo)}
      cols={[
        { head: c.f.material, cell: (m) => <ItemCell code={m.item.code} name={m.item.name} /> },
        { head: c.f.perBase, end: true, minor: true, cell: (m) => q(m.bomQuantity, m.unit.code) },
        {
          head: c.f.requiredQty,
          end: true,
          cell: (m) => (
            <span className="font-semibold whitespace-nowrap" data-required={m.required}>
              {q(m.required, m.unit.code)}
              {m.exact === false && (
                <span className="block text-caption font-normal text-text-muted">{c.rounded}</span>
              )}
            </span>
          ),
        },
        { head: c.f.available, end: true, cell: (m) => q(m.available, m.unit.code) },
        {
          head: c.f.shortage,
          end: true,
          cell: (m) =>
            m.shortage && m.shortage !== '0' ? (
              <span className="font-semibold text-[#f3cf8a]" data-shortage={m.shortage}>
                {q(m.shortage, m.unit.code)}
              </span>
            ) : (
              q(m.shortage, m.unit.code)
            ),
        },
        { head: c.f.availability, cell: (m) => (m.state ? <AvailPill state={m.state} /> : '—') },
      ]}
    />
  );
}

/** Server search for production items (finished goods or materials). */
export function ItemSearch({
  role,
  label,
  hint,
  onPick,
}: {
  role: 'OUTPUT' | 'MATERIAL';
  label: string;
  hint: string;
  onPick: (i: ProductionItem) => void;
}) {
  const { c } = useProd();
  const id = useId();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [got, setGot] = useState<{ q: string; items: ProductionItem[] } | null>(null);
  const items = debounced.length >= 2 && got?.q === debounced ? got.items : [];
  useEffect(() => {
    let live = true;
    if (debounced.length >= 2) {
      productionApi.items(role, debounced).then(
        (r) => live && setGot({ q: debounced, items: r.items }),
        () => live && setGot({ q: debounced, items: [] }),
      );
    }
    return () => {
      live = false;
    };
  }, [debounced, role]);
  return (
    <div className="grid gap-2" data-item-search={role}>
      <SearchBox
        id={id}
        label={label}
        value={q}
        onChange={setQ}
        placeholder={hint}
        describedBy={`${id}-n`}
      />
      <span id={`${id}-n`} className="sr-only" role="status">
        {items.length ? c.count(items.length) : ''}
      </span>
      {items.length > 0 && (
        <ul className="grid gap-1">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(i);
                  setQ('');
                }}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 text-left text-label hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-focus"
                data-pick={i.code}
              >
                <span>
                  <span className="font-mono">{i.code}</span> · {i.name}
                </span>
                <span className="text-caption text-text-muted">{i.unit.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Audit timeline (labels per action suffix). */
export function TimelineList({
  items,
  date,
}: {
  items: { type: string; at: string; actor: { name: string } | null }[];
  date: (iso: string) => string;
}) {
  const { c } = useProd();
  return (
    <ol className="grid gap-2" data-timeline>
      {items.map((t, i) => (
        <li key={i} className="flex flex-wrap gap-x-3 text-label">
          <span className="font-semibold text-text-primary">
            {c.timelineTypes[t.type.replace(/^PRODUCTION_(ORDER_|BOM_)?|^MATERIAL_ISSUE_/, '')] ??
              t.type}
          </span>
          <span className="text-text-secondary">{t.actor?.name ?? c.system}</span>
          <span className="text-caption text-text-muted">{date(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}
