import { CircleAlert, KeyRound, LoaderCircle, SearchX, ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { DEPARTMENT_CODES, type DepartmentCode } from '@/features/company/api';
import type { Locale } from '@/i18n/locales';
import { cn } from '@/lib/cn';
import type { PlatformCopy } from './copy';
import { DEPT_COLOR, departmentName, initials, type LoadError, type Tone } from './model';

/*
 * Shared pieces of the Platform Control Center (EP24.1). Every value shown
 * comes from the platform API; nothing here invents a number.
 */

// ------------------------------------------------------------------- loading

// --------------------------------------------------------------------- tones

const TONE: Record<Tone, string> = {
  active: 'bg-brand-primary/[0.12] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22)]',
  waiting: 'bg-warning/[0.1] text-[#f3cf8a] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]',
  danger: 'bg-danger/[0.1] text-[#f9a3a3] shadow-[inset_0_0_0_1px_rgb(244_114_114/0.28)]',
  muted: 'bg-white/[0.04] text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
  info: 'bg-brand-cool/[0.1] text-[#a9cfff] shadow-[inset_0_0_0_1px_rgb(90_169_255/0.25)]',
};

const DOT: Record<Tone, string> = {
  active: 'bg-brand-primary',
  waiting: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-text-muted',
  info: 'bg-brand-cool',
};

/** A status chip: a coloured dot plus words — colour is never the only signal. */
export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] leading-none font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} />
      <span className="truncate">{children}</span>
    </span>
  );
}

// --------------------------------------------------------- department track

/**
 * The six departments as one connected track — lit where enabled, an empty
 * ring where available, a struck ring where the package excludes it. The
 * accessible name lists the enabled ones in words.
 */
export function DepartmentTrack({
  enabled,
  notInPackage = [],
  locale,
  label,
  size = 'sm',
}: {
  enabled: readonly DepartmentCode[];
  notInPackage?: readonly DepartmentCode[];
  locale: Locale;
  label: string;
  size?: 'sm' | 'md';
}) {
  const names = enabled.map((d) => departmentName(d, locale));
  return (
    <span
      role="img"
      aria-label={`${label}: ${names.length ? names.join(', ') : '—'}`}
      className="relative inline-flex items-center"
    >
      <span
        aria-hidden
        className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgb(190_235_222/0.06),rgb(190_235_222/0.16),rgb(190_235_222/0.06))]"
      />
      <span className={cn('relative flex items-center', size === 'md' ? 'gap-2.5' : 'gap-1.5')}>
        {DEPARTMENT_CODES.map((code) => {
          const on = enabled.includes(code);
          const out = !on && notInPackage.includes(code);
          return (
            <span
              key={code}
              aria-hidden
              title={departmentName(code, locale)}
              data-dept={code}
              data-state={on ? 'on' : out ? 'out' : 'off'}
              className={cn(
                'block rounded-full',
                size === 'md' ? 'size-3' : 'size-2.5',
                on
                  ? 'shadow-[0_0_0_3px_rgb(5_11_18)]'
                  : out
                    ? 'bg-surface-dark [background-image:linear-gradient(135deg,transparent_45%,rgb(190_235_222/0.35)_45%,rgb(190_235_222/0.35)_55%,transparent_55%)] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]'
                    : 'bg-surface-dark shadow-[inset_0_0_0_1.5px_rgb(190_235_222/0.28)]',
              )}
              style={on ? { backgroundColor: DEPT_COLOR[code] } : undefined}
            />
          );
        })}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------- states

/** A deliberate state (loading, empty, no result, error) — compact, never a dashed void. */
export function StateMessage({
  kind,
  title,
  text,
  action,
}: {
  kind: 'loading' | 'empty' | 'noResult' | LoadError;
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  const icon =
    kind === 'loading' ? (
      <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
    ) : kind === 'noResult' || kind === 'notFound' ? (
      <SearchX aria-hidden className="size-5" />
    ) : kind === 'forbidden' ? (
      <ShieldOff aria-hidden className="size-5" />
    ) : kind === 'expired' ? (
      <KeyRound aria-hidden className="size-5" />
    ) : (
      <CircleAlert aria-hidden className="size-5" />
    );
  const alert =
    kind === 'temporary' || kind === 'forbidden' || kind === 'expired' || kind === 'notFound';
  return (
    <div
      role={alert ? 'alert' : 'status'}
      data-state={kind}
      className="flex items-start gap-3 rounded-2xl bg-white/[0.02] px-4 py-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:px-5"
    >
      <span className={cn('mt-0.5 shrink-0', alert ? 'text-warning' : 'text-text-muted')}>
        {icon}
      </span>
      <div className="min-w-0">
        {title && <p className="text-label font-medium text-text-primary">{title}</p>}
        {text && <p className={cn('text-caption text-text-secondary', title && 'mt-1')}>{text}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** The four error kinds, each with its own words and the one sensible next step. */
export function LoadErrorMessage({
  error,
  p,
  onRetry,
}: {
  error: LoadError;
  p: PlatformCopy;
  onRetry: () => void;
}) {
  const text = p.states[error];
  const action =
    error === 'expired' ? (
      <Link to="/login?next=%2Fplatform" className={buttonClasses('secondary', 'md')}>
        {p.states.signIn}
      </Link>
    ) : error === 'temporary' ? (
      <button type="button" onClick={onRetry} className={buttonClasses('secondary', 'md')}>
        {p.states.retry}
      </button>
    ) : undefined;
  return <StateMessage kind={error} text={text} action={action} />;
}

// --------------------------------------------------------------- formatting

/** A company mark: its initials on a calm plate (demo companies carry their own tag). */
export function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,rgb(24_48_64),rgb(9_19_29))] font-semibold tracking-wide text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.16)]',
        size === 'lg'
          ? 'size-14 text-[1.125rem] sm:size-16 sm:text-[1.25rem]'
          : 'size-10 text-[0.8125rem]',
      )}
    >
      {initials(name)}
    </span>
  );
}

/** A small section heading used across the platform pages. */
export function SectionTitle({
  id,
  title,
  lead,
  aside,
  level = 2,
}: {
  id: string;
  title: string;
  lead?: string;
  aside?: ReactNode;
  level?: 2 | 3;
}) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <H id={id} className="text-[1.0625rem] font-semibold tracking-tight text-text-primary">
          {title}
        </H>
        {lead && <p className="mt-1 text-caption text-text-muted">{lead}</p>}
      </div>
      {aside}
    </div>
  );
}
