import { useId, useState, type ReactNode } from 'react';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { CELL, useDateFormat, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import { AreaLink, Loading, PageTitle } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { MOVEMENT_TYPES, whApi, type MovementRow, type WarehouseContext } from './whApi';
import { WH_COPY, whError } from './whCopy';
import { ShowMore, WarehouseNav } from './whParts';
import { WH, useDebounced, usePaged } from './whModel';

/*
 * /core/warehouse/movements (EP31) — the stock movement ledger, newest first,
 * its own lazy chunk. Every row is immutable; a correction shows as a
 * reversal. EP32 adds transfer, adjustment and count movements, each linked
 * to its document. Quantities and identities only.
 */

const DOC_LINK =
  'inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-7';

/** The source document of a movement: a receipt (and its order), or an EP32 document. */
function SourceLink({ s }: { s: MovementRow['source'] }) {
  const doc: [string, { id: string; number: string }] | null = s.receipt
    ? ['receipts', s.receipt]
    : s.transfer
      ? ['transfers', s.transfer]
      : s.adjustment
        ? ['adjustments', s.adjustment]
        : s.count
          ? ['counts', s.count]
          : s.shipment
            ? ['shipments', s.shipment]
            : null;
  if (!doc) return <>—</>;
  return (
    <>
      <AreaLink to={`${WH}/${doc[0]}/${encodeURIComponent(doc[1].id)}`} className={DOC_LINK}>
        {doc[1].number}
      </AreaLink>
      {s.order && (
        <span className="block font-mono text-caption text-text-muted">{s.order.number}</span>
      )}
    </>
  );
}

export default function MovementsArea() {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{whError(state.error, c, cc)}</Notice>;
  return <MovementList ctx={state.data} />;
}

function MovementList({ ctx }: { ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { dateTime } = useDateFormat();
  const base = useId();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) => whApi.movements({ q: debounced, type, page, pageSize: 25 }),
    [debounced, type],
  );
  const heads = [
    c.f.date,
    c.f.type,
    c.f.document,
    c.f.item,
    c.f.lot,
    c.f.location,
    c.f.delta,
    c.f.by,
  ];
  return (
    <div className="grid grid-cols-1 gap-6" data-movements>
      <PageTitle title={c.movements} lead={c.movementsLead} />
      <WarehouseNav ctx={ctx} />
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end"
      >
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.movementHint}
          describedBy={`${base}-count`}
        />
        <SelectField
          id={`${base}-type`}
          label={c.f.type}
          value={type}
          onChange={(e) => setType(e.target.value)}
          data-filter="type"
        >
          <option value="">{c.f.any}</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {c.movementTypes[t]}
            </option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{whError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.noMovements}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-movement-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {heads.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    h === c.f.delta && 'text-right',
                    (h === c.f.by || h === c.f.location) && 'md:max-xl:hidden',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((m) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(CELL, extra)}>
                  {content}
                </td>
              );
              const out = m.quantityDelta.startsWith('-');
              return (
                <tr
                  key={m.id}
                  className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                  data-movement={m.type}
                >
                  {cell(c.f.date, dateTime(m.occurredAt), 'md:whitespace-nowrap')}
                  {cell(c.f.type, c.movementTypes[m.type])}
                  {cell(c.f.document, <SourceLink s={m.source} />)}
                  {cell(c.f.item, <span className="font-mono">{m.item.code}</span>)}
                  {cell(
                    c.f.lot,
                    m.lot ? <span className="font-mono">{m.lot.lotNumber}</span> : '—',
                  )}
                  {cell(
                    c.f.location,
                    <span className="font-mono">{m.location.code}</span>,
                    'md:max-xl:hidden',
                  )}
                  {cell(
                    c.f.delta,
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        out ? 'text-[#f3cf8a]' : 'text-brand-soft',
                      )}
                    >
                      {out ? '−' : '+'}
                      {m.quantityDelta.replace('-', '')}{' '}
                      <span className="font-normal text-text-muted">{m.unit.code}</span>
                    </span>,
                    'md:text-right md:whitespace-nowrap',
                  )}
                  {cell(c.f.by, m.actor?.name ?? c.system, 'md:max-xl:hidden')}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ShowMore visible={!!data?.hasMore} busy={more} onClick={showMore} />
    </div>
  );
}
