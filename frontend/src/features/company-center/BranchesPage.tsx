import { ChevronRight, Plus, Search } from 'lucide-react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { TextField } from '@/features/auth/fields';
import type { BranchInfo } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import { BranchCode, BranchStatusPill, FieldGroup, StatusRail } from './adminParts';
import { controlApi, type BranchInput, type BranchList } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import {
  branchFields,
  emptyBranch,
  errorText,
  fieldGrid,
  useDateFormat,
  useDepartmentName,
  locationSummary,
  useLoad,
  type BranchFields,
} from './model';
import { AreaLink, Loading, PageTitle, Pill, Result, Section } from './parts';

/*
 * /company/branches (EP25; EP26: an operational list). Every branch of the
 * company, Head Office first: code, name, status, where it is, how many
 * people can work there and which departments they bring, and when it last
 * changed. Each row opens the branch detail (/company/branches/:id), where it
 * is edited, deactivated or reactivated. Owner and System Admin add branches;
 * everyone else reads. The Head Office (00000) is never deactivated or removed
 * (the server and the database refuse it too); codes are fixed once created.
 */

/** Rows shown before "Show more" — branch lists stay light even for large companies. */
const PAGE = 50;

export function BranchesPage() {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const { reload: reloadOverview } = useControl();
  const { state, reload } = useLoad(controlApi.branches);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const searchId = useId();

  const rows = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = search.trim().toLowerCase();
    if (!q) return state.data.branches;
    return state.data.branches.filter((b) =>
      [b.code, b.name, b.address.province, b.address.district ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [state, search]);

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const list: BranchList = state.data;
  const active = list.branches.filter((b) => b.status === 'ACTIVE').length;

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
            initial={emptyBranch}
            suggestedCode={list.suggestedCode}
            onCancel={() => setCreating(false)}
            onSaved={(b) => {
              setCreating(false);
              setNotice({ tone: 'success', text: c.branches.created(b.code) });
              void Promise.all([reload(), reloadOverview()]).catch(() => undefined);
            }}
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
        {list.branches.length > 8 && (
          <div className="mb-4 max-w-sm">
            <label htmlFor={searchId} className="sr-only">
              {a.branchList.search}
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              />
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder={a.branchList.search}
                className="min-h-11 w-full rounded-xl bg-white/[0.04] py-2 pr-3 pl-9 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                data-branch-search
              />
            </div>
          </div>
        )}
        <BranchRows rows={rows.slice(0, limit)} />
        {rows.length === 0 && (
          <p className="py-4 text-label text-text-secondary">{a.branchList.none}</p>
        )}
        {rows.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className={buttonClasses('secondary', 'md', 'mt-4')}
          >
            {a.branchList.showMore}
          </button>
        )}
        <p className="mt-4 text-caption text-text-muted">{c.branches.headOfficeNote}</p>
      </Section>
    </div>
  );
}

function BranchRows({ rows }: { rows: BranchList['branches'] }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  return (
    <div className="grid gap-1.5">
      {/* Column heads for the dense desktop rows (the rows read on their own too). */}
      <div
        aria-hidden
        className="hidden grid-cols-[4.5rem_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_1.25rem] gap-4 px-4 pb-1 text-caption text-text-muted lg:grid"
      >
        <span />
        <span>{a.branchList.columns.branch}</span>
        <span>{a.branchList.columns.status}</span>
        <span>{a.branchList.columns.people}</span>
        <span>{a.branchList.columns.departments}</span>
        <span>{a.branchList.columns.updated}</span>
        <span />
      </div>
      <ul className="grid gap-1.5" data-branch-list>
        {rows.map((b) => {
          const head = b.type === 'HEAD_OFFICE';
          return (
            <li key={b.id} data-branch={b.code} data-status={b.status}>
              <AreaLink
                to={`/company/branches/${encodeURIComponent(b.id)}`}
                className={cn(
                  'relative grid gap-x-4 gap-y-1.5 rounded-xl py-3 pr-3 pl-4 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none lg:grid-cols-[4.5rem_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_1.25rem] lg:items-center',
                  b.status === 'ACTIVE' ? 'bg-white/[0.02]' : 'opacity-80',
                )}
              >
                <StatusRail active={b.status === 'ACTIVE'} />
                <span className="flex items-center gap-2 lg:block">
                  <BranchCode code={b.code} head={head} />
                  <span className="lg:hidden">
                    <BranchStatusPill status={b.status} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold break-words text-text-primary">
                      {b.name}
                    </span>
                    {head && <Pill tone="teal">{c.branches.headOffice}</Pill>}
                  </span>
                  <span className="block text-caption break-words text-text-muted">
                    {locationSummary(b)}
                  </span>
                </span>
                <span className="max-lg:hidden">
                  <BranchStatusPill status={b.status} />
                </span>
                <span className="text-caption text-text-secondary">
                  <span className="text-text-muted lg:hidden">{a.branchList.columns.people}: </span>
                  {a.branchList.people(b.access.people)}
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {b.access.departments.length ? (
                    b.access.departments.map((d) => (
                      <Pill key={d} tone="muted">
                        {deptName(d)}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-caption text-text-muted">
                      {a.branchList.noDepartments}
                    </span>
                  )}
                </span>
                <span className="text-caption text-text-muted">
                  {b.updatedAt && (
                    <>
                      <span className="lg:hidden">{a.branchList.columns.updated}: </span>
                      {date(b.updatedAt)}
                    </>
                  )}
                </span>
                <ChevronRight
                  aria-hidden
                  className="absolute top-3.5 right-3 size-4 text-text-muted lg:static"
                />
                <span className="sr-only">{a.branchList.open(b.name)}</span>
              </AreaLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Create or edit a branch, in three groups: Identity, Address, Contact.
 * Status is managed on the branch detail. Thai address order: house number /
 * street, sub-district (แขวง / ตำบล), district (เขต / อำเภอ), province,
 * postcode. The server validates again (postcode by country, phone format).
 */
export function BranchForm({
  initial,
  branch,
  suggestedCode,
  onCancel,
  onSaved,
}: {
  initial: BranchFields;
  branch?: BranchInfo;
  suggestedCode: string | null;
  onCancel: () => void;
  onSaved: (b: BranchInfo) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const pc = c.profile;
  const [form, setForm] = useState<BranchFields>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof BranchFields, string>>>({});
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = useId();
  const f = (k: keyof BranchFields) => `${base}-${k}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const missing: Partial<Record<keyof BranchFields, string>> = {};
    for (const k of ['name', 'addressLine1', 'province', 'postalCode'] as const)
      if (!form[k].trim()) missing[k] = pc.invalid.required;
    if (!branch && form.code.trim() && !/^\d{5}$/.test(form.code.trim()))
      missing.code = c.branches.codeHint(suggestedCode ?? '00001');
    setErrors(missing);
    if (Object.keys(missing).length) {
      document.getElementById(f(Object.keys(missing)[0] as keyof BranchFields))?.focus();
      return;
    }
    const trimmed = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v.trim()]),
    ) as BranchFields;
    setBusy(true);
    try {
      let saved: BranchInfo;
      if (branch) {
        const body: Partial<BranchInput> = {};
        const before = branchFields(branch);
        for (const k of Object.keys(trimmed) as (keyof BranchFields)[]) {
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
        const next: Partial<Record<keyof BranchFields, string>> = {};
        for (const d of err.details as { path: string }[]) {
          const k = d.path as keyof BranchFields;
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
    k: keyof BranchFields,
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
      className="grid gap-7"
      data-branch-form={branch ? 'edit' : 'new'}
    >
      <FieldGroup legend={a.branchForm.identity}>
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
        </div>
      </FieldGroup>
      <FieldGroup legend={a.branchForm.address}>
        <div className={fieldGrid}>
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
        </div>
      </FieldGroup>
      <FieldGroup legend={a.branchForm.contact}>
        <div className={fieldGrid}>
          {input('phone', `${c.branches.phone} (${c.common.optional})`, {
            type: 'tel',
            maxLength: 32,
          })}
        </div>
      </FieldGroup>
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
