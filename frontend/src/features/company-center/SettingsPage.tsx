import { useId, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import type { Locale } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { controlApi, type CompanySettings } from './api';
import { RequirePermission } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useLoad } from './model';
import { Loading, PageTitle, Result, Section } from './parts';

/*
 * /company/settings — only settings the system really uses today: the
 * company time zone (dates in invitation emails) and the default language
 * (of invitation emails). Closing the company is not self-service.
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
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  return <SettingsForm initial={state.data} />;
}

function SettingsForm({ initial }: { initial: CompanySettings }) {
  const c = useCopy(CONTROL_COPY);
  const { reload } = useControl();
  const base = useId();
  const [saved, setSaved] = useState(initial);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [language, setLanguage] = useState<Locale>(initial.defaultLocale);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const zones = ZONES.includes(saved.timezone) ? ZONES : [saved.timezone, ...ZONES];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Partial<CompanySettings> = {};
    if (timezone !== saved.timezone) body.timezone = timezone;
    if (language !== saved.defaultLocale) body.defaultLocale = language;
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
