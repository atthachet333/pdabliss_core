import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Eye,
  EyeOff,
  LogIn,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { lazy, Suspense, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { authApi, type Challenge, type Identity } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { commonError, errorCode } from '@/features/auth/errors';
import { OtpStep } from '@/features/auth/OtpStep';
import { destinationFor, setIdentity, useIdentity, withPlan } from '@/features/auth/session';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { LOGIN_COPY } from './copy';
import { GatewayScene, type GatePhase } from './GatewayScene';

/*
 * The CORE Gateway sign-in (EP15 design; real authentication since EP23).
 * Email + password → an emailed one-time code when the server asks for one
 * (new browser, or always for platform accounts) → the account's home:
 * /platform for Platform Owner/Admin, /account for everyone else. The
 * session is an HttpOnly cookie set by the API; this page never stores or
 * logs the password or the code. `?next=` accepts same-app paths only.
 */

// Keys, not words: messages are looked up in the visitor's language.
const LoginSchema = z.object({
  email: z.string().trim().min(1, 'required').email('invalid'),
  password: z.string().min(1, 'required'),
});
type LoginValues = z.infer<typeof LoginSchema>;

/** Timings of the transition (instant under reduced motion). */
const ALIGN_MS = 380;
const RESOLVE_MS = 520;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STATUS_ICON = {
  idle: CircleDashed,
  focus: ScanLine,
  submit: CircleDot,
  success: ShieldCheck,
  fail: CircleAlert,
} as const;

function statusOf(phase: GatePhase): keyof typeof STATUS_ICON {
  if (phase === 'user' || phase === 'pass') return 'focus';
  return phase;
}

/**
 * EP28.1: the demo persona list — development builds only. In a production
 * build `import.meta.env.DEV` is false, so neither this import nor its chunk
 * exists; the API also lists personas only where the demo bypass exists.
 */
const DevPersonaPicker = import.meta.env.DEV ? lazy(() => import('./DevPersonaPicker')) : null;

export function LoginGateway() {
  const c = useCopy(LOGIN_COPY);
  const a = useCopy(AUTH_COPY);
  const { t, href, locale } = useLocale();
  // Sign-in is not a landing page: keep it out of search results (EP15, EP17).
  usePageMeta(c.meta.title, c.meta.description, { index: false });
  const reduce = usePrefersReducedMotion();
  const identity = useIdentity();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  // EP24: a package chosen on the public site travels to the Account Portal.
  const plan = params.get('plan');
  const [phase, setPhase] = useState<GatePhase>('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, setPending] = useState(false);
  const [otp, setOtp] = useState<{ challenge: Challenge; trust: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  // Already signed in: go straight to the account's home (or a safe `next`).
  if (identity.status === 'ready' && !pending) {
    return <Navigate to={withPlan(destinationFor(identity.identity, next), plan)} replace />;
  }

  const failed = failure !== null;
  const focusPhase = (field: 'user' | 'pass') => () => {
    if (!pending) setPhase(failed ? 'fail' : field);
  };
  const onFormBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (pending || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setPhase(failed ? 'fail' : 'idle');
  };
  const onCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  const finish = async (signedIn: Identity) => {
    setPhase('success');
    await wait(reduce ? 0 : RESOLVE_MS);
    setIdentity(signedIn);
    navigate(withPlan(destinationFor(signedIn, next), plan), { replace: true });
  };

  const fail = (message: string) => {
    setPending(false);
    setFailure(message);
    setPhase('fail');
  };

  const onSubmit = async (values: LoginValues) => {
    setFailure(null);
    setUnverifiedEmail(null);
    setResent(false);
    setPending(true);
    setPhase('submit');
    await wait(reduce ? 0 : ALIGN_MS);
    try {
      const res = await authApi.login(values.email, values.password);
      if (res.status === 'authenticated') {
        await finish(res.identity);
        return;
      }
      setValue('password', '');
      setPending(false);
      setPhase('pass');
      setOtp({ challenge: res.challenge, trust: res.trustDeviceAllowed });
    } catch (e) {
      const code = errorCode(e);
      if (code === 'INVALID_CREDENTIALS') {
        fail(c.failed);
        setValue('password', '');
        setFocus('password');
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        fail(c.notVerified);
        setUnverifiedEmail(values.email);
      } else if (code === 'ACCOUNT_UNAVAILABLE') {
        fail(c.accountUnavailable);
      } else if (code === 'LOGIN_THROTTLED') {
        fail(c.throttled);
      } else {
        fail(commonError(e, a));
      }
    }
  };

  const resendVerification = async () => {
    if (!unverifiedEmail) return;
    await authApi.resendVerification(unverifiedEmail).catch(() => undefined);
    setResent(true);
  };

  const restart = () => {
    setOtp(null);
    setPhase('idle');
    setFailure(null);
  };

  const status = statusOf(phase);
  const StatusIcon = STATUS_ICON[status];
  const password = register('password', {
    onChange: () => {
      if (!failed) return;
      setFailure(null);
      setPhase('pass');
    },
  });
  const emailError = errors.email
    ? errors.email.message === 'invalid'
      ? c.invalidEmail
      : c.required.email
    : null;
  const authLinkState = { state: { locale } };

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-surface-dark">
      {/* EP19: the same skip link as the public shell — past the home links to the form. */}
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_55%_at_70%_45%,rgb(25_195_154/0.12),transparent_70%),radial-gradient(ellipse_60%_50%_at_10%_100%,rgb(9_19_31/0.9),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_60%_45%,black,transparent_80%)] opacity-25"
      />

      <header className="mx-auto flex w-full max-w-[1640px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link to={href('/')} aria-label={c.home} className="shrink-0">
          {/* The wordmark needs ~400 px beside the way back; below that, the mark. */}
          <span className="max-[399px]:hidden">
            <Logo compact />
          </span>
          <LogoMark className="size-9 min-[400px]:hidden" />
        </Link>
        <Link
          to={href('/')}
          data-link="home"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-caption whitespace-nowrap text-text-secondary transition-colors hover:text-text-primary sm:px-3 sm:text-label"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {c.back}
        </Link>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-[1640px] flex-1 grid-cols-1 content-start px-4 pb-10 outline-none sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(25rem,28rem)] lg:content-center lg:items-center lg:px-10 lg:pb-14"
      >
        {/* Outside → gate. Compact above the form on smaller screens. */}
        <div className="pointer-events-none lg:flex lg:h-[min(36rem,calc(100dvh-9rem))] lg:items-center lg:justify-end 2xl:h-[min(46rem,calc(100dvh-9rem))]">
          <GatewayScene
            phase={phase}
            variant="compact"
            className="mx-auto block h-auto w-full max-w-[17rem] min-[400px]:max-w-[22rem] md:max-w-[26rem] lg:hidden"
          />
          <GatewayScene phase={phase} variant="wide" className="hidden size-full lg:block" />
        </div>

        {/* Inside — the focused workspace */}
        <section
          aria-labelledby="login-title"
          data-panel
          data-phase={phase}
          className={cn(
            'relative mx-auto w-full max-w-md rounded-[1.75rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.96),rgb(7_15_22/0.98))] p-5 transition-shadow duration-300 sm:p-8 lg:max-w-none',
            phase === 'fail'
              ? 'shadow-[inset_0_0_0_1px_rgb(245_184_75/0.55),0_40px_120px_-60px_rgb(0_0_0/0.9)]'
              : phase === 'success'
                ? 'shadow-[inset_0_0_0_1px_rgb(62_240_192/0.6),0_40px_120px_-50px_rgb(62_240_192/0.45)]'
                : 'shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1),0_40px_120px_-60px_rgb(0_0_0/0.9)]',
          )}
        >
          {/* Where the gate's lane arrives */}
          <span
            aria-hidden
            className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-brand-glow shadow-[0_0_0_4px_rgb(5_11_18)] lg:top-1/2 lg:-left-1.5 lg:translate-x-0 lg:-translate-y-1/2"
          />

          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3 sm:pb-4">
            <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase">
              CORE · {c.workspace}
            </p>
            <p
              data-status={status}
              aria-live="polite"
              className={cn(
                'inline-flex items-center gap-1.5 text-caption font-medium',
                status === 'fail'
                  ? 'text-warning'
                  : status === 'success' || status === 'submit'
                    ? 'text-brand-soft'
                    : 'text-text-muted',
              )}
            >
              <StatusIcon aria-hidden className="size-3.5" />
              {c.status[status]}
            </p>
          </div>

          <p className="mt-4 text-caption font-semibold text-brand-soft sm:mt-6">{c.kicker}</p>
          <h1
            id="login-title"
            className="mt-2 text-[clamp(1.4rem,1.1rem+1.3vw,2.125rem)] leading-[1.3] font-semibold tracking-tight text-text-primary"
          >
            {c.title}
          </h1>
          <p className="mt-2 text-label text-text-secondary">{c.lead}</p>

          {otp ? (
            <div className="mt-5 sm:mt-7">
              <OtpStep
                challenge={otp.challenge}
                showTrustDevice={otp.trust}
                onVerify={async (code, trustDevice) => {
                  const res = await authApi.loginOtp(otp.challenge.id, code, trustDevice);
                  setPending(true);
                  await finish(res.identity);
                }}
                onResend={async () => (await authApi.resendLoginOtp(otp.challenge.id)).challenge}
                onRestart={restart}
              />
            </div>
          ) : (
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              onBlur={onFormBlur}
              className="mt-5 space-y-4 sm:mt-7"
            >
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-label font-medium text-text-primary"
                >
                  {c.email}
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={controlClass(!!emailError)}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'login-email-error' : undefined}
                  onFocus={focusPhase('user')}
                  {...register('email')}
                />
                {emailError && (
                  <p
                    id="login-email-error"
                    role="alert"
                    className="mt-1.5 flex items-center gap-1.5 text-caption text-danger"
                  >
                    <CircleAlert className="size-3.5" aria-hidden />
                    {emailError}
                  </p>
                )}
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="login-password"
                    className="block text-label font-medium text-text-primary"
                  >
                    {c.password}
                  </label>
                  <Link
                    to="/forgot-password"
                    {...authLinkState}
                    data-link="forgot"
                    // EP23: a 44 px hit area (was 20 px); the negative margin keeps the layout.
                    className="-my-3 inline-flex min-h-11 items-center text-caption text-brand-soft underline-offset-4 hover:underline"
                  >
                    {c.forgot}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`${controlClass(!!errors.password || failed)} pr-12`}
                    aria-invalid={!!errors.password || failed}
                    aria-describedby={
                      [
                        errors.password && 'login-password-error',
                        failed && 'login-failed',
                        capsLock && 'login-caps',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onFocus={focusPhase('pass')}
                    onKeyDown={onCaps}
                    onKeyUp={onCaps}
                    {...password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    // EP19: the label alone carries the state ("Show" / "Hide password");
                    // aria-pressed as well announced it twice ("Hide password, pressed").
                    aria-label={showPassword ? c.hide : c.show}
                    aria-controls="login-password"
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-text-muted hover:text-text-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4.5" aria-hidden />
                    ) : (
                      <Eye className="size-4.5" aria-hidden />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="login-password-error"
                    role="alert"
                    className="mt-1.5 flex items-center gap-1.5 text-caption text-danger"
                  >
                    <CircleAlert className="size-3.5" aria-hidden />
                    {c.required.password}
                  </p>
                )}
                {capsLock && (
                  <p id="login-caps" data-caps className="mt-1.5 text-caption text-warning">
                    {c.capsLock}
                  </p>
                )}
              </div>

              {failed && (
                <div
                  id="login-failed"
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-warning/[0.08] p-3 text-caption text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {failure}
                    {failure === c.failed && (
                      <span className="block text-text-secondary">{c.failedHint}</span>
                    )}
                    {unverifiedEmail &&
                      (resent ? (
                        <span className="block text-text-secondary">{c.verificationSent}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void resendVerification()}
                          className="mt-1 block min-h-11 text-left text-brand-soft underline underline-offset-4"
                        >
                          {c.resendVerification}
                        </button>
                      ))}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className={buttonClasses('primary', 'lg', 'w-full')}
              >
                <LogIn className="size-4" aria-hidden />
                {pending ? c.submitting : c.submit}
              </button>
              <p className="text-caption text-text-muted">{c.after}</p>
              <Link
                to="/register"
                {...authLinkState}
                data-link="register"
                className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline"
              >
                {c.register}
              </Link>
            </form>
          )}
          {DevPersonaPicker && !otp && (
            <Suspense fallback={null}>
              <DevPersonaPicker
                onPick={(email) => {
                  setValue('email', email, { shouldValidate: true });
                  setFocus('password');
                }}
              />
            </Suspense>
          )}

          <div className="mt-6 flex flex-col items-start gap-0.5 border-t border-white/[0.06] pt-4">
            <Link
              to={href('/demo')}
              data-link="demo"
              className="group inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft underline-offset-4 hover:underline"
            >
              {c.demo}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              to={href('/security')}
              data-link="security"
              className="inline-flex min-h-11 items-center text-caption text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
            >
              {c.security}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
