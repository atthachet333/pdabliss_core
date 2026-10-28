import { ArrowLeft, Mail, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { Frame } from '@/components/editorial/Layout';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { CONTACT_COPY } from './copy';
import type { Inquiry, Prefill } from './model';
import { Summary } from './Summary';
import { useDeptName } from './summaryText';

/*
 * /consultation surroundings (EP13; their own route since EP24.1.4.3): the
 * hero with the way back to Contact, the context the visitor arrived with,
 * the live summary that follows the conversation, and a quiet fallback for
 * people who would rather just call, write or chat. Every phone, email and
 * LINE value comes from CONTACT.
 */

const PLAN_NAMES = {
  starter: 'Starter',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

export function ConsultationHero() {
  const c = useCopy(CONTACT_COPY);
  const { href } = useLocale();
  return (
    <section aria-labelledby="consultation-title" className="relative isolate overflow-hidden">
      {/* A few faint converging lines — the conversation coming together at one point. */}
      <svg
        aria-hidden
        className="absolute inset-0 -z-10 size-full opacity-60"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {[22, 48, 74].map((y, i) => (
          <path
            key={y}
            d={`M 0 ${y} C 30 ${y - 8 + i * 4}, 60 ${y + 10 - i * 3}, 100 ${y - 4}`}
            fill="none"
            stroke="#3ef0c0"
            strokeOpacity="0.06"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_85%_10%,rgb(62_224_180/0.08),transparent_70%)]"
      />
      <Frame width="wide" className="pt-24 pb-10 sm:pt-28 lg:pb-12">
        <Link
          to={href('/contact')}
          data-back-to-contact
          className="inline-flex min-h-11 items-center gap-2 rounded-full text-caption font-semibold text-text-secondary transition-colors hover:text-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {c.consultation.back}
        </Link>
        <div className="mt-6 lg:max-w-4xl">
          <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
            <span aria-hidden className="h-px w-6 bg-current opacity-70" />
            {c.hero.eyebrow}
          </p>
          <h1
            id="consultation-title"
            className="mt-5 text-[clamp(2rem,1.2rem+2.9vw,3.75rem)] leading-[1.18] font-semibold tracking-tight text-text-primary"
          >
            <Lines text={c.hero.title} />
          </h1>
          <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.hero.lead}</p>
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
      className="mb-6 rounded-2xl bg-brand-primary/[0.07] px-5 py-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
    >
      <p className="flex items-center gap-2 text-caption font-semibold text-brand-soft">
        <Sparkles aria-hidden className="size-3.5" />
        {c.context.label}
      </p>
      <ul className="mt-2 space-y-1">
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
 * What the visitor has chosen so far, beside the conversation it follows.
 * Open on wide screens; a disclosure on phones (never sticky).
 */
export function LiveSummary({ inquiry }: { inquiry: Inquiry }) {
  const c = useCopy(CONTACT_COPY).panel;
  const wide = useMediaQuery('(min-width: 64rem)');
  return (
    <details
      key={wide ? 'wide' : 'narrow'}
      data-live-summary
      open={wide || undefined}
      className="group rounded-2xl px-5 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:px-6 lg:pointer-events-none"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-caption font-semibold text-text-muted lg:cursor-default">
        {c.summaryTitle}
        <DisclosureIcon size="sm" className="lg:hidden" />
      </summary>
      <Summary inquiry={inquiry} includeContact={false} className="mt-1 pb-2" />
    </details>
  );
}

/** For people who would rather not fill the conversation in: the three channels, quietly. */
export function ConsultationFallback() {
  const c = useCopy(CONTACT_COPY).consultation;
  const { t } = useLocale();
  const item =
    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-label transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none';
  return (
    <section aria-labelledby="fallback-title" data-fallback className="px-1">
      <h2 id="fallback-title" className="text-caption font-semibold text-text-secondary">
        {c.fallbackTitle}
      </h2>
      <p className="mt-0.5 text-caption text-text-muted">{c.fallbackLead}</p>
      <ul className="mt-3 grid gap-1">
        <li>
          <a href={telHref()} data-fallback-link="phone" className={item}>
            <Phone aria-hidden className="size-4 shrink-0 text-brand-soft" />
            <span className="sr-only">{c.call}: </span>
            <span className="font-semibold text-text-primary tabular">{CONTACT.phone.display}</span>
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
            <MessageCircle aria-hidden className="size-4 shrink-0 text-brand-soft" />
            <span className="sr-only">{c.line}: </span>
            <span className="font-semibold text-text-primary">{CONTACT.lineId}</span>
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </li>
        <li>
          <a href={mailtoHref()} data-fallback-link="email" className={item}>
            <Mail aria-hidden className="size-4 shrink-0 text-brand-soft" />
            <span className="sr-only">{c.email}: </span>
            <span className="min-w-0 font-semibold break-all text-text-primary">
              {CONTACT.email}
            </span>
          </a>
        </li>
      </ul>
    </section>
  );
}
