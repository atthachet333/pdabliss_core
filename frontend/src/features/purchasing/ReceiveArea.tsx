import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { BranchCode } from '@/features/company-center/adminParts';
import { CELL, useDateFormat, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Section,
} from '@/features/company-center/parts';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { WH_COPY } from '@/features/warehouse/whCopy';
import { whApi } from '@/features/warehouse/whApi';
import { GrStatusPill, WarehouseNav } from '@/features/warehouse/whParts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { receiveApi, type Page, type ReceiveOrder } from './orderApi';
import { ORDER_COPY, poError } from './orderCopy';
import { LineIdentity, PoStatusPill } from './orderParts';

/*
 * /core/warehouse/pending-receive/* — what is on its way to the branch (EP30),
 * Warehouse's own lazy chunk. The server's WarehousePendingReceiveView holds
 * quantities and identities only: no price, discount, tax, total, deposit,
 * terms or supplier contact exists in what this page receives. EP31: per line
 * what was received, rejected and is still pending, the order's goods receipts,
 * and “Receive goods” (a new draft receipt) for those who may process receipts.
 */

const BASE = '/core/warehouse/pending-receive';

export default function ReceiveArea() {
  return (
    <div className="grid grid-cols-1 gap-6" data-pending-receive>
      <Routes>
        <Route index element={<ReceiveList />} />
        <Route path=":id" element={<ReceiveRoute />} />
      </Routes>
    </div>
  );
}

function ReceiveRoute() {
  const { id } = useParams();
  return <ReceivePage key={id} id={id!} />;
}

function ReceiveList() {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { date } = useDateFormat();
  const base = useId();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<Page<ReceiveOrder> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const { state: ctx } = useLoad(whApi.context);
  const request = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const load = async (page: number) => {
    const n = ++request.current;
    const next = await receiveApi.list({ q: debounced, page, pageSize: 25 });
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next,
    );
    setError(null);
  };
  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <>
      <AreaLink
        to="/core"
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← CORE
      </AreaLink>
      <PageTitle title={c.receive} lead={c.receiveLead} />
      {ctx.status === 'ready' && <WarehouseNav ctx={ctx.data} />}
      <div role="search" className="grid max-w-xl grid-cols-1">
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-count`}
        />
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{poError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.noReceive}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-receive-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {[c.f.number, c.f.supplier, c.f.branch, c.f.expected, c.f.lines].map((h) => (
                <th key={h} scope="col" className="px-3 pb-2 font-medium first:pl-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((o) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(CELL, extra)}>
                  {content}
                </td>
              );
              return (
                <tr
                  key={o.id}
                  className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                  data-receive-order={o.number}
                >
                  {cell(
                    c.f.number,
                    <AreaLink
                      to={`${BASE}/${encodeURIComponent(o.id)}`}
                      className="inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-0"
                    >
                      {o.number}
                    </AreaLink>,
                    'max-md:before:hidden',
                  )}
                  {cell(c.f.supplier, o.supplier.name ?? '—')}
                  {cell(
                    c.f.branch,
                    <BranchCode code={o.branch.code} head={o.branch.code === '00000'} />,
                  )}
                  {cell(c.f.expected, o.expectedDate ? date(o.expectedDate) : '—')}
                  {cell(c.f.lines, <span className="tabular-nums">{o.lineCount}</span>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={() => {
            setMore(true);
            load(data.page + 1)
              .catch((e: unknown) => setError(e))
              .finally(() => setMore(false));
          }}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
    </>
  );
}

function ReceivePage({ id }: { id: string }) {
  const c = useCopy(ORDER_COPY);
  const w = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { date, dateTime } = useDateFormat();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { state } = useLoad(() => Promise.all([receiveApi.get(id), whApi.context()]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const [{ order: o }, ctx] = state.data;
  const canReceive = ctx.receiving.process && o.status === 'PENDING_RECEIVE';
  const receive = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await whApi.create(o.id);
      void navigate(`/core/warehouse/receipts/${encodeURIComponent(d.receipt.id)}`, {
        state: { locale },
      });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 gap-6" data-receive-order={o.number}>
      <AreaLink
        to={BASE}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.back}
      </AreaLink>
      <div>
        <PageTitle
          title={o.number}
          action={
            canReceive ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void receive()}
                className={buttonClasses('primary', 'md')}
                data-receive-goods
              >
                {busy ? w.loading : w.receiveGoods}
              </button>
            ) : undefined
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PoStatusPill status={o.status} />
          <span className="text-caption text-text-muted">{c.receiveStates[o.receiving.state]}</span>
        </div>
      </div>
      <div aria-live="polite">
        {!!error && <Notice tone="error">{poError(error, c, cc)}</Notice>}
      </div>
      <Section id="rcv-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.supplier}>{`${o.supplier.code ?? ''} · ${o.supplier.name ?? ''}`}</Fact>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.expected}>{o.expectedDate ? date(o.expectedDate) : '—'}</Fact>
          <Fact term={c.statuses.PENDING_RECEIVE}>
            {o.pendingReceiveAt ? dateTime(o.pendingReceiveAt) : '—'}
          </Fact>
          {o.receiving.receivedAt && (
            <Fact term={c.statuses.RECEIVED}>{dateTime(o.receiving.receivedAt)}</Fact>
          )}
        </Facts>
      </Section>
      <Section id="rcv-lines" title={`${c.f.lines} · ${c.linesCount(o.lines.length)}`}>
        <ol className="grid grid-cols-1 gap-2" data-lines>
          {o.lines.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-xl bg-white/[0.02] p-3"
              data-line={l.lineNo}
            >
              <span className="font-mono text-caption text-text-muted tabular-nums">
                #{l.lineNo}
              </span>
              <div className="grid min-w-0 gap-2">
                <LineIdentity line={l} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    [c.f.ordered, l.orderedQuantity],
                    [c.f.received, l.receivedQuantity],
                    [c.f.rejected, l.rejectedQuantity],
                    [c.f.pendingQuantity, l.receivable ? l.pendingQuantity : '—'],
                    [c.f.lot, l.lotTracking ? c.tracking[l.lotTracking] : '—'],
                    [c.f.expiry, l.expiryTracking ? c.tracking[l.expiryTracking] : '—'],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt className="text-text-muted">{term}</dt>
                      <dd className="text-text-primary tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      {o.receipts.length > 0 && (
        <Section id="rcv-receipts" title={c.receiptsTitle}>
          <ul className="grid gap-2" data-receipts>
            {o.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                <AreaLink
                  to={`/core/warehouse/receipts/${encodeURIComponent(r.id)}`}
                  className="inline-flex min-h-11 items-center font-mono font-semibold text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {r.number}
                </AreaLink>
                <GrStatusPill status={r.status} />
                <span className="text-caption text-text-muted">{dateTime(r.receivedAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
