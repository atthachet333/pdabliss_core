import { CircleCheck, CircleX, LoaderCircle, MailCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { usePageMeta } from '@/lib/usePageMeta';
import { authApi } from './api';
import { AuthFrame, Guidance, Notice } from './AuthFrame';
import { AUTH_COPY } from './copy';
import { commonError, EMAIL_PATTERN, errorCode } from './errors';
import { TextField } from './fields';
import { takeLinkToken } from './linkToken';
import { withLocale } from './localeState';

/*
 * /verify-email (EP23): the link from the verification email. Verifying does
 * not sign anyone in — the person signs in next (with an email code on a new
 * browser). Expired / invalid links offer a fresh one.
 */

type State =
  'verifying' | 'verified' | 'already' | 'expired' | 'used' | 'invalid' | 'missing' | 'error';

export function VerifyEmail() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  usePageMeta(c.verify.meta.title, c.verify.meta.description, { index: false });
  const [state, setState] = useState<State>('verifying');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once only (StrictMode runs effects twice in development).
    if (started.current) return;
    started.current = true;
    const token = takeLinkToken();
    (token ? authApi.verifyEmail(token) : Promise.resolve(null)).then(
      (res) => setState(!res ? 'missing' : res.status === 'verified' ? 'verified' : 'already'),
      (e: unknown) => {
        const code = errorCode(e);
        if (code === 'TOKEN_EXPIRED') setState('expired');
        else if (code === 'TOKEN_USED') setState('used');
        else if (code === 'TOKEN_INVALID' || code === 'VALIDATION_FAILED') setState('invalid');
        else {
          setError(commonError(e, c));
          setState('error');
        }
      },
    );
  }, [c]);

  const title = {
    verifying: c.verify.verifying,
    verified: c.verify.verified,
    already: c.verify.already,
    expired: c.verify.expired,
    used: c.verify.used,
    invalid: c.verify.invalid,
    missing: c.verify.missing,
    error: c.common.errors.generic,
  }[state];
  const lead = {
    verifying: undefined,
    verified: c.verify.verifiedLead,
    already: c.verify.alreadyLead,
    expired: c.verify.expiredLead,
    used: c.verify.expiredLead,
    invalid: c.verify.invalidLead,
    missing: c.verify.missingLead,
    error: undefined,
  }[state];
  const ok = state === 'verified' || state === 'already';

  // EP24 polish: a state emblem leads each result; the title carries the meaning.
  const emblem =
    state === 'verifying'
      ? undefined
      : ok
        ? { icon: <CircleCheck />, tone: 'success' as const }
        : state === 'missing'
          ? { icon: <MailCheck />, tone: 'brand' as const }
          : { icon: <CircleX />, tone: 'warning' as const };

  return (
    <AuthFrame kicker={c.verify.kicker} title={title} lead={lead} state={emblem}>
      <div className="space-y-5" data-state={state} aria-live="polite">
        {state === 'verifying' && (
          <LoaderCircle
            aria-hidden
            className="size-6 animate-spin text-brand-soft motion-reduce:animate-none"
          />
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {ok ? (
          <>
            <p className="rounded-2xl bg-white/[0.025] p-4 text-caption leading-relaxed text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]">
              {c.verify.nextStep}
            </p>
            <Link
              to="/login"
              {...withLocale(locale)}
              className={buttonClasses('primary', 'lg', 'w-full')}
            >
              {c.common.signIn}
            </Link>
          </>
        ) : (
          state !== 'verifying' && (
            <>
              {state === 'missing' && (
                <Guidance title={c.common.notArrivedTitle} items={c.common.notArrived} />
              )}
              <ResendVerification />
            </>
          )
        )}
      </div>
    </AuthFrame>
  );
}

/** "Send me a new link" — always the same answer, whatever the address. */
export function ResendVerification() {
  const c = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError(value ? c.common.invalidEmail : c.common.required.email);
      document.getElementById('resend-email')?.focus();
      return;
    }
    setError(null);
    setPending(true);
    try {
      await authApi.resendVerification(value);
      setDone(c.verify.resent);
    } catch (err) {
      setDone(null);
      setError(commonError(err, c));
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <TextField
        id="resend-email"
        label={c.common.email}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />
      {done && <Notice tone="success">{done}</Notice>}
      <button type="submit" disabled={pending} className={buttonClasses('primary', 'md', 'w-full')}>
        {c.verify.resendSubmit}
      </button>
      <Link
        to="/login"
        {...withLocale(locale)}
        className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
      >
        {c.common.backToLogin}
      </Link>
    </form>
  );
}
