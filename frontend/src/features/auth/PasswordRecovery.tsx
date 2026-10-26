import { CircleCheck, CircleX, LoaderCircle, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';
import { authApi } from './api';
import { AuthFrame, Notice } from './AuthFrame';
import { AUTH_COPY } from './copy';
import { commonError, EMAIL_PATTERN, errorCode, passwordProblem } from './errors';
import { PasswordField, TextField } from './fields';
import { takeLinkToken } from './linkToken';
import { clearIdentity } from './session';
import { withLocale } from './localeState';

/*
 * Forgot / reset password (EP23). The request always gets the same answer
 * (no account discovery). The reset link's token lives only in memory; a
 * successful reset signs out every device, this one included.
 */

export function ForgotPassword() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  usePageMeta(c.forgot.meta.title, c.forgot.meta.description, { index: false });
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError(value ? c.common.invalidEmail : c.common.required.email);
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setError(null);
    setFailure(null);
    setPending(true);
    try {
      await authApi.forgotPassword(value);
      setSent(true);
    } catch (err) {
      setFailure(commonError(err, c));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame kicker={c.forgot.kicker} title={c.forgot.sentTitle}>
        <div className="space-y-4" data-state="reset-sent">
          <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-soft" />
            <p role="status" className="text-label text-text-secondary">
              {c.forgot.sentLead}
            </p>
          </div>
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

  return (
    <AuthFrame kicker={c.forgot.kicker} title={c.forgot.title} lead={c.forgot.lead}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          id="forgot-email"
          label={c.common.email}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          {pending ? c.forgot.submitting : c.forgot.submit}
        </button>
        <Link
          to="/login"
          {...withLocale(locale)}
          className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
        >
          {c.common.backToLogin}
        </Link>
      </form>
    </AuthFrame>
  );
}

type ResetState = 'checking' | 'form' | 'done' | 'expired' | 'used' | 'invalid' | 'error';

export function ResetPassword() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  usePageMeta(c.reset.meta.title, c.reset.meta.description, { index: false });
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const [state, setState] = useState<ResetState>('checking');
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const badLink = (e: unknown) => {
    const code = errorCode(e);
    if (code === 'TOKEN_EXPIRED') setState('expired');
    else if (code === 'TOKEN_USED') setState('used');
    else if (code === 'TOKEN_INVALID' || code === 'VALIDATION_FAILED') setState('invalid');
    else return false;
    return true;
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = takeLinkToken();
    if (!token.current) {
      setState('invalid');
      return;
    }
    authApi.checkReset(token.current).then(
      () => setState('form'),
      (e: unknown) => {
        if (!badLink(e)) {
          setFailure(commonError(e, c));
          setState('error');
        }
      },
    );
    // `c` only localizes messages; the link is checked once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.password) next.password = c.common.required.password;
    else {
      const problem = passwordProblem(values.password, '');
      if (problem) next.password = c.common.policy[problem];
    }
    if (!values.confirm) next.confirm = c.common.required.confirm;
    else if (values.confirm !== values.password) next.confirm = c.common.mismatch;
    setErrors(next);
    if (next.password || next.confirm) {
      document.getElementById(next.password ? 'reset-password' : 'reset-confirm')?.focus();
      return;
    }
    setFailure(null);
    setPending(true);
    try {
      await authApi.resetPassword(token.current!, values.password);
      token.current = null;
      clearIdentity();
      setState('done');
    } catch (err) {
      if (!badLink(err)) setFailure(commonError(err, c));
    } finally {
      setPending(false);
    }
  };

  if (state === 'checking') {
    return (
      <AuthFrame kicker={c.reset.kicker} title={c.reset.checking}>
        <LoaderCircle
          aria-hidden
          className="size-6 animate-spin text-brand-soft motion-reduce:animate-none"
        />
      </AuthFrame>
    );
  }

  if (state === 'done') {
    return (
      <AuthFrame kicker={c.reset.kicker} title={c.reset.done} lead={c.reset.doneLead}>
        <div className="space-y-4" data-state="done">
          <CircleCheck aria-hidden className="size-8 text-brand-soft" />
          <Link
            to="/login"
            {...withLocale(locale)}
            className={buttonClasses('primary', 'lg', 'w-full')}
          >
            {c.common.signIn}
          </Link>
        </div>
      </AuthFrame>
    );
  }

  if (state !== 'form') {
    const title =
      state === 'expired' ? c.reset.expired : state === 'used' ? c.reset.used : c.reset.invalid;
    return (
      <AuthFrame kicker={c.reset.kicker} title={title} lead={c.reset.badLead}>
        <div className="space-y-4" data-state={state}>
          <CircleX aria-hidden className="size-8 text-warning" />
          {failure && <Notice tone="error">{failure}</Notice>}
          <Link
            to="/forgot-password"
            {...withLocale(locale)}
            className={buttonClasses('primary', 'lg', 'w-full')}
          >
            {c.reset.requestNew}
          </Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame kicker={c.reset.kicker} title={c.reset.title} lead={c.reset.lead}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4" data-state="form">
        <PasswordField
          id="reset-password"
          label={c.common.newPassword}
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password}
          hint={c.common.passwordHint}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        <PasswordField
          id="reset-confirm"
          label={c.common.confirmPassword}
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))}
          error={errors.confirm}
          showLabel={c.common.show}
          hideLabel={c.common.hide}
          capsLockLabel={c.common.capsLock}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          {pending ? c.reset.submitting : c.reset.submit}
        </button>
      </form>
    </AuthFrame>
  );
}
