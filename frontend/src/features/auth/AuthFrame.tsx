import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { AUTH_COPY } from './copy';

/*
 * The frame of every account screen (EP23): the CORE Gateway's chrome —
 * dark field, logo, "back to the website", skip link — around one focused
 * panel. Same visual language as /login, without the gate illustration.
 */
export function AuthFrame({
  kicker,
  title,
  lead,
  children,
  wide = false,
}: {
  kicker: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const c = useCopy(AUTH_COPY);
  const { t, href } = useLocale();
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-surface-dark">
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_55%_at_70%_30%,rgb(25_195_154/0.1),transparent_70%),radial-gradient(ellipse_60%_50%_at_10%_100%,rgb(9_19_31/0.9),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black,transparent_80%)] opacity-20"
      />
      <header className="mx-auto flex w-full max-w-[1640px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link to={href('/')} aria-label={c.common.home} className="shrink-0">
          <span className="max-[399px]:hidden">
            <Logo compact />
          </span>
          <LogoMark className="size-9 min-[400px]:hidden" />
        </Link>
        <Link
          to={href('/')}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-caption whitespace-nowrap text-text-secondary transition-colors hover:text-text-primary sm:px-3 sm:text-label"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {c.common.back}
        </Link>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[1640px] flex-1 justify-center px-4 pt-4 pb-12 outline-none sm:px-6 sm:pt-8 lg:px-10"
      >
        <section
          aria-labelledby="auth-title"
          className={cn(
            'h-fit w-full rounded-[1.75rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.96),rgb(7_15_22/0.98))] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1),0_40px_120px_-60px_rgb(0_0_0/0.9)] sm:p-8',
            wide ? 'max-w-3xl' : 'max-w-md',
          )}
        >
          <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase">
            CORE · {kicker}
          </p>
          <h1
            id="auth-title"
            className="mt-3 text-[clamp(1.4rem,1.1rem+1.3vw,2rem)] leading-[1.3] font-semibold tracking-tight text-text-primary"
          >
            {title}
          </h1>
          {lead && <p className="mt-2 text-label text-text-secondary">{lead}</p>}
          <div className="mt-6">{children}</div>
        </section>
      </main>
    </div>
  );
}

/** Polite status or assertive error line, announced to screen readers. */
export function Notice({
  tone,
  children,
  id,
}: {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
  id?: string;
}) {
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl p-3 text-caption',
        tone === 'error' &&
          'bg-warning/[0.08] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]',
        tone === 'info' && 'bg-white/[0.04] text-text-secondary',
        tone === 'success' &&
          'bg-brand-primary/[0.08] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]',
      )}
    >
      {children}
    </p>
  );
}
