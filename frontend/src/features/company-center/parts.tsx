import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router';
import { useLocale } from '@/i18n/useLocale';
import { Notice } from '@/features/auth/AuthFrame';
import { cn } from '@/lib/cn';
import { logoUrl } from './api';
import { initials } from './model';

/*
 * Small building blocks of the Company Control Center (EP25). The customer
 * side reads as operational teal — a sibling of the Platform Control Center's
 * gold authority, never a copy of it: flat sections separated by hairlines
 * instead of a wall of cards, facts as label/value rows, actions where the
 * work is.
 */

/** The company's logo, or its initials on a teal tile. Never a broken image. */
export function CompanyMark({
  name,
  logo,
  size = 'md',
}: {
  name: string;
  logo: { version: string } | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const box =
    size === 'lg'
      ? 'size-16 rounded-2xl'
      : size === 'md'
        ? 'size-11 rounded-xl'
        : 'size-9 rounded-lg';
  if (logo && !failed) {
    return (
      <img
        src={logoUrl(logo.version)}
        alt=""
        onError={() => setFailed(true)}
        data-company-logo
        className={cn(
          box,
          'shrink-0 bg-white object-contain p-1 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.18)]',
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-company-initials
      className={cn(
        box,
        'grid shrink-0 place-items-center bg-[linear-gradient(145deg,rgb(62_240_192/0.22),rgb(20_120_110/0.18))] font-semibold text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]',
        size === 'lg' ? 'text-h3' : 'text-label',
      )}
    >
      {initials(name)}
    </span>
  );
}

/** A page heading block: kicker, h1 and a short lead. */
export function PageTitle({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl min-w-0">
        <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {lead && <p className="mt-2 text-label leading-relaxed text-text-secondary">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** A flat, titled section — hairline above, no card chrome. */
export function Section({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('min-w-0 border-t border-white/[0.07] pt-5', className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-body font-semibold text-text-primary">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Label/value rows (a real description list). */
export function Facts({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-2.5 text-label sm:grid-cols-[minmax(9rem,max-content)_minmax(0,1fr)]',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-text-primary max-sm:-mt-1.5 max-sm:mb-1">
        {children}
      </dd>
    </>
  );
}

export function Pill({
  tone = 'neutral',
  wrap = false,
  children,
  className,
  ...data
}: {
  tone?: 'teal' | 'neutral' | 'warning' | 'muted';
  /** Long data (a branch name) may wrap instead of overflowing a narrow screen. */
  wrap?: boolean;
  children: ReactNode;
  className?: string;
  /** `data-*` hooks (e.g. a status code) are passed through to the element. */
} & { [key: `data-${string}`]: string | boolean | undefined }) {
  return (
    <span
      {...data}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption',
        wrap ? 'break-words' : 'whitespace-nowrap',
        tone === 'teal' &&
          'bg-brand-primary/[0.1] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22)]',
        tone === 'neutral' && 'bg-white/[0.06] text-text-secondary',
        tone === 'warning' && 'bg-warning/[0.12] text-[#f3cf8a]',
        tone === 'muted' &&
          'bg-transparent text-text-muted shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-caption text-text-muted">
      <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );
}

/** A save result line under a form (polite status or an alert). */
export function Result({ result }: { result: { tone: 'success' | 'error'; text: string } | null }) {
  if (!result) return null;
  return <Notice tone={result.tone}>{result.text}</Notice>;
}

/** An in-area link that keeps the current language (signed-in screens carry it in router state). */
export function AreaLink(props: LinkProps) {
  const { locale } = useLocale();
  return <Link {...props} state={{ locale }} />;
}

export function AreaNavLink(props: NavLinkProps) {
  const { locale } = useLocale();
  return <NavLink {...props} state={{ locale }} />;
}
