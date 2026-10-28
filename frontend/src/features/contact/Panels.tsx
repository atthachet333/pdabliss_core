import { ArrowLeft, Mail, MessageCircle, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { Frame } from '@/components/editorial/Layout';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { metaText } from './coreControls';
import { CONTACT_COPY } from './copy';
import { STEPS, type Inquiry, type Prefill } from './model';
import { Summary } from './Summary';
import { useDeptName } from './summaryText';

/*
 * /consultation surroundings (EP13; own route since EP24.1.4.3; recomposed in
 * EP24.1.4.4 as a guided discovery): a compact hero with the way back to
 * Contact, the context the visitor arrived with, a light context rail that
 * follows the conversation (current path · progress), and a quiet fallback
 * for people who would rather call, write or chat. Every phone, email and
 * LINE value comes from CONTACT.
 */

const PLAN_NAMES = {
  starter: 'Starter',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function ConsultationHero() {
  const c = useCopy(CONTACT_COPY);
  const { href } = useLocale();
  return (
    <section aria-labelledby="consultation-title" className="relative isolate">
      {/* Faint routes converging at the right edge — many inputs, one path. */}
      <svg
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 hidden h-full w-1/2 opacity-80 lg:block"
        preserveAspectRatio="none"
        viewBox="0 0 400 200"
        fill="none"
      >
        {[30, 70, 110, 150, 190].map((y) => (
          <path
            key={y}
            d={`M0 ${y} C 170 ${y}, 230 110, 400 110`}
            stroke="#3ef0c0"
            strokeOpacity="0.07"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(ellipse_45%_60%_at_92%_0%,rgb(62_224_180/0.07),transparent_72%)]"
      />
      <Frame width="wide" className="pt-24 pb-9 sm:pt-28 lg:pb-12">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            to={href('/contact')}
            data-back-to-contact
            className="group/back -ml-1 inline-flex min-h-11 items-center gap-2 rounded-[6px] px-1 text-caption font-medium text-text-secondary transition-colors hover:text-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
          >
            <ArrowLeft
              aria-hidden
              className="size-3.5 transition-transform group-hover/back:-translate-x-0.5 motion-reduce:transition-none"
            />
            {c.consultation.back}
          </Link>
          <span aria-hidden className="h-3.5 w-px bg-white/15" />
          <p className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-glow shadow-[0_0_0_3px_rgb(62_240_192/0.14)]"
            />
            <span className={cn(metaText, 'text-brand-soft')}>{c.hero.eyebrow}</span>
            <span aria-hidden className="h-px w-6 bg-white/15" />
            <span lang="en" className={cn(metaText, 'text-text-muted')}>
              Discovery
            </span>
          </p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end lg:gap-16">
          <h1
            id="consultation-title"
            className="text-[clamp(1.875rem,1.4rem+1.8vw,3.25rem)] leading-[1.18] font-semibold tracking-[-0.015em] text-text-primary"
          >
            <Lines text={c.hero.title} />
          </h1>
          <p className="max-w-xl text-body leading-relaxed text-text-secondary lg:pb-1.5">
            {c.hero.lead}
          </p>
        </div>
      </Frame>
    </section>
  );
}

/** What we already know from the page the visitor came from. */
export function ContextBanner({ prefill }: { prefill: Prefill }) {
  const c = useCopy(CONTACT_COPY);
  const deptName = useDeptName();
  const lines: string[] = [];
  if (prefill.plan === 'enterprise' || (!prefill.plan && prefill.type === 'enterprise'))
    lines.push(c.context.enterprise);
  else if (prefill.plan) lines.push(c.context.plan(PLAN_NAMES[prefill.plan]));
  if (prefill.department) lines.push(c.context.department(deptName(prefill.department)));
  if (prefill.industry) lines.push(c.context.industry(c.industries[prefill.industry]));
  if (!lines.length) return null;
  return (
    <div
      data-context
      className="mb-8 flex flex-col gap-2 rounded-r-[8px] border-l-2 border-brand-primary/70 bg-[linear-gradient(90deg,rgb(62_240_192/0.08),transparent)] py-3 pr-4 pl-4 sm:flex-row sm:items-baseline sm:gap-5"
    >
      <p className="shrink-0 text-caption font-semibold text-brand-soft">{c.context.label}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {lines.map((l) => (
          <li key={l} data-context-line className="text-label font-semibold text-text-primary">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The context rail: where the conversation stands (step n of six) and what
 * has been chosen so far. Open on wide screens; a disclosure below the
 * conversation on phones (never sticky there).
 */
export function LiveSummary({ inquiry, step }: { inquiry: Inquiry; step: number }) {
  const c = useCopy(CONTACT_COPY).panel;
  const wide = useMediaQuery('(min-width: 64rem)');
  return (
    <details
      key={wide ? 'wide' : 'narrow'}
      data-live-summary
      open={wide || undefined}
      className="group border-y border-white/[0.07] lg:pointer-events-none lg:border-0"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 lg:cursor-default">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-px w-4 bg-brand-primary/70" />
          <span className={cn(metaText, 'text-text-secondary')}>{c.summaryTitle}</span>
        </span>
        <DisclosureIcon size="sm" className="lg:hidden" />
      </summary>
      <div className="pb-3">
        <div data-progress className="mt-2 flex items-center justify-between gap-4 py-2">
          <span className="text-caption text-text-muted">{c.progress}</span>
          <span lang="en" className="font-mono text-[0.75rem] tracking-[0.12em] text-text-primary">
            {pad(step + 1)} <span className="text-text-muted">/ {pad(STEPS.length)}</span>
          </span>
        </div>
        <div aria-hidden className="grid grid-cols-6 gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-[3px] rounded-[1px]',
                i === step ? 'bg-brand-glow' : i < step ? 'bg-brand-primary/45' : 'bg-white/[0.08]',
              )}
            />
          ))}
        </div>
        <Summary
          inquiry={inquiry}
          includeContact={false}
          stacked={wide}
          className="mt-3 border-t border-white/[0.06]"
        />
      </div>
    </details>
  );
}

/** For people who would rather not fill the conversation in: the three channels, quietly. */
export function ConsultationFallback() {
  const c = useCopy(CONTACT_COPY).consultation;
  const { t } = useLocale();
  const item =
    'group flex min-h-11 items-center gap-3 rounded-[6px] text-label transition-colors hover:text-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none';
  const icon = 'size-3.5 shrink-0 text-brand-soft/80';
  return (
    <section
      aria-labelledby="fallback-title"
      data-fallback
      className="border-t border-white/[0.07] pt-5 lg:pt-6"
    >
      <h2 id="fallback-title" className="text-caption font-semibold text-text-secondary">
        {c.fallbackTitle}
      </h2>
      <p className="mt-0.5 text-caption text-text-muted">{c.fallbackLead}</p>
      <ul className="mt-2 grid">
        <li>
          <a href={telHref()} data-fallback-link="phone" className={item}>
            <Phone aria-hidden className={icon} />
            <span className="sr-only">{c.call}: </span>
            <span className="font-semibold text-text-primary tabular group-hover:text-brand-soft">
              {CONTACT.phone.display}
            </span>
            <span className="text-caption text-text-muted">({t.contact.phoneLabel})</span>
          </a>
        </li>
        <li>
          <a
            href={CONTACT.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-fallback-link="line"
            className={item}
          >
            <MessageCircle aria-hidden className={icon} />
            <span className="sr-only">{c.line}: </span>
            <span className="font-semibold text-text-primary group-hover:text-brand-soft">
              {CONTACT.lineId}
            </span>
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </li>
        <li>
          <a href={mailtoHref()} data-fallback-link="email" className={item}>
            <Mail aria-hidden className={icon} />
            <span className="sr-only">{c.email}: </span>
            <span className="min-w-0 font-semibold break-all text-text-primary group-hover:text-brand-soft">
              {CONTACT.email}
            </span>
          </a>
        </li>
      </ul>
    </section>
  );
}
