import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Route, Routes, useParams } from 'react-router';
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
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { depositApi, type DepositDetail, type DepositOrder, type Page } from './orderApi';
import { ORDER_COPY, poError, useMoney } from './orderCopy';
import { ConfirmBox, DepositPill, LineIdentity, PoStatusPill } from './orderParts';

/*
 * /core/accounting/deposits/* — supplier deposits to confirm (EP30), Accounting's
 * own lazy chunk. The server's AccountingDepositView: order amounts and the
 * deposit, read-only order content, and two actions — confirm (an optional
 * payment reference; never bank credentials) or waive (reason required).
 * Either moves the order to pending receive; of two at once, one wins.
 */

const BASE = '/core/accounting/deposits';

export default function DepositsArea() {
  return (
    <div className="grid grid-cols-1 gap-6" data-deposits>
      <Routes>
        <Route index element={<DepositList />} />
        <Route path=":id" element={<DepositRoute />} />
      </Routes>
    </div>
  );
}

function DepositRoute() {
  const { id } = useParams();
  return <DepositPage key={id} id={id!} />;
}

function DepositList() {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const money = useMoney();
  const { date } = useDateFormat();
  const base = useId();
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<Page<DepositOrder> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const request = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const n = ++request.current;
    depositApi.list({ view, q: debounced, pageSize: 50 }).then(
      (next) => {
        if (n !== request.current) return;
        setData(next);
        setError(null);
      },
      (e: unknown) => setError(e),
    );
  }, [view, debounced]);
  return (
    <>
      <AreaLink
        to="/core"
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← CORE
      </AreaLink>
      <PageTitle title={c.deposits} lead={c.depositsLead} />
      <nav
        aria-label={c.deposits}
        className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-white/[0.07]"
      >
        {(['pending', 'all'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              view === v
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
            data-view={v}
          >
            {c.depositViews[v]}
          </button>
        ))}
      </nav>
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
          {c.noDeposits}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-deposit-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {[
                c.f.number,
                c.f.status,
                c.f.branch,
                c.f.grandTotal,
                c.f.depositAmount,
                c.f.dueDate,
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    (h === c.f.grandTotal || h === c.f.depositAmount) && 'text-right',
                    h === c.f.grandTotal && 'md:max-lg:hidden',
                  )}
                >
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
                  data-deposit-order={o.number}
                >
                  {cell(
                    c.f.number,
                    <>
                      <AreaLink
                        to={`${BASE}/${encodeURIComponent(o.id)}`}
                        className="inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-0"
                      >
                        {o.number}
                      </AreaLink>
                      <span className="block max-w-40 truncate text-caption text-text-muted lg:max-w-72">
                        {o.supplier.name}
                      </span>
                    </>,
                    'max-md:before:hidden',
                  )}
                  {cell(c.f.status, <DepositPill status={o.deposit.status} />)}
                  {cell(
                    c.f.branch,
                    <BranchCode code={o.branch.code} head={o.branch.code === '00000'} />,
                  )}
                  {cell(
                    c.f.grandTotal,
                    <span className="tabular-nums">{money(o.totals.grandTotal, o.currency)}</span>,
                    'md:text-right md:whitespace-nowrap md:max-lg:hidden',
                  )}
                  {cell(
                    c.f.depositAmount,
                    <span className="font-semibold tabular-nums">
                      {money(o.deposit.amount, o.currency)}
                    </span>,
                    'md:text-right md:whitespace-nowrap',
                  )}
                  {cell(c.f.dueDate, o.deposit.dueDate ? date(o.deposit.dueDate) : '—')}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function DepositPage({ id }: { id: string }) {
  const c = useCopy(ORDER_COPY);
  const cc = useCopy(CONTROL_COPY);
  const money = useMoney();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => depositApi.get(id));
  const [confirm, setConfirm] = useState<'confirm_deposit' | 'waive_deposit' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{poError(state.error, c, cc)}</Notice>;
  const o = state.data.order;
  const cur = o.currency;
  const act = async (work: () => Promise<DepositDetail>) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text: c.depositDone });
      setConfirm(null);
      heading.current?.focus();
    } catch (e) {
      setNotice({ tone: 'error', text: poError(e, c, cc) });
    }
  };
  return (
    <div className="grid grid-cols-1 gap-6" data-deposit-order={o.number} data-status={o.status}>
      <AreaLink
        to={BASE}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.back}
      </AreaLink>
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={o.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PoStatusPill status={o.status} />
          <DepositPill status={o.deposit.status} />
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      <Section id="dep-facts" title={c.f.deposit}>
        <Facts>
          <Fact term={c.f.supplier}>
            {o.supplier.code} · {o.supplier.name}
            {o.supplier.taxId && (
              <span className="block text-caption text-text-muted">{`${c.f.taxId} ${o.supplier.taxId}`}</span>
            )}
          </Fact>
          <Fact term={c.f.branch}>{`${o.branch.code} · ${o.branch.name}`}</Fact>
          <Fact term={c.f.issued}>
            {o.issuedAt ? `${dateTime(o.issuedAt)} · ${o.issuedBy?.name ?? ''}` : '—'}
          </Fact>
          <Fact term={c.f.terms}>
            <span className="whitespace-pre-line">{o.paymentTerms ?? '—'}</span>
          </Fact>
          <Fact term={c.f.grandTotal}>
            <span className="tabular-nums">{money(o.totals.grandTotal, cur)}</span>
          </Fact>
          <Fact term={c.f.depositAmount}>
            <span className="font-semibold tabular-nums" data-deposit-amount>
              {money(o.deposit.amount, cur)}
            </span>
            {o.deposit.type === 'PERCENT' && (
              <span className="text-text-muted"> ({o.deposit.value}%)</span>
            )}
          </Fact>
          <Fact term={c.f.dueDate}>{o.deposit.dueDate ? date(o.deposit.dueDate) : '—'}</Fact>
          {o.deposit.note && (
            <Fact term={c.f.depositNote}>
              <span className="whitespace-pre-line">{o.deposit.note}</span>
            </Fact>
          )}
          {o.deposit.confirmedAt && (
            <Fact term={c.depositStatuses.CONFIRMED}>
              {`${dateTime(o.deposit.confirmedAt)} · ${o.deposit.confirmedBy?.name ?? ''}${o.deposit.reference ? ` · ${o.deposit.reference}` : ''}`}
            </Fact>
          )}
          {o.deposit.waivedAt && (
            <Fact term={c.depositStatuses.WAIVED}>
              {`${dateTime(o.deposit.waivedAt)} · ${o.deposit.waivedBy?.name ?? ''}`}
              <span className="block whitespace-pre-line">{o.deposit.waiveReason}</span>
            </Fact>
          )}
        </Facts>
      </Section>
      {o.actions.length > 0 && (
        <div className="grid gap-3" data-actions>
          {confirm ? (
            <ConfirmBox
              question={confirm === 'confirm_deposit' ? c.confirmDepositAsk : c.waiveDepositAsk}
              goLabel={confirm === 'confirm_deposit' ? c.confirmDeposit : c.waiveDeposit}
              reason={confirm === 'waive_deposit' ? 'required' : undefined}
              field={
                confirm === 'confirm_deposit'
                  ? { label: c.f.reference, hint: c.f.referenceHint, maxLength: 100 }
                  : undefined
              }
              onCancel={() => setConfirm(null)}
              onConfirm={(text) =>
                act(() =>
                  confirm === 'confirm_deposit'
                    ? depositApi.confirm(o.id, text)
                    : depositApi.waive(o.id, text ?? ''),
                )
              }
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {o.actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setConfirm(a)}
                  className={buttonClasses(a === 'confirm_deposit' ? 'primary' : 'secondary', 'md')}
                  data-action={a}
                >
                  {a === 'confirm_deposit' ? c.confirmDeposit : c.waiveDeposit}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Section id="dep-lines" title={`${c.f.lines} · ${c.linesCount(o.lines.length)}`}>
        <ol className="grid grid-cols-1 gap-2">
          {o.lines.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-1 gap-2 rounded-xl bg-white/[0.02] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
            >
              <LineIdentity line={l} />
              <dl className="grid grid-cols-2 gap-x-4 text-caption sm:grid-cols-4">
                {(
                  [
                    [c.f.unitPrice, money(l.unitPrice)],
                    [c.f.discount, money(l.discountAmount)],
                    [c.f.taxRate, `${l.taxRate}%`],
                    [c.f.lineTotal, money(l.lineTotal)],
                  ] as const
                ).map(([t, v]) => (
                  <div key={t}>
                    <dt className="text-text-muted">{t}</dt>
                    <dd className="text-text-primary tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
