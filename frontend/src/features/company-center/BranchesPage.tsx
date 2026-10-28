import { Building, MapPin, Phone, Plus } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { TextField } from '@/features/auth/fields';
import type { BranchInfo } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { controlApi, type BranchInput, type BranchList } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, fieldGrid, oneLineAddress, useLoad } from './model';
import { Loading, PageTitle, Pill, Result, Section } from './parts';

/*
 * /company/branches — every branch of the company. Owner and System Admin
 * create, edit, deactivate and reactivate; everyone else reads. The Head
 * Office (00000) is always there: its details can change, it can never be
 * deactivated or removed (the server and the database refuse it too). Branch
 * codes are 5 digits, unique in the company, and fixed once created.
 */

type Fields = Record<
  | 'code'
  | 'name'
  | 'addressLine1'
  | 'addressLine2'
  | 'subdistrict'
  | 'district'
  | 'province'
  | 'postalCode'
  | 'countryCode'
  | 'phone',
  string
>;

const empty: Fields = {
  code: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  subdistrict: '',
  district: '',
  province: '',
  postalCode: '',
  countryCode: 'TH',
  phone: '',
};

const fromBranch = (b: BranchInfo): Fields => ({
  code: b.code,
  name: b.name,
  addressLine1: b.address.line1,
  addressLine2: b.address.line2 ?? '',
  subdistrict: b.address.subdistrict ?? '',
  district: b.address.district ?? '',
  province: b.address.province,
  postalCode: b.address.postalCode,
  countryCode: b.address.countryCode,
  phone: b.phone ?? '',
});

export function BranchesPage() {
  const c = useCopy(CONTROL_COPY);
  const { reload: reloadOverview } = useControl();
  const { state, reload } = useLoad(controlApi.branches);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const list: BranchList = state.data;
  const active = list.branches.filter((b) => b.status === 'ACTIVE').length;

  const done = async (text: string) => {
    setNotice({ tone: 'success', text });
    setCreating(false);
    setEditing(null);
    await Promise.all([reload(), reloadOverview()]).catch(() => undefined);
  };

  return (
    <div className="grid gap-8">
      <PageTitle
        title={c.branches.title}
        lead={c.branches.lead}
        action={
          list.canManage && !creating ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setEditing(null);
                setNotice(null);
              }}
              className={buttonClasses('primary', 'md')}
              data-add-branch
            >
              <Plus aria-hidden className="size-4" />
              {c.branches.add}
            </button>
          ) : undefined
        }
      />
      {!list.canManage && <Notice tone="info">{c.shell.readOnly}</Notice>}
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      {creating && (
        <Section id="new-branch-title" title={c.branches.newTitle}>
          <BranchForm
            initial={empty}
            suggestedCode={list.suggestedCode}
            onCancel={() => setCreating(false)}
            onSaved={(b) => void done(c.branches.created(b.code))}
          />
        </Section>
      )}

      <Section
        id="branch-list-title"
        title={c.branches.title}
        aside={
          <span className="text-caption text-text-muted">
            {c.branches.countActive(active, list.branches.length)}
          </span>
        }
      >
        <ul className="grid gap-3" data-branch-list>
          {list.branches.map((b) => (
            <li
              key={b.id}
              data-branch={b.code}
              data-status={b.status}
              className={cn(
                'rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:p-5',
                b.status === 'ACTIVE' ? 'bg-white/[0.025]' : 'bg-transparent opacity-80',
              )}
            >
              <BranchRow
                branch={b}
                canManage={list.canManage}
                editing={editing === b.id}
                onEdit={() => {
                  setEditing(editing === b.id ? null : b.id);
                  setCreating(false);
                  setNotice(null);
                }}
                onDone={(text) => void done(text)}
                onError={(text) => setNotice({ tone: 'error', text })}
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-text-muted">{c.branches.headOfficeNote}</p>
      </Section>
    </div>
  );
}

function BranchRow({
  branch: b,
  canManage,
  editing,
  onEdit,
  onDone,
  onError,
}: {
  branch: BranchInfo;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const head = b.type === 'HEAD_OFFICE';
  const panelId = useId();

  const setActive = async (activeNow: boolean) => {
    setBusy(true);
    try {
      await controlApi.setBranchActive(b.id, activeNow);
      setConfirming(false);
      onDone(activeNow ? c.branches.reactivated : c.branches.deactivated);
    } catch (e) {
      onError(errorText(e, c));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            head
              ? 'bg-brand-primary/[0.12] text-brand-soft'
              : 'bg-white/[0.05] text-text-secondary',
          )}
        >
          <Building className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-caption text-text-muted tabular-nums">{b.code}</span>
            <span className="text-label font-semibold break-words text-text-primary">{b.name}</span>
            {head && <Pill tone="teal">{c.branches.headOffice}</Pill>}
            {b.status !== 'ACTIVE' && (
              <Pill tone="muted">
                {b.status === 'CLOSED' ? c.common.closed : c.common.inactive}
              </Pill>
            )}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-caption text-text-secondary">
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-words">{oneLineAddress(b)}</span>
          </p>
          {b.phone && (
            <p className="mt-0.5 flex items-center gap-1.5 text-caption text-text-secondary">
              <Phone aria-hidden className="size-3.5 shrink-0" />
              <span className="tabular-nums">{b.phone}</span>
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              aria-expanded={editing}
              aria-controls={panelId}
              className={buttonClasses('secondary', 'md')}
            >
              {c.common.edit}
            </button>
            {!head && b.status === 'ACTIVE' && !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={buttonClasses('ghost', 'md')}
              >
                {c.branches.deactivate}
              </button>
            )}
            {!head && b.status === 'INACTIVE' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setActive(true)}
                className={buttonClasses('ghost', 'md')}
              >
                {c.branches.reactivate}
              </button>
            )}
          </div>
        )}
      </div>
      {confirming && (
        <div
          role="group"
          aria-label={c.branches.deactivate}
          className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
        >
          <p className="text-label text-text-primary">{c.branches.confirmDeactivate(b.name)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void setActive(false)}
              className={buttonClasses('secondary', 'md')}
              data-confirm-deactivate
            >
              {c.common.confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={buttonClasses('ghost', 'md')}
            >
              {c.common.cancel}
            </button>
          </div>
        </div>
      )}
      <div id={panelId} hidden={!editing}>
        {editing && (
          <BranchForm
            initial={fromBranch(b)}
            branch={b}
            suggestedCode={null}
            onCancel={onEdit}
            onSaved={() => onDone(c.branches.updated)}
          />
        )}
      </div>
    </div>
  );
}

function BranchForm({
  initial,
  branch,
  suggestedCode,
  onCancel,
  onSaved,
}: {
  initial: Fields;
  branch?: BranchInfo;
  suggestedCode: string | null;
  onCancel: () => void;
  onSaved: (b: BranchInfo) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const pc = c.profile;
  const [form, setForm] = useState<Fields>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = useId();
  const f = (k: keyof Fields) => `${base}-${k}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const missing: Partial<Record<keyof Fields, string>> = {};
    for (const k of ['name', 'addressLine1', 'province', 'postalCode'] as const)
      if (!form[k].trim()) missing[k] = pc.invalid.required;
    if (!branch && form.code.trim() && !/^\d{5}$/.test(form.code.trim()))
      missing.code = c.branches.codeHint(suggestedCode ?? '00001');
    setErrors(missing);
    if (Object.keys(missing).length) {
      document.getElementById(f(Object.keys(missing)[0] as keyof Fields))?.focus();
      return;
    }
    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as Fields;
    setBusy(true);
    try {
      let saved: BranchInfo;
      if (branch) {
        const body: Partial<BranchInput> = {};
        const before = fromBranch(branch);
        for (const k of Object.keys(trimmed) as (keyof Fields)[]) {
          if (k === 'code' || trimmed[k] === before[k]) continue;
          (body as Record<string, string | null>)[k] =
            trimmed[k] ||
            (['addressLine2', 'subdistrict', 'district', 'phone'].includes(k) ? null : trimmed[k]);
        }
        if (!Object.keys(body).length) {
          onCancel();
          return;
        }
        saved = (await controlApi.updateBranch(branch.id, body)).branch;
      } else {
        saved = (
          await controlApi.createBranch({
            ...(trimmed.code && { code: trimmed.code }),
            name: trimmed.name,
            addressLine1: trimmed.addressLine1,
            ...(trimmed.addressLine2 && { addressLine2: trimmed.addressLine2 }),
            ...(trimmed.subdistrict && { subdistrict: trimmed.subdistrict }),
            ...(trimmed.district && { district: trimmed.district }),
            province: trimmed.province,
            postalCode: trimmed.postalCode,
            countryCode: trimmed.countryCode.toUpperCase() || 'TH',
            ...(trimmed.phone && { phone: trimmed.phone }),
          })
        ).branch;
      }
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BRANCH_CODE_TAKEN') {
        setErrors({ code: c.errors.BRANCH_CODE_TAKEN });
        document.getElementById(f('code'))?.focus();
      } else if (err instanceof ApiError && Array.isArray(err.details)) {
        const next: Partial<Record<keyof Fields, string>> = {};
        for (const d of err.details as { path: string }[]) {
          const k = d.path as keyof Fields;
          next[k] =
            k === 'phone'
              ? pc.invalid.phone
              : k === 'postalCode'
                ? pc.invalid.postalCode
                : pc.invalid.required;
        }
        setErrors(next);
      }
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  const input = (
    k: keyof Fields,
    label: string,
    extra: Partial<Parameters<typeof TextField>[0]> = {},
  ) => (
    <TextField
      id={f(k)}
      label={label}
      value={form[k]}
      onChange={(e) => setForm((v) => ({ ...v, [k]: e.target.value }))}
      error={errors[k]}
      {...extra}
    />
  );

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid gap-4"
      data-branch-form={branch ? 'edit' : 'new'}
    >
      <div className={fieldGrid}>
        {branch ? (
          <TextField
            id={f('code')}
            label={c.branches.code}
            value={branch.code}
            readOnly
            hint={c.branches.codeFixed}
          />
        ) : (
          input('code', `${c.branches.code} (${c.common.optional})`, {
            inputMode: 'numeric',
            maxLength: 5,
            placeholder: suggestedCode ?? undefined,
            hint: c.branches.codeHint(suggestedCode ?? '—'),
          })
        )}
        {input('name', c.branches.name, { required: true, maxLength: 120 })}
        {input('addressLine1', pc.addressLine1, {
          required: true,
          maxLength: 200,
          className: 'sm:col-span-2',
        })}
        {input('addressLine2', `${pc.addressLine2} (${c.common.optional})`, {
          maxLength: 200,
          className: 'sm:col-span-2',
        })}
        {input('subdistrict', `${pc.subdistrict} (${c.common.optional})`, { maxLength: 100 })}
        {input('district', `${pc.district} (${c.common.optional})`, { maxLength: 100 })}
        {input('province', pc.province, { required: true, maxLength: 100 })}
        {input('postalCode', pc.postalCode, {
          required: true,
          inputMode: 'numeric',
          maxLength: 12,
        })}
        {input('countryCode', pc.country, { maxLength: 2 })}
        {input('phone', `${c.branches.phone} (${c.common.optional})`, {
          type: 'tel',
          maxLength: 32,
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
          {busy ? c.common.saving : branch ? c.common.save : c.branches.create}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.common.cancel}
        </button>
      </div>
      <Result result={result} />
    </form>
  );
}
