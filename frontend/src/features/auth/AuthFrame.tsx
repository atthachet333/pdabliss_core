import { ArrowLeft } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { AUTH_COPY } from './copy';

export type StateTone = 'brand' | 'success' | 'warning';

/*
 * The frame of every account screen (EP23; polished in EP24): the CORE
 * Gateway's chrome — dark field, logo, "back to the website", skip link —
 * around one focused panel, centred in the viewport with a restrained CORE
 * halo behind it. An optional state emblem (an icon in a soft ring) leads
 * result states such as "check your email" or "link expired". Presentation
 * only: no auth behaviour lives here.
 */
export function AuthFrame({
  kicker,
  title,
  lead,
  children,
  wide = false,
  state,
}: {
  kicker: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Result-state emblem: a decorative icon with a tone (the title carries the meaning). */
  state?: { icon: ReactNode; tone?: StateTone };
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
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,black,transparent_80%)] opacity-20"
      />
      {/* A soft CORE halo behind the panel — decoration only, no motion. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[min(52rem,140vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.09),transparent_62%)]"
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
        className="mx-auto flex w-full max-w-[1640px] flex-1 flex-col items-center px-4 pt-4 pb-10 outline-none sm:px-6 sm:pt-6 lg:px-10"
      >
        {/* my-auto: centred when there is room, top-aligned and scrollable when there is not. */}
        <div className={cn('my-auto w-full', wide ? 'max-w-3xl' : 'max-w-[30rem]')}>
          <section
            aria-labelledby="auth-title"
            className="relative w-full overflow-hidden rounded-[1.75rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.97),rgb(7_15_22/0.99))] p-6 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1),0_40px_120px_-60px_rgb(0_0_0/0.9)] sm:p-9"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/45 to-transparent"
            />
            {state && <StateEmblem tone={state.tone ?? 'brand'}>{state.icon}</StateEmblem>}
            <p
              className={cn(
                'font-mono text-[0.6875rem] tracking-[0.16em] text-text-muted uppercase',
                state && 'mt-5',
              )}
            >
              CORE · {kicker}
            </p>
            <h1
              id="auth-title"
              className="mt-3 text-[clamp(1.45rem,1.15rem+1.3vw,2rem)] leading-[1.3] font-semibold tracking-tight text-text-primary"
            >
              {title}
            </h1>
            {lead && (
              <p className="mt-2.5 text-label leading-relaxed text-text-secondary">{lead}</p>
            )}
            <div className="mt-7">{children}</div>
          </section>
          <p className="mt-5 text-center text-caption text-text-muted">
            {c.common.help}{' '}
            <Link
              to={href('/contact')}
              className="inline-flex min-h-11 items-center text-brand-soft underline-offset-4 hover:underline"
            >
              {c.common.contactTeam}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

const EMBLEM_TONES: Record<StateTone, string> = {
  brand:
    'bg-brand-primary/[0.1] text-brand-glow shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3),0_0_48px_-12px_rgb(62_240_192/0.45)]',
  success:
    'bg-brand-primary/[0.12] text-brand-glow shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4),0_0_48px_-12px_rgb(62_240_192/0.5)]',
  warning:
    'bg-warning/[0.1] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35),0_0_48px_-14px_rgb(245_184_75/0.4)]',
};

/** The decorative state icon at the top of a result panel. */
function StateEmblem({ tone, children }: { tone: StateTone; children: ReactNode }) {
  return (
    <div
      aria-hidden
      data-state-emblem={tone}
      className={cn(
        'flex size-14 items-center justify-center rounded-2xl [&>svg]:size-6',
        EMBLEM_TONES[tone],
      )}
    >
      {children}
    </div>
  );
}

/**
 * Short, factual guidance under a result state: what the link does, what to do
 * when nothing arrives. A titled list, so it reads as one group.
 */
export function Guidance({
  title,
  items,
  id,
}: {
  title: string;
  items: readonly ReactNode[];
  id?: string;
}) {
  const auto = useId();
  const headingId = id ?? auto;
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="rounded-2xl bg-white/[0.025] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
    >
      <p id={headingId} className="text-label font-medium text-text-primary">
        {title}
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-caption leading-relaxed text-text-secondary">
            <span
              aria-hidden
              className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-glow/70"
            />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
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
