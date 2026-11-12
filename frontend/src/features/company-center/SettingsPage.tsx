import { useId, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { SelectField } from '@/features/auth/fields';
import type { Locale } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import {
  controlApi,
  type ApprovalPolicy,
  type CompanySettings,
  type ManufacturingMode,
} from './api';
import { RequirePermission } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useLoad } from './model';
import { Loading, PageError, PageTitle, Result, Section } from './parts';

/*
 * /company/settings — only settings the system really uses today: the
 * company time zone (dates in invitation emails), the default language
 * (of invitation emails) and, EP41, the approval policy (owner-only); EP46, the manufacturing
 * mode (BOM required / optional, owner-only). Closing the company is not self-service.
 */

/** Common zones for CORE customers; the company's current zone is always listed. */
const ZONES = [
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Manila',
  'Asia/Yangon',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'UTC',
];

export function SettingsPage() {
  return (
    <RequirePermission permission="company.settings.manage">
      <Settings />
    </RequirePermission>
  );
}

function Settings() {
  const c = useCopy(CONTROL_COPY);
  const { state } = useLoad(controlApi.settings);
  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error')
    return <PageError error={state.error}>{errorText(state.error, c)}</PageError>;
  return <SettingsForm initial={state.data} />;
}

function SettingsForm({ initial }: { initial: CompanySettings }) {
  const c = useCopy(CONTROL_COPY);
  const { reload } = useControl();
  const base = useId();
  const [saved, setSaved] = useState(initial);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [language, setLanguage] = useState<Locale>(initial.defaultLocale);
  const [policy, setPolicy] = useState<ApprovalPolicy>(initial.approvalPolicy);
  const [mode, setMode] = useState<ManufacturingMode>(initial.manufacturingMode ?? 'BOM_REQUIRED');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const zones = ZONES.includes(saved.timezone) ? ZONES : [saved.timezone, ...ZONES];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Parameters<typeof controlApi.updateSettings>[0] = {};
    if (timezone !== saved.timezone) body.timezone = timezone;
    if (language !== saved.defaultLocale) body.defaultLocale = language;
    if (policy !== saved.approvalPolicy) body.approvalPolicy = policy;
    if (saved.manufacturingMode && mode !== saved.manufacturingMode) body.manufacturingMode = mode;
    if (!Object.keys(body).length) {
      setResult({ tone: 'success', text: c.profile.nothing });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setSaved(await controlApi.updateSettings(body));
      setResult({ tone: 'success', text: c.settings.saved });
      void reload().catch(() => undefined);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8">
      <PageTitle title={c.settings.title} lead={c.settings.lead} />
      <form
        noValidate
        onSubmit={(e) => void submit(e)}
        className="grid max-w-2xl gap-5"
        data-settings-form
      >
        <SelectField
          id={`${base}-tz`}
          label={c.settings.timezone}
          hint={c.settings.timezoneHint}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${base}-lang`}
          label={c.settings.language}
          hint={c.settings.languageHint}
          value={language}
          onChange={(e) => setLanguage(e.target.value as Locale)}
        >
          {(['th', 'en', 'zh-CN'] as const).map((l) => (
            <option key={l} value={l}>
              {c.settings.languages[l]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${base}-policy`}
          label={c.settings.approvalPolicy}
          hint={
            saved.canChangeApprovalPolicy
              ? c.settings.approvalPolicyHint
              : `${c.settings.approvalPolicyHint} · ${c.settings.approvalPolicyOwnerOnly}`
          }
          value={policy}
          disabled={!saved.canChangeApprovalPolicy}
          onChange={(e) => setPolicy(e.target.value as ApprovalPolicy)}
          data-approval-policy
        >
          {(['INDEPENDENT_APPROVAL', 'SELF_APPROVAL_ALLOWED'] as const).map((p) => (
            <option key={p} value={p}>
              {c.settings.policies[p]}
            </option>
          ))}
        </SelectField>
        {saved.manufacturingMode && (
          <SelectField
            id={`${base}-mode`}
            label={c.settings.manufacturingMode}
            hint={
              saved.canChangeManufacturingMode
                ? c.settings.manufacturingModeHint
                : `${c.settings.manufacturingModeHint} · ${c.settings.approvalPolicyOwnerOnly}`
            }
            value={mode}
            disabled={!saved.canChangeManufacturingMode}
            onChange={(e) => setMode(e.target.value as ManufacturingMode)}
            data-manufacturing-mode
          >
            {(['BOM_REQUIRED', 'BOM_OPTIONAL'] as const).map((m) => (
              <option key={m} value={m}>
                {c.settings.manufacturingModes[m]}
              </option>
            ))}
          </SelectField>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
            {busy ? c.common.saving : c.common.save}
          </button>
        </div>
        <Result result={result} />
      </form>
      <Section id="closure-title" title={c.settings.closure}>
        <p className="max-w-2xl text-label leading-relaxed text-text-secondary">
          {c.settings.closureNote}
        </p>
      </Section>
    </div>
  );
}
