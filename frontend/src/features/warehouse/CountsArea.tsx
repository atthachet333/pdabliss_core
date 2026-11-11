import { useId, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { Fact, Facts, Section } from '@/features/company-center/parts';
import { cn } from '@/lib/cn';
import { ctlApi, type Count, type CountLineInput, type PickItem } from './ctlApi';
import { CARD, DocArea, DocList, DocPage, ItemSearch, NewDoc, NoteField } from './ctlParts';
import { useCtl } from './ctlModel';
import { QTY, type WarehouseContext } from './whApi';

/*
 * /core/warehouse/counts/* (EP32) — cycle counts, their own lazy chunk. A count
 * covers some locations of one branch. Starting it snapshots on-hand stock and
 * locks those locations; counters enter what they find (0 is a count) and may
 * add stock the system did not show; review, then a manager posts — one signed
 * COUNT_CORRECTION per difference — or the server refuses a stale count.
 */

export default function CountsArea() {
  const { k } = useCtl();
  return (
    <DocArea
      kind="counts"
      list={(ctx) => (
        <DocList
          kind="counts"
          ctx={ctx}
          canCreate={ctx.cycleCounts.create}
          statuses={['DRAFT', 'COUNTING', 'REVIEW', 'POSTED', 'CANCELLED']}
          // EP42.4: start counting → send for review → confirm the result.
          next={(r) =>
            r.status === 'DRAFT'
              ? k.act.start
              : r.status === 'COUNTING'
                ? k.act.review
                : r.status === 'REVIEW'
                  ? k.act.postCount
                  : null
          }
          // Counted figures only — the system quantity of a blind count never appears here.
          preview={(d) =>
            d.lines.map((l) => ({
              key: l.id,
              code: l.item.code,
              name: l.item.name,
              quantity: l.countedQuantity ?? '—',
              unit: l.countedQuantity === null ? null : l.unit.code,
              extra: [l.location.code, l.lot?.lotNumber ?? l.newLot?.lotNumber]
                .filter(Boolean)
                .join(' · '),
            }))
          }
          columns={[
            {
              head: k.f.locations,
              cell: (r) => (
                <span className="font-mono">{r.locations.map((l) => l.code).join(', ')}</span>
              ),
            },
            {
              head: k.f.variance,
              cell: (r) => (
                <span className="tabular-nums">{`${r.countedLines}/${r.lineCount} · Δ ${r.varianceLines}`}</span>
              ),
            },
          ]}
        />
      )}
      create={(ctx) => (ctx.cycleCounts.create ? <NewCount ctx={ctx} /> : null)}
      page={(id) => <CountPage id={id} />}
    />
  );
}

function NewCount({ ctx }: { ctx: WarehouseContext }) {
  const { k } = useCtl();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <NewDoc
      kind="counts"
      ready={picked.length > 0}
      body={() => ({ locationIds: picked, note: note.trim() || null })}
    >
      <fieldset className="grid gap-1 sm:col-span-2">
        <legend className="mb-2 text-label font-medium text-text-primary">{k.f.locations}</legend>
        {ctx.locations.map((l) => (
          <label key={l.id} className="flex min-h-11 items-center gap-3 text-label">
            <input
              type="checkbox"
              className="size-5 accent-brand-primary"
              checked={picked.includes(l.id)}
              onChange={(e) =>
                setPicked((p) => (e.target.checked ? [...p, l.id] : p.filter((x) => x !== l.id)))
              }
            />
            <span className="font-mono">{l.code}</span> · {l.name}
          </label>
        ))}
      </fieldset>
      <NoteField value={note} onChange={setNote} />
    </NewDoc>
  );
}

function CountPage({ id }: { id: string }) {
  const { c, k } = useCtl();
  const { date, dateTime } = useDateFormat();
  return (
    <DocPage
      kind="counts"
      id={id}
      steps={(n) =>
        (
          [
            ['start', { label: k.act.start, ask: k.ask.start, primary: true }],
            ['review', { label: k.act.review, ask: k.ask.review, primary: true }],
            ['post', { label: k.act.postCount, ask: k.ask.postCount, primary: true }],
            ['reopen', { label: k.act.reopen, ask: k.ask.reopen }],
            ['cancel', { label: k.act.cancelCount, ask: k.ask.cancelCount, reason: 'optional' }],
          ] as const
        )
          .filter(([action]) => n.actions.includes(action))
          .map(([action, s]) => ({ action, ...s }))
      }
    >
      {(n, run) => (
        <>
          {(n.status === 'COUNTING' || n.status === 'REVIEW') && (
            <Notice tone="info">{k.lockNote}</Notice>
          )}
          <Section id="cc-facts" title={k.title.counts}>
            <Facts>
              <Fact term={k.f.locations}>
                {n.locations.map((l) => `${l.code} · ${l.name}`).join(', ')}
              </Fact>
              {n.item && <Fact term={c.f.item}>{`${n.item.code} · ${n.item.name}`}</Fact>}
              <Fact term={c.f.branch}>{`${n.branch.code} · ${n.branch.name}`}</Fact>
              <Fact term={k.f.date}>{date(n.countDate)}</Fact>
              <Fact term={c.f.by}>{n.createdBy?.name ?? '—'}</Fact>
              <Fact term={k.f.countedLines}>{`${n.countedLines}/${n.lineCount}`}</Fact>
              {n.postedAt && (
                <Fact
                  term={c.f.postedBy}
                >{`${dateTime(n.postedAt)} · ${n.postedBy?.name ?? ''}`}</Fact>
              )}
              {n.note && <Fact term={c.f.note}>{n.note}</Fact>}
              {n.cancellationReason && <Fact term={c.f.reason}>{n.cancellationReason}</Fact>}
            </Facts>
          </Section>
          {n.status !== 'DRAFT' && (
            <Section id="cc-lines" title={`${c.f.lines} · ${n.lines.length}`}>
              <CountSheet
                key={n.updatedAt}
                n={n}
                save={(entries) => run(() => ctlApi.entries(n.id, entries))}
                add={(body) => run(() => ctlApi.addCountLine(n.id, body))}
              />
            </Section>
          )}
        </>
      )}
    </DocPage>
  );
}

function CountSheet({
  n,
  save,
  add,
}: {
  n: Count;
  save: (entries: { lineId: string; countedQuantity: string | null }[]) => Promise<boolean>;
  add: (b: CountLineInput) => Promise<boolean>;
}) {
  const { c, k } = useCtl();
  const base = useId();
  const editable = n.actions.includes('count');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(n.lines.map((l) => [l.id, l.countedQuantity ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const changed = n.lines.filter((l) => values[l.id] !== (l.countedQuantity ?? ''));
  const bad = changed.some((l) => values[l.id] !== '' && !QTY.test(values[l.id]!));
  const td = 'px-3 py-2 align-middle first:pl-4 max-md:p-0';
  return (
    <div className="grid gap-4" data-count-sheet>
      {editable && <p className="text-caption text-text-muted">{k.countHint}</p>}
      <table className="w-full text-left text-label max-md:block">
        <thead className="max-md:sr-only">
          <tr className="text-caption text-text-muted">
            {[c.f.location, c.f.item, c.f.lot, k.f.system, k.f.counted, k.f.variance].map((h) => (
              <th key={h} scope="col" className="px-3 pb-2 font-medium first:pl-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
          {n.lines.map((l) => {
            const v = l.variance;
            return (
              <tr
                key={l.id}
                className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-2 max-md:gap-2 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                data-count-line={l.lineNo}
              >
                <td className={cn(td, 'font-mono')}>{l.location.code}</td>
                <td className={td}>
                  <span className="font-mono">{l.item.code}</span>
                  {!l.expected && (
                    <span className="block text-caption text-warning">{k.unexpected}</span>
                  )}
                </td>
                <td className={cn(td, 'font-mono')}>{(l.lot ?? l.newLot)?.lotNumber ?? '—'}</td>
                <td className={cn(td, 'tabular-nums')}>
                  <span className="text-caption text-text-muted md:hidden">{k.f.system} </span>
                  {l.systemQuantity} {l.unit.code}
                </td>
                <td className={td}>
                  {editable ? (
                    <TextField
                      id={`${base}-${l.id}`}
                      label={`${k.f.counted} #${l.lineNo}`}
                      inputMode="decimal"
                      value={values[l.id] ?? ''}
                      onChange={(e) => setValues((x) => ({ ...x, [l.id]: e.target.value.trim() }))}
                      className="[&_label]:sr-only"
                    />
                  ) : (
                    <span className="tabular-nums">{l.countedQuantity ?? k.notCounted}</span>
                  )}
                </td>
                <td
                  className={cn(
                    td,
                    'font-semibold tabular-nums',
                    v && v !== '0' && (v.startsWith('-') ? 'text-[#f3cf8a]' : 'text-brand-soft'),
                  )}
                  data-variance={v ?? ''}
                >
                  <span className="text-caption font-normal text-text-muted md:hidden">
                    {k.f.variance}{' '}
                  </span>
                  {v === null
                    ? '—'
                    : v.startsWith('-')
                      ? `−${v.slice(1)}`
                      : v === '0'
                        ? '0'
                        : `+${v}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editable && (
        <>
          <button
            type="button"
            disabled={busy || !changed.length || bad}
            onClick={() => {
              setBusy(true);
              void save(
                changed.map((l) => ({ lineId: l.id, countedQuantity: values[l.id] || null })),
              ).finally(() => setBusy(false));
            }}
            className={buttonClasses('secondary', 'md', 'w-fit')}
            data-save-counts
          >
            {busy ? c.saving : k.saveCounts}
          </button>
          <FoundLine n={n} add={add} />
        </>
      )}
    </div>
  );
}

/** Stock found in scope that the snapshot did not show (system 0). */
function FoundLine({ n, add }: { n: Count; add: (b: CountLineInput) => Promise<boolean> }) {
  const { c, k } = useCtl();
  const base = useId();
  const [item, setItem] = useState<PickItem | null>(null);
  const [locationId, setLocationId] = useState(n.locations[0]?.id ?? '');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <details className={CARD} data-found-line>
      <summary className="min-h-11 cursor-pointer content-center text-label font-medium">
        {k.addFound}
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id={`${base}-loc`}
          label={c.f.location}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {n.locations.map((l) => (
            <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>
          ))}
        </SelectField>
        {item ? (
          <p className="self-end text-label">
            <span className="font-mono">{item.code}</span> · {item.name}
          </p>
        ) : (
          <ItemSearch onPick={setItem} />
        )}
        {item && item.lotTracking !== 'NONE' && (
          <TextField
            id={`${base}-lot`}
            label={c.f.lotNumber}
            value={lot}
            maxLength={60}
            onChange={(e) => setLot(e.target.value)}
          />
        )}
        {item && item.expiryTracking !== 'NONE' && (
          <TextField
            id={`${base}-exp`}
            type="date"
            label={c.f.expiryDate}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        )}
        <TextField
          id={`${base}-qty`}
          label={k.f.counted}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value.trim())}
        />
        <button
          type="button"
          disabled={busy || !item || !QTY.test(qty)}
          onClick={() => {
            setBusy(true);
            void add({
              locationId,
              itemId: item!.id,
              newLotNumber: lot.trim() || null,
              newLotExpiry: expiry || null,
              countedQuantity: qty,
            }).finally(() => setBusy(false));
          }}
          className={buttonClasses('secondary', 'md', 'w-fit self-end')}
        >
          {busy ? c.saving : k.add}
        </button>
      </div>
    </details>
  );
}
