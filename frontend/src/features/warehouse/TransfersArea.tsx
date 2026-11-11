import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SelectField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { Fact, Facts, Section } from '@/features/company-center/parts';
import { ctlApi, type Transfer } from './ctlApi';
import {
  DocArea,
  DocList,
  DocPage,
  DraftEditor,
  NewDoc,
  NoteField,
  ReadLines,
  StockPicker,
  type Draft,
} from './ctlParts';
import { useCtl } from './ctlModel';
import type { WarehouseContext } from './whApi';

/*
 * /core/warehouse/transfers/* (EP32) — stock transfers inside one branch, its
 * own lazy chunk. Staff draft a transfer (source → destination, lines picked
 * from the source's stock, the lot kept); a manager posts it (TRANSFER_OUT +
 * TRANSFER_IN) or reverses a posted one with a reason. The server re-checks
 * every rule — these screens only help.
 */

export default function TransfersArea() {
  const { k } = useCtl();
  return (
    <DocArea
      kind="transfers"
      list={(ctx) => (
        <DocList
          kind="transfers"
          ctx={ctx}
          canCreate={ctx.transfers.create}
          statuses={['DRAFT', 'POSTED', 'CANCELLED']}
          // EP42.4: a draft is posted next (one step: no in-transit stage to show).
          next={(r) => (r.status === 'DRAFT' ? k.act.post : null)}
          preview={(d) =>
            d.lines.map((l) => ({
              key: l.id,
              code: l.item.code,
              name: l.item.name,
              quantity: l.quantity,
              unit: l.unit.code,
              extra: l.lot ? l.lot.lotNumber : undefined,
            }))
          }
          columns={[
            {
              head: `${k.f.from} → ${k.f.to}`,
              cell: (r) => (
                <span className="font-mono whitespace-nowrap">{`${r.source.code} → ${r.destination.code}`}</span>
              ),
            },
          ]}
        />
      )}
      create={(ctx) => (ctx.transfers.create ? <NewTransfer ctx={ctx} /> : null)}
      page={(id) => <TransferPage id={id} />}
    />
  );
}

function NewTransfer({ ctx }: { ctx: WarehouseContext }) {
  const { k } = useCtl();
  const base = useId();
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get('location') ?? '');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const options = [
    <option key="" value="">
      {k.choose}
    </option>,
    ...ctx.locations.map((l) => <option key={l.id} value={l.id}>{`${l.code} · ${l.name}`}</option>),
  ];
  return (
    <NewDoc
      kind="transfers"
      ready={!!from && !!to && from !== to}
      body={() => ({
        sourceLocationId: from,
        destinationLocationId: to,
        note: note.trim() || null,
      })}
    >
      <SelectField
        id={`${base}-f`}
        label={k.f.from}
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      >
        {options}
      </SelectField>
      <SelectField
        id={`${base}-t`}
        label={k.f.to}
        value={to}
        onChange={(e) => setTo(e.target.value)}
      >
        {options}
      </SelectField>
      <NoteField value={note} onChange={setNote} />
    </NewDoc>
  );
}

function TransferPage({ id }: { id: string }) {
  const { c, k } = useCtl();
  const { date, dateTime } = useDateFormat();
  return (
    <DocPage
      kind="transfers"
      id={id}
      steps={(t) => [
        ...(t.actions.includes('post')
          ? [{ action: 'post', label: k.act.post, ask: k.ask.post, primary: true }]
          : []),
        ...(t.actions.includes('cancel')
          ? [
              t.status === 'POSTED'
                ? {
                    action: 'cancel',
                    label: k.act.reverse,
                    ask: k.ask.reverse,
                    reason: 'required' as const,
                  }
                : { action: 'cancel', label: k.act.cancel, ask: k.ask.cancel },
            ]
          : []),
      ]}
    >
      {(t, run) => (
        <>
          <Section id="tr-facts" title={k.title.transfers}>
            <Facts>
              <Fact term={k.f.from}>{`${t.source.code} · ${t.source.name}`}</Fact>
              <Fact term={k.f.to}>{`${t.destination.code} · ${t.destination.name}`}</Fact>
              <Fact term={c.f.branch}>{`${t.branch.code} · ${t.branch.name}`}</Fact>
              <Fact term={k.f.date}>{date(t.transferDate)}</Fact>
              <Fact term={c.f.by}>{t.createdBy?.name ?? '—'}</Fact>
              {t.postedAt && (
                <Fact
                  term={c.f.postedBy}
                >{`${dateTime(t.postedAt)} · ${t.postedBy?.name ?? ''}`}</Fact>
              )}
              {t.note && <Fact term={c.f.note}>{t.note}</Fact>}
              {t.cancellationReason && <Fact term={c.f.reason}>{t.cancellationReason}</Fact>}
            </Facts>
          </Section>
          <Section id="tr-lines" title={`${c.f.lines} · ${t.lines.length}`}>
            {t.actions.includes('edit') ? (
              <LinesEditor
                key={t.updatedAt}
                t={t}
                save={(lines) => run(() => ctlApi.lines('transfers', t.id, lines))}
              />
            ) : (
              <ReadLines
                rows={t.lines.map((l) => ({
                  id: l.id,
                  title: l.item.code,
                  name: l.item.name,
                  lot: l.lot?.lotNumber ?? null,
                  qty: `${l.quantity} ${l.unit.code}`,
                }))}
              />
            )}
          </Section>
        </>
      )}
    </DocPage>
  );
}

type Line = Draft & { itemId: string; lotId: string | null };

function LinesEditor({
  t,
  save,
}: {
  t: Transfer;
  save: (lines: { itemId: string; lotId: string | null; quantity: string }[]) => Promise<boolean>;
}) {
  const { k } = useCtl();
  const [lines, setLines] = useState<Line[]>(() =>
    t.lines.map((l) => ({
      itemId: l.item.id,
      lotId: l.lot?.id ?? null,
      label: `${l.item.code}${l.lot ? ` · ${l.lot.lotNumber}` : ''} (${k.f.available} ${l.available})`,
      unit: l.unit.code,
      quantity: l.quantity,
    })),
  );
  return (
    <DraftEditor
      lines={lines}
      setLines={setLines}
      save={(ls) => save(ls.map(({ itemId, lotId, quantity }) => ({ itemId, lotId, quantity })))}
      adder={
        <StockPicker
          locationId={t.source.id}
          label={`${k.pickStock} (${t.source.code})`}
          onPick={(s) =>
            setLines((ls) =>
              ls.some((x) => x.itemId === s.item.id && x.lotId === (s.lot?.id ?? null))
                ? ls
                : [
                    ...ls,
                    {
                      itemId: s.item.id,
                      lotId: s.lot?.id ?? null,
                      label: `${s.item.code}${s.lot ? ` · ${s.lot.lotNumber}` : ''} (${k.f.available} ${s.quantityAvailable})`,
                      unit: s.unit.code,
                      quantity: s.quantityAvailable,
                    },
                  ],
            )
          }
        />
      }
    />
  );
}
