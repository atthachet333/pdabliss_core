import { ArrowLeft } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { BranchCode } from '@/features/company-center/adminParts';
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
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { masterApi, type MasterDetail, type MasterRecord, type Resource } from './api';
import { MASTER_COPY } from './copy';
import { useMaster } from './context';
import { RecordForm, RefText, StatusPill, TrackingBadges } from './parts';
import {
  bodyOf,
  CODE_EXAMPLE,
  emptyValues,
  FIELDS,
  readError,
  valuesOf,
  type Field,
} from './schema';

/*
 * One master record (EP28): its facts in groups, then — for those allowed —
 * edit, deactivate / reactivate (reversible, confirmed in place) and, for an
 * item, its unit & tracking (the structure policy point, saved separately).
 * `id === null` is the create page. A dedicated page, not a modal.
 */

export function RecordPage({ resource: r, id }: { resource: Resource; id: string | null }) {
  const c = useCopy(MASTER_COPY);
  const { ctx } = useMaster();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const list = `/company/master-data/${r}`;
  const back = (
    <AreaLink
      to={list}
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {c.back}
    </AreaLink>
  );

  if (id === null) {
    if (!ctx.capabilities[r].manage) return <Notice tone="info">{c.readOnly}</Notice>;
    const fields = FIELDS[r];
    const example = CODE_EXAMPLE[r];
    return (
      <div className="grid grid-cols-1 gap-6" data-record-create={r}>
        {back}
        <PageTitle title={c.res[r].create} lead={c.res[r].lead} />
        <RecordForm
          fields={fields}
          initial={{
            ...emptyValues(r, fields),
            ...(r === 'locations'
              ? { branchId: ctx.branches.find((b) => b.canManage)?.id ?? '' }
              : {}),
          }}
          ctx={ctx}
          hints={{
            code: example ? c.codeAuto(example) : c.codeFixed,
            precision: c.precisionHint,
            taxId: c.taxHint,
          }}
          submitLabel={c.res[r].create}
          onCancel={() => void navigate(list, { state: { locale } })}
          onSubmit={async (values) => {
            const created = await masterApi.create(r, bodyOf(fields, values));
            void navigate(`${list}/${encodeURIComponent(created.id)}`, {
              state: { locale },
            });
          }}
        />
      </div>
    );
  }
  return <Detail resource={r} id={id} back={back} />;
}

function Detail({ resource: r, id, back }: { resource: Resource; id: string; back: ReactNode }) {
  const c = useCopy(MASTER_COPY);
  const { ctx } = useMaster();
  const { dateTime } = useDateFormat();
  const { state, set } = useLoad(() => masterApi.get(r, id));
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toggleButton = useRef<HTMLButtonElement>(null);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return (
      <div className="grid grid-cols-1 gap-4">
        {back}
        <Notice tone="error">{readError(state.error, c).message}</Notice>
      </div>
    );
  const d = state.data;
  const x = d.record;
  const active = x.status === 'ACTIVE';
  const branchOk =
    r !== 'locations' || ctx.branches.some((b) => b.id === x.branch?.id && b.canManage);
  const manage = d.canManage && branchOk;
  const replace = (record: MasterRecord, text: string) => {
    set({ ...d, record } satisfies MasterDetail);
    setNotice({ tone: 'success', text });
  };
  const fields = FIELDS[r].filter((f) => !f.create && !f.structure);

  const toggle = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const next = await masterApi.setStatus(r, x.id, !active);
      replace(next, next.status === 'ACTIVE' ? c.statuses.ACTIVE : c.statuses.INACTIVE);
      setConfirming(false);
      // The confirmation closes; keep keyboard users on the (now opposite) action.
      requestAnimationFrame(() => toggleButton.current?.focus());
    } catch (e) {
      setNotice({ tone: 'error', text: readError(e, c).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6" data-record={x.code} data-status={x.status}>
      {back}
      <div>
        <PageTitle
          title={x.name}
          action={
            manage && !editing ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setNotice(null);
                  }}
                  className={buttonClasses('secondary', 'md')}
                  data-edit
                >
                  {c.edit}
                </button>
                <button
                  ref={toggleButton}
                  type="button"
                  disabled={busy}
                  onClick={() => (active ? setConfirming(true) : void toggle())}
                  className={buttonClasses('ghost', 'md')}
                  data-toggle-status
                >
                  {active ? c.deactivate : c.reactivate}
                </button>
              </div>
            ) : undefined
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-label text-text-primary">
            {x.code}
          </span>
          <StatusPill status={x.status} />
          {x.isDefault && <Pill tone="teal">{c.default}</Pill>}
          <span className="text-caption text-text-muted">{c.res[r].one}</span>
        </div>
      </div>
      {!d.canManage && <Notice tone="info">{c.readOnly}</Notice>}
      {confirming && (
        <div
          role="group"
          aria-label={c.deactivate}
          className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
          data-confirm
        >
          <p className="text-label text-text-primary">{c.confirmOff(x.code)}</p>
          {d.usage && (
            <p className="text-caption text-text-secondary">{c.usage(d.usage.activeItems)}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              autoFocus
              onClick={() => void toggle()}
              className={buttonClasses('primary', 'md')}
              data-confirm-deactivate
            >
              {c.confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonClasses('ghost', 'md')}
            >
              {c.cancel}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      {editing ? (
        <Section id="edit-title" title={c.edit}>
          <p className="mb-4 text-caption text-text-muted">{c.codeFixed}</p>
          <RecordForm
            fields={fields}
            initial={valuesOf(x, fields)}
            ctx={ctx}
            record={x}
            hints={{ precision: c.precisionHint, taxId: c.taxHint }}
            submitLabel={c.save}
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              const body = bodyOf(fields, values, valuesOf(x, fields));
              const next = Object.keys(body).length ? await masterApi.update(r, x.id, body) : x;
              setEditing(false);
              replace(next, c.saved);
            }}
          />
        </Section>
      ) : (
        <Section id="facts-title" title={c.groups.identity}>
          <Facts>
            {FIELDS[r]
              .filter((f) => !f.structure && f.key !== 'code' && f.key !== 'name')
              .map((f) => (
                <Fact key={f.key} term={c.f[f.key] ?? f.key}>
                  <Value field={f} x={x} />
                </Fact>
              ))}
            {d.usage && <Fact term={c.f.usage!}>{c.usage(d.usage.activeItems)}</Fact>}
            {d.activeChildren ? (
              <Fact term={c.groups.placement}>{c.children(d.activeChildren)}</Fact>
            ) : null}
            <Fact term={c.f.status!}>
              <StatusPill status={x.status} />
              <span className="ml-2 text-caption text-text-muted">{dateTime(x.updatedAt)}</span>
            </Fact>
          </Facts>
        </Section>
      )}

      {r === 'items' && (
        <Section id="structure-title" title={c.structureTitle}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <RefText r={x.baseUnit} />
            <TrackingBadges item={x} />
          </div>
          <p className="mb-4 max-w-3xl text-caption text-text-muted">{c.structureNote}</p>
          {manage && <StructureForm x={x} onSaved={(next) => replace(next, c.saved)} />}
        </Section>
      )}
    </div>
  );
}

function StructureForm({ x, onSaved }: { x: MasterRecord; onSaved: (r: MasterRecord) => void }) {
  const c = useCopy(MASTER_COPY);
  const { ctx } = useMaster();
  const fields = FIELDS.items.filter((f) => f.structure);
  const initial = valuesOf(x, fields);
  return (
    <RecordForm
      key={x.updatedAt}
      fields={fields}
      initial={initial}
      ctx={ctx}
      record={x}
      submitLabel={c.saveStructure}
      onSubmit={async (values) => {
        const body = bodyOf(fields, values, initial);
        if (Object.keys(body).length) onSaved(await masterApi.structure(x.id, body));
      }}
    />
  );
}

/** A field's value in words (enums named, references as code · name, empty as —). */
function Value({ field: f, x }: { field: Field; x: MasterRecord }) {
  const c = useCopy(MASTER_COPY);
  switch (f.key) {
    case 'kind':
      return <>{c.kinds[x.kind as 'BUSINESS']}</>;
    case 'type':
      return <>{c.types[x.type!]}</>;
    case 'categoryId':
      return <RefText r={x.category} />;
    case 'parentId':
      return <RefText r={x.parent} />;
    case 'isDefault':
      return <>{x.isDefault ? c.default : c.none}</>;
    case 'branchId':
      return (
        <span className="flex flex-wrap items-center gap-2">
          <BranchCode code={x.branch!.code} head={x.branch!.type === 'HEAD_OFFICE'} />
          {x.branch!.name}
        </span>
      );
  }
  const v = x[f.key];
  if (v === null || v === undefined || v === '')
    return <span className="text-text-muted">{c.none}</span>;
  return (
    <span className={f.mono ? 'font-mono' : f.kind === 'area' ? 'whitespace-pre-line' : undefined}>
      {String(v)}
    </span>
  );
}
