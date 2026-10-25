import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Kicker } from '@/components/editorial/Layout';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { EASE_CORE } from '@/motion/tokens';

/*
 * Shared primitives for the company story pages (/about, /why-core — EP12).
 * Editorial type, quiet links and the company's name — never cards.
 */

/**
 * Multi-line display text. `\n` starts a new line; `|` marks where a line may
 * wrap on narrow screens (Thai has no spaces, so wrap points are authored).
 * A space before `|` is kept as a real space between the chunks. Each line
 * ends with a (visually collapsed) space so headings read as words, not
 * "askingwhat", to assistive technology and in text content.
 */
export function Lines({ text, className }: { text: string; className?: string }) {
  return text.split('\n').map((line, i) => (
    <span key={i} className={cn('block', className)}>
      {line.split('|').map((chunk, k) => (
        <Fragment key={k}>
          <span className="inline-block">{chunk.trimEnd()}</span>
          {chunk.endsWith(' ') && ' '}
        </Fragment>
      ))}{' '}
    </span>
  ));
}

const TITLE = {
  statement: 'text-[clamp(2rem,1.2rem+3vw,4rem)] leading-[1.18]',
  title: 'text-[clamp(1.75rem,1.2rem+1.9vw,2.85rem)] leading-[1.25]',
  quiet: 'text-[clamp(1.5rem,1.15rem+1.3vw,2.25rem)] leading-[1.3]',
} as const;

/**
 * Chapter number + label, then an editorial title and an optional lead.
 * EP13 (/about): `ghost` adds an oversized, near-invisible chapter number
 * behind the head and a rule that draws on entry; `notation` adds a small
 * figure note in system notation. Numbers never outweigh the content.
 */
export function StoryHead({
  index,
  kicker,
  id,
  title,
  lead,
  size = 'title',
  center = false,
  ghost = false,
  notation,
  className,
  children,
}: {
  index?: string;
  kicker: string;
  id: string;
  title: string;
  lead?: string;
  size?: keyof typeof TITLE;
  center?: boolean;
  ghost?: boolean;
  notation?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        center ? 'mx-auto max-w-4xl text-center' : 'max-w-3xl',
        ghost && 'relative isolate',
        className,
      )}
    >
      {ghost && index && (
        <span
          aria-hidden
          data-ghost-number
          className="pointer-events-none absolute -top-16 -left-3 -z-10 text-[clamp(7rem,5rem+8vw,13rem)] leading-none font-semibold tracking-tighter text-white/[0.035] tabular select-none sm:-top-24"
        >
          {index}
        </span>
      )}
      <Kicker tone="clear" className={cn(center && 'justify-center')}>
        {index && (
          <span className="text-text-muted tabular" aria-hidden>
            {index}
          </span>
        )}
        {kicker}
      </Kicker>
      {ghost && (
        <motion.span
          aria-hidden
          className="mt-3 block h-px w-full max-w-[14rem] origin-left bg-[linear-gradient(90deg,rgb(62_240_192/0.6),transparent)]"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 1.1, ease: EASE_CORE }}
        />
      )}
      {notation && (
        <p
          data-notation
          // EP19: full muted tone (5.5:1) — at 80 % the 11 px notation fell to 3.9:1.
          className="mt-2 font-mono text-[0.6875rem] tracking-wide text-text-muted"
        >
          {notation}
        </p>
      )}
      <Reveal>
        <h2
          id={id}
          className={cn('mt-5 font-semibold tracking-tight text-text-primary', TITLE[size])}
        >
          <Lines text={title} />
        </h2>
      </Reveal>
      {lead && (
        <p className={cn('mt-6 max-w-2xl text-body-lg text-text-secondary', center && 'mx-auto')}>
          {lead}
        </p>
      )}
      {children}
    </div>
  );
}

/** A quiet, locale-preserving text link with an arrow. */
export function QuietLink({
  to,
  children,
  className,
  data,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  data?: string;
}) {
  const { href } = useLocale();
  return (
    <Link
      to={href(to)}
      data-link={data}
      className={cn(
        'group inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft underline-offset-4 hover:underline',
        className,
      )}
    >
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** A small external link (LINE) — always a new tab, always announced. */
export function ExternalLink({
  href,
  children,
  newTab,
  className,
}: {
  href: string;
  children: ReactNode;
  newTab: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('group inline-flex min-h-11 items-center gap-1.5', className)}
    >
      {children}
      <ArrowUpRight aria-hidden className="size-4" />
      <span className="sr-only"> {newTab}</span>
    </a>
  );
}

/** The department's workspace colour as a small dot. */
export function DeptDot({ id, className }: { id: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: `var(--color-ws-${id})` }}
    />
  );
}
