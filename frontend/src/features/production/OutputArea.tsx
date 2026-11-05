import { useId, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useLocale } from '@/i18n/useLocale';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import {
  AreaLink,
  Fact,
  Facts,
  Loading,
  PageTitle,
  Section,
} from '@/features/company-center/parts';
import { SearchBox } from '@/features/company-center/SearchBox';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useDebounced, usePaged } from '@/features/warehouse/whModel';
import { useOut } from './outCopy';
import { outputApi, type Output, type OutputDetail, type OutputInput } from './outputApi';
import { OutputStatusPill, OutTimeline, ReceiptStatusPill } from './outParts';
import { places, productionApi, QTY, type ProductionContext } from './productionApi';
import { BackLink, ItemCell, LINK, MoStatusPill, PROD, Table } from './prodParts';

/*
 * /core/production/output/* (EP38, its own lazy chunk) — production output
 * reports: the branch list, a new report for an order in production, and one
 * report (OUT-YYYYMM-NNNNNN) with its quality decision and the finished goods
 * receipts that took it into stock. Reporting never moves stock; the server
 * computes every figure and decides every limit.
 */

export default function OutputArea({ ctx }: { ctx: ProductionContext }) {
  return (
    <Routes>
      <Route index element={<OutputList ctx={ctx} />} />
      {ctx.output?.create && <Route path="new" element={<NewOutput />} />}
      <Route path=":id" element={<ById />} />
    </Routes>
  );
}

function ById() {
  const { id } = useParams();
  return <OutputPage key={id} id={id!} />;
}

const OUT = `${PROD}/output`;
const goodQty = (v: string, precision: number) => QTY.test(v) && places(v) <= precision;

function OutputList({ ctx }: { ctx: ProductionContext }) {
  const { o, err } = useOut();
  const { date } = useDateFormat();
  const base = useId();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) =>
      outputApi.outputs({
        status: status || undefined,
        q: debounced || undefined,
        page,
        pageSize: 25,
      }),
    [status, debounced],
  );
  return (
    <>
      <PageTitle
        title={o.title}
        lead={o.lead}
        action={
          ctx.output?.create ? (
            <AreaLink to={`${OUT}/new`} className={buttonClasses('primary', 'md')} data-new-output>
              {o.newOutput}
            </AreaLink>
          ) : undefined
        }
      />
      <div role="search" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SearchBox
          id={`${base}-q`}
          label={o.f.search}
          value={q}
          onChange={setQ}
          placeholder={o.f.searchHint}
          describedBy={`${base}-n`}
        />
        <SelectField
          id={`${base}-s`}
          label={o.f.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-filter="output-status"
        >
          <option value="">{o.f.any}</option>
          {Object.entries(o.statuses).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
      </div>
      <p id={`${base}-n`} role="status" className="text-caption text-text-muted">
        {data ? o.count(data.total) : o.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={o.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {o.none}
        </p>
      ) : (
        <Table
          data="outputs"
          wide
          rows={data.items}
          rowKey={(r) => r.id}
          cols={[
            {
              head: o.f.number,
              cell: (r) => (
                <AreaLink to={`${OUT}/${encodeURIComponent(r.id)}`} className={LINK}>
                  {r.number}
                </AreaLink>
              ),
            },
            { head: o.f.status, cell: (r) => <OutputStatusPill status={r.status} /> },
            {
              head: o.f.order,
              cell: (r) => (
                <AreaLink to={`${PROD}/orders/${encodeURIComponent(r.order.id)}`} className={LINK}>
                  {r.order.number}
                </AreaLink>
              ),
            },
            { head: o.f.item, cell: (r) => <ItemCell code={r.item.code} name={r.item.name} /> },
            { head: o.f.good, end: true, cell: (r) => `${r.good} ${r.unit.code}` },
            { head: o.f.defective, end: true, minor: true, cell: (r) => r.defective },
            { head: o.f.accepted, end: true, cell: (r) => r.accepted ?? '—' },
            { head: o.f.received, end: true, minor: true, cell: (r) => r.received },
            { head: o.f.productionDate, minor: true, cell: (r) => date(r.productionDate) },
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
          {more ? o.loading : o.showMore}
        </button>
      )}
    </>
  );
}

/** The report fields (shape checked here; the server re-checks every rule). */
function OutputFields({
  precision,
  unit,
  value,
  onChange,
  today,
}: {
  precision: number;
  unit: string;
  value: Required<Omit<OutputInput, 'note'>> & { note: string };
  onChange: (v: Required<Omit<OutputInput, 'note'>> & { note: string }) => void;
  today: string;
}) {
  const { o } = useOut();
  const base = useId();
  const bad = (v: string) =>
    v !== '' && !goodQty(v, precision) ? o.errors.QUANTITY_PRECISION : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        id={`${base}-d`}
        type="date"
        label={o.f.productionDate}
        value={value.productionDate}
        max={today}
        onChange={(e) => onChange({ ...value, productionDate: e.target.value })}
      />
      {(['goodQuantity', 'defectiveQuantity', 'pendingQuantity'] as const).map((k) => (
        <TextField
          key={k}
          id={`${base}-${k}`}
          label={`${k === 'goodQuantity' ? o.f.good : k === 'defectiveQuantity' ? o.f.defective : o.f.pending} (${unit})`}
          inputMode="decimal"
          value={value[k]}
          onChange={(e) => onChange({ ...value, [k]: e.target.value.trim() })}
          error={bad(value[k])}
          data-field={k}
        />
      ))}
      <TextField
        id={`${base}-n`}
        label={o.f.note}
        value={value.note}
        maxLength={1000}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
        className="sm:col-span-2"
      />
    </div>
  );
}

const valid = (
  v: { goodQuantity: string; defectiveQuantity: string; pendingQuantity: string },
  p: number,
) =>
  [v.goodQuantity, v.defectiveQuantity, v.pendingQuantity].every(
    (q) => q === '' || goodQty(q, p),
  ) && [v.goodQuantity, v.defectiveQuantity, v.pendingQuantity].some((q) => /[1-9]/.test(q));

function NewOutput() {
  const { o, c, err } = useOut();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [params] = useSearchParams();
  const base = useId();
  const orders = useLoad(() => productionApi.list({ stage: 'EXECUTION', pageSize: 100, page: 1 }));
  const ctx = useLoad(() => productionApi.context());
  const [orderId, setOrderId] = useState(params.get('order') ?? '');
  const [v, setV] = useState({
    productionDate: '',
    goodQuantity: '',
    defectiveQuantity: '',
    pendingQuantity: '',
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (orders.state.status === 'loading' || ctx.state.status === 'loading')
    return <Loading label={o.loading} />;
  if (orders.state.status === 'error')
    return <Notice tone="error">{err(orders.state.error)}</Notice>;
  const today = ctx.state.status === 'ready' ? ctx.state.data.today : '';
  const open = orders.state.data.items.filter(
    (m) => m.status === 'IN_PRODUCTION' || m.status === 'PAUSED',
  );
  const chosen = open.find((m) => m.id === orderId);
  const date = v.productionDate || today;
  return (
    <div className="grid grid-cols-1 gap-6" data-new-output-form>
      <BackLink to={OUT} />
      <PageTitle title={o.newOutput} lead={o.lead} />
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!chosen || !valid(v, chosen.unit.precision)) return;
          setBusy(true);
          setError(null);
          outputApi
            .createOutput({
              productionOrderId: chosen.id,
              productionDate: date,
              goodQuantity: v.goodQuantity || '0',
              ...(v.defectiveQuantity ? { defectiveQuantity: v.defectiveQuantity } : {}),
              ...(v.pendingQuantity ? { pendingQuantity: v.pendingQuantity } : {}),
              note: v.note.trim() || null,
            })
            .then((d) =>
              navigate(`${OUT}/${encodeURIComponent(d.report.id)}`, { state: { locale } }),
            )
            .catch((x: unknown) => {
              setError(err(x));
              setBusy(false);
            });
        }}
      >
        <SelectField
          id={`${base}-o`}
          label={o.f.order}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          data-field="order"
        >
          <option value="">—</option>
          {open.map((m) => (
            <option key={m.id} value={m.id}>
              {`${m.number} · ${m.item.code} · ${m.quantity} ${m.unit.code} · ${c.statuses[m.status]}`}
            </option>
          ))}
        </SelectField>
        {chosen && (
          <OutputFields
            precision={chosen.unit.precision}
            unit={chosen.unit.code}
            value={{ ...v, productionDate: date }}
            onChange={setV}
            today={today}
          />
        )}
        <div aria-live="polite">{error && <Notice tone="error">{error}</Notice>}</div>
        <button
          type="submit"
          disabled={busy || !chosen || !valid(v, chosen?.unit.precision ?? 0)}
          className={buttonClasses('primary', 'md', 'w-fit')}
        >
          {o.act.save}
        </button>
      </form>
    </div>
  );
}

type Step = 'submit' | 'accept' | 'reject' | 'cancel';

function OutputPage({ id }: { id: string }) {
  const { o, err } = useOut();
  const { date, dateTime } = useDateFormat();
  const base = useId();
  const { state, set } = useLoad(() => outputApi.output(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<Step | null>(null);
  const [pendingGood, setPendingGood] = useState('0');
  const heading = useRef<HTMLDivElement>(null);
  if (state.status === 'loading') return <Loading label={o.loading} />;
  if (state.status === 'error')
    return (
      <>
        <BackLink to={OUT} />
        <Notice tone="error">{err(state.error)}</Notice>
      </>
    );
  const { report: r, timeline } = state.data;
  const run = async (work: () => Promise<OutputDetail>, text: string) => {
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
  const steps = (['submit', 'accept', 'reject', 'cancel'] as const).filter((a) =>
    r.actions.includes(a),
  );
  const label: Record<Step, string> = {
    submit: o.act.submit,
    accept: o.act.accept,
    reject: o.act.reject,
    cancel: o.act.cancel,
  };
  const pendingOk = goodQty(pendingGood, r.unit.precision);
  return (
    <div className="grid grid-cols-1 gap-6" data-output={r.number} data-status={r.status}>
      <BackLink to={OUT} />
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={r.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OutputStatusPill status={r.status} />
          <span className="text-caption text-text-muted">{o.f.order}</span>
          <AreaLink to={`${PROD}/orders/${encodeURIComponent(r.order.id)}`} className={LINK}>
            {r.order.number}
          </AreaLink>
          <MoStatusPill status={r.order.status} />
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      <Section id="out-facts" title={o.reports}>
        <Facts>
          <Fact term={o.f.item}>{`${r.item.code} · ${r.item.name}`}</Fact>
          <Fact term={o.f.productionDate}>{date(r.productionDate)}</Fact>
          <Fact term={o.f.good}>{`${r.good} ${r.unit.code}`}</Fact>
          <Fact term={o.f.defective}>{`${r.defective} ${r.unit.code}`}</Fact>
          <Fact term={o.f.pending}>{`${r.pending} ${r.unit.code}`}</Fact>
          {r.accepted !== null && <Fact term={o.f.accepted}>{`${r.accepted} ${r.unit.code}`}</Fact>}
          {r.rejected !== null && <Fact term={o.f.rejected}>{`${r.rejected} ${r.unit.code}`}</Fact>}
          {r.accepted !== null && <Fact term={o.f.received}>{`${r.received} ${r.unit.code}`}</Fact>}
          <Fact
            term={o.f.createdBy}
          >{`${dateTime(r.createdAt)} · ${r.createdBy?.name ?? ''}`}</Fact>
          {r.rejectionReason && <Fact term={o.f.reason}>{r.rejectionReason}</Fact>}
          {r.cancellationReason && <Fact term={o.f.reason}>{r.cancellationReason}</Fact>}
          {r.note && <Fact term={o.f.note}>{r.note}</Fact>}
        </Facts>
      </Section>
      {r.actions.includes('edit') && (
        <Section id="out-edit" title={o.act.save}>
          <DraftEditor
            key={r.updatedAt}
            r={r}
            save={(input) => run(() => outputApi.updateOutput(r.id, input), o.saved)}
          />
        </Section>
      )}
      {steps.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <>
              {open === 'accept' && r.pending !== '0' && (
                <TextField
                  id={`${base}-pg`}
                  label={`${o.f.pendingGood} (${r.unit.code})`}
                  inputMode="decimal"
                  value={pendingGood}
                  onChange={(e) => setPendingGood(e.target.value.trim())}
                  error={pendingOk ? undefined : o.errors.PENDING_DECISION_INVALID}
                  className="max-w-xs"
                />
              )}
              <ConfirmBox
                question={o.ask[open]}
                goLabel={label[open]}
                reason={
                  open === 'reject' || (open === 'cancel' && r.status === 'ACCEPTED')
                    ? 'required'
                    : open === 'cancel'
                      ? 'optional'
                      : undefined
                }
                onCancel={close}
                onConfirm={async (reason) => {
                  if (open === 'accept' && !pendingOk) return;
                  const extra: Record<string, string> =
                    open === 'accept'
                      ? r.pending !== '0'
                        ? { pendingGood }
                        : {}
                      : open === 'submit'
                        ? {}
                        : reason
                          ? { reason }
                          : {};
                  if (await run(() => outputApi.outputAct(r.id, open, extra), o.saved)) close();
                }}
              />
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(
                    s === 'accept' || s === 'submit' ? 'primary' : 'ghost',
                    'md',
                  )}
                  data-action={s}
                >
                  {label[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {r.receipts.length > 0 && (
        <Section id="out-receipts" title={o.receipts}>
          <ul className="grid gap-2">
            {r.receipts.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center gap-3 text-label"
                data-receipt={x.number}
              >
                <span className="font-mono">{x.number}</span>
                <ReceiptStatusPill status={x.status} />
                <span className="tabular-nums">{`${x.quantity} ${r.unit.code}`}</span>
                {x.postedAt && (
                  <span className="text-caption text-text-muted">{dateTime(x.postedAt)}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section id="out-timeline" title={o.timeline}>
        <OutTimeline items={timeline} date={dateTime} />
      </Section>
    </div>
  );
}

function DraftEditor({ r, save }: { r: Output; save: (input: OutputInput) => Promise<boolean> }) {
  const { o } = useOut();
  const [v, setV] = useState({
    productionDate: r.productionDate,
    goodQuantity: r.good,
    defectiveQuantity: r.defective,
    pendingQuantity: r.pending,
    note: r.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid(v, r.unit.precision)) return;
        setBusy(true);
        void save({
          productionDate: v.productionDate,
          goodQuantity: v.goodQuantity || '0',
          defectiveQuantity: v.defectiveQuantity || '0',
          pendingQuantity: v.pendingQuantity || '0',
          note: v.note.trim() || null,
        }).finally(() => setBusy(false));
      }}
      data-output-editor
    >
      <OutputFields
        precision={r.unit.precision}
        unit={r.unit.code}
        value={v}
        onChange={setV}
        today=""
      />
      <button
        type="submit"
        disabled={busy || !valid(v, r.unit.precision)}
        className={buttonClasses('secondary', 'md', 'w-fit')}
      >
        {o.act.save}
      </button>
    </form>
  );
}
