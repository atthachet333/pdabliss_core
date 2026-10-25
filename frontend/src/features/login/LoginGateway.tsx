import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Eye,
  EyeOff,
  FlaskConical,
  LogIn,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { PROTOTYPE_ENABLED } from '@/prototype/config';
import { lastWorkspace, prototypeSignIn, usePrototypeSession } from '@/prototype/session';
import { LOGIN_COPY } from './copy';
import { GatewayScene, type GatePhase } from './GatewayScene';

/*
 * The CORE Gateway sign-in (EP15). A visual layer over the unchanged
 * EP01-PROTOTYPE sign-in: same check (prototypeSignIn), same session flag,
 * same safe `?next=` handling. Nothing here logs or stores the password.
 */

// Keys, not words: messages are looked up in the visitor's language.
const LoginSchema = z.object({
  username: z.string().trim().min(1, 'username'),
  password: z.string().min(1, 'password'),
});
type LoginValues = z.infer<typeof LoginSchema>;

/** Only same-app workspace paths are accepted as a post-login destination. */
function safeNext(next: string | null): string | null {
  return next && /^\/app\/[a-z-]+(\/[a-z-]+)?$/.test(next) ? next : null;
}

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

export function LoginGateway() {
  const c = useCopy(LOGIN_COPY);
  const { t, href } = useLocale();
  // Sign-in is not a landing page: keep it out of search results (EP15, EP17).
  usePageMeta(c.meta.title, c.meta.description, { index: false });
  const reduce = usePrefersReducedMotion();
  const session = usePrototypeSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<GatePhase>('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  const destination = safeNext(params.get('next')) ?? `/app/${lastWorkspace()}`;

  if (session && !pending) return <Navigate to={destination} replace />;

  const focusPhase = (next: 'user' | 'pass') => () => {
    if (!pending) setPhase(failed ? 'fail' : next);
  };
  const onFormBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (pending || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setPhase(failed ? 'fail' : 'idle');
  };
  const onCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  const onSubmit = async (values: LoginValues) => {
    setFailed(false);
    setPending(true);
    setPhase('submit');
    // Signals align toward the gate; there is no network call.
    await wait(reduce ? 0 : ALIGN_MS);
    if (prototypeSignIn(values.username, values.password)) {
      setPhase('success');
      await wait(reduce ? 0 : RESOLVE_MS);
      navigate(destination, { replace: true });
    } else {
      setPending(false);
      setFailed(true);
      setPhase('fail');
      setValue('password', '');
      setFocus('password');
    }
  };

  const status = statusOf(phase);
  const StatusIcon = STATUS_ICON[status];
  const password = register('password', {
    onChange: () => {
      if (!failed) return;
      setFailed(false);
      setPhase('pass');
    },
  });

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

          {PROTOTYPE_ENABLED ? (
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              onBlur={onFormBlur}
              className="mt-5 space-y-4 sm:mt-7"
            >
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-2 block text-label font-medium text-text-primary"
                >
                  {c.username}
                </label>
                <input
                  id="login-username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={controlClass(!!errors.username)}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? 'login-username-error' : undefined}
                  onFocus={focusPhase('user')}
                  {...register('username')}
                />
                {errors.username && (
                  <p
                    id="login-username-error"
                    role="alert"
                    className="mt-1.5 flex items-center gap-1.5 text-caption text-danger"
                  >
                    <CircleAlert className="size-3.5" aria-hidden />
                    {c.required.username}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-label font-medium text-text-primary"
                >
                  {c.password}
                </label>
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
                <p
                  id="login-failed"
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-warning/[0.08] p-3 text-caption text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {c.failed}
                    <span className="block text-text-secondary">{c.failedHint}</span>
                  </span>
                </p>
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
            </form>
          ) : (
            <p
              data-unavailable
              className="mt-7 rounded-xl bg-white/[0.03] p-4 text-label text-text-secondary"
            >
              {c.unavailable}
            </p>
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

          {PROTOTYPE_ENABLED && (
            <p
              data-prototype
              className="mt-3 flex items-start gap-1.5 text-caption text-text-muted"
            >
              <FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning/80" />
              <span>
                <span className="font-medium text-warning/90">{c.prototype}</span> ·{' '}
                {c.prototypeNote}
              </span>
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
