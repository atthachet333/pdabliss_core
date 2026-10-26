import { MailCheck, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Challenge } from './api';
import { Notice } from './AuthFrame';
import { AUTH_COPY } from './copy';
import { commonError } from './errors';

/*
 * The email one-time-code step (EP23): one numeric field (so paste, browser
 * one-time-code autofill and screen readers all work), submits by itself when
 * six digits are in, a resend countdown, and clear terminal states (expired,
 * locked, out of resends) that offer to start again. No code is ever shown,
 * stored or logged on this side.
 */

const secondsUntil = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));

export function OtpStep({
  challenge: initial,
  onVerify,
  onResend,
  onRestart,
  showTrustDevice = false,
}: {
  challenge: Challenge;
  onVerify: (code: string, trustDevice: boolean) => Promise<void>;
  onResend: () => Promise<Challenge>;
  onRestart: () => void;
  showTrustDevice?: boolean;
}) {
  const c = useCopy(AUTH_COPY);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [wait, setWait] = useState(() => secondsUntil(initial.resendAvailableAt));

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = secondsUntil(challenge.resendAvailableAt);
      setWait(left);
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge.resendAvailableAt]);

  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : '';
    if (code === 'OTP_INCORRECT') {
      const left = Number(e instanceof ApiError ? e.details?.attemptsRemaining : 0);
      setError(c.otp.incorrect(left));
    } else if (code === 'OTP_EXPIRED') {
      setError(c.otp.expired);
      setTerminal(true);
    } else if (code === 'OTP_LOCKED') {
      setError(c.otp.locked);
      setTerminal(true);
    } else if (code === 'OTP_RESEND_LIMIT') {
      setError(c.otp.resendLimit);
      setCanResend(false);
    } else if (code === 'OTP_RESEND_TOO_SOON') {
      const at = e instanceof ApiError ? e.details?.resendAvailableAt : undefined;
      if (typeof at === 'string') {
        setChallenge((ch) => ({ ...ch, resendAvailableAt: at }));
        setWait(secondsUntil(at));
      }
    } else if (code === 'OTP_CHALLENGE_LIMIT') {
      setError(c.otp.challengeLimit);
      setTerminal(true);
    } else {
      setError(commonError(e, c));
    }
  };

  const verify = async (value: string) => {
    if (pending || terminal || !/^\d{6}$/.test(value)) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      await onVerify(value, trust);
    } catch (e) {
      fail(e);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      const next = await onResend();
      setChallenge(next);
      setWait(secondsUntil(next.resendAvailableAt));
      setCode('');
      setInfo(c.otp.resent);
      inputRef.current?.focus();
    } catch (e) {
      fail(e);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4" data-otp>
      <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
        <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-soft" />
        <div>
          <p className="text-label font-medium text-text-primary">{c.otp.title}</p>
          <p id={`${id}-lead`} className="mt-0.5 text-caption text-text-secondary">
            {c.otp.lead(challenge.maskedEmail)}
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${id}-code`}
          className="mb-2 block text-label font-medium text-text-primary"
        >
          {c.otp.label}
        </label>
        <input
          ref={inputRef}
          id={`${id}-code`}
          name="one-time-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          disabled={terminal}
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6) void verify(digits);
          }}
          aria-invalid={!!error}
          aria-describedby={`${id}-lead${error ? ` ${id}-error` : ''}`}
          className={cn(
            'h-14 w-full rounded-control border bg-surface-raised px-4 text-center font-mono text-[1.6rem] tracking-[0.45em] text-text-primary transition-[border-color,box-shadow] duration-200 focus:border-brand-glow focus:shadow-glow-sm focus:outline-none disabled:opacity-50',
            error ? 'border-danger/70' : 'border-border-strong',
          )}
        />
      </div>

      {showTrustDevice && !terminal && (
        <label className="flex items-start gap-3 text-caption text-text-secondary">
          <input
            type="checkbox"
            checked={trust}
            onChange={(e) => setTrust(e.target.checked)}
            className="mt-0.5 size-4.5 shrink-0 accent-brand-primary"
          />
          <span>
            <span className="font-medium text-text-primary">{c.otp.trustDevice}</span>
            <span className="block">{c.otp.trustDeviceHint}</span>
          </span>
        </label>
      )}

      {error && (
        <Notice tone="error" id={`${id}-error`}>
          {error}
        </Notice>
      )}
      {info && <Notice tone="info">{info}</Notice>}

      {terminal ? (
        <button
          type="button"
          onClick={onRestart}
          className={buttonClasses('primary', 'lg', 'w-full')}
        >
          <RotateCcw className="size-4" aria-hidden />
          {c.otp.startOver}
        </button>
      ) : (
        <>
          <button
            type="submit"
            disabled={pending || code.length !== 6}
            className={buttonClasses('primary', 'lg', 'w-full')}
          >
            {pending ? c.otp.verifying : c.otp.verify}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void resend()}
              disabled={wait > 0 || !canResend}
              className="inline-flex min-h-11 items-center text-label text-brand-soft underline-offset-4 hover:underline disabled:text-text-muted disabled:no-underline"
            >
              {wait > 0 ? c.otp.resendIn(wait) : c.otp.resend}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex min-h-11 items-center text-caption text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
            >
              {c.otp.startOver}
            </button>
          </div>
          <p className="text-caption text-text-muted">{c.otp.noCode}</p>
        </>
      )}
    </form>
  );
}
