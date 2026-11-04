import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import { AreaLink, Loading, PageTitle } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { whApi, type ExpiryState, type WarehouseContext } from './whApi';
import { WH_COPY, whError } from './whCopy';
import { ExpiryPill, ShowMore, WarehouseNav } from './whParts';
import { WH, useDebounced, usePaged } from './whModel';

/*
 * /core/warehouse/inventory and /core/warehouse/lots (EP31) — stock on hand,
 * one lazy chunk. Inventory: by item, location and lot. Lots & expiry: lot
 * stock earliest expiry first (the FEFO order), with an expiry state. Server
 * paging, search and filters; quantities only — there is no value to show.
 */

const EXPIRY: ExpiryState[] = ['EXPIRED', 'EXPIRING_SOON', 'OK', 'NO_EXPIRY'];

export default function InventoryArea({ view }: { view: 'stock' | 'lots' }) {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{whError(state.error, c, cc)}</Notice>;
  return <StockList key={view} view={view} ctx={state.data} />;
}

/** EP34: eight columns no longer fit at 768 px — rows stay labelled cards below 1024 px. */
const SCELL =
  'block px-0 py-1 align-top lg:table-cell lg:px-3 lg:py-3 lg:first:pl-4 max-lg:before:block max-lg:before:text-caption max-lg:before:text-text-muted max-lg:before:content-[attr(data-label)]';

function StockList({ view, ctx }: { view: 'stock' | 'lots'; ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const base = useId();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState('');
  const [expiry, setExpiry] = useState(params.get('expiry') ?? '');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) => whApi.stock({ view, q: debounced, locationId, expiry, page, pageSize: 25 }),
    [view, debounced, locationId, expiry],
  );
  const lots = view === 'lots';
  // EP32: a stock row leads to a transfer from its location or an adjustment.
  const acts = ctx.transfers.create || ctx.adjustments.create;
  const heads = [
    c.f.item,
    c.f.lot,
    c.f.expiry,
    c.f.location,
    c.f.onHand,
    c.f.reserved,
    c.f.available,
    ...(acts ? [c.f.actions] : []),
  ];
  return (
    <div className="grid grid-cols-1 gap-6" data-stock={view}>
      <PageTitle
        title={lots ? c.lots : c.inventory}
        lead={lots ? c.lotsLead(ctx.expiringSoonDays) : c.inventoryLead}
      />
      <WarehouseNav ctx={ctx} />
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))] lg:items-end"
      >
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.stockHint}
          describedBy={`${base}-count`}
        />
        <SelectField
          id={`${base}-loc`}
          label={c.f.location}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          data-filter="locationId"
        >
          <option value="">{c.f.any}</option>
          {ctx.locations.map((l) => (
            <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>
          ))}
        </SelectField>
        <SelectField
          id={`${base}-exp`}
          label={c.f.expiry}
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          data-filter="expiry"
        >
          <option value="">{c.f.any}</option>
          {EXPIRY.filter((s) => !(lots && s === 'NO_EXPIRY')).map((s) => (
            <option key={s} value={s}>
              {c.expiry[s]}
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
          {c.noStock}
        </p>
      ) : (
        <table className="w-full text-left text-label max-lg:block" data-stock-rows>
          <thead className="max-lg:sr-only">
            <tr className="text-caption text-text-muted">
              {heads.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    (h === c.f.onHand || h === c.f.reserved || h === c.f.available) && 'text-right',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-lg:grid max-lg:grid-cols-1 max-lg:gap-2">
            {data.items.map((s) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(SCELL, extra)}>
                  {content}
                </td>
              );
              return (
                <tr
                  key={s.id}
                  className="border-t border-white/[0.06] max-lg:grid max-lg:grid-cols-1 max-lg:gap-1 max-lg:rounded-xl max-lg:border-0 max-lg:bg-white/[0.02] max-lg:p-4"
                  data-stock-row={s.lot?.lotNumber ?? s.item.code}
                >
                  {cell(
                    c.f.item,
                    <>
                      <span className="font-mono text-text-primary">{s.item.code}</span>
                      <span className="block max-w-64 truncate text-caption text-text-muted">
                        {s.item.name}
                      </span>
                    </>,
                    'max-lg:before:hidden',
                  )}
                  {cell(
                    c.f.lot,
                    s.lot ? <span className="font-mono">{s.lot.lotNumber}</span> : '—',
                  )}
                  {cell(
                    c.f.expiry,
                    <span className="flex flex-wrap items-center gap-2">
                      {s.lot?.expiryDate ?? ''}
                      <ExpiryPill state={s.expiryState} days={s.daysToExpiry} />
                    </span>,
                  )}
                  {cell(c.f.location, <span className="font-mono">{s.location.code}</span>)}
                  {cell(
                    c.f.onHand,
                    <span className="font-semibold tabular-nums">
                      {s.quantityOnHand}{' '}
                      <span className="font-normal text-text-muted">{s.unit.code}</span>
                    </span>,
                    'lg:text-right lg:whitespace-nowrap',
                  )}
                  {cell(
                    c.f.reserved,
                    <span
                      className={cn(
                        'tabular-nums',
                        s.quantityReserved === '0' && 'text-text-muted',
                      )}
                      data-reserved={s.quantityReserved}
                    >
                      {s.quantityReserved}
                    </span>,
                    'lg:text-right lg:whitespace-nowrap',
                  )}
                  {cell(
                    c.f.available,
                    <span
                      className="font-semibold tabular-nums"
                      data-available={s.quantityAvailable}
                    >
                      {s.quantityAvailable}
                    </span>,
                    'lg:text-right lg:whitespace-nowrap',
                  )}
                  {acts && (
                    <td
                      data-label={c.f.actions}
                      className={cn(SCELL, 'max-lg:before:hidden lg:text-right')}
                      data-row-actions
                    >
                      <span className="flex flex-wrap gap-x-4 lg:justify-end">
                        {ctx.transfers.create && (
                          <AreaLink
                            to={`${WH}/transfers/new?location=${encodeURIComponent(s.location.id)}`}
                            className="inline-flex min-h-11 items-center text-label whitespace-nowrap text-brand-soft hover:underline lg:min-h-6"
                            aria-label={`${c.nav.transfers} ${s.item.code} ${s.location.code}`}
                          >
                            {c.nav.transfers}
                          </AreaLink>
                        )}
                        {ctx.adjustments.create && (
                          <AreaLink
                            to={`${WH}/adjustments/new`}
                            className="inline-flex min-h-11 items-center text-label whitespace-nowrap text-brand-soft hover:underline lg:min-h-6"
                            aria-label={`${c.nav.adjustments} ${s.item.code} ${s.location.code}`}
                          >
                            {c.nav.adjustments}
                          </AreaLink>
                        )}
                      </span>
                    </td>
                  )}
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
