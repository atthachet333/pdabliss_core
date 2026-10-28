import {
  ArrowRight,
  ArrowUpRight,
  Mail,
  MessageCircle,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { STEPS } from '@/features/contact/model';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { CONTACT_PAGE_COPY } from './contactPageCopy';
import { controlArrow, coreControl, metaText } from './coreControls';

/*
 * /contact (EP24.1.4.3 split; EP24.1.4.4 recomposition): where the outside
 * world connects to PDA BLISS. A company endpoint, not a landing page — a
 * compact intro, the three direct channels as one rail of endpoints, the
 * location as the page's main visual, and a bridge into /consultation for
 * people who are not sure where to start. Nothing here imports the wizard.
 */

/** Section metadata: a short teal rule, an index, a label. */
export function SectionMark({
  index,
  children,
  className,
}: {
  index: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('flex items-center gap-3 text-text-muted', className)}>
      <span aria-hidden className="h-px w-5 bg-brand-primary/70" />
      <span aria-hidden lang="en" className={cn(metaText, 'text-brand-soft')}>
        {index}
      </span>
      <span className={metaText}>{children}</span>
    </p>
  );
}

export function ContactIntro() {
  const c = useCopy(CONTACT_PAGE_COPY);
  const { href } = useLocale();
  return (
    <section aria-labelledby="contact-title" className="relative isolate">
      {/* A faint teal falloff behind the endpoint, top right. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(ellipse_45%_60%_at_92%_0%,rgb(62_224_180/0.07),transparent_72%)]"
      />
      <Frame width="wide" className="pt-24 sm:pt-28 lg:pt-32">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-end lg:gap-16">
          <div>
            <p className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-brand-glow shadow-[0_0_0_3px_rgb(62_240_192/0.14)]"
              />
              <span className={cn(metaText, 'text-brand-soft')}>{c.hero.eyebrow}</span>
              <span aria-hidden className="h-px w-6 bg-white/15" />
              <span lang="en" className={cn(metaText, 'text-text-muted')}>
                PDA BLISS
              </span>
            </p>
            <h1
              id="contact-title"
              className="mt-5 text-[clamp(2.125rem,1.55rem+2.1vw,3.5rem)] leading-[1.12] font-semibold tracking-[-0.015em] text-text-primary"
            >
              {c.hero.title}
            </h1>
          </div>
          <div className="max-w-xl lg:pb-1.5">
            <p className="text-body leading-relaxed text-text-secondary">{c.hero.lead}</p>
            {/* The consultation path, signposted from the first screen. */}
            <Link
              to={href('/consultation')}
              data-consultation-signpost
              className="group/ctl mt-3 inline-flex min-h-11 items-center gap-2 text-label font-semibold text-brand-soft transition-colors hover:text-brand-glow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
            >
              {c.hero.signpost}
              <ArrowRight aria-hidden className={controlArrow} />
            </Link>
          </div>
        </div>
        <DirectContact />
      </Frame>
    </section>
  );
}

/** Phone · LINE OA · email — once on the page, as one rail of endpoints (stacked on phones). */
function DirectContact() {
  const c = useCopy(CONTACT_PAGE_COPY).direct;
  const { t } = useLocale();
  return (
    <div data-direct-contact className="relative mt-10 sm:mt-12">
      <h2 className="sr-only">{c.title}</h2>
      {/* The rail: a hairline with a teal segment where the endpoints begin. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgb(62_240_192/0.55),rgb(62_240_192/0.12)_28%,rgb(255_255_255/0.08)_60%)]"
      />
      <ul className="grid border-b border-white/[0.08] md:grid-cols-[1.05fr_0.75fr_1.2fr] lg:grid-cols-3">
        <Endpoint
          icon={Phone}
          label={c.call}
          href={telHref()}
          kind="phone"
          value={
            <>
              <span className="tabular">{CONTACT.phone.display}</span>{' '}
              <span className="font-normal text-text-muted">({t.contact.phoneLabel})</span>
            </>
          }
        />
        <Endpoint
          icon={MessageCircle}
          label={c.line}
          href={CONTACT.lineUrl}
          kind="line"
          external={t.contact.opensInNewTab}
          value={CONTACT.lineId}
        />
        <Endpoint
          icon={Mail}
          label={c.email}
          href={mailtoHref()}
          kind="email"
          value={<span className="break-all">{CONTACT.email}</span>}
        />
      </ul>
    </div>
  );
}

function Endpoint({
  icon: Icon,
  label,
  href,
  kind,
  value,
  external,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  kind: string;
  value: ReactNode;
  /** Set for links that open a new tab: the announcement text. */
  external?: string;
}) {
  return (
    <li className="relative min-w-0 border-t border-white/[0.06] first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0">
      {/* The node where this endpoint meets the rail. */}
      <span
        aria-hidden
        className="absolute top-0 left-0 hidden size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-glow/80 md:block md:[li:first-child>&]:hidden"
      />
      <a
        href={href}
        data-direct-link={kind}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="group relative flex min-h-[4.75rem] items-center gap-4 py-4 transition-colors hover:bg-[linear-gradient(180deg,rgb(62_240_192/0.05),transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none md:px-5 lg:px-6 md:[li:first-child>&]:pl-0"
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-[8px] text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28)] transition-[background-color,box-shadow] group-hover:bg-brand-primary/[0.08] group-hover:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.55)] md:hidden lg:grid"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn(metaText, 'block text-text-muted')}>{label}</span>
          <span className="mt-2 block text-body font-semibold text-text-primary transition-colors group-hover:text-brand-soft">
            {value}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="hidden size-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none lg:block"
        />
        {external && <span className="sr-only"> {external}</span>}
      </a>
    </li>
  );
}

/**
 * For people who don't yet know what they need: a bridge into /consultation.
 * Not another card — a section between hairlines whose rail previews the six
 * short steps and ends at the one action.
 */
export function ConsultationInvite() {
  const c = useCopy(CONTACT_PAGE_COPY);
  const { href } = useLocale();
  return (
    <section
      aria-labelledby="invite-title"
      data-consultation-invite
      className="relative isolate border-y border-white/[0.08] py-12 sm:py-14 lg:py-16"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_40%_80%_at_85%_50%,rgb(62_224_180/0.07),transparent_72%)]"
      />
      {/* A technical grid behind the path, fading out at its edges. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 hidden w-3/5 bg-grid [mask-image:radial-gradient(ellipse_70%_75%_at_60%_50%,black,transparent_75%)] opacity-50 lg:block"
      />
      <span
        aria-hidden
        className="absolute -top-px left-0 h-px w-40 bg-[linear-gradient(90deg,rgb(62_240_192/0.7),transparent)]"
      />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div className="max-w-xl">
          <SectionMark index="03">{c.sections.consult}</SectionMark>
          <h2
            id="invite-title"
            className="mt-6 text-[clamp(1.5rem,1.25rem+0.9vw,2.125rem)] leading-[1.25] font-semibold tracking-[-0.01em] text-text-primary"
          >
            {c.invite.title}
          </h2>
          <p className="mt-4 text-body leading-relaxed text-text-secondary">{c.invite.body}</p>
        </div>
        <div>
          <p className="text-caption text-text-muted">{c.invite.path}</p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-5">
            <StepRail />
            <Link
              to={href('/consultation')}
              data-consultation-cta
              className={coreControl('primary', 'w-full shrink-0 sm:w-auto')}
            >
              {c.invite.cta}
              <ArrowRight aria-hidden className={controlArrow} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The six consultation steps as nodes on a line that runs into the action. */
function StepRail() {
  return (
    <ol aria-hidden className="relative flex min-w-0 flex-1 items-center justify-between">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgb(62_240_192/0.15),rgb(62_240_192/0.6))]" />
      {STEPS.map((step, i) => (
        <li key={step} className="relative flex flex-col items-center">
          <span
            className={cn(
              'block size-2 rounded-full ring-4 ring-surface-dark',
              i === 0
                ? 'bg-brand-glow'
                : 'bg-[#0d1b24] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]',
            )}
          />
          <span
            lang="en"
            className="absolute top-4 font-mono text-[0.625rem] tracking-[0.12em] text-text-muted"
          >
            {String(i + 1).padStart(2, '0')}
          </span>
        </li>
      ))}
    </ol>
  );
}
