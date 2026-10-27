import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  MailCheck,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { authApi, planIntent } from './api';
import { AuthFrame, Guidance, Notice } from './AuthFrame';
import { AUTH_COPY } from './copy';
import { commonError, EMAIL_PATTERN, passwordProblem } from './errors';
import { FieldError, PasswordField, SelectField, TextField } from './fields';
import { withLocale } from './localeState';
import {
  CONTACT_PREFERENCES,
  fullNameProblem,
  JOB_FUNCTIONS,
  LINE_ID_PATTERN,
  normalizePhone,
  SIGNUP_INDUSTRIES,
  SIGNUP_INTERESTS,
  SIGNUP_TEAM_SIZES,
  type ContactPreference,
  type JobFunction,
  type SignupIndustry,
  type SignupInterest,
  type SignupTeamSize,
} from './profile';
import { PROFILE_COPY, type ProfileCopy } from './profileCopy';

/*
 * Self-registration (EP23; EP24.1 profile + business context), in two calm
 * steps sent as ONE request at the end:
 *   1. the person — full name, phone, optional job function, email, password;
 *   2. their business — company name, type, team size, how to reach them,
 *      interests, an optional note, and the terms.
 * Step 2 is lead information for PDA BLISS: it does not create the CORE
 * company (onboarding does, after verification) and nothing here grants
 * access. A plan chosen on /pricing (`?plan=business`) travels along as
 * onboarding intent only; nothing is charged.
 */

type AccountField = 'fullName' | 'phone' | 'email' | 'password' | 'confirm';
type BusinessField = 'companyName' | 'industry' | 'teamSize' | 'lineId' | 'terms';
type Errors = Partial<Record<AccountField | BusinessField, string>>;
const ACCOUNT_ORDER: AccountField[] = ['fullName', 'phone', 'email', 'password', 'confirm'];
const BUSINESS_ORDER: BusinessField[] = ['companyName', 'industry', 'teamSize', 'lineId', 'terms'];

export function RegisterForm() {
  const c = useCopy(AUTH_COPY);
  const p = useCopy(PROFILE_COPY);
  const { locale } = useLocale();
  usePageMeta(c.register.meta.title, c.register.meta.description, { index: false });
  const [params] = useSearchParams();
  const plan = planIntent(params.get('plan'));
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState({
    fullName: '',
    phone: '',
    jobFunction: '' as JobFunction | '',
    email: '',
    password: '',
    confirm: '',
  });
  const [business, setBusiness] = useState({
    companyName: '',
    industry: '' as SignupIndustry | '',
    teamSize: '' as SignupTeamSize | '',
    preferredContact: 'EMAIL' as ContactPreference,
    lineId: '',
    interests: [] as SignupInterest[],
    note: '',
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // After a step change, start at that step's heading (keyboard and screen readers).
  useEffect(() => {
    if (moved.current) stepHeading.current?.focus();
  }, [step]);

  const setA = (key: keyof typeof account) => (e: { target: { value: string } }) =>
    setAccount((v) => ({ ...v, [key]: e.target.value }));
  const setB =
    (key: 'companyName' | 'industry' | 'teamSize' | 'lineId' | 'note') =>
    (e: { target: { value: string } }) =>
      setBusiness((v) => ({ ...v, [key]: e.target.value }));

  const validateAccount = (): Errors => {
    const next: Errors = {};
    const name = fullNameProblem(account.fullName);
    if (name) {
      next.fullName = name === 'required' ? p.errors.fullNameRequired : p.errors.fullNameInvalid;
    }
    if (!account.phone.trim()) next.phone = p.errors.phoneRequired;
    else if (!normalizePhone(account.phone)) next.phone = p.errors.phoneInvalid;
    const email = account.email.trim();
    if (!email) next.email = c.common.required.email;
    else if (!EMAIL_PATTERN.test(email)) next.email = c.common.invalidEmail;
    if (!account.password) next.password = c.common.required.password;
    else {
      const problem = passwordProblem(account.password, email);
      if (problem) next.password = c.common.policy[problem];
    }
    if (!account.confirm) next.confirm = c.common.required.confirm;
    else if (account.confirm !== account.password) next.confirm = c.common.mismatch;
    return next;
  };

  const validateBusiness = (): Errors => {
    const next: Errors = {};
    const name = business.companyName.trim();
    if (name.length < 2 || /[<>]/.test(name)) next.companyName = p.business.errors.companyName;
    if (!business.industry) next.industry = p.business.errors.industry;
    if (!business.teamSize) next.teamSize = p.business.errors.teamSize;
    if (business.preferredContact === 'LINE' && !LINE_ID_PATTERN.test(business.lineId.trim())) {
      next.lineId = p.business.errors.lineId;
    }
    if (!terms) next.terms = c.common.required.terms;
    return next;
  };

  const focusFirst = (found: Errors, order: string[]) => {
    const first = order.find((k) => found[k as keyof Errors]);
    if (first) document.getElementById(`register-${first}`)?.focus();
    return !!first;
  };

  const goNext = (e: FormEvent) => {
    e.preventDefault();
    const found = validateAccount();
    setErrors(found);
    if (focusFirst(found, ACCOUNT_ORDER)) return;
    moved.current = true;
    setStep(2);
  };

  const goBack = () => {
    setErrors({});
    setFailure(null);
    moved.current = true;
    setStep(1);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateBusiness();
    setErrors(found);
    setFailure(null);
    if (focusFirst(found, BUSINESS_ORDER)) return;
    setPending(true);
    try {
      await authApi.register({
        fullName: account.fullName.trim().replace(/\s+/g, ' '),
        phone: account.phone.trim(),
        jobFunction: account.jobFunction || undefined,
        email: account.email.trim(),
        password: account.password,
        business: {
          companyName: business.companyName.trim(),
          industry: business.industry as SignupIndustry,
          teamSize: business.teamSize as SignupTeamSize,
          preferredContact: business.preferredContact,
          lineId:
            business.preferredContact === 'LINE' ? business.lineId.trim() || undefined : undefined,
          interests: business.interests,
          note: business.note.trim() || undefined,
        },
        locale,
        plan: plan ?? undefined,
        acceptTerms: true,
      });
      setSentTo(account.email.trim());
    } catch (err) {
      setFailure(commonError(err, c));
    } finally {
      setPending(false);
    }
  };

  if (sentTo) return <VerificationSent email={sentTo} />;

  const req = <RequiredMark label={p.required} />;

  return (
    <AuthFrame kicker={c.register.kicker} title={c.register.title} lead={c.register.lead} wide>
      {plan && (
        <p
          data-plan={plan}
          className="mb-5 rounded-xl bg-brand-primary/[0.08] p-3 text-caption text-brand-soft"
        >
          {c.register.plan(c.plans[plan])}
        </p>
      )}
      <Steps step={step} p={p} />

      <h2
        ref={stepHeading}
        tabIndex={-1}
        className="mt-6 text-[1.25rem] font-semibold tracking-tight text-text-primary outline-none"
        data-step-heading={step}
      >
        <span className="sr-only">{p.steps.of(step, 2)}: </span>
        {step === 1 ? p.steps.account : p.steps.business}
      </h2>
      <p className="mt-1 text-caption text-text-muted">{p.requiredNote}</p>

      {step === 1 ? (
        <form noValidate onSubmit={goNext} className="mt-6 space-y-8" data-register-step="1">
          <Group id="register-person" title={p.groups.person} lead={p.groups.personLead}>
            <TextField
              id="register-fullName"
              label={
                <>
                  {p.fullName}
                  {req}
                </>
              }
              autoComplete="name"
              maxLength={120}
              required
              value={account.fullName}
              onChange={setA('fullName')}
              error={errors.fullName}
              hint={p.fullNameHint}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="register-phone"
                label={
                  <>
                    {p.phone}
                    {req}
                  </>
                }
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
                required
                value={account.phone}
                onChange={setA('phone')}
                error={errors.phone}
                hint={p.phoneHint}
              />
              <SelectField
                id="register-jobFunction"
                label={
                  <>
                    {p.jobFunction}{' '}
                    <span className="font-normal text-text-muted">({c.common.optional})</span>
                  </>
                }
                value={account.jobFunction}
                onChange={setA('jobFunction')}
                hint={p.jobFunctionHint}
              >
                <option value="">{p.jobFunctionNone}</option>
                {JOB_FUNCTIONS.map((code) => (
                  <option key={code} value={code}>
                    {p.jobFunctions[code]}
                  </option>
                ))}
              </SelectField>
            </div>
          </Group>

          <Group id="register-signin" title={p.groups.signIn} lead={p.groups.signInLead}>
            <TextField
              id="register-email"
              label={
                <>
                  {c.common.email}
                  {req}
                </>
              }
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={account.email}
              onChange={setA('email')}
              error={errors.email}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="register-password"
                label={
                  <>
                    {c.common.password}
                    {req}
                  </>
                }
                autoComplete="new-password"
                required
                value={account.password}
                onChange={setA('password')}
                error={errors.password}
                hint={c.common.passwordHint}
                showLabel={c.common.show}
                hideLabel={c.common.hide}
                capsLockLabel={c.common.capsLock}
              />
              <PasswordField
                id="register-confirm"
                label={
                  <>
                    {c.common.confirmPassword}
                    {req}
                  </>
                }
                autoComplete="new-password"
                required
                value={account.confirm}
                onChange={setA('confirm')}
                error={errors.confirm}
                showLabel={c.common.show}
                hideLabel={c.common.hide}
                capsLockLabel={c.common.capsLock}
              />
            </div>
            <PasswordRules
              password={account.password}
              confirm={account.confirm}
              email={account.email}
              p={p}
            />
          </Group>

          <div className="space-y-4">
            <button type="submit" className={buttonClasses('primary', 'lg', 'w-full')}>
              {p.steps.next}
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <Trust p={p} />
            <HaveAccount />
          </div>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={(e) => void onSubmit(e)}
          className="mt-6 space-y-8"
          data-register-step="2"
        >
          <p className="rounded-xl bg-white/[0.025] px-4 py-3 text-caption text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]">
            {p.business.lead}
          </p>
          <div className="space-y-4">
            <TextField
              id="register-companyName"
              label={
                <>
                  {p.business.companyName}
                  {req}
                </>
              }
              autoComplete="organization"
              maxLength={160}
              required
              value={business.companyName}
              onChange={setB('companyName')}
              error={errors.companyName}
              hint={p.business.companyNameHint}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="register-industry"
                label={
                  <>
                    {p.business.industry}
                    {req}
                  </>
                }
                required
                value={business.industry}
                onChange={setB('industry')}
                error={errors.industry}
              >
                <option value="">{p.business.choose}</option>
                {SIGNUP_INDUSTRIES.map((code) => (
                  <option key={code} value={code}>
                    {p.business.industries[code]}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="register-teamSize"
                label={
                  <>
                    {p.business.teamSize}
                    {req}
                  </>
                }
                required
                value={business.teamSize}
                onChange={setB('teamSize')}
                error={errors.teamSize}
              >
                <option value="">{p.business.choose}</option>
                {SIGNUP_TEAM_SIZES.map((code) => (
                  <option key={code} value={code}>
                    {p.business.teamSizes[code]}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <fieldset className="min-w-0">
            <legend className="mb-3 text-label font-medium text-text-primary">
              {p.business.contact}
            </legend>
            <div className="flex flex-wrap gap-2">
              {CONTACT_PREFERENCES.map((code) => (
                <label
                  key={code}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus motion-reduce:transition-none',
                    business.preferredContact === code
                      ? 'bg-brand-primary/[0.12] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                      : 'bg-white/[0.03] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:text-text-primary',
                  )}
                >
                  <input
                    type="radio"
                    name="register-contact"
                    value={code}
                    checked={business.preferredContact === code}
                    onChange={() => setBusiness((v) => ({ ...v, preferredContact: code }))}
                    className="sr-only"
                  />
                  {business.preferredContact === code && (
                    <Check aria-hidden className="size-4 text-brand-soft" />
                  )}
                  {p.business.contacts[code]}
                </label>
              ))}
            </div>
            {business.preferredContact === 'LINE' && (
              <TextField
                id="register-lineId"
                className="mt-4 sm:max-w-sm"
                label={
                  <>
                    {p.business.lineId}
                    {req}
                  </>
                }
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={50}
                value={business.lineId}
                onChange={setB('lineId')}
                error={errors.lineId}
                hint={p.business.lineIdHint}
              />
            )}
          </fieldset>

          <fieldset className="min-w-0" aria-describedby="register-interests-hint">
            <legend className="text-label font-medium text-text-primary">
              {p.business.interests}{' '}
              <span className="font-normal text-text-muted">({c.common.optional})</span>
            </legend>
            <p id="register-interests-hint" className="mt-1 mb-3 text-caption text-text-muted">
              {p.business.interestsHint}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SIGNUP_INTERESTS.map((code) => {
                const on = business.interests.includes(code);
                return (
                  <label
                    key={code}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus motion-reduce:transition-none',
                      on
                        ? 'bg-brand-primary/[0.09] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                        : 'bg-white/[0.02] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:text-text-primary',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setBusiness((v) => ({
                          ...v,
                          interests: on
                            ? v.interests.filter((x) => x !== code)
                            : [...v.interests, code],
                        }))
                      }
                      className="size-4.5 shrink-0 accent-brand-primary"
                    />
                    {p.business.interestOptions[code]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="register-note"
              className="mb-2 block text-label font-medium text-text-primary"
            >
              {p.business.note}{' '}
              <span className="font-normal text-text-muted">({c.common.optional})</span>
            </label>
            <textarea
              id="register-note"
              rows={3}
              maxLength={1000}
              value={business.note}
              onChange={setB('note')}
              aria-describedby="register-note-hint"
              className={cn(controlClass(false), 'min-h-24 resize-y py-3')}
            />
            <p id="register-note-hint" className="mt-1.5 text-caption text-text-muted">
              {p.business.noteHint}
            </p>
          </div>

          <section
            aria-labelledby="register-terms-title"
            className={cn(
              'rounded-2xl p-4 sm:p-5',
              errors.terms
                ? 'bg-danger/[0.06] shadow-[inset_0_0_0_1px_rgb(244_114_114/0.35)]'
                : 'bg-white/[0.025] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
            )}
          >
            <h3 id="register-terms-title" className="text-label font-semibold text-text-primary">
              {p.terms.title}
            </h3>
            <label className="mt-3 flex min-h-6 items-start gap-3 text-label text-text-secondary">
              <input
                id="register-terms"
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                aria-invalid={!!errors.terms}
                aria-describedby={errors.terms ? 'register-terms-error' : 'register-terms-lead'}
                className="mt-1 size-4.5 shrink-0 accent-brand-primary"
              />
              <span>
                {c.register.termsBefore}{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  className="text-brand-soft underline underline-offset-4"
                >
                  {c.register.terms}
                </Link>{' '}
                {c.register.termsAnd}{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  className="text-brand-soft underline underline-offset-4"
                >
                  {c.register.privacy}
                </Link>
                {req}
              </span>
            </label>
            <p id="register-terms-lead" className="mt-2 text-caption text-text-muted sm:pl-7.5">
              {p.terms.lead}
            </p>
            {errors.terms && <FieldError id="register-terms-error">{errors.terms}</FieldError>}
          </section>

          {failure && <Notice tone="error">{failure}</Notice>}

          <div className="space-y-4">
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goBack}
                className={buttonClasses('secondary', 'lg', 'sm:w-auto')}
              >
                <ArrowLeft className="size-4" aria-hidden />
                {p.steps.back}
              </button>
              <button
                type="submit"
                disabled={pending}
                className={buttonClasses('primary', 'lg', 'flex-1')}
              >
                <UserPlus className="size-4" aria-hidden />
                {pending ? c.register.submitting : c.register.submit}
              </button>
            </div>
            <Trust p={p} />
          </div>
        </form>
      )}
    </AuthFrame>
  );
}

/** Two steps, the current one marked — words carry the meaning, the line only connects. */
function Steps({ step, p }: { step: 1 | 2; p: ProfileCopy }) {
  const items = [p.steps.account, p.steps.business];
  return (
    <nav aria-label={p.steps.label}>
      <ol className="flex items-center gap-3" data-steps={step}>
        {items.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full text-caption font-semibold tabular-nums',
                  done
                    ? 'bg-brand-primary text-text-inverse'
                    : current
                      ? 'bg-brand-primary/[0.14] text-brand-soft shadow-[inset_0_0_0_1.5px_rgb(62_240_192/0.6)]'
                      : 'bg-white/[0.03] text-text-muted shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)]',
                )}
              >
                {done ? <Check className="size-4" /> : n}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-[0.625rem] tracking-[0.14em] text-text-muted uppercase">
                  {p.steps.of(n, 2)}
                </span>
                <span
                  className={cn(
                    'block truncate text-label',
                    current || done ? 'text-text-primary' : 'text-text-muted',
                  )}
                >
                  {label}
                </span>
              </span>
              {i === 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'ml-auto hidden h-px flex-1 sm:block',
                    step > 1 ? 'bg-brand-primary/50' : 'bg-white/[0.1]',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PasswordRules({
  password,
  confirm,
  email,
  p,
}: {
  password: string;
  confirm: string;
  email: string;
  p: ProfileCopy;
}) {
  const local = email.trim().split('@')[0]?.toLowerCase() ?? '';
  const rules = [
    { key: 'length', label: p.password.length, met: [...password].length >= 10 },
    {
      key: 'email',
      label: p.password.email,
      met: !!password && !(local.length >= 4 && password.toLowerCase().includes(local)),
    },
    { key: 'match', label: p.password.match, met: !!confirm && confirm === password },
  ];
  return (
    <div className="rounded-xl bg-white/[0.025] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]">
      <p id="register-rules-title" className="text-caption font-medium text-text-secondary">
        {p.password.title}
      </p>
      <ul aria-labelledby="register-rules-title" className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {rules.map((r) => (
          <li
            key={r.key}
            data-rule={r.key}
            data-met={r.met}
            className={cn(
              'flex items-start gap-2 text-caption transition-colors motion-reduce:transition-none',
              r.met ? 'text-brand-soft' : 'text-text-muted',
            )}
          >
            {r.met ? (
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <Circle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>
              {r.label}
              <span className="sr-only"> — {r.met ? p.password.met : p.password.notMet}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trust({ p }: { p: ProfileCopy }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {p.trust.map((t) => (
        <li key={t} className="flex items-start gap-2 text-caption text-text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-soft/70" />
          {t}
        </li>
      ))}
    </ul>
  );
}

function HaveAccount() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  return (
    <p className="text-caption text-text-secondary">
      {c.register.haveAccount}{' '}
      <Link
        to="/login"
        {...withLocale(locale)}
        className="inline-flex min-h-11 items-center text-brand-soft underline-offset-4 hover:underline"
      >
        {c.common.signIn}
      </Link>
    </p>
  );
}

/** A visible "*" with its meaning for assistive technology. */
function RequiredMark({ label }: { label: string }) {
  return (
    <span className="ml-1 text-brand-soft">
      <span aria-hidden>*</span>
      <span className="sr-only"> ({label})</span>
    </span>
  );
}

/** A titled group of fields (a real fieldset, so the legend names its fields). */
function Group({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-4" aria-describedby={`${id}-lead`}>
      <legend className="w-full border-b border-white/[0.07] pb-2.5 text-body font-semibold text-text-primary">
        {title}
      </legend>
      <p id={`${id}-lead`} className="-mt-1 text-caption text-text-muted">
        {lead}
      </p>
      {children}
    </fieldset>
  );
}

function VerificationSent({ email }: { email: string }) {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const [cooldown, setCooldown] = useState(60);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    try {
      await authApi.resendVerification(email);
      setMessage(c.register.resent);
      setCooldown(60);
    } catch (e) {
      setMessage(commonError(e, c));
    }
  };

  return (
    <AuthFrame
      kicker={c.register.kicker}
      title={c.register.sentTitle}
      state={{ icon: <MailCheck /> }}
    >
      <div className="space-y-5" data-state="verification-sent">
        <div>
          <p role="status" className="text-body leading-relaxed break-words text-text-primary">
            {c.register.sentLead(email)}
          </p>
          <p className="mt-1.5 text-caption text-text-muted">{c.register.sentNote}</p>
        </div>
        <Guidance
          title={c.common.notArrivedTitle}
          items={[...c.common.notArrived, c.register.sentNext]}
        />
        {message && <Notice tone="info">{message}</Notice>}
        <div className="space-y-2">
          <Link
            to="/login"
            {...withLocale(locale)}
            className={buttonClasses('primary', 'lg', 'w-full')}
          >
            {c.common.backToLogin}
          </Link>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={cooldown > 0}
            className={buttonClasses('secondary', 'md', 'w-full')}
          >
            {cooldown > 0 ? c.register.resendIn(cooldown) : c.register.resend}
          </button>
        </div>
      </div>
    </AuthFrame>
  );
}
