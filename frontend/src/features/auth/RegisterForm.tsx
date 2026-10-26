import { MailCheck, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';
import { authApi, planIntent } from './api';
import { AuthFrame, Notice } from './AuthFrame';
import { AUTH_COPY } from './copy';
import { commonError, EMAIL_PATTERN, passwordProblem } from './errors';
import { FieldError, PasswordField, TextField } from './fields';
import { withLocale } from './localeState';

/*
 * Self-registration (EP23): email, password, confirmation and the terms. No
 * company profile here — company setup comes after verification. A plan
 * chosen on /pricing (`?plan=business`) travels along as onboarding intent
 * only; nothing is charged and no subscription is created.
 */

type Errors = Partial<Record<'email' | 'password' | 'confirm' | 'terms', string>>;

export function RegisterForm() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  usePageMeta(c.register.meta.title, c.register.meta.description, { index: false });
  const [params] = useSearchParams();
  const plan = planIntent(params.get('plan'));
  const [values, setValues] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const validate = (): Errors => {
    const next: Errors = {};
    const email = values.email.trim();
    if (!email) next.email = c.common.required.email;
    else if (!EMAIL_PATTERN.test(email)) next.email = c.common.invalidEmail;
    if (!values.password) next.password = c.common.required.password;
    else {
      const problem = passwordProblem(values.password, email);
      if (problem) next.password = c.common.policy[problem];
    }
    if (!values.confirm) next.confirm = c.common.required.confirm;
    else if (values.confirm !== values.password) next.confirm = c.common.mismatch;
    if (!terms) next.terms = c.common.required.terms;
    return next;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFailure(null);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`register-${first}`)?.focus();
      return;
    }
    setPending(true);
    try {
      await authApi.register({
        email: values.email.trim(),
        password: values.password,
        displayName: values.displayName.trim() || undefined,
        locale,
        plan: plan ?? undefined,
        acceptTerms: true,
      });
      setSentTo(values.email.trim());
    } catch (err) {
      setFailure(commonError(err, c));
    } finally {
      setPending(false);
    }
  };

  if (sentTo) return <VerificationSent email={sentTo} />;

  return (
    <AuthFrame kicker={c.register.kicker} title={c.register.title} lead={c.register.lead}>
      {plan && (
        <p
          data-plan={plan}
          className="mb-5 rounded-xl bg-brand-primary/[0.08] p-3 text-caption text-brand-soft"
        >
          {c.register.plan(c.plans[plan])}
        </p>
      )}
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          id="register-displayName"
          label={
            <>
              {c.common.displayName}{' '}
              <span className="font-normal text-text-muted">({c.common.optional})</span>
            </>
          }
          autoComplete="name"
          maxLength={80}
          value={values.displayName}
          onChange={set('displayName')}
        />
        <TextField
          id="register-email"
          label={c.common.email}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <PasswordField
          id="register-password"
          label={c.common.password}
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint={c.common.passwordHint}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        <PasswordField
          id="register-confirm"
          label={c.common.confirmPassword}
          autoComplete="new-password"
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        <div>
          <label className="flex items-start gap-3 text-caption text-text-secondary">
            <input
              id="register-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? 'register-terms-error' : undefined}
              className="mt-0.5 size-4.5 shrink-0 accent-brand-primary"
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
            </span>
          </label>
          {errors.terms && <FieldError id="register-terms-error">{errors.terms}</FieldError>}
        </div>

        {failure && <Notice tone="error">{failure}</Notice>}

        <button
          type="submit"
          disabled={pending}
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          <UserPlus className="size-4" aria-hidden />
          {pending ? c.register.submitting : c.register.submit}
        </button>
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
      </form>
    </AuthFrame>
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
    <AuthFrame kicker={c.register.kicker} title={c.register.sentTitle}>
      <div className="space-y-4" data-state="verification-sent">
        <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-soft" />
          <p role="status" className="text-label text-text-secondary">
            {c.register.sentLead(email)}
          </p>
        </div>
        <p className="text-caption text-text-muted">{c.register.sentNote}</p>
        {message && <Notice tone="info">{message}</Notice>}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0}
          className={buttonClasses('secondary', 'md', 'w-full')}
        >
          {cooldown > 0 ? c.register.resendIn(cooldown) : c.register.resend}
        </button>
        <Link
          to="/login"
          {...withLocale(locale)}
          className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
        >
          {c.common.backToLogin}
        </Link>
      </div>
    </AuthFrame>
  );
}
