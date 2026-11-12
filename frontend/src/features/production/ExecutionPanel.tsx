import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { AreaLink, Fact, Facts, Pill, Section } from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { useLocale } from '@/i18n/useLocale';
import { useExec } from './execCopy';
import { places, productionApi, QTY, type Mo, type MoDetail } from './productionApi';
import { ItemCell, LINK, PROD, Table } from './prodParts';

/*
 * EP37 — the execution part of a production order page (its own lazy chunk):
 * materials planned · reserved · issued · used, the exact reservations (FEFO
 * locations and lots), reserve / release / reallocate, start / pause / resume,
 * a new material issue, actual usage and authorized excess. Every number is the
 * server's; every action is offered only when the order's `actions` say so;
 * every state change asks first and returns focus to the page heading.
 */

type Act = 'allocate' | 'unreserve' | 'reallocate' | 'start' | 'pause' | 'resume';
const qtyOk = (q: string, p: number) => QTY.test(q) && /[1-9]/.test(q) && places(q) <= p;

export default function ExecutionPanel({
  o,
  run,
  focusHeading,
}: {
  o: Mo;
  run: (work: () => Promise<MoDetail>, text?: string) => Promise<boolean>;
  focusHeading: () => void;
}) {
  const { x, c, err } = useExec();
  const { date, dateTime } = useDateFormat();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [open, setOpen] = useState<Act | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const can = (a: Mo['actions'][number]) => o.actions.includes(a);
  const acts = (
    ['allocate', 'reallocate', 'unreserve', 'start', 'pause', 'resume'] as const
  ).filter((a) => can(a));
  const anyReserved = o.materials.some((m) => m.reserved !== '0' || m.issued !== '0');
  const label = (a: Act) => (a === 'allocate' && anyReserved ? x.act.allocateAgain : x.act[a]);
  const close = () => {
    setOpen(null);
    focusHeading();
  };
  const variance = o.materials.some(
    (m) => m.issued !== '0' && (m.unrecorded !== '0' || m.usageVariance !== '0'),
  );
  // EP46: a withheld quantity (confidential recipe, not yet released) shows as a dash.
  const q = (v: string | null, u: string) => (v === null ? '—' : `${v} ${u}`);
  const newIssue = async () => {
    setIssueError(null);
    try {
      const { issue } = await productionApi.createIssue({ productionOrderId: o.id });
      void navigate(`${PROD}/issues/${encodeURIComponent(issue.id)}`, { state: { locale } });
    } catch (e) {
      setIssueError(err(e));
    }
  };
  return (
    <>
      <Section
        id="mo-execution"
        title={x.execution}
        aside={
          o.reservationState ? (
            <Pill tone="muted">{c.reservationStates[o.reservationState]}</Pill>
          ) : undefined
        }
      >
        {(o.startedAt || o.pausedAt || o.executionNote) && (
          <Facts className="mb-4">
            {o.startedAt && (
              <Fact
                term={x.f.started}
              >{`${dateTime(o.startedAt)} · ${o.startedBy?.name ?? ''}`}</Fact>
            )}
            {o.pausedAt && <Fact term={x.f.paused}>{dateTime(o.pausedAt)}</Fact>}
            {o.executionNote && <Fact term={x.f.note}>{o.executionNote}</Fact>}
          </Facts>
        )}
        <Table
          wide
          data="execution-materials"
          rows={o.materials}
          rowKey={(m) => String(m.lineNo)}
          cols={[
            { head: x.f.material, cell: (m) => <ItemCell code={m.item.code} name={m.item.name} /> },
            { head: x.f.required, end: true, cell: (m) => q(m.required, m.unit.code) },
            {
              head: x.f.reserved,
              end: true,
              cell: (m) => <span data-reserved={m.reserved}>{q(m.reserved, m.unit.code)}</span>,
            },
            {
              head: x.f.issued,
              end: true,
              cell: (m) => <span data-issued={m.issued}>{q(m.issued, m.unit.code)}</span>,
            },
            { head: x.f.used, end: true, cell: (m) => q(m.used, m.unit.code) },
            {
              head: x.f.stillNeeded,
              end: true,
              cell: (m) => (
                <span
                  className={
                    m.stillNeeded && m.stillNeeded !== '0'
                      ? 'font-semibold text-[#f3cf8a]'
                      : undefined
                  }
                >
                  {q(m.stillNeeded, m.unit.code)}
                </span>
              ),
            },
            {
              head: x.f.available,
              end: true,
              minor: true,
              cell: (m) => (m.available === null ? '—' : q(m.available, m.unit.code)),
            },
            {
              head: x.f.variance,
              end: true,
              minor: true,
              cell: (m) => (m.issued === '0' ? '—' : q(m.usageVariance, m.unit.code)),
            },
            {
              head: x.f.unrecorded,
              end: true,
              minor: true,
              cell: (m) => (m.issued === '0' ? '—' : q(m.unrecorded, m.unit.code)),
            },
            {
              head: x.f.excess,
              end: true,
              minor: true,
              cell: (m) => (m.excess === '0' ? '—' : q(m.excess, m.unit.code)),
            },
          ]}
        />
        <p className="mt-3 text-caption text-text-muted">{x.reservationNote}</p>
        {variance && (
          <p className="mt-2 text-caption text-[#f3cf8a]" data-variance-warning>
            {x.varianceWarning}
          </p>
        )}
        <p className="mt-2 text-caption text-text-muted">{x.noOutputNote}</p>
      </Section>

      <Section id="mo-reservations" title={x.reservations}>
        {o.reservations.length ? (
          <Table
            data="reservations"
            rows={o.reservations}
            rowKey={(r) => r.id}
            cols={[
              {
                head: x.f.material,
                cell: (r) => <ItemCell code={r.item.code} name={r.item.name} />,
              },
              {
                head: x.f.location,
                cell: (r) => <span className="font-mono">{r.location.code}</span>,
              },
              { head: x.f.lot, cell: (r) => r.lot?.lotNumber ?? '—' },
              {
                head: x.f.expiry,
                minor: true,
                cell: (r) => (r.lot?.expiryDate ? date(r.lot.expiryDate) : '—'),
              },
              {
                head: x.f.quantity,
                end: true,
                cell: (r) => (
                  <span className="whitespace-nowrap">
                    {q(r.quantity, r.unit.code)}
                    {r.excess && (
                      <Pill tone="warning" className="ml-2">
                        {x.f.excess}
                      </Pill>
                    )}
                  </span>
                ),
              },
              { head: x.f.claimed, end: true, minor: true, cell: (r) => q(r.claimed, r.unit.code) },
            ]}
          />
        ) : (
          <p className="text-label text-text-secondary" data-no-reservations>
            {x.noReservations}
          </p>
        )}
      </Section>

      {acts.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-exec-actions>
          {open ? (
            <ConfirmBox
              question={x.ask[open]}
              goLabel={label(open)}
              field={
                open === 'start' || open === 'pause' || open === 'resume'
                  ? { label: x.f.note, hint: '', maxLength: 500 }
                  : undefined
              }
              onCancel={close}
              onConfirm={async (note) => {
                const work =
                  open === 'start' || open === 'pause' || open === 'resume'
                    ? () => productionApi.execute(o.id, open, note)
                    : () => productionApi.materials(o.id, open === 'unreserve' ? 'release' : open);
                if (
                  await run(
                    work,
                    open === 'allocate' || open === 'reallocate' ? x.saved : c.statuses[o.status],
                  )
                )
                  close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {acts.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setOpen(a)}
                  className={buttonClasses(
                    a === 'unreserve' || a === 'pause' ? 'ghost' : 'primary',
                    'md',
                  )}
                  data-exec-action={a}
                >
                  {label(a)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Section
        id="mo-issues"
        title={x.issues}
        aside={
          can('issue') ? (
            <button
              type="button"
              onClick={() => void newIssue()}
              className={buttonClasses('secondary', 'md')}
              data-new-issue
            >
              {x.act.issue}
            </button>
          ) : undefined
        }
      >
        {issueError && <Notice tone="error">{issueError}</Notice>}
        {o.issues.length ? (
          <ul className="grid gap-1" data-order-issues>
            {o.issues.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 text-label">
                <AreaLink to={`${PROD}/issues/${encodeURIComponent(i.id)}`} className={LINK}>
                  {i.number}
                </AreaLink>
                <Pill
                  tone={i.status === 'POSTED' ? 'teal' : i.status === 'DRAFT' ? 'neutral' : 'muted'}
                >
                  {c.issueStatuses[i.status]}
                </Pill>
                <span className="text-caption text-text-muted">
                  {i.postedAt ? dateTime(i.postedAt) : `${i.lineCount} ${x.f.lines}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-label text-text-secondary">{x.noIssues}</p>
        )}
        <p className="mt-3 text-caption text-text-muted">{x.leftoverNote}</p>
      </Section>

      {can('usage') && <UsageForm o={o} run={run} />}
      {can('excess') && <ExcessForm o={o} run={run} />}
    </>
  );
}

function UsageForm({
  o,
  run,
}: {
  o: Mo;
  run: (work: () => Promise<MoDetail>, text?: string) => Promise<boolean>;
}) {
  const { x } = useExec();
  const base = useId();
  const issued = o.materials.filter((m) => m.issued !== '0');
  const [material, setMaterial] = useState(issued[0]?.lineNo ?? 0);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const m = issued.find((z) => z.lineNo === material);
  const ok = !!m && qtyOk(qty, m.unit.precision);
  const ref = useRef<HTMLFormElement>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok || !m) return;
    setBusy(true);
    const done = await run(
      () =>
        productionApi.usage(o.id, { materialId: m.id, quantity: qty, note: note.trim() || null }),
      x.saved,
    );
    setBusy(false);
    if (done) {
      setQty('');
      setNote('');
    }
  };
  return (
    <Section id="mo-usage" title={x.usage}>
      <form
        ref={ref}
        noValidate
        onSubmit={(e) => void submit(e)}
        className="grid max-w-4xl gap-4 sm:grid-cols-3"
        data-usage-form
      >
        <SelectField
          id={`${base}-m`}
          label={x.f.material}
          value={String(material)}
          onChange={(e) => setMaterial(Number(e.target.value))}
        >
          {issued.map((z) => (
            <option key={z.lineNo} value={z.lineNo}>{`${z.item.code} · ${z.item.name}`}</option>
          ))}
        </SelectField>
        <TextField
          id={`${base}-q`}
          label={m ? `${x.f.usageQty} (${m.unit.code})` : x.f.usageQty}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value.trim())}
          error={qty && !ok ? x.errors.QUANTITY_PRECISION : undefined}
        />
        <TextField
          id={`${base}-n`}
          label={x.f.note}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !ok}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {x.act.usage}
        </button>
      </form>
      <p className="mt-3 text-caption text-text-muted">{x.usageNote}</p>
    </Section>
  );
}

function ExcessForm({
  o,
  run,
}: {
  o: Mo;
  run: (work: () => Promise<MoDetail>, text?: string) => Promise<boolean>;
}) {
  const { x } = useExec();
  const base = useId();
  const [material, setMaterial] = useState(o.materials[0]?.lineNo ?? 0);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const m = o.materials.find((z) => z.lineNo === material);
  const ok = !!m && qtyOk(qty, m.unit.precision) && reason.trim().length > 0;
  return (
    <Section id="mo-excess" title={x.act.excess}>
      <form
        noValidate
        className="grid max-w-4xl gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok || !m) return;
          setBusy(true);
          void run(
            () => productionApi.excess(o.id, m.id, { quantity: qty, reason: reason.trim() }),
            x.saved,
          )
            .then((done) => {
              if (done) {
                setQty('');
                setReason('');
              }
            })
            .finally(() => setBusy(false));
        }}
        data-excess-form
      >
        <SelectField
          id={`${base}-m`}
          label={x.f.material}
          value={String(material)}
          onChange={(e) => setMaterial(Number(e.target.value))}
        >
          {o.materials.map((z) => (
            <option key={z.lineNo} value={z.lineNo}>{`${z.item.code} · ${z.item.name}`}</option>
          ))}
        </SelectField>
        <TextField
          id={`${base}-q`}
          label={m ? `${x.f.excessQty} (${m.unit.code})` : x.f.excessQty}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value.trim())}
        />
        <TextField
          id={`${base}-r`}
          label={x.f.reason}
          value={reason}
          maxLength={500}
          required
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !ok}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {x.act.excess}
        </button>
      </form>
      <p className="mt-3 text-caption text-text-muted">{x.ask.excess}</p>
    </Section>
  );
}
