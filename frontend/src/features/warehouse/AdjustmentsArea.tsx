import { useId, useState } from 'react';
import { SelectField, TextField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { Fact, Facts, Section } from '@/features/company-center/parts';
import {
  ADJ_REASONS,
  DECREASE_ONLY,
  INCREASE_ONLY,
  ctlApi,
  type Adjustment,
  type AdjustmentLineInput,
  type AdjReason,
} from './ctlApi';
import {
  CARD,
  DocArea,
  DocList,
  DocPage,
  DraftEditor,
  ItemSearch,
  NewDoc,
  NoteField,
  ReadLines,
  StockPicker,
  type Draft,
} from './ctlParts';
import { useCtl } from './ctlModel';
import type { WarehouseContext } from './whApi';

/*
 * /core/warehouse/adjustments/* (EP32) — stock adjustments, their own lazy
 * chunk. Staff draft one (a reason, lines that INCREASE or DECREASE stock at a
 * location — an increase may bring a new lot where the reason allows) and
 * submit it; a manager approves (= posts: ADJUSTMENT_IN / ADJUSTMENT_OUT),
 * rejects with a reason, or reverses a posted one. The server decides again.
 */

export default function AdjustmentsArea() {
  const { c, k } = useCtl();
  return (
    <DocArea
      kind="adjustments"
      list={(ctx) => (
        <DocList
          kind="adjustments"
          ctx={ctx}
          canCreate={ctx.adjustments.create}
          statuses={['DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED', 'CANCELLED']}
          extraFilter={{
            label: c.f.reason,
            param: 'reason',
            options: ADJ_REASONS.map((r) => [r, k.reasons[r]]),
          }}
          // EP42.4: draft → submitted for approval → approved (and posted); quantities only.
          next={(r) =>
            r.status === 'DRAFT' ? k.act.submit : r.status === 'SUBMITTED' ? k.act.approve : null
          }
          preview={(d) =>
            d.lines.map((l) => ({
              key: l.id,
              code: l.item.code,
              name: l.item.name,
              quantity: `${l.direction === 'DECREASE' ? '-' : '+'}${l.quantity}`,
              unit: l.unit.code,
              extra: [l.location.code, l.lot?.lotNumber ?? l.newLot?.lotNumber]
                .filter(Boolean)
                .join(' · '),
            }))
          }
          columns={[
            { head: c.f.reason, cell: (r) => k.reasons[r.reason] },
            {
              head: c.f.location,
              cell: (r) => <span className="font-mono">{r.locations.join(', ') || '—'}</span>,
            },
          ]}
        />
      )}
      create={(ctx) => (ctx.adjustments.create ? <NewAdjustment /> : null)}
      page={(id, ctx) => <AdjustmentPage id={id} ctx={ctx} />}
    />
  );
}

function NewAdjustment() {
  const { c, k } = useCtl();
  const id = useId();
  const [reason, setReason] = useState<AdjReason | ''>('');
  const [note, setNote] = useState('');
  return (
    <NewDoc
      kind="adjustments"
      ready={!!reason && (reason !== 'OTHER' || !!note.trim())}
      body={() => ({ reason, note: note.trim() || null })}
    >
      <SelectField
        id={id}
        label={c.f.reason}
        value={reason}
        onChange={(e) => setReason(e.target.value as AdjReason)}
      >
        <option value="">{k.choose}</option>
        {ADJ_REASONS.map((r) => (
          <option key={r} value={r}>
            {k.reasons[r]}
          </option>
        ))}
      </SelectField>
      <NoteField value={note} onChange={setNote} />
    </NewDoc>
  );
}

function AdjustmentPage({ id, ctx }: { id: string; ctx: WarehouseContext }) {
  const { c, k } = useCtl();
  const { date, dateTime } = useDateFormat();
  return (
    <DocPage
      kind="adjustments"
      id={id}
      steps={(a) =>
        (
          [
            ['submit', { label: k.act.submit, ask: k.ask.submit, primary: true }],
            ['approve', { label: k.act.approve, ask: k.ask.approve, primary: true }],
            ['reject', { label: k.act.reject, ask: k.ask.reject, reason: 'required' }],
            [
              'cancel',
              a.status === 'POSTED'
                ? { label: k.act.reverse, ask: k.ask.reverse, reason: 'required' as const }
                : { label: k.act.cancel, ask: k.ask.cancel },
            ],
          ] as const
        )
          .filter(([action]) => a.actions.includes(action))
          .map(([action, s]) => ({ action, ...s }))
      }
    >
      {(a, run) => (
        <>
          <Section id="adj-facts" title={k.title.adjustments}>
            <Facts>
              <Fact term={c.f.reason}>{k.reasons[a.reason]}</Fact>
              <Fact term={c.f.branch}>{`${a.branch.code} · ${a.branch.name}`}</Fact>
              <Fact term={k.f.date}>{date(a.adjustmentDate)}</Fact>
              <Fact term={c.f.by}>{a.createdBy?.name ?? '—'}</Fact>
              {a.approvedAt && (
                <Fact
                  term={k.f.approvedBy}
                >{`${dateTime(a.approvedAt)} · ${a.approvedBy?.name ?? ''}`}</Fact>
              )}
              {a.note && <Fact term={c.f.note}>{a.note}</Fact>}
              {a.rejectionReason && <Fact term={k.act.reject}>{a.rejectionReason}</Fact>}
              {a.cancellationReason && <Fact term={c.f.reason}>{a.cancellationReason}</Fact>}
            </Facts>
          </Section>
          <Section id="adj-lines" title={`${c.f.lines} · ${a.lines.length}`}>
            {a.actions.includes('edit') ? (
              <LinesEditor
                key={a.updatedAt}
                a={a}
                ctx={ctx}
                save={(lines) => run(() => ctlApi.lines('adjustments', a.id, lines))}
              />
            ) : (
              <ReadLines
                rows={a.lines.map((l) => ({
                  id: l.id,
                  title: `${l.location.code} · ${l.item.code}`,
                  name: l.item.name,
                  lot: (l.lot ?? l.newLot)?.lotNumber ?? null,
                  qty: `${l.direction === 'INCREASE' ? '+' : '−'}${l.quantity} ${l.unit.code}`,
                }))}
              />
            )}
          </Section>
        </>
      )}
    </DocPage>
  );
}

type Line = Draft & AdjustmentLineInput & { newLot: boolean };

function LinesEditor({
  a,
  ctx,
  save,
}: {
  a: Adjustment;
  ctx: WarehouseContext;
  save: (lines: AdjustmentLineInput[]) => Promise<boolean>;
}) {
  const { c, k } = useCtl();
  const base = useId();
  const directions = INCREASE_ONLY.includes(a.reason)
    ? (['INCREASE'] as const)
    : DECREASE_ONLY.includes(a.reason)
      ? (['DECREASE'] as const)
      : (['DECREASE', 'INCREASE'] as const);
  const here = ctx.locations.filter((l) => l.branchId === a.branch.id);
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>(directions[0]);
  const [locationId, setLocationId] = useState(here[0]?.id ?? '');
  const sign = (d: string) => (d === 'INCREASE' ? '+' : '−');
  const [lines, setLines] = useState<Line[]>(() =>
    a.lines.map((l) => ({
      direction: l.direction,
      locationId: l.location.id,
      itemId: l.item.id,
      lotId: l.lot?.id ?? null,
      newLotNumber: l.newLot?.lotNumber ?? null,
      newLotExpiry: l.newLot?.expiryDate ?? null,
      quantity: l.quantity,
      label: `${sign(l.direction)} ${l.location.code} · ${l.item.code}${(l.lot ?? l.newLot) ? ` · ${(l.lot ?? l.newLot)!.lotNumber}` : ''}`,
      unit: l.unit.code,
      newLot: false,
    })),
  );
  const code = here.find((l) => l.id === locationId)?.code ?? '';
  const add = (l: Omit<Line, 'direction' | 'locationId' | 'quantity'>) =>
    setLines((ls) => [
      ...ls,
      {
        ...l,
        direction,
        locationId,
        quantity: '',
        label: `${sign(direction)} ${code} · ${l.label}`,
      },
    ]);
  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <DraftEditor
      lines={lines}
      setLines={setLines}
      save={(ls) => save(ls.map(({ label: _l, unit: _u, newLot: _n, ...line }) => line))}
      extra={(l, i) =>
        l.newLot && (
          <span className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TextField
              id={`${base}-l${i}`}
              label={c.f.lotNumber}
              value={l.newLotNumber ?? ''}
              maxLength={60}
              onChange={(e) => update(i, { newLotNumber: e.target.value.trim() || null })}
            />
            <TextField
              id={`${base}-e${i}`}
              type="date"
              label={c.f.expiryDate}
              value={l.newLotExpiry ?? ''}
              onChange={(e) => update(i, { newLotExpiry: e.target.value || null })}
            />
          </span>
        )
      }
      adder={
        <div className={`${CARD} grid grid-cols-1 gap-3 sm:grid-cols-2`}>
          <SelectField
            id={`${base}-d`}
            label={k.f.direction}
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'INCREASE' | 'DECREASE')}
          >
            {directions.map((d) => (
              <option key={d} value={d}>
                {k.direction[d]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={`${base}-loc`}
            label={c.f.location}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {here.map((l) => (
              <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <StockPicker
              locationId={locationId}
              label={k.pickStock}
              onPick={(s) =>
                add({
                  itemId: s.item.id,
                  lotId: s.lot?.id ?? null,
                  label: `${s.item.code}${s.lot ? ` · ${s.lot.lotNumber}` : ''}`,
                  unit: s.unit.code,
                  newLot: false,
                })
              }
            />
          </div>
          {direction === 'INCREASE' && (
            <div className="sm:col-span-2">
              <ItemSearch
                onPick={(it) =>
                  add({
                    itemId: it.id,
                    lotId: null,
                    label: it.code,
                    unit: it.baseUnit.code,
                    newLot: it.lotTracking !== 'NONE',
                  })
                }
              />
            </div>
          )}
        </div>
      }
    />
  );
}
