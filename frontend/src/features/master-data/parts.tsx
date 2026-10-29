import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { FieldError, SelectField, TextField } from '@/features/auth/fields';
import { FieldGroup } from '@/features/company-center/adminParts';
import { Pill } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import {
  ITEM_TYPES,
  masterApi,
  type MasterContext,
  type MasterRecord,
  type Resource,
  type Tracking,
} from './api';
import { MASTER_COPY } from './copy';
import { problems, readError, type Field, type FormValues, type Group } from './schema';

/* Building blocks of the EP28 Master Data screens: status, tracking badges, the grouped form. */

export function StatusPill({ status }: { status: string }) {
  const c = useCopy(MASTER_COPY);
  return status === 'ACTIVE' ? (
    <Pill tone="teal">{c.statuses.ACTIVE}</Pill>
  ) : (
    <Pill tone="muted">{c.statuses.INACTIVE}</Pill>
  );
}

/** "PCS · ชิ้น", marked when the referenced record is inactive. */
export function RefText({ r }: { r?: { code: string; name: string; status: string } | null }) {
  const c = useCopy(MASTER_COPY);
  if (!r) return <span className="text-text-muted">{c.none}</span>;
  return (
    <span className="break-words">
      <span className="font-mono">{r.code}</span> · {r.name}
      {r.status !== 'ACTIVE' && <span className="text-text-muted"> ({c.inactive})</span>}
    </span>
  );
}

/** Stock / lot / expiry in words — never colour alone. */
export function TrackingBadges({ item }: { item: MasterRecord }) {
  const c = useCopy(MASTER_COPY);
  const level = (l?: Tracking) => (l === 'REQUIRED' ? c.levels.REQUIRED : c.levels.OPTIONAL);
  return (
    <span className="flex flex-wrap gap-1" data-tracking>
      {item.inventoryTracked ? (
        <Pill tone="neutral">{c.badge.stock}</Pill>
      ) : (
        <Pill tone="muted">{c.badge.noStock}</Pill>
      )}
      {item.lotTracking !== 'NONE' && (
        <Pill tone="teal" data-lot={item.lotTracking}>
          {c.badge.lot} · {level(item.lotTracking)}
        </Pill>
      )}
      {item.expiryTracking !== 'NONE' && (
        <Pill tone="warning" data-expiry={item.expiryTracking}>
          {c.badge.expiry} · {level(item.expiryTracking)}
        </Pill>
      )}
    </span>
  );
}

type Opt = [value: string, label: string];

/** Choices for reference fields: active records, plus the current one even if inactive. */
function useChoices(
  fields: Field[],
  values: FormValues,
  ctx: MasterContext,
  record?: MasterRecord,
): Record<string, Opt[]> {
  const c = useCopy(MASTER_COPY);
  const [lists, setLists] = useState<Record<string, MasterRecord[]>>({});
  const needs = new Set(fields.map((f) => f.options));
  const branchId =
    (typeof values.branchId === 'string' && values.branchId) || record?.branch?.id || '';
  useEffect(() => {
    const load = (key: string, r: Resource, extra: Record<string, string> = {}) =>
      masterApi
        .list(r, { status: 'ACTIVE', pageSize: 100, ...extra })
        .then((l) => setLists((s) => ({ ...s, [key]: l.items })))
        .catch(() => undefined);
    if (needs.has('units')) void load('units', 'units');
    if (needs.has('categories')) void load('categories', 'categories');
    if (needs.has('parents') && branchId) void load('parents', 'locations', { branchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);
  const refs = (key: string, current?: MasterRecord['category']) => {
    const rows = (lists[key] ?? []).filter((r) => r.id !== record?.id);
    if (current && !rows.some((r) => r.id === current.id)) rows.unshift(current as MasterRecord);
    return rows.map((r): Opt => [
      r.id,
      `${r.code} · ${r.name}${r.status === 'ACTIVE' ? '' : ` (${c.inactive})`}`,
    ]);
  };
  return {
    kinds: (['BUSINESS', 'INDIVIDUAL'] as const).map((k): Opt => [k, c.kinds[k]]),
    types: ITEM_TYPES.map((t): Opt => [t, c.types[t]]),
    levels: (['NONE', 'OPTIONAL', 'REQUIRED'] as const).map((l): Opt => [l, c.levels[l]]),
    units: refs('units', record?.baseUnit),
    categories: refs('categories', record?.category),
    parents: refs('parents', record?.parent),
    branches: ctx.branches
      .filter((b) => b.canManage)
      .map((b): Opt => [b.id, `${b.code} · ${b.name}`]),
  };
}

const GROUP_ORDER: Group[] = ['placement', 'identity', 'contact', 'address', 'tracking', 'other'];

/**
 * One grouped form for every resource. Validation runs here first and on the
 * server always; server field errors land on their field, the rest above the
 * buttons. The first invalid field receives focus.
 */
export function RecordForm({
  fields,
  initial,
  ctx,
  record,
  hints = {},
  submitLabel,
  onSubmit,
  onCancel,
}: {
  fields: Field[];
  initial: FormValues;
  ctx: MasterContext;
  record?: MasterRecord;
  hints?: Record<string, string>;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const c = useCopy(MASTER_COPY);
  const base = useId();
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = useChoices(fields, values, ctx, record);
  const idOf = (key: string) => `${base}-${key}`;
  const focusFirst = (keys: string[]) => {
    const first = fields.find((fd) => keys.includes(fd.key));
    if (first) document.getElementById(idOf(first.key))?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const local = problems(fields, values);
    const shown = Object.fromEntries(
      Object.entries(local).map(([k, p]) => [k, p === 'required' ? c.required : c.invalid]),
    );
    setErrors(shown);
    if (Object.keys(shown).length) return focusFirst(Object.keys(shown));
    setBusy(true);
    try {
      await onSubmit(values);
    } catch (err) {
      const read = readError(err, c);
      setErrors(read.fields);
      setMessage(read.message);
      focusFirst(Object.keys(read.fields));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: string, v: string | boolean) => {
    setValues((s) => ({ ...s, [key]: v, ...(key === 'branchId' ? { parentId: '' } : {}) }));
    setErrors(({ [key]: _, ...rest }) => rest);
  };

  const render = (fd: Field): ReactNode => {
    const id = idOf(fd.key);
    const label = c.f[fd.key] ?? fd.key;
    const error = errors[fd.key] ?? null;
    const value = values[fd.key];
    const hint = hints[fd.key];
    if (fd.kind === 'check') {
      return (
        <div key={fd.key} className="sm:col-span-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-label text-text-primary">
            <input
              id={id}
              type="checkbox"
              checked={value === true}
              onChange={(e) => set(fd.key, e.target.checked)}
              aria-describedby={error ? `${id}-error` : undefined}
              className="size-4 accent-[var(--color-brand-primary)]"
              data-field={fd.key}
            />
            {label}
          </label>
          {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
        </div>
      );
    }
    if (fd.kind === 'select') {
      return (
        <SelectField
          key={fd.key}
          id={id}
          label={label}
          hint={hint}
          error={error}
          value={String(value)}
          required={fd.required}
          onChange={(e) => set(fd.key, e.target.value)}
          data-field={fd.key}
        >
          {!fd.required || !value ? (
            <option value="">{fd.key === 'parentId' ? c.top : c.none}</option>
          ) : null}
          {(choices[fd.options!] ?? []).map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </SelectField>
      );
    }
    if (fd.kind === 'area') {
      return (
        <div key={fd.key} className="sm:col-span-2">
          <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
            {label}
          </label>
          <textarea
            id={id}
            value={String(value)}
            maxLength={fd.max}
            rows={3}
            onChange={(e) => set(fd.key, e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={controlClass(!!error, true)}
            data-field={fd.key}
          />
          {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
        </div>
      );
    }
    return (
      <TextField
        key={fd.key}
        id={id}
        label={label}
        hint={hint}
        error={error}
        type={fd.kind === 'number' ? 'number' : fd.kind}
        inputMode={fd.kind === 'number' ? 'numeric' : undefined}
        min={fd.kind === 'number' ? 0 : undefined}
        max={fd.kind === 'number' ? 6 : undefined}
        maxLength={fd.max}
        required={fd.required}
        autoComplete="off"
        value={String(value)}
        onChange={(e) => set(fd.key, e.target.value)}
        className={cn(fd.mono && '[&_input]:font-mono [&_input]:uppercase')}
        data-field={fd.key}
      />
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid grid-cols-1 gap-8"
      data-record-form
    >
      {GROUP_ORDER.map((g) => {
        const inGroup = fields.filter((fd) => fd.group === g);
        if (!inGroup.length) return null;
        return (
          <FieldGroup key={g} legend={c.groups[g]}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{inGroup.map(render)}</div>
          </FieldGroup>
        );
      })}
      <div aria-live="polite">{message && <Notice tone="error">{message}</Notice>}</div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
          {busy ? c.saving : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
            {c.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
