import { Building2, Check, CircleCheck, CircleDashed, CircleDot, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { Panel } from '@/features/account/PortalShell';
import { planIntent, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError } from '@/features/auth/errors';
import { FieldError, TextField } from '@/features/auth/fields';
import { formatNumber, getPlan } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  companyApi,
  departmentId,
  DEPARTMENT_CODES,
  PLAN_CODES,
  planCode,
  planId,
  type CompanyInfo,
  type CreateCompanyRequest,
  type DepartmentCode,
  type Onboarding,
  type PlanCode,
} from './api';
import { COMPANY_COPY, type CompanyCopy } from './copy';

/*
 * Company onboarding in the Account Portal (EP24):
 *   verified → choose a package → create the company (Head Office, departments)
 *   → subscription awaiting activation → active.
 * The page states each position honestly: nothing is paid in EP24, and the
 * Company Control Center is the next phase. The server enforces every rule;
 * the limits shown here only help people choose.
 */

/** Plan facts for display, from the frozen public pricing (parity-tested with the API catalog). */
const facts = (code: PlanCode) => getPlan(planId(code));
const maxDepartments = (code: PlanCode) => {
  const limit = facts(code).departmentLimit;
  return typeof limit === 'number' ? limit : limit === 'all' ? 6 : null;
};

export function CompanyOnboarding({ identity }: { identity: Identity }) {
  const c = useCopy(COMPANY_COPY);
  const a = useCopy(AUTH_COPY);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; onboarding: Onboarding }
  >({ status: 'loading' });

  // State changes only when the request settles (no synchronous setState in the effect).
  const load = useCallback(
    () =>
      companyApi.onboarding().then(
        (onboarding) => setState({ status: 'ready', onboarding }),
        () => setState({ status: 'error' }),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const retry = () => {
    setState({ status: 'loading' });
    void load();
  };

  if (state.status === 'loading') {
    return (
      <Panel id="company-title" title={c.summary.title}>
        <p role="status" className="flex items-center gap-2 text-caption text-text-muted">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          {c.summary.loading}
        </p>
      </Panel>
    );
  }
  if (state.status === 'error') {
    return (
      <Panel id="company-title" title={c.summary.title}>
        <Notice tone="error">{c.summary.error}</Notice>
        <button
          type="button"
          onClick={retry}
          className={`${buttonClasses('secondary', 'md')} mt-4`}
        >
          {c.summary.retry}
        </button>
      </Panel>
    );
  }

  const { onboarding } = state;
  const stage = onboarding.stage;
  if (stage === 'PLATFORM_OPERATOR') return null;

  return (
    <div className="grid gap-5 lg:col-span-2" data-onboarding-stage={stage}>
      <Progress stage={stage} c={c} />
      {stage === 'NEEDS_PACKAGE' || stage === 'NEEDS_COMPANY' ? (
        <SetupFlow identity={identity} onboarding={onboarding} onDone={load} c={c} a={a} />
      ) : (
        <CompanySummary c={c} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ progress */

function Progress({ stage, c }: { stage: Onboarding['stage']; c: CompanyCopy }) {
  const position =
    stage === 'NEEDS_PACKAGE'
      ? 1
      : stage === 'NEEDS_COMPANY'
        ? 2
        : stage === 'PENDING_ACTIVATION'
          ? 3
          : 4;
  const steps = [
    c.progress.verified,
    c.progress.package,
    c.progress.company,
    c.progress.activation,
  ];
  return (
    <nav aria-label={c.progress.label}>
      <ol className="grid gap-2 sm:grid-cols-4" data-progress={position}>
        {steps.map((label, i) => {
          const done = i < position;
          const current = i === position;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-caption',
                current
                  ? 'bg-brand-primary/[0.08] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                  : done
                    ? 'text-text-secondary'
                    : 'text-text-muted',
              )}
            >
              {done ? (
                <CircleCheck aria-hidden className="size-4 shrink-0 text-brand-soft" />
              ) : current ? (
                <CircleDot aria-hidden className="size-4 shrink-0 text-brand-glow" />
              ) : (
                <CircleDashed aria-hidden className="size-4 shrink-0" />
              )}
              <span className="min-w-0">
                {label}
                <span className="sr-only">
                  {' — '}
                  {done ? c.progress.done : current ? c.progress.current : c.progress.todo}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* --------------------------------------------------------- package + company */

function SetupFlow({
  identity,
  onboarding,
  onDone,
  c,
  a,
}: {
  identity: Identity;
  onboarding: Onboarding;
  onDone: () => Promise<void>;
  c: CompanyCopy;
  a: typeof AUTH_COPY.th;
}) {
  const [params] = useSearchParams();
  // A plan chosen on /pricing travels along as ?plan= or as the registration intent.
  const fromUrl = planIntent(params.get('plan'));
  const fromIntent = planIntent(identity.onboarding.planIntent);
  const [changing, setChanging] = useState(false);
  // A different plan picked on /pricing than the one saved is offered once (preselected).
  const [urlHandled, setUrlHandled] = useState(false);
  const chosen = onboarding.selectedPlan;
  const urlDiffers = !!fromUrl && planCode(fromUrl) !== chosen && !urlHandled;
  const showPackages = !chosen || changing || urlDiffers;
  const suggested: PlanCode = fromUrl
    ? planCode(fromUrl)
    : (chosen ?? (fromIntent ? planCode(fromIntent) : 'BUSINESS'));

  return showPackages ? (
    <PackageStep
      initial={suggested}
      fromPricing={fromUrl ? planCode(fromUrl) : null}
      onChosen={async () => {
        setChanging(false);
        setUrlHandled(true);
        await onDone();
      }}
      c={c}
      a={a}
    />
  ) : (
    <CompanyForm
      plan={chosen!}
      suggestedName={identity.user.signup?.companyName ?? ''}
      onChangePlan={() => setChanging(true)}
      onCreated={onDone}
      c={c}
      a={a}
    />
  );
}

function PackageStep({
  initial,
  fromPricing,
  onChosen,
  c,
  a,
}: {
  initial: PlanCode;
  fromPricing: PlanCode | null;
  onChosen: () => Promise<void>;
  c: CompanyCopy;
  a: typeof AUTH_COPY.th;
}) {
  const { href } = useLocale();
  const [plan, setPlan] = useState<PlanCode>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await companyApi.selectPackage(plan);
      await onChosen();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status >= 500 ? commonError(err, a) : c.package.error,
      );
      setBusy(false);
    }
  };

  return (
    <Panel id="package-title" title={c.package.title}>
      <form noValidate onSubmit={submit} data-package-step>
        <p className="text-label text-text-secondary">{c.package.lead}</p>
        {fromPricing && (
          <p className="mt-3 text-caption text-brand-soft" data-from-pricing={fromPricing}>
            {c.package.fromPricing(facts(fromPricing).name)}
          </p>
        )}
        <fieldset className="mt-5">
          <legend className="sr-only">{c.package.legend}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAN_CODES.map((code) => {
              const p = facts(code);
              const max = maxDepartments(code);
              const on = plan === code;
              return (
                <label
                  key={code}
                  data-plan-option={code}
                  className={cn(
                    'relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl p-4 transition-[background-color,box-shadow] duration-200 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-glow motion-reduce:transition-none',
                    on
                      ? 'bg-brand-primary/[0.08] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]'
                      : 'bg-white/[0.02] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:bg-white/[0.04]',
                  )}
                >
                  <input
                    type="radio"
                    name={name}
                    value={code}
                    checked={on}
                    onChange={() => setPlan(code)}
                    className="sr-only"
                  />
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold text-text-primary">{p.name}</span>
                    {p.recommended && (
                      <span className="rounded-full bg-brand-primary/15 px-2 py-0.5 text-caption text-brand-soft">
                        {c.package.recommended}
                      </span>
                    )}
                    {on && <Check aria-hidden className="ml-auto size-4 text-brand-glow" />}
                  </span>
                  <span className="text-label font-medium text-text-primary">
                    {p.monthlyPrice === null
                      ? c.package.quotation
                      : c.package.perMonth(formatNumber(p.monthlyPrice))}
                  </span>
                  <span className="text-caption leading-relaxed text-text-secondary">
                    {max === null
                      ? c.package.customDepartments
                      : max === 6
                        ? c.package.allDepartments
                        : c.package.departments(max)}
                    {' · '}
                    {p.storageGb === null
                      ? c.package.customStorage
                      : c.package.storage(p.storageGb)}
                    {' · '}
                    {p.executiveAccess ? c.package.executive : c.package.noExecutive}
                    {' · '}
                    {
                      c.package.api[
                        p.api === 'no' ? 'NONE' : p.api === 'addon' ? 'ADD_ON' : 'INCLUDED'
                      ]
                    }
                    {' · '}
                    {c.package.allBranches}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {plan === 'ENTERPRISE' && (
          <p className="mt-4 text-caption text-text-secondary" data-enterprise-note>
            {c.package.enterpriseNote}{' '}
            <Link
              to={href('/contact?interest=enterprise&plan=enterprise')}
              className="inline-flex min-h-11 items-center text-brand-soft underline underline-offset-4"
            >
              {c.package.contact}
            </Link>
          </p>
        )}
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
            {busy ? c.package.submitting : c.package.submit}
          </button>
          <span className="text-caption text-text-muted">{c.package.noCharge}</span>
        </div>
      </form>
    </Panel>
  );
}

type FieldKey =
  | 'legalName'
  | 'displayName'
  | 'taxId'
  | 'registrationNumber'
  | 'hoName'
  | 'addressLine1'
  | 'addressLine2'
  | 'subdistrict'
  | 'district'
  | 'province'
  | 'postalCode'
  | 'phone';

const REQUIRED: FieldKey[] = ['legalName', 'displayName', 'addressLine1', 'province', 'postalCode'];

/** Client mirror of the server's Thai tax-ID check (the server stays authoritative). */
function taxIdOk(value: string) {
  const d = value.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** Maps a server validation path to a form field. */
const SERVER_PATHS: Record<string, FieldKey> = {
  legalName: 'legalName',
  displayName: 'displayName',
  taxId: 'taxId',
  registrationNumber: 'registrationNumber',
  'headOffice.name': 'hoName',
  'headOffice.addressLine1': 'addressLine1',
  'headOffice.addressLine2': 'addressLine2',
  'headOffice.subdistrict': 'subdistrict',
  'headOffice.district': 'district',
  'headOffice.province': 'province',
  'headOffice.postalCode': 'postalCode',
  'headOffice.phone': 'phone',
};

function CompanyForm({
  plan,
  suggestedName,
  onChangePlan,
  onCreated,
  c,
  a,
}: {
  plan: PlanCode;
  /** EP24.1: the name given at sign-up, as a starting point the owner can change. */
  suggestedName: string;
  onChangePlan: () => void;
  onCreated: () => Promise<void>;
  c: CompanyCopy;
  a: typeof AUTH_COPY.th;
}) {
  const { locale } = useLocale();
  const f = c.form;
  const max = maxDepartments(plan);
  const executiveAllowed = facts(plan).executiveAccess;
  const quotation = facts(plan).cta === 'quote';
  const [values, setValues] = useState<Record<FieldKey, string>>({
    legalName: suggestedName,
    displayName: suggestedName,
    taxId: '',
    registrationNumber: '',
    hoName: '',
    addressLine1: '',
    addressLine2: '',
    subdistrict: '',
    district: '',
    province: '',
    postalCode: '',
    phone: '',
  });
  const [departments, setDepartments] = useState<DepartmentCode[]>(
    max === 6 ? [...DEPARTMENT_CODES] : [],
  );
  const [billing, setBilling] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'departments', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const billingName = useId();

  const set = (k: FieldKey) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const limitReached = max !== null && departments.length >= max;
  const toggle = (code: DepartmentCode) =>
    setDepartments((d) => (d.includes(code) ? d.filter((x) => x !== code) : [...d, code]));

  const focusFirst = (keys: string[]) => {
    const order: (FieldKey | 'departments')[] = [
      'legalName',
      'displayName',
      'taxId',
      'registrationNumber',
      'hoName',
      'addressLine1',
      'addressLine2',
      'subdistrict',
      'district',
      'province',
      'postalCode',
      'phone',
      'departments',
    ];
    const first = order.find((k) => keys.includes(k));
    if (first)
      document
        .getElementById(first === 'departments' ? 'company-departments-first' : `company-${first}`)
        ?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    for (const k of REQUIRED) if (!values[k].trim()) next[k] = f.errors.required;
    if (values.taxId.trim() && !taxIdOk(values.taxId)) next.taxId = f.errors.taxId;
    if (values.postalCode.trim() && !/^\d{5}$/.test(values.postalCode.trim())) {
      next.postalCode = f.errors.postalCode;
    }
    if (!quotation && departments.length === 0) next.departments = f.errors.departments;
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError(f.errors.summary);
      focusFirst(Object.keys(next));
      return;
    }
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    const body: CreateCompanyRequest = {
      legalName: values.legalName.trim(),
      displayName: values.displayName.trim(),
      taxId: opt(values.taxId),
      registrationNumber: opt(values.registrationNumber),
      headOffice: {
        name: opt(values.hoName),
        addressLine1: values.addressLine1.trim(),
        addressLine2: opt(values.addressLine2),
        subdistrict: opt(values.subdistrict),
        district: opt(values.district),
        province: values.province.trim(),
        postalCode: values.postalCode.trim(),
        countryCode: 'TH',
        phone: opt(values.phone),
      },
      // Canonical order, whatever order they were ticked in.
      departments: DEPARTMENT_CODES.filter((d) => departments.includes(d)),
      billingCycle: billing,
    };
    setBusy(true);
    try {
      await companyApi.create(body);
      await onCreated();
    } catch (err) {
      setBusy(false);
      if (!(err instanceof ApiError)) {
        setFormError(f.errors.generic);
        return;
      }
      if (err.code === 'COMPANY_EXISTS') {
        // A retried or double submit: the company exists — show it.
        await onCreated();
        return;
      }
      if (err.code === 'PACKAGE_REQUIRED') return setFormError(f.errors.packageRequired);
      if (err.code === 'DEPARTMENT_LIMIT' || err.code === 'DEPARTMENTS_REQUIRED') {
        setErrors({
          departments:
            err.code === 'DEPARTMENT_LIMIT' ? f.errors.departmentLimit : f.errors.departments,
        });
        setFormError(f.errors.summary);
        return focusFirst(['departments']);
      }
      if (err.code === 'VALIDATION_FAILED' && Array.isArray(err.details)) {
        const server: typeof errors = {};
        for (const issue of err.details as { path?: string }[]) {
          const key = issue.path ? SERVER_PATHS[issue.path] : undefined;
          if (key) {
            server[key] =
              key === 'taxId'
                ? f.errors.taxId
                : key === 'postalCode'
                  ? f.errors.postalCode
                  : f.errors.required;
          }
        }
        if (Object.keys(server).length) {
          setErrors(server);
          setFormError(f.errors.summary);
          return focusFirst(Object.keys(server));
        }
      }
      setFormError(
        err.status === 429 || err.status >= 500 ? commonError(err, a) : f.errors.generic,
      );
    }
  };

  const field = (
    k: FieldKey,
    label: string,
    opts: {
      hint?: string;
      optional?: boolean;
      autoComplete?: string;
      inputMode?: 'numeric' | 'tel';
      className?: string;
    } = {},
  ) => (
    <TextField
      id={`company-${k}`}
      label={
        opts.optional ? (
          <>
            {label} <span className="font-normal text-text-muted">({f.optional})</span>
          </>
        ) : (
          label
        )
      }
      value={values[k]}
      onChange={set(k)}
      error={errors[k]}
      hint={opts.hint}
      autoComplete={opts.autoComplete ?? 'off'}
      inputMode={opts.inputMode}
      required={!opts.optional}
      className={opts.className}
    />
  );

  return (
    <Panel id="company-form-title" title={f.title}>
      <form noValidate onSubmit={submit} data-company-form className="space-y-6">
        <p className="text-label text-text-secondary">{f.lead}</p>
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3"
          data-chosen-plan={plan}
        >
          <span className="text-caption text-text-muted">{f.planLabel}</span>
          <span className="text-label font-semibold text-text-primary">{facts(plan).name}</span>
          <button
            type="button"
            onClick={onChangePlan}
            className="ml-auto inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
          >
            {f.changePlan}
          </button>
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-label font-semibold text-text-primary">
            {f.companyLegend}
          </legend>
          {field('legalName', f.legalName, {
            hint: f.legalNameHint,
            autoComplete: 'organization',
            className: 'sm:col-span-2',
          })}
          {field('displayName', f.displayName, { hint: f.displayNameHint })}
          {field('taxId', f.taxId, { hint: f.taxIdHint, optional: true, inputMode: 'numeric' })}
          {field('registrationNumber', f.registrationNumber, {
            hint: f.registrationNumberHint,
            optional: true,
          })}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-label font-semibold text-text-primary">
            {f.headOfficeLegend}
          </legend>
          <p className="text-caption text-text-muted sm:col-span-2">{f.headOfficeNote}</p>
          {field('hoName', f.headOfficeName, {
            hint: f.headOfficeNameHint,
            optional: true,
            className: 'sm:col-span-2',
          })}
          {field('addressLine1', f.addressLine1, {
            autoComplete: 'address-line1',
            className: 'sm:col-span-2',
          })}
          {field('addressLine2', f.addressLine2, {
            optional: true,
            autoComplete: 'address-line2',
            className: 'sm:col-span-2',
          })}
          {field('subdistrict', f.subdistrict, { optional: true, autoComplete: 'address-level3' })}
          {field('district', f.district, { optional: true, autoComplete: 'address-level2' })}
          {field('province', f.province, { autoComplete: 'address-level1' })}
          {field('postalCode', f.postalCode, { autoComplete: 'postal-code', inputMode: 'numeric' })}
          {field('phone', f.phone, { optional: true, autoComplete: 'tel', inputMode: 'tel' })}
        </fieldset>

        <fieldset aria-describedby="company-departments-hint company-departments-error">
          <legend className="text-label font-semibold text-text-primary">
            {f.departmentsLegend}
          </legend>
          <p id="company-departments-hint" className="mt-1 text-caption text-text-muted">
            {f.departmentsHint(
              max === null
                ? f.departmentsCustom
                : max === 6
                  ? f.departmentsAll
                  : f.departmentsMax(max),
            )}
            {' · '}
            {f.lotFefo}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENT_CODES.map((code, i) => {
              const on = departments.includes(code);
              const notInPlan = code === 'EXECUTIVE' && !executiveAllowed;
              const disabled = notInPlan || (!on && limitReached);
              const name = getDepartment(departmentId(code), locale).name;
              return (
                <label
                  key={code}
                  data-department-option={code}
                  className={cn(
                    'flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-label has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-glow',
                    disabled
                      ? 'cursor-not-allowed text-text-muted'
                      : 'cursor-pointer text-text-primary',
                    on
                      ? 'bg-brand-primary/[0.08] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                      : 'bg-white/[0.02] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
                  )}
                >
                  <input
                    id={i === 0 ? 'company-departments-first' : undefined}
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={() => toggle(code)}
                    className="size-4.5 shrink-0 accent-brand-primary"
                  />
                  <span className="min-w-0">
                    {name}
                    {notInPlan && (
                      <span className="block text-caption text-text-muted">
                        {f.executiveNotIncluded}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {limitReached && max !== 6 && (
            <p className="mt-2 text-caption text-text-secondary" role="status">
              {f.limitReached}
            </p>
          )}
          {errors.departments && (
            <FieldError id="company-departments-error">{errors.departments}</FieldError>
          )}
        </fieldset>

        <fieldset aria-describedby="company-billing-hint">
          <legend className="text-label font-semibold text-text-primary">{f.billingLegend}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['MONTHLY', 'ANNUAL'] as const).map((cycle) => (
              <label
                key={cycle}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-label has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-glow',
                  billing === cycle
                    ? 'bg-brand-primary/[0.08] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                    : 'bg-white/[0.02] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
                )}
              >
                <input
                  type="radio"
                  name={billingName}
                  value={cycle}
                  checked={billing === cycle}
                  onChange={() => setBilling(cycle)}
                  className="size-4 accent-brand-primary"
                />
                {cycle === 'MONTHLY' ? f.monthly : f.annual}
              </label>
            ))}
          </div>
          <p id="company-billing-hint" className="mt-2 text-caption text-text-muted">
            {f.annualHint}
          </p>
        </fieldset>

        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
            <Building2 aria-hidden className="size-4" />
            {busy ? f.submitting : f.submit}
          </button>
          <span className="text-caption text-text-muted">{f.noCharge}</span>
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------- summary */

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-text-primary">{children}</dd>
    </>
  );
}

function CompanySummary({ c }: { c: CompanyCopy }) {
  const a = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const [info, setInfo] = useState<CompanyInfo | null | 'error'>(null);
  const load = useCallback(
    () =>
      companyApi.current().then(
        (value) => setInfo(value),
        () => setInfo('error'),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const retry = () => {
    setInfo(null);
    void load();
  };

  if (info === null) {
    return (
      <Panel id="company-title" title={c.summary.title}>
        <p role="status" className="text-caption text-text-muted">
          {c.summary.loading}
        </p>
      </Panel>
    );
  }
  if (info === 'error') {
    return (
      <Panel id="company-title" title={c.summary.title}>
        <Notice tone="error">{c.summary.error}</Notice>
        <button
          type="button"
          onClick={retry}
          className={`${buttonClasses('secondary', 'md')} mt-4`}
        >
          {c.summary.retry}
        </button>
      </Panel>
    );
  }

  const { company, subscription, entitlements, headOffice } = info;
  const s = c.summary;
  const quotation = subscription?.plan === 'ENTERPRISE';
  const message =
    company.status === 'SUSPENDED'
      ? s.suspended
      : company.status === 'CLOSED'
        ? s.closed
        : info.access.canEnterCore
          ? company.isDemo
            ? `${s.active} ${s.demoActive}`
            : s.active
          : quotation
            ? s.pendingEnterprise
            : s.pending;

  return (
    <div
      className="grid gap-5 lg:grid-cols-2"
      data-company-summary
      data-company-status={company.status}
    >
      <Panel id="company-title" title={s.title}>
        <p className="flex items-center gap-2 text-body font-semibold text-text-primary">
          <Building2 aria-hidden className="size-5 shrink-0 text-brand-soft" />
          <span className="min-w-0 break-words">{company.displayName}</span>
        </p>
        {company.isDemo && (
          <p className="mt-2 inline-flex rounded-full bg-warning/15 px-2.5 py-1 text-caption text-warning">
            {s.demo}
          </p>
        )}
        <dl className="mt-4 grid gap-2 text-label sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-6">
          <Row term={s.role}>{a.roles[info.role]}</Row>
          {company.legalName && <Row term={s.legalName}>{company.legalName}</Row>}
          {company.taxId && <Row term={s.taxId}>{company.taxId}</Row>}
          {headOffice && (
            <Row term={s.headOffice}>
              {headOffice.name} ({headOffice.code}) —{' '}
              {[
                headOffice.address.line1,
                headOffice.address.line2,
                headOffice.address.subdistrict,
                headOffice.address.district,
                headOffice.address.province,
                headOffice.address.postalCode,
              ]
                .filter(Boolean)
                .join(' ')}
            </Row>
          )}
          <Row term={s.departments}>
            {info.departments.length ? (
              <span className="flex flex-wrap gap-1.5" data-company-departments>
                {info.departments.map((d) => (
                  <span key={d} className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-caption">
                    {getDepartment(departmentId(d), locale).name}
                  </span>
                ))}
              </span>
            ) : (
              s.departmentsLater
            )}
          </Row>
          <Row term={c.platform.status}>{s.statuses[company.status]}</Row>
        </dl>
      </Panel>

      <Panel id="subscription-title" title={s.package}>
        {subscription && entitlements && (
          <>
            <p
              className="text-body font-semibold text-text-primary"
              data-subscription-plan={subscription.plan}
            >
              {facts(subscription.plan).name}
              <span className="ml-2 text-label font-normal text-text-secondary">
                {subscription.monthlyPriceThb === null
                  ? c.package.quotation
                  : c.package.perMonth(formatNumber(subscription.monthlyPriceThb))}
              </span>
            </p>
            <dl className="mt-4 grid gap-2 text-label sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-6">
              <Row term={s.subscription}>
                <span data-subscription-status={subscription.status}>
                  {s.subscriptionStatuses[subscription.status]}
                </span>
              </Row>
              <Row term={s.billingCycle}>{c.billing[subscription.billingCycle]}</Row>
              <Row term={s.storage}>
                {entitlements.storage === 'CUSTOM' ? s.custom : `${entitlements.storage.gb} GB`}
              </Row>
              <Row term={s.executive}>
                {entitlements.executiveAllowed ? s.allowed : s.notAllowed}
              </Row>
              <Row term={s.api}>{c.package.api[entitlements.api]}</Row>
            </dl>
          </>
        )}
        <p
          role="status"
          className={cn(
            'mt-4 rounded-xl p-3 text-caption leading-relaxed',
            info.access.canEnterCore
              ? 'bg-brand-primary/[0.08] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]'
              : 'bg-white/[0.04] text-text-secondary',
          )}
          data-company-message
        >
          {message}
        </p>
        {info.access.canEnterCore && (
          <p className="mt-3 text-caption text-text-muted" data-control-center="next-phase">
            {s.controlCenterSoon}
          </p>
        )}
      </Panel>
    </div>
  );
}
