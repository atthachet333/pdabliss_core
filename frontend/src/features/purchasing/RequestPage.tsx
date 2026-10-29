import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { FieldGroup } from '@/features/company-center/adminParts';
import { useDateFormat, useDepartmentName, useLoad } from '@/features/company-center/model';
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
import {
  prApi,
  type ItemOption,
  type LineInput,
  type PrAction,
  type PrContext,
  type PrDetail,
  type PrLine,
  type UnitOption,
} from './api';
import { PR_COPY, prError } from './copy';
import { HeaderForm, PurposeField, StatusPill } from './PurchasingArea';

/*
 * One purchase request (EP29): identity, status, branch, department,
 * requester, purpose and lines; for a DRAFT its requester edits the header
 * and lines in place; the actions the server lists (`actions`) appear as
 * buttons, each confirmed in place — reject and cancel-after-submit ask for a
 * reason. A short timeline (created / submitted / decided / cancelled) ends
 * the page. No price, supplier or cost exists to show.
 */

const QTY = /^\d{1,12}(\.\d{1,6})?$/;
const decimals = (q: string) => (q.split('.')[1] ?? '').replace(/0+$/, '').length;

export function RequestPage({ id, ctx }: { id: string; ctx: PrContext }) {
  const c = useCopy(PR_COPY);
  const cc = useCopy(CONTROL_COPY);
  const deptName = useDepartmentName();
  const { date, dateTime } = useDateFormat();
  const { state, set } = useLoad(() => prApi.get(id));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Exclude<PrAction, 'edit'> | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const heading = useRef<HTMLDivElement>(null);

  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{prError(state.error, c, cc)}</Notice>;
  const d = state.data;
  const r = d.request;
  const editable = d.actions.includes('edit');
  const apply = (next: PrDetail, text: string) => {
    set(next);
    setNotice({ tone: 'success', text });
  };
  const run = async (work: () => Promise<PrDetail>, text = c.saved) => {
    setNotice(null);
    try {
      apply(await work(), text);
      return true;
    } catch (e) {
      setNotice({ tone: 'error', text: prError(e, c, cc) });
      return false;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6" data-request={r.number} data-status={r.status}>
      <AreaLink
        to="/core/purchasing/requests"
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.back}
      </AreaLink>
      <div ref={heading} tabIndex={-1} className="outline-none">
        <PageTitle title={r.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={r.status} />
          <span className="text-caption text-text-muted">{c.title}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      <Section id="pr-facts" title={c.details}>
        <Facts>
          <Fact term={c.f.department}>{deptName(r.department)}</Fact>
          <Fact term={c.f.branch}>{`${r.branch.code} · ${r.branch.name}`}</Fact>
          <Fact term={c.f.requester}>{r.requester.name}</Fact>
          <Fact term={c.f.requestDate}>{date(r.requestDate)}</Fact>
          <Fact term={c.f.needBy}>{r.needByDate ? date(r.needByDate) : '—'}</Fact>
          <Fact term={c.f.purpose}>
            <span className="whitespace-pre-line">{r.purpose ?? '—'}</span>
          </Fact>
          {(r.rejectionReason || r.cancellationReason) && (
            <Fact term={c.f.reason}>
              <span className="whitespace-pre-line">
                {r.rejectionReason ?? r.cancellationReason}
              </span>
            </Fact>
          )}
        </Facts>
        {editable && (
          <div className="mt-6">
            <HeaderForm
              ctx={ctx}
              request={r}
              submitLabel={c.save}
              onSubmit={async (body) => apply(await prApi.update(r.id, body), c.saved)}
            />
          </div>
        )}
      </Section>

      <Section id="pr-lines" title={`${c.f.lines} · ${c.linesCount(r.lines.length)}`}>
        {editable && <p className="mb-3 text-caption text-text-muted">{c.draftNote}</p>}
        {r.lines.length === 0 ? (
          <p className="text-label text-text-secondary">{c.noLines}</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2" data-lines>
            {r.lines.map((l) =>
              editing === l.id ? (
                <li key={l.id}>
                  <LineForm
                    line={l}
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      if (await run(() => prApi.updateLine(r.id, l.id, input))) setEditing(null);
                    }}
                  />
                </li>
              ) : (
                <li
                  key={l.id}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl bg-white/[0.02] p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
                  data-line={l.lineNo}
                >
                  <span className="font-mono text-caption text-text-muted tabular-nums">
                    #{l.lineNo}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-label break-words text-text-primary">
                      {l.item ? (
                        <>
                          <span className="font-mono">{l.item.code}</span> · {l.item.name}
                          {!l.item.active && (
                            <span className="text-text-muted"> ({c.inactiveItem})</span>
                          )}
                        </>
                      ) : (
                        l.description
                      )}
                    </span>
                    <span className="block text-caption text-text-secondary">
                      <span className="font-semibold tabular-nums">{l.quantity}</span>{' '}
                      {l.unit?.code ?? l.unit?.name ?? ''}
                      {l.item ? '' : ` · ${c.f.nonItem}`}
                    </span>
                    {l.note && (
                      <span className="block text-caption whitespace-pre-line text-text-muted">
                        {l.note}
                      </span>
                    )}
                  </span>
                  {editable && (
                    <span className="col-start-2 flex gap-1 sm:col-start-auto">
                      <button
                        type="button"
                        onClick={() => setEditing(l.id)}
                        className={buttonClasses('ghost', 'md', 'px-3')}
                      >
                        {c.editLine}
                      </button>
                      <button
                        type="button"
                        onClick={() => void run(() => prApi.removeLine(r.id, l.id))}
                        className={buttonClasses('ghost', 'md', 'px-3')}
                        aria-label={`${c.removeLine} #${l.lineNo}`}
                      >
                        {c.removeLine}
                      </button>
                    </span>
                  )}
                </li>
              ),
            )}
          </ol>
        )}
        {editable &&
          (editing === 'new' ? (
            <div className="mt-3">
              <LineForm
                onCancel={() => setEditing(null)}
                onSave={async (input) => {
                  if (await run(() => prApi.addLine(r.id, input))) setEditing(null);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className={buttonClasses('secondary', 'md', 'mt-3 w-fit')}
              data-add-line
            >
              + {c.addLine}
            </button>
          ))}
      </Section>

      {d.actions.some((a) => a !== 'edit') && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {confirm ? (
            <ConfirmPanel
              action={confirm}
              reasonNeeded={confirm === 'reject' || (confirm === 'cancel' && r.status !== 'DRAFT')}
              onCancel={() => setConfirm(null)}
              onConfirm={async (reason) => {
                const ok = await run(
                  () => prApi.act(r.id, confirm, reason),
                  c.statuses[
                    {
                      submit: 'SUBMITTED',
                      approve: 'APPROVED',
                      reject: 'REJECTED',
                      cancel: 'CANCELLED',
                    }[confirm] as 'SUBMITTED'
                  ],
                );
                if (ok) {
                  setConfirm(null);
                  heading.current?.focus();
                }
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(['submit', 'approve', 'reject', 'cancel'] as const)
                .filter((a) => d.actions.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setConfirm(a)}
                    className={buttonClasses(
                      a === 'submit' || a === 'approve' ? 'primary' : 'secondary',
                      'md',
                    )}
                    data-action={a}
                  >
                    {c.actions[a]}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <Section id="pr-timeline" title={c.timeline}>
        <ol className="grid gap-2" data-timeline>
          {d.timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 text-label">
              <span className="font-semibold text-text-primary">
                {t.type.endsWith('CREATED') ? c.created : c.statuses[t.type.slice(17) as 'DRAFT']}
              </span>
              <span className="text-text-secondary">{t.actor?.name ?? c.system}</span>
              <span className="text-caption text-text-muted">{dateTime(t.at)}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/** Add or change one DRAFT line: an item (searched; its base unit) or a described need. */
function LineForm({
  line,
  onSave,
  onCancel,
}: {
  line?: PrLine;
  onSave: (input: LineInput) => Promise<void>;
  onCancel: () => void;
}) {
  const c = useCopy(PR_COPY);
  const cc = useCopy(CONTROL_COPY);
  const base = useId();
  const [type, setType] = useState<'ITEM' | 'NON_ITEM'>(line?.type ?? 'ITEM');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ItemOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [itemId, setItemId] = useState(line?.item?.id ?? '');
  const [description, setDescription] = useState(line?.description ?? '');
  const [quantity, setQuantity] = useState(line?.quantity ?? '');
  const [unitId, setUnitId] = useState(line?.type === 'NON_ITEM' ? (line.unit?.id ?? '') : '');
  const [unitText, setUnitText] = useState(
    line?.type === 'NON_ITEM' && !line.unit?.id ? (line.unit?.name ?? '') : '',
  );
  const [note, setNote] = useState(line?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      prApi.items(q.trim()).then(
        (res) => setItems(res.items),
        () => setItems([]),
      );
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    prApi.units().then(
      (res) => setUnits(res.units),
      () => setUnits([]),
    );
  }, []);

  const chosen = items.find((i) => i.id === itemId);
  const unit = type === 'ITEM' ? chosen?.unit : units.find((u) => u.id === unitId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (type === 'ITEM' && !itemId) found.item = c.required;
    if (type === 'NON_ITEM' && !description.trim()) found.description = c.required;
    const qty = quantity.trim();
    if (!QTY.test(qty) || !/[1-9]/.test(qty)) found.quantity = cc.errors.VALIDATION_FAILED;
    else if (unit && decimals(qty) > unit.precision) found.quantity = c.errors.QUANTITY_PRECISION!;
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`${base}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSave(
        type === 'ITEM'
          ? { type, itemId, quantity: qty, note: note.trim() || null }
          : {
              type,
              description: description.trim(),
              quantity: qty,
              unitId: unitId || null,
              unitText: unitId ? null : unitText.trim() || null,
              note: note.trim() || null,
            },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid grid-cols-1 gap-4 rounded-xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)]"
      data-line-form
    >
      <FieldGroup legend={c.f.lineType}>
        <div className="flex flex-wrap gap-2">
          {(['ITEM', 'NON_ITEM'] as const).map((t) => (
            <label
              key={t}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
                type === t &&
                  'bg-brand-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]',
              )}
            >
              <input
                type="radio"
                name={`${base}-type`}
                checked={type === t}
                onChange={() => setType(t)}
                className="size-4 accent-[var(--color-brand-primary)]"
                data-line-type={t}
              />
              {t === 'ITEM' ? c.f.item : c.f.nonItem}
            </label>
          ))}
        </div>
      </FieldGroup>
      {type === 'ITEM' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id={`${base}-q`}
            type="search"
            label={c.f.itemSearch}
            placeholder={c.f.itemHint}
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
          <SelectField
            id={`${base}-item`}
            label={c.f.choose}
            value={itemId}
            error={errors.item}
            onChange={(e) => setItemId(e.target.value)}
            data-item-select
          >
            <option value="">—</option>
            {line?.item && !items.some((i) => i.id === line.item!.id) && (
              <option value={line.item.id}>{`${line.item.code} · ${line.item.name}`}</option>
            )}
            {items.map((i) => (
              <option key={i.id} value={i.id}>{`${i.code} · ${i.name} (${i.unit.code})`}</option>
            ))}
          </SelectField>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id={`${base}-description`}
            label={c.f.description}
            value={description}
            maxLength={300}
            error={errors.description}
            onChange={(e) => setDescription(e.target.value)}
            className="sm:col-span-2"
          />
          <SelectField
            id={`${base}-unit`}
            label={c.f.unit}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{`${u.code} · ${u.name}`}</option>
            ))}
          </SelectField>
          {!unitId && (
            <TextField
              id={`${base}-unitText`}
              label={c.f.unitText}
              value={unitText}
              maxLength={30}
              onChange={(e) => setUnitText(e.target.value)}
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={`${base}-quantity`}
          label={unit ? `${c.f.quantity} (${unit.code})` : c.f.quantity}
          inputMode="decimal"
          autoComplete="off"
          value={quantity}
          maxLength={19}
          error={errors.quantity}
          onChange={(e) => setQuantity(e.target.value)}
          data-quantity
        />
        <TextField
          id={`${base}-note`}
          label={c.f.note}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className={buttonClasses('primary', 'md')}
          data-save-line
        >
          {busy ? c.saving : c.saveLine}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}

/** Confirms an action in place; reject (and cancel after submit) needs a reason. Escape backs out. */
function ConfirmPanel({
  action,
  reasonNeeded,
  onConfirm,
  onCancel,
}: {
  action: Exclude<PrAction, 'edit'>;
  reasonNeeded: boolean;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const c = useCopy(PR_COPY);
  const base = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const asksReason = action === 'reject' || action === 'cancel';
  return (
    <div
      role="group"
      aria-labelledby={`${base}-title`}
      className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      data-confirm={action}
    >
      <p id={`${base}-title`} className="text-label text-text-primary">
        {c.confirm[action]}
      </p>
      {asksReason && (
        <PurposeField
          id={`${base}-reason`}
          label={reasonNeeded ? c.f.reason : c.reasonOptional}
          value={reason}
          onChange={setReason}
          error={error}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          autoFocus={!asksReason}
          onClick={() => {
            if (reasonNeeded && !reason.trim()) {
              setError(c.reasonRequired);
              document.getElementById(`${base}-reason`)?.focus();
              return;
            }
            setBusy(true);
            void onConfirm(reason.trim() || undefined).finally(() => setBusy(false));
          }}
          className={buttonClasses('primary', 'md')}
          data-confirm-go
        >
          {c.actions[action]}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.cancel}
        </button>
      </div>
    </div>
  );
}
