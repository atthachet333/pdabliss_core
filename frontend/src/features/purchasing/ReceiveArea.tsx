import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Route, Routes, useParams } from 'react-router';
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
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { receiveApi, type Page, type ReceiveOrder } from './orderApi';
import { ORDER_COPY, poError } from './orderCopy';
import { LineIdentity, PoStatusPill } from './orderParts';

/*
 * /core/warehouse/pending-receive/* — what is on its way to the branch (EP30),
 * Warehouse's own lazy chunk. The server's WarehousePendingReceiveView holds
 * quantities and identities only: no price, discount, tax, total, deposit,
 * terms or supplier contact exists in what this page receives. No receive
 * action yet (EP31).
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
  const request = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const n = ++request.current;
    receiveApi.list({ q: debounced, pageSize: 50 }).then(
      (next) => {
        if (n !== request.current) return;
        setData(next);
        setError(null);
      },
      (e: unknown) => setError(e),
    );
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
      <Notice tone="info">{c.receiveLater}</Notice>
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
    </>
  );
}

function ReceivePage({ id }: { id: string }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { date, dateTime } = useDateFormat();
  const { state } = useLoad(() => receiveApi.get(id));
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const o = state.data.order;
  return (
    <div className="grid grid-cols-1 gap-6" data-receive-order={o.number}>
      <AreaLink
        to={BASE}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.back}
      </AreaLink>
      <div>
        <PageTitle title={o.number} />
        <div className="mt-3">
          <PoStatusPill status={o.status} />
        </div>
      </div>
      <Section id="rcv-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.supplier}>{`${o.supplier.code ?? ''} · ${o.supplier.name ?? ''}`}</Fact>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.expected}>{o.expectedDate ? date(o.expectedDate) : '—'}</Fact>
          <Fact term={c.statuses.PENDING_RECEIVE}>
            {o.pendingReceiveAt ? dateTime(o.pendingReceiveAt) : '—'}
          </Fact>
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
              <LineIdentity line={l} />
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
