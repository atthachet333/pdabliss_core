import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Route, Routes, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { CELL, useDateFormat, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import { AreaLink, Loading, PageTitle, Pill, Section } from '@/features/company-center/parts';
import { ConfirmBox } from '@/features/purchasing/orderParts';
import { cn } from '@/lib/cn';
import {
  ctlApi,
  docOf,
  type Detail,
  type DocKind,
  type DocOf,
  type DocStatus,
  type PickItem,
  type RowOf,
} from './ctlApi';
import { timelineLabel } from './ctlCopy';
import { useCtl, useOpenDoc, useRunner } from './ctlModel';
import { QTY, whApi, type StockRow, type WarehouseContext } from './whApi';
import { ShowMore, WarehouseNav } from './whParts';
import { WH, useDebounced, usePaged } from './whModel';

/*
 * Pieces shared by the EP32 inventory-control screens (transfers, adjustments,
 * cycle counts) — one small chunk the three lazy areas share. Status is text
 * plus a subtle tone, never colour alone; every action the server does not
 * list in `actions` is simply not offered (the server decides again).
 */

const LINK =
  'inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-7';
const ROW =
  'border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4';

/** The area: context first, then list (index), a new document (`new`) and one document (`:id`). */
export function DocArea({
  kind,
  list,
  create,
  page,
}: {
  kind: DocKind;
  list: (ctx: WarehouseContext) => ReactNode;
  create: ((ctx: WarehouseContext) => ReactNode) | null;
  page: (id: string, ctx: WarehouseContext) => ReactNode;
}) {
  const { c, err } = useCtl();
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{err(state.error)}</Notice>;
  const ctx = state.data;
  return (
    <div className="grid grid-cols-1 gap-6" data-ctl={kind}>
      <Routes>
        <Route index element={list(ctx)} />
        {create && <Route path="new" element={create(ctx)} />}
        <Route path=":id" element={<ById render={(id) => page(id, ctx)} />} />
      </Routes>
    </div>
  );
}

function ById({ render }: { render: (id: string) => ReactNode }) {
  const { id } = useParams();
  return <div key={id}>{render(id!)}</div>;
}

const TONE: Record<DocStatus, 'neutral' | 'teal' | 'muted' | 'warning'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  COUNTING: 'warning',
  REVIEW: 'warning',
  POSTED: 'teal',
  REJECTED: 'muted',
  CANCELLED: 'muted',
  IN_PROGRESS: 'warning',
  PICKED: 'neutral',
  PACKED: 'neutral',
  READY: 'warning',
  DISPATCHED: 'teal',
  DELIVERED: 'teal',
  DELIVERY_EXCEPTION: 'warning',
};

export function DocStatusPill({ status }: { status: DocStatus }) {
  const { k } = useCtl();
  return (
    <Pill
      tone={TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-doc-status={status}
    >
      {k.statuses[status]}
    </Pill>
  );
}

export interface Column<K extends DocKind> {
  head: string;
  cell: (r: RowOf<K>) => ReactNode;
  /** Hidden between md and lg (secondary facts). */
  minor?: boolean;
}

/** A server-paged, filterable list of one document kind. */
export function DocList<K extends DocKind>({
  kind,
  ctx,
  statuses,
  columns,
  extraFilter,
  canCreate,
}: {
  kind: K;
  ctx: WarehouseContext;
  statuses: DocStatus[];
  columns: Column<K>[];
  extraFilter?: { label: string; param: string; options: [string, string][] };
  canCreate: boolean;
}) {
  const { c, k, err } = useCtl();
  const { date } = useDateFormat();
  const base = useId();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [extra, setExtra] = useState('');
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const { data, error, more, showMore } = usePaged(
    (page) =>
      ctlApi.list(kind, {
        status,
        q: debounced,
        ...(extraFilter ? { [extraFilter.param]: extra } : {}),
        page,
        pageSize: 25,
      }),
    [status, extra, debounced],
  );
  const cols: Column<K>[] = [
    {
      head: c.f.number,
      cell: (r) => (
        <AreaLink to={`${WH}/${kind}/${encodeURIComponent(r.id)}`} className={LINK}>
          {r.number}
        </AreaLink>
      ),
    },
    { head: c.f.status, cell: (r) => <DocStatusPill status={r.status} /> },
    ...columns,
    {
      head: c.f.lines,
      cell: (r) => <span className="tabular-nums">{r.lineCount}</span>,
      minor: true,
    },
    { head: c.f.by, cell: (r) => r.createdBy?.name ?? '—', minor: true },
    { head: c.f.date, cell: (r) => date(r.updatedAt), minor: true },
  ];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title={k.title[kind]} lead={k.lead[kind]} />
        {canCreate && (
          <AreaLink to={`${WH}/${kind}/new`} className={buttonClasses('primary', 'md')} data-new>
            {k.newDoc[kind]}
          </AreaLink>
        )}
      </div>
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
          placeholder={c.f.number}
          describedBy={`${base}-count`}
        />
        <SelectField
          id={`${base}-status`}
          label={c.f.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-filter="status"
        >
          <option value="">{c.f.any}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {k.statuses[s]}
            </option>
          ))}
        </SelectField>
        {extraFilter && (
          <SelectField
            id={`${base}-x`}
            label={extraFilter.label}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            data-filter={extraFilter.param}
          >
            <option value="">{c.f.any}</option>
            {extraFilter.options.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {k.noDocs}
        </p>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-doc-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {cols.map((col) => (
                <th
                  key={col.head}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    col.minor && 'md:max-lg:hidden',
                  )}
                >
                  {col.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((r) => (
              <tr key={r.id} className={ROW} data-doc={r.number}>
                {cols.map((col) => (
                  <td
                    key={col.head}
                    data-label={col.head}
                    className={cn(CELL, col.minor && 'md:max-lg:hidden')}
                  >
                    {col.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ShowMore visible={!!data?.hasMore} busy={more} onClick={showMore} />
    </>
  );
}

export interface Step {
  action: string;
  label: string;
  ask: string;
  reason?: 'required' | 'optional';
  primary?: boolean;
}

/**
 * One document: loads it, then back link, number, status, the live notice,
 * the body, the workflow steps the server allows (each asks first, with a
 * reason where needed) and the timeline.
 */
export function DocPage<K extends DocKind>({
  kind,
  id,
  steps,
  children,
}: {
  kind: K;
  id: string;
  steps: (d: DocOf<K>) => Step[];
  children: (d: DocOf<K>, run: (work: () => Promise<Detail<K>>) => Promise<boolean>) => ReactNode;
}) {
  const { c, k, err } = useCtl();
  const { dateTime } = useDateFormat();
  const { state, set } = useLoad(() => ctlApi.get(kind, id));
  const { notice, run } = useRunner<Detail<K>>(set);
  const [open, setOpen] = useState<Step | null>(null);
  // Focus returns to the document's title when the confirm box closes (it unmounts with the focused button).
  const top = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(null);
    top.current?.focus();
  };
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{err(state.error)}</Notice>;
  const d = docOf(kind, state.data);
  const allowed = steps(d);
  return (
    <div className="grid grid-cols-1 gap-6" data-doc-page={d.number} data-status={d.status}>
      <AreaLink
        to={`${WH}/${kind}`}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {k.title[kind]}
      </AreaLink>
      <div ref={top} tabIndex={-1} className="outline-none">
        <PageTitle title={d.number} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DocStatusPill status={d.status} />
          <span className="text-caption text-text-muted">{k.title[kind]}</span>
        </div>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>
      {children(d, run)}
      {allowed.length > 0 && (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5" data-actions>
          {open ? (
            <ConfirmBox
              question={open.ask}
              goLabel={open.label}
              reason={open.reason}
              onCancel={close}
              onConfirm={async (reason) => {
                if (await run(() => ctlApi.act(kind, d.id, open.action, reason))) close();
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowed.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setOpen(s)}
                  className={buttonClasses(s.primary ? 'primary' : 'ghost', 'md')}
                  data-action={s.action}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Section id="doc-timeline" title={c.timeline}>
        <ol className="grid gap-2" data-timeline>
          {state.data.timeline.map((t, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 text-label">
              <span className="font-semibold text-text-primary">{timelineLabel(k, t.type)}</span>
              <span className="text-text-secondary">{t.actor?.name ?? c.system}</span>
              <span className="text-caption text-text-muted">{dateTime(t.at)}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/** A new document: its fields, then create and open it. */
export function NewDoc({
  kind,
  ready,
  body,
  children,
}: {
  kind: DocKind;
  ready: boolean;
  body: () => object;
  children: ReactNode;
}) {
  const { c, k, err } = useCtl();
  const open = useOpenDoc(kind);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      open(docOf(kind, await ctlApi.create(kind, body())).id);
    } catch (x) {
      setError(err(x));
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle title={k.newDoc[kind]} lead={k.lead[kind]} />
      {error && <Notice tone="error">{error}</Notice>}
      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
        data-new-doc={kind}
      >
        {children}
        <button
          type="submit"
          disabled={busy || !ready}
          className={buttonClasses('primary', 'md', 'w-fit sm:col-span-2')}
        >
          {busy ? c.saving : k.create}
        </button>
      </form>
    </>
  );
}

/** The note of a new document (trimmed by the caller). */
export function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c } = useCtl();
  const id = useId();
  return (
    <TextField
      id={id}
      label={c.f.note}
      value={value}
      maxLength={1000}
      onChange={(e) => onChange(e.target.value)}
      className="sm:col-span-2"
    />
  );
}

export const CARD = 'rounded-xl bg-white/[0.02] p-4';

/** Posted / read-only lines: what, which lot, how much. */
export function ReadLines({
  rows,
}: {
  rows: { id: string; title: string; name: string; lot: string | null; qty: string }[];
}) {
  return (
    <ol className="grid gap-2" data-lines>
      {rows.map((r) => (
        <li key={r.id} className={cn(CARD, 'flex flex-wrap justify-between gap-2 text-label')}>
          <span>
            <span className="font-mono">{r.title}</span> · {r.name}
            {r.lot && <span className="block font-mono text-caption text-text-muted">{r.lot}</span>}
          </span>
          <span className="font-semibold tabular-nums">{r.qty}</span>
        </li>
      ))}
    </ol>
  );
}

export interface Draft {
  label: string;
  unit: string;
  quantity: string;
}

/** Draft lines (quantity + remove, optional extra fields), a way to add, and save. */
export function DraftEditor<T extends Draft>({
  lines,
  setLines,
  extra,
  adder,
  save,
}: {
  lines: T[];
  setLines: Dispatch<SetStateAction<T[]>>;
  extra?: (l: T, i: number) => ReactNode;
  adder: ReactNode;
  save: (lines: T[]) => Promise<boolean>;
}) {
  const { c, k } = useCtl();
  const base = useId();
  const [busy, setBusy] = useState(false);
  const bad = lines.some((l) => !QTY.test(l.quantity) || !/[1-9]/.test(l.quantity));
  return (
    <div className="grid gap-4" data-lines-editor>
      <p className="text-caption text-text-muted">{lines.length ? k.draftHint : k.noLines}</p>
      <ol className="grid gap-2">
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              CARD,
              'grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]',
            )}
            data-draft-line={i + 1}
          >
            <span className="grid gap-2 text-label">
              <span className="font-mono">{l.label}</span>
              {extra?.(l, i)}
            </span>
            <TextField
              id={`${base}-${i}`}
              label={`${c.f.quantity} (${l.unit})`}
              inputMode="decimal"
              value={l.quantity}
              onChange={(e) =>
                setLines((ls) =>
                  ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value.trim() } : x)),
                )
              }
            />
            <button
              type="button"
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              className={buttonClasses('ghost', 'md')}
              aria-label={`${k.remove} ${l.label}`}
            >
              {k.remove}
            </button>
          </li>
        ))}
      </ol>
      {adder}
      <button
        type="button"
        disabled={busy || bad}
        onClick={() => {
          setBusy(true);
          void save(lines).finally(() => setBusy(false));
        }}
        className={buttonClasses('secondary', 'md', 'w-fit')}
        data-save-lines
      >
        {busy ? c.saving : k.saveLines}
      </button>
    </div>
  );
}

/** On-hand rows at one location (item, lot, quantity) to pick a stock identity from. */
export function StockPicker({
  locationId,
  label,
  onPick,
}: {
  locationId: string;
  label: string;
  onPick: (s: StockRow) => void;
}) {
  const { k } = useCtl();
  const id = useId();
  // Rows belong to the location they were read for (a stale answer shows nothing).
  const [got, setGot] = useState<{ at: string; rows: StockRow[] } | null>(null);
  const rows = got?.at === locationId ? got.rows : null;
  useEffect(() => {
    let live = true;
    if (locationId) {
      whApi
        .stock({ view: 'stock', locationId, pageSize: 100 })
        .then((p) => {
          if (live)
            // EP34: reserved stock cannot move — offer what is available only.
            setGot({ at: locationId, rows: p.items.filter((x) => x.quantityAvailable !== '0') });
        })
        .catch(() => {
          if (live) setGot({ at: locationId, rows: [] });
        });
    }
    return () => {
      live = false;
    };
  }, [locationId]);
  return (
    <SelectField
      id={id}
      label={label}
      value=""
      disabled={!rows?.length}
      onChange={(e) => {
        const s = rows?.find((r) => r.id === e.target.value);
        if (s) onPick(s);
      }}
      data-stock-picker
    >
      <option value="">{rows && !rows.length ? k.noStockHere : k.choose}</option>
      {rows?.map((s) => (
        <option key={s.id} value={s.id}>
          {`${s.item.code}${s.lot ? ` · ${s.lot.lotNumber}` : ''} — ${s.quantityAvailable} ${s.unit.code}`}
        </option>
      ))}
    </SelectField>
  );
}

/** Search the company's stock items (identity only) and pick one. */
export function ItemSearch({ onPick }: { onPick: (i: PickItem) => void }) {
  const { c, k } = useCtl();
  const id = useId();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [got, setGot] = useState<{ q: string; items: PickItem[] } | null>(null);
  const items = debounced.length >= 2 && got?.q === debounced ? got.items : [];
  useEffect(() => {
    let live = true;
    if (debounced.length >= 2) {
      ctlApi
        .items(debounced)
        .then((r) => {
          if (live) setGot({ q: debounced, items: r.items });
        })
        .catch(() => {
          if (live) setGot({ q: debounced, items: [] });
        });
    }
    return () => {
      live = false;
    };
  }, [debounced]);
  return (
    <div className="grid gap-2" data-item-search>
      <SearchBox
        id={id}
        label={k.pickItem}
        value={q}
        onChange={setQ}
        placeholder={c.f.stockHint}
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
                className="min-h-11 w-full rounded-lg px-3 text-left text-label hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className="font-mono">{i.code}</span> · {i.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
