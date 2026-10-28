import { ImageUp, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField, TextField } from '@/features/auth/fields';
import { SIGNUP_INDUSTRIES, type SignupIndustry } from '@/features/auth/profile';
import { PROFILE_COPY } from '@/features/auth/profileCopy';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { can, controlApi, type ControlOverview, type ProfileUpdate } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY, type ControlCopy } from './copy';
import { errorText, fieldGrid } from './model';
import { CompanyMark, Fact, Facts, PageTitle, Result, Section } from './parts';

/*
 * /company/profile — the company's official details and the Head Office
 * (00000) address. Owner and System Admin edit; everyone else reads. Only
 * changed fields are sent; an emptied optional field is sent as null
 * (cleared). Older companies simply show "not set" — nothing is invented.
 */

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX = 256 * 1024;

type Form = Record<
  | 'displayName'
  | 'legalName'
  | 'englishName'
  | 'taxId'
  | 'registrationNumber'
  | 'phone'
  | 'website'
  | 'contactEmail'
  | 'industry'
  | 'addressLine1'
  | 'addressLine2'
  | 'subdistrict'
  | 'district'
  | 'province'
  | 'postalCode'
  | 'countryCode',
  string
>;

function formFrom(o: ControlOverview): Form {
  const c = o.company;
  const h = o.headOffice?.address;
  return {
    displayName: c.displayName,
    legalName: c.legalName ?? '',
    englishName: c.englishName ?? '',
    taxId: c.taxId ?? '',
    registrationNumber: c.registrationNumber ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    contactEmail: c.contactEmail ?? '',
    industry: c.industry ?? '',
    addressLine1: h?.line1 ?? '',
    addressLine2: h?.line2 ?? '',
    subdistrict: h?.subdistrict ?? '',
    district: h?.district ?? '',
    province: h?.province ?? '',
    postalCode: h?.postalCode ?? '',
    countryCode: h?.countryCode ?? 'TH',
  };
}

const ADDRESS: (keyof Form)[] = [
  'addressLine1',
  'addressLine2',
  'subdistrict',
  'district',
  'province',
  'postalCode',
  'countryCode',
];

/** Only what changed: emptied optional fields become null (cleared). */
function changes(before: Form, after: Form): ProfileUpdate {
  const body: ProfileUpdate = {};
  const opt = (
    k: 'englishName' | 'taxId' | 'registrationNumber' | 'phone' | 'website' | 'contactEmail',
  ) => {
    if (after[k].trim() !== before[k]) body[k] = after[k].trim() || null;
  };
  if (after.displayName.trim() !== before.displayName) body.displayName = after.displayName.trim();
  if (after.legalName.trim() !== before.legalName) body.legalName = after.legalName.trim();
  opt('englishName');
  opt('taxId');
  opt('registrationNumber');
  opt('phone');
  opt('website');
  opt('contactEmail');
  if (after.industry !== before.industry)
    body.industry = (after.industry || null) as SignupIndustry | null;
  if (ADDRESS.some((k) => after[k].trim() !== before[k])) {
    body.headOffice = {
      addressLine1: after.addressLine1.trim(),
      ...(after.addressLine2.trim() && { addressLine2: after.addressLine2.trim() }),
      ...(after.subdistrict.trim() && { subdistrict: after.subdistrict.trim() }),
      ...(after.district.trim() && { district: after.district.trim() }),
      province: after.province.trim(),
      postalCode: after.postalCode.trim(),
      countryCode: after.countryCode.trim().toUpperCase() || 'TH',
    };
  }
  return body;
}

/** Field-level messages from the server's validation details. */
function fieldErrors(e: unknown, c: ControlCopy): Partial<Record<keyof Form, string>> {
  if (!(e instanceof ApiError) || e.code !== 'VALIDATION_FAILED' || !Array.isArray(e.details))
    return {};
  const out: Partial<Record<keyof Form, string>> = {};
  for (const issue of e.details as { path: string }[]) {
    const key = issue.path.replace(/^headOffice\./, '') as keyof Form;
    out[key] =
      key === 'taxId'
        ? c.profile.invalid.taxId
        : key === 'phone'
          ? c.profile.invalid.phone
          : key === 'website'
            ? c.profile.invalid.website
            : key === 'contactEmail'
              ? c.profile.invalid.email
              : key === 'postalCode'
                ? c.profile.invalid.postalCode
                : c.profile.invalid.required;
  }
  return out;
}

export function ProfilePage() {
  const c = useCopy(CONTROL_COPY);
  const p = useCopy(PROFILE_COPY);
  const { overview, replace } = useControl();
  const editable = can(overview.me.capabilities, 'profile.edit');
  const [form, setForm] = useState<Form>(() => formFrom(overview));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = useId();
  const f = (k: keyof Form) => `${base}-${k}`;
  const company = overview.company;
  const ho = overview.headOffice;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const missing: Partial<Record<keyof Form, string>> = {};
    for (const k of ['displayName', 'legalName', 'addressLine1', 'province', 'postalCode'] as const)
      if (!form[k].trim()) missing[k] = c.profile.invalid.required;
    setErrors(missing);
    if (Object.keys(missing).length) {
      document.getElementById(f(Object.keys(missing)[0] as keyof Form))?.focus();
      return;
    }
    const body = changes(formFrom(overview), form);
    if (!Object.keys(body).length) {
      setResult({ tone: 'success', text: c.profile.nothing });
      return;
    }
    setBusy(true);
    try {
      const next = await controlApi.updateProfile(body);
      replace(next);
      setForm(formFrom(next));
      setResult({ tone: 'success', text: c.profile.saved });
    } catch (err) {
      const fields = fieldErrors(err, c);
      setErrors(fields);
      setResult({ tone: 'error', text: errorText(err, c) });
      const first = Object.keys(fields)[0] as keyof Form | undefined;
      if (first) document.getElementById(f(first))?.focus();
    } finally {
      setBusy(false);
    }
  };

  const input = (
    k: keyof Form,
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
    <div className="grid gap-8">
      <PageTitle title={c.profile.title} lead={c.profile.lead} />
      <LogoEditor editable={editable} />
      {!editable ? (
        <>
          <Notice tone="info">{c.shell.readOnly}</Notice>
          <Section id="identity-title" title={c.profile.identity}>
            <Facts>
              <Fact term={c.profile.displayName}>{company.displayName}</Fact>
              <Fact term={c.profile.legalName}>{company.legalName ?? c.common.notSet}</Fact>
              <Fact term={c.profile.englishName}>{company.englishName ?? c.common.notSet}</Fact>
              <Fact term={c.profile.taxId}>{company.taxId ?? c.common.notSet}</Fact>
              <Fact term={c.profile.industry}>
                {company.industry ? p.business.industries[company.industry] : c.common.notSet}
              </Fact>
            </Facts>
          </Section>
          <Section id="contact-title" title={c.profile.contact}>
            <Facts>
              <Fact term={c.profile.phone}>{company.phone ?? c.common.notSet}</Fact>
              <Fact term={c.profile.website}>{company.website ?? c.common.notSet}</Fact>
              <Fact term={c.profile.contactEmail}>{company.contactEmail ?? c.common.notSet}</Fact>
              {ho && (
                <Fact term={c.profile.address}>
                  {[
                    ho.address.line1,
                    ho.address.line2,
                    ho.address.subdistrict,
                    ho.address.district,
                    ho.address.province,
                    ho.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Fact>
              )}
            </Facts>
          </Section>
        </>
      ) : (
        <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-8" data-profile-form>
          <Section id="identity-title" title={c.profile.identity}>
            <div className={fieldGrid}>
              {input('displayName', c.profile.displayName, { required: true, maxLength: 120 })}
              {input('legalName', c.profile.legalName, { required: true, maxLength: 200 })}
              {input('englishName', `${c.profile.englishName} (${c.common.optional})`, {
                maxLength: 200,
              })}
              {input('taxId', `${c.profile.taxId} (${c.common.optional})`, {
                hint: c.profile.taxIdHint,
                inputMode: 'numeric',
                maxLength: 30,
              })}
              {input(
                'registrationNumber',
                `${c.profile.registrationNumber} (${c.common.optional})`,
                {
                  maxLength: 40,
                },
              )}
              <SelectField
                id={f('industry')}
                label={`${c.profile.industry} (${c.common.optional})`}
                value={form.industry}
                onChange={(e) => setForm((v) => ({ ...v, industry: e.target.value }))}
              >
                <option value="">{c.profile.choose}</option>
                {SIGNUP_INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {p.business.industries[i]}
                  </option>
                ))}
              </SelectField>
            </div>
          </Section>
          <Section id="contact-title" title={c.profile.contact}>
            <div className={fieldGrid}>
              {input('phone', `${c.profile.phone} (${c.common.optional})`, {
                type: 'tel',
                autoComplete: 'tel',
                maxLength: 32,
              })}
              {input('website', `${c.profile.website} (${c.common.optional})`, {
                type: 'url',
                inputMode: 'url',
                maxLength: 200,
              })}
              {input('contactEmail', `${c.profile.contactEmail} (${c.common.optional})`, {
                type: 'email',
                autoComplete: 'email',
                maxLength: 254,
              })}
            </div>
          </Section>
          <Section id="address-title" title={c.profile.address}>
            <div className={fieldGrid}>
              {input('addressLine1', c.profile.addressLine1, {
                required: true,
                maxLength: 200,
                className: 'sm:col-span-2',
              })}
              {input('addressLine2', `${c.profile.addressLine2} (${c.common.optional})`, {
                maxLength: 200,
                className: 'sm:col-span-2',
              })}
              {input('subdistrict', `${c.profile.subdistrict} (${c.common.optional})`, {
                maxLength: 100,
              })}
              {input('district', `${c.profile.district} (${c.common.optional})`, {
                maxLength: 100,
              })}
              {input('province', c.profile.province, { required: true, maxLength: 100 })}
              {input('postalCode', c.profile.postalCode, {
                required: true,
                inputMode: 'numeric',
                maxLength: 12,
              })}
              {input('countryCode', c.profile.country, { maxLength: 2, autoComplete: 'country' })}
            </div>
          </Section>
          <div className="grid gap-3 sm:flex sm:items-center">
            <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
              {busy ? c.common.saving : c.common.save}
            </button>
            <Result result={result} />
          </div>
        </form>
      )}
    </div>
  );
}

/** Logo upload: raster only, checked here for size/type and again (by its bytes) by the server. */
function LogoEditor({ editable }: { editable: boolean }) {
  const c = useCopy(CONTROL_COPY);
  const { overview, reload } = useControl();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const inputId = useId();
  const logo = overview.company.logo;

  const upload = async (file: File) => {
    setResult(null);
    if (!LOGO_TYPES.includes(file.type)) {
      setResult({ tone: 'error', text: c.errors.LOGO_TYPE });
      return;
    }
    if (file.size > LOGO_MAX) {
      setResult({ tone: 'error', text: c.errors.LOGO_TOO_LARGE });
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      await controlApi.uploadLogo(file.type, btoa(binary));
      await reload();
      setResult({ tone: 'success', text: c.profile.logoSaved });
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setResult(null);
    try {
      await controlApi.removeLogo();
      await reload();
      setResult({ tone: 'success', text: c.profile.logoRemoved });
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="logo-title" title={c.profile.logo}>
      <div className="flex flex-wrap items-center gap-5" data-logo-editor>
        <CompanyMark name={overview.company.displayName} logo={logo} size="lg" />
        <div className="grid min-w-0 flex-1 gap-3">
          <p className="text-caption text-text-muted">
            {logo ? c.profile.logoHint : c.profile.logoNone}
          </p>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                id={inputId}
                type="file"
                accept={LOGO_TYPES.join(',')}
                hidden
                tabIndex={-1}
                aria-hidden
                data-logo-input
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className={buttonClasses('secondary', 'md')}
              >
                <ImageUp aria-hidden className="size-4" />
                {busy
                  ? c.profile.logoUploading
                  : logo
                    ? c.profile.logoReplace
                    : c.profile.logoUpload}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className={buttonClasses('ghost', 'md')}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {c.profile.logoRemove}
                </button>
              )}
            </div>
          )}
          {editable && !logo && (
            <p className="text-caption text-text-muted">{c.profile.logoHint}</p>
          )}
          <Result result={result} />
        </div>
      </div>
    </Section>
  );
}
