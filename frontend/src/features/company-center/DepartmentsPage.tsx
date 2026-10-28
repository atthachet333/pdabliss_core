import { EyeOff } from 'lucide-react';
import { useState } from 'react';

import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { Notice } from '@/features/auth/AuthFrame';
import { departmentId, DEPARTMENT_CODES, type DepartmentCode } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { controlApi, type DepartmentConfig } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useLoad } from './model';
import { AreaLink, Loading, PageTitle, Pill, Result, Section } from './parts';

/*
 * /company/departments — the six CORE departments and what this company has
 * enabled. The screen guides (limit meter, Executive only from Business), but
 * the server decides: the same package rules are enforced on save. Disabling
 * is soft — assignments stay — and every change is audited.
 */
export function DepartmentsPage() {
  const c = useCopy(CONTROL_COPY);
  const { locale } = useLocale();
  const { reload: reloadOverview } = useControl();
  const { state, set } = useLoad(controlApi.departments);
  const [draft, setDraft] = useState<DepartmentCode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const cfg: DepartmentConfig = state.data;
  const selected = draft ?? cfg.enabled;
  const max = cfg.entitlements?.maxDepartments ?? 'CUSTOM';
  const maxNumber = max === 'CUSTOM' ? DEPARTMENT_CODES.length : max;
  const maxLabel = max === 'CUSTOM' ? c.departments.custom : String(max);
  const atLimit = selected.length >= maxNumber;
  const changed = draft !== null && [...draft].sort().join() !== [...cfg.enabled].sort().join();

  const toggle = (code: DepartmentCode) => {
    setResult(null);
    setDraft(selected.includes(code) ? selected.filter((d) => d !== code) : [...selected, code]);
  };

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const next = await controlApi.setDepartments(selected);
      set(next);
      setDraft(null);
      setResult({ tone: 'success', text: c.departments.saved });
      void reloadOverview().catch(() => undefined);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8">
      <PageTitle title={c.departments.title} lead={c.departments.lead} />
      {!cfg.canManage && <Notice tone="info">{c.shell.readOnly}</Notice>}

      <Section
        id="departments-list-title"
        title={c.departments.title}
        aside={
          <span className="text-caption text-text-muted" data-department-usage>
            {c.departments.used(selected.length, maxLabel)}
          </span>
        }
      >
        <div aria-hidden className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-brand-primary transition-[width] motion-reduce:transition-none"
            style={{ width: `${Math.min(100, (selected.length / maxNumber) * 100)}%` }}
          />
        </div>
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" data-department-config>
          {cfg.departments.map((d) => {
            const info = getDepartment(departmentId(d.code), locale);
            const on = selected.includes(d.code);
            const blocked = d.state === 'NOT_IN_PACKAGE';
            const disabled = !cfg.canManage || blocked || busy || (!on && atLimit);
            const inputId = `dept-${d.code}`;
            return (
              <li
                key={d.code}
                data-department={d.code}
                data-state={on ? 'ENABLED' : d.state === 'ENABLED' ? 'AVAILABLE' : d.state}
                className={cn(
                  'flex gap-4 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
                  on && 'bg-brand-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22)]',
                  blocked && 'opacity-70',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl',
                    on
                      ? 'bg-brand-primary/[0.14] text-brand-soft'
                      : 'bg-white/[0.05] text-text-muted',
                  )}
                >
                  <info.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={inputId}
                    className="block text-label font-semibold text-text-primary"
                  >
                    {info.name}
                  </label>
                  <p className="mt-0.5 text-caption text-text-muted">{info.purpose}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone={on ? 'teal' : blocked ? 'warning' : 'muted'}>
                      {on
                        ? c.departments.states.ENABLED
                        : c.departments.states[blocked ? 'NOT_IN_PACKAGE' : 'AVAILABLE']}
                    </Pill>
                    {d.state === 'ENABLED' && (
                      <Pill tone="muted">{c.departments.assigned(d.assigned)}</Pill>
                    )}
                  </p>
                  {blocked && (
                    <p className="mt-2 text-caption text-text-muted">
                      {c.departments.executiveOnly}
                    </p>
                  )}
                  {d.code === 'WAREHOUSE' && (
                    <p className="mt-2 flex items-start gap-1.5 text-caption text-text-secondary">
                      <EyeOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {c.departments.warehouse}
                    </p>
                  )}
                </div>
                {cfg.canManage && (
                  <input
                    id={inputId}
                    type="checkbox"
                    role="switch"
                    aria-checked={on}
                    checked={on}
                    disabled={disabled}
                    onChange={() => toggle(d.code)}
                    className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/[0.12] transition-colors before:block before:size-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-text-primary before:transition-transform checked:bg-brand-primary checked:before:translate-x-[1.375rem] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none motion-reduce:before:transition-none"
                    data-toggle={d.code}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {cfg.canManage && atLimit && (
          <p className="mt-4 text-caption text-text-muted" role="status">
            {c.departments.limitReached}
          </p>
        )}
      </Section>

      {cfg.canManage && (
        <div className="grid gap-3">
          <p className="text-caption text-text-muted">{c.departments.disableNote}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!changed || busy}
              onClick={() => void save()}
              className={buttonClasses('primary', 'md')}
              data-save-departments
            >
              {busy ? c.common.saving : c.departments.save}
            </button>
            {changed && (
              <button
                type="button"
                onClick={() => setDraft(null)}
                className={buttonClasses('ghost', 'md')}
              >
                {c.common.cancel}
              </button>
            )}
            <AreaLink
              to="/contact"
              className="inline-flex min-h-6 items-center text-caption text-brand-soft underline underline-offset-4"
            >
              {c.departments.upgrade}
            </AreaLink>
          </div>
          <Result result={result} />
        </div>
      )}
    </div>
  );
}
