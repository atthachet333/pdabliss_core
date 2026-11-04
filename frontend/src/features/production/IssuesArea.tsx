import { useId, useRef, useState } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Pill,
  Section,
} from '@/features/company-center/parts';
import { SearchBox } from '@/features/company-center/SearchBox';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useDebounced, usePaged } from '@/features/warehouse/whModel';
import { useExec } from './execCopy';
import {
  places,
  productionApi,
  QTY,
  type Issue,
  type IssueDetail,
  type IssueStatus,
} from './productionApi';
import { BackLink, ItemCell, LINK, MoStatusPill, PROD, Table, TimelineList } from './prodParts';

/*
 * /core/production/issues/* (EP37, its own lazy chunk) — material issues: the
 * branch list, and one issue (MI-YYYYMM-NNNNNN) with its exact reservations
 * (location, lot, expiry) and quantities. A DRAFT's quantities can be changed
 * (never above what its reservation still holds — the server decides); POST
 * asks first in the exact words: physical stock is deducted and the matching
 * production reservations are consumed. A posted issue never changes.
 */

const ISSUE_TONE: Record<IssueStatus, 'neutral' | 'teal' | 'muted'> = {
  DRAFT: 'neutral',
  POSTED: 'teal',
  CANCELLED: 'muted',
};

function IssueStatusPill({ status }: { status: IssueStatus }) {
  const { c } = useExec();
  return (
    <Pill
      tone={ISSUE_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-issue-status={status}
    >
      {c.issueStatuses[status]}
    </Pill>
  );
}

export default function IssuesArea() {
  return (
    <Routes>
      <Route index element={<IssueList />} />
      <Route path=":id" element={<ById />} />
    </Routes>
  );
}

function ById() {
  const { id } = useParams();
  return <IssuePage key={id} id={id!} />;
}

function IssueList() {
  const { x, c, err } = useExec();
  const { dateTime } = useDateFormat();
  const base = useId();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) =>
      productionApi.issues({
        status: status || undefined,
        q: debounced || undefined,
        page,
        pageSize: 25,
      }),
    [status, debounced],
  );
  return (
    <>
      <PageTitle title={c.nav.issues} lead={x.issuesLead} />
      <div role="search" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SearchBox
          id={`${base}-q`}
          label={x.f.search}
          value={q}
          onChange={setQ}
          placeholder={x.f.searchHint}
          describedBy={`${base}-n`}
        />
        <SelectField
          id={`${base}-s`}
          label={x.f.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-filter="issue-status"
        >
          <option value="">{x.f.any}</option>
          {Object.entries(c.issueStatuses).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-n`} role="status" className="text-caption text-text-muted">
        {data ? x.count(data.total) : x.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={x.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {x.none}
        </p>
      ) : (
        <Table
          data="issues"
          rows={data.items}
          rowKey={(i) => i.id}
          cols={[
            {
              head: x.f.number,
              cell: (i) => (
                <AreaLink to={`${PROD}/issues/${encodeURIComponent(i.id)}`} className={LINK}>
                  {i.number}
                </AreaLink>
              ),
            },
            { head: x.f.status, cell: (i) => <IssueStatusPill status={i.status} /> },
            {
              head: x.f.order,
              cell: (i) => (
                <AreaLink to={`${PROD}/orders/${encodeURIComponent(i.order.id)}`} className={LINK}>
                  {i.order.number}
                </AreaLink>
              ),
            },
            { head: x.f.lines, end: true, cell: (i) => i.lineCount },
            {
              head: x.f.postedAt,
              minor: true,
              cell: (i) => (i.postedAt ? dateTime(i.postedAt) : '—'),
            },
            { head: x.f.createdBy, minor: true, cell: (i) => i.createdBy?.name ?? '—' },
          ]}
        />
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? x.loading : x.showMore}
        </button>
      )}
    </>
  );
}

function IssuePage({ id }: { id: string }) {
  const { x, err } = useExec();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => productionApi.issue(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<'post' | 'cancel' | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={x.loading} />;
  if (state.status === 'error')
    return (
      <>
        <BackLink to={`${PROD}/issues`} />
        <Notice tone="error">{err(state.error)}</Notice>
      </>
    );
  const { issue: i, timeline } = state.data;
  const run = async (work: () => Promise<IssueDetail>, text: string) => {
    setNotice(null);
    try {
      set(await work());
      setNotice({ tone: 'success', text });
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: err(e) });
      return false;
    }
  };
  const close = () => {
    setOpen(null);
    heading.current?.focus();
  };
  const steps = (['post', 'cancel'] as const).filter((a) => i.actions.includes(a));
  return (
    <div className="grid grid-cols-1 gap-6" data-issue={i.number} data-status={i.status}>
      <BackLink to={`${PROD}/issues`} />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={i.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IssueStatusPill status={i.status} />
          <span className="text-caption text-text-muted">{x.f.order}</span>
          <AreaLink to={`${PROD}/orders/${encodeURIComponent(i.order.id)}`} className={LINK}>
            {i.order.number}
          </AreaLink>
          <MoStatusPill status={i.order.status} />
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      <Section id="mi-facts" title={x.f.lines}>
        <Facts className="mb-4">
          <Fact
            term={x.f.createdBy}
          >{`${dateTime(i.createdAt)} · ${i.createdBy?.name ?? ''}`}</Fact>
          {i.postedAt && (
            <Fact term={x.f.postedAt}>{`${dateTime(i.postedAt)} · ${i.postedBy?.name ?? ''}`}</Fact>
          )}
          {i.cancellationReason && <Fact term={x.f.reason}>{i.cancellationReason}</Fact>}
          {i.note && <Fact term={x.f.note}>{i.note}</Fact>}
        </Facts>
        {i.actions.includes('edit') ? (
          <LinesEditor
            key={i.updatedAt}
            i={i}
            save={(lines) => run(() => productionApi.issueLines(i.id, lines), x.saved)}
          />
        ) : (
          <Table
            data="issue-lines"
            rows={i.lines}
            rowKey={(l) => l.id}
            cols={[
              {
                head: x.f.material,
                cell: (l) => <ItemCell code={l.item.code} name={l.item.name} />,
              },
              {
                head: x.f.location,
                cell: (l) => <span className="font-mono">{l.location.code}</span>,
              },
              { head: x.f.lot, cell: (l) => l.lot?.lotNumber ?? '—' },
              {
                head: x.f.expiry,
                minor: true,
                cell: (l) => (l.lot?.expiryDate ? date(l.lot.expiryDate) : '—'),
              },
              { head: x.f.quantity, end: true, cell: (l) => `${l.quantity} ${l.unit.code}` },
            ]}
          />
        )}
      </Section>
      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={open === 'post' ? x.ask.post : x.ask.cancelIssue}
              goLabel={open === 'post' ? x.act.post : x.act.cancelIssue}
              reason={open === 'cancel' ? 'optional' : undefined}
              onCancel={close}
              onConfirm={async (reason) => {
                if (
                  await run(
                    () => productionApi.issueAct(i.id, open, reason),
                    open === 'post' ? x.f.postedAt : x.saved,
                  )
                )
                  close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s === 'post' ? 'primary' : 'ghost', 'md')}
                  data-action={s}
                >
                  {s === 'post' ? x.act.post : x.act.cancelIssue}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Section id="mi-timeline" title={x.timeline}>
        <TimelineList items={timeline} date={dateTime} />
      </Section>
    </div>
  );
}

/** A draft's quantities, one per reservation (shape checked here; the server re-checks every limit). */
function LinesEditor({
  i,
  save,
}: {
  i: Issue;
  save: (lines: { allocationId: string; quantity: string }[]) => Promise<boolean>;
}) {
  const { x } = useExec();
  const { date } = useDateFormat();
  const base = useId();
  const [qty, setQty] = useState(() => Object.fromEntries(i.lines.map((l) => [l.id, l.quantity])));
  const [busy, setBusy] = useState(false);
  const bad = (l: Issue['lines'][number]) => {
    const v = qty[l.id] ?? '';
    return !QTY.test(v) || !/[1-9]/.test(v) || places(v) > l.unit.precision;
  };
  const dirty = i.lines.some((l) => qty[l.id] !== l.quantity);
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || i.lines.some(bad)) return;
        setBusy(true);
        void save(
          i.lines.map((l) => ({ allocationId: l.allocationId, quantity: qty[l.id]! })),
        ).finally(() => setBusy(false));
      }}
      data-issue-editor
    >
      <ol className="grid gap-2">
        {i.lines.map((l, n) => (
          <li
            key={l.id}
            className="grid items-end gap-3 rounded-xl bg-white/[0.02] p-4 sm:grid-cols-[minmax(0,1fr)_12rem]"
          >
            <span className="min-w-0 text-label">
              <ItemCell code={l.item.code} name={l.item.name} />
              <span className="block text-caption text-text-muted">
                {`${x.f.location} ${l.location.code}`}
                {l.lot && ` · ${x.f.lot} ${l.lot.lotNumber}`}
                {l.lot?.expiryDate && ` · ${x.f.expiry} ${date(l.lot.expiryDate)}`}
                {l.reserved !== null && ` · ${x.f.reserved} ${l.reserved} ${l.unit.code}`}
              </span>
            </span>
            <TextField
              id={`${base}-${n}`}
              label={`${x.f.issueQty} (${l.unit.code})`}
              inputMode="decimal"
              value={qty[l.id] ?? ''}
              onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value.trim() }))}
              error={bad(l) ? x.errors.QUANTITY_PRECISION : undefined}
            />
          </li>
        ))}
      </ol>
      <button
        type="submit"
        disabled={busy || !dirty || i.lines.some(bad)}
        className={buttonClasses('secondary', 'md', 'w-fit')}
      >
        {x.act.save}
      </button>
    </form>
  );
}
