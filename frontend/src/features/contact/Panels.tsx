import { ArrowRight, Mail, MapPin, MessageCircle, Phone, Sparkles } from 'lucide-react';
import { Fragment } from 'react';
import { useMediaQuery } from '@/components/core/hooks';
import { Frame } from '@/components/editorial/Layout';
import { companyName } from '@/config/company';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { CONTACT_COPY } from './copy';
import { LOCATION_COPY } from './locationCopy';
import type { Inquiry, Prefill } from './model';
import { Summary } from './Summary';
import { useDeptName } from './summaryText';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';

/*
 * /contact surroundings (EP13): the hero, the context the visitor arrived
 * with, and the persistent "talk directly" panel. Every phone, email and
 * LINE value comes from CONTACT.
 */

const PLAN_NAMES = {
  starter: 'Starter',
  business: 'Business',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

/** Direct channels — a real phone link, a real mailto, the exact LINE URL. */
export function DirectLinks({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const c = useCopy(CONTACT_COPY).panel;
  const { t } = useLocale();
  const link =
    'group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-label transition-colors hover:bg-white/[0.06]';
  return (
    <ul
      data-direct
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1',
        className,
      )}
    >
      <li>
        <a href={telHref()} data-direct-link="phone" className={cn(link, 'bg-white/[0.035]')}>
          <Phone aria-hidden className="size-4 shrink-0 text-brand-soft" />
          <span className="min-w-0">
            <span className="block text-caption text-text-muted">{c.call}</span>
            <span className="block font-semibold text-text-primary tabular">
              {CONTACT.phone.display}{' '}
              <span className="font-normal text-text-muted">({t.contact.phoneLabel})</span>
            </span>
          </span>
        </a>
      </li>
      <li>
        <a
          href={CONTACT.lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-direct-link="line"
          className={cn(link, 'bg-brand-primary/10 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]')}
        >
          <MessageCircle aria-hidden className="size-4 shrink-0 text-brand-glow" />
          <span className="min-w-0">
            <span className="block text-caption text-brand-soft">{c.line}</span>
            <span className="block font-semibold text-text-primary">{CONTACT.lineId}</span>
          </span>
          <span className="sr-only"> {t.contact.opensInNewTab}</span>
        </a>
      </li>
      <li>
        <a href={mailtoHref()} data-direct-link="email" className={cn(link, 'bg-white/[0.035]')}>
          <Mail aria-hidden className="size-4 shrink-0 text-brand-soft" />
          <span className="min-w-0">
            <span className="block text-caption text-text-muted">{c.email}</span>
            <span className="block font-semibold break-all text-text-primary">{CONTACT.email}</span>
          </span>
        </a>
      </li>
    </ul>
  );
}

export function ContactHero() {
  const c = useCopy(CONTACT_COPY).hero;
  return (
    <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
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
      <Frame width="wide" className="pt-28 pb-12 sm:pt-32 lg:pt-36 lg:pb-16">
        <div className="grid grid-cols-1 gap-10 lg:max-w-4xl">
          <div>
            <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
              <span aria-hidden className="h-px w-6 bg-current opacity-70" />
              {c.eyebrow}
            </p>
            <h1
              id="contact-title"
              className="mt-5 text-[clamp(2rem,1.2rem+2.9vw,3.75rem)] leading-[1.18] font-semibold tracking-tight text-text-primary"
            >
              <Lines text={c.title} />
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.lead}</p>
            {/* inquiry → context → conversation */}
            <ol
              aria-hidden
              className="mt-8 flex flex-wrap items-center gap-2 text-caption text-text-muted"
            >
              {c.flow.map((f, i) => (
                <Fragment key={f}>
                  <li
                    className={cn(
                      'rounded-full px-3 py-1.5',
                      i === 2 ? 'bg-brand-primary/12 text-brand-soft' : 'bg-white/[0.04]',
                    )}
                  >
                    {f}
                  </li>
                  {i < c.flow.length - 1 && <ArrowRight className="size-3.5 text-brand-glow/60" />}
                </Fragment>
              ))}
            </ol>
          </div>
          {/* Phones and tablets reach the direct channels here; wide screens use the panel. */}
          <div className="lg:hidden" data-hero-direct>
            <p className="text-caption font-semibold text-text-muted">{c.direct}</p>
            <DirectLinks compact className="mt-3" />
          </div>
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

export function DirectPanel({ inquiry }: { inquiry: Inquiry }) {
  const c = useCopy(CONTACT_COPY).panel;
  const { locale } = useLocale();
  const wide = useMediaQuery('(min-width: 64rem)');
  const seeMap = useCopy(LOCATION_COPY).seeMap;
  return (
    <aside
      aria-labelledby="direct-title"
      data-direct-panel
      className="rounded-[2rem] bg-white/[0.025] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:p-7"
    >
      <h2 id="direct-title" className="text-h3 text-text-primary">
        {c.title}
      </h2>
      <p className="mt-1 text-caption text-text-secondary">{c.lead}</p>
      <DirectLinks className="mt-5" />

      {/* Desktop: always open. Phones: collapsible, never sticky. */}
      <details
        key={wide ? 'wide' : 'narrow'}
        data-live-summary
        open={wide || undefined}
        className="group mt-7 border-t border-border-soft pt-5 lg:pointer-events-none"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-caption font-semibold text-text-muted lg:cursor-default">
          {c.summaryTitle}
          <DisclosureIcon size="sm" className="lg:hidden" />
        </summary>
        <Summary inquiry={inquiry} includeContact={false} className="mt-2" />
      </details>

      <div className="mt-7 border-t border-border-soft pt-5">
        <p className="text-caption font-semibold text-text-muted">{c.needsTitle}</p>
        <ul className="mt-3 space-y-1.5">
          {c.needs.map((n) => (
            <li key={n} className="flex items-baseline gap-2.5 text-caption text-text-secondary">
              <span
                aria-hidden
                className="size-1 shrink-0 translate-y-[-0.15em] rounded-full bg-brand-glow"
              />
              {n}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-7 border-t border-border-soft pt-5">
        <p className="text-caption font-semibold text-text-muted">{c.company}</p>
        <p className="mt-2 text-label text-text-primary" lang={locale === 'th' ? 'th' : undefined}>
          {companyName(locale)}
        </p>
        <p lang="th" className="mt-1 text-caption text-text-secondary">
          {CONTACT.address}
        </p>
        <a
          href="#location"
          data-see-map
          className="mt-3 inline-flex min-h-6 items-center gap-1.5 text-caption text-brand-soft underline underline-offset-4 hover:text-brand-glow"
        >
          <MapPin aria-hidden className="size-3.5" />
          {seeMap}
        </a>
      </div>
    </aside>
  );
}
