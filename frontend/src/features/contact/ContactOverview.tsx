import { ArrowRight, Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Frame } from '@/components/editorial/Layout';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { CONTACT_PAGE_COPY } from './contactPageCopy';

/*
 * /contact (EP24.1.4.3): a company contact page, not an intake form. The
 * intro says who you are talking to; the three direct channels sit in one
 * restrained rail right under it (the only place on the page with them); the
 * invitation at the end leads people who are not sure where to start into
 * /consultation. Nothing here imports the consultation wizard.
 */

export function ContactIntro() {
  const c = useCopy(CONTACT_PAGE_COPY);
  return (
    <section aria-labelledby="contact-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_70%_at_88%_0%,rgb(62_224_180/0.09),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-12 sm:pt-32 lg:pb-16">
        <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
          <span aria-hidden className="h-px w-6 bg-current opacity-70" />
          {c.hero.eyebrow}
        </p>
        <h1
          id="contact-title"
          className="mt-5 text-[clamp(2.25rem,1.3rem+3.4vw,4.25rem)] leading-[1.1] font-semibold tracking-tight text-text-primary"
        >
          {c.hero.title}
        </h1>
        <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.hero.lead}</p>
        <DirectContact />
      </Frame>
    </section>
  );
}

/** Phone · LINE OA · email — once on the page, as one quiet rail (stacked on phones). */
function DirectContact() {
  const c = useCopy(CONTACT_PAGE_COPY).direct;
  const { t } = useLocale();
  return (
    <div data-direct-contact className="mt-10 lg:mt-12">
      <h2 className="sr-only">{c.title}</h2>
      <ul className="grid divide-y divide-white/[0.08] border-y border-white/[0.08] md:grid-cols-3 md:divide-x md:divide-y-0">
        <Channel
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
        <Channel
          icon={MessageCircle}
          label={c.line}
          href={CONTACT.lineUrl}
          kind="line"
          external={t.contact.opensInNewTab}
          value={CONTACT.lineId}
        />
        <Channel
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

function Channel({
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
    <li className="min-w-0">
      <a
        href={href}
        data-direct-link={kind}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="group flex min-h-16 items-center gap-4 py-4 transition-colors hover:text-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none md:px-6 md:first:pl-0"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)] transition-colors group-hover:bg-brand-primary/[0.08]"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-caption text-text-muted">{label}</span>
          <span className="block text-label font-semibold text-text-primary">{value}</span>
        </span>
        {external && <span className="sr-only"> {external}</span>}
      </a>
    </li>
  );
}

/** For people who don't yet know what they need: the way into /consultation. */
export function ConsultationInvite() {
  const c = useCopy(CONTACT_PAGE_COPY).invite;
  const { href } = useLocale();
  return (
    <section
      aria-labelledby="invite-title"
      data-consultation-invite
      className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgb(11_30_36/0.95),rgb(6_14_21/0.98))] px-6 py-10 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.18)] sm:px-10 lg:px-14 lg:py-14"
    >
      {/* Two faint lines meeting at one point — a conversation finding its start. */}
      <svg
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 hidden h-full w-1/2 opacity-70 md:block"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 40 C 160 40, 220 100, 400 100"
          stroke="#3ef0c0"
          strokeOpacity="0.14"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0 160 C 160 160, 220 100, 400 100"
          stroke="#d6e2e6"
          strokeOpacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
        <div className="max-w-2xl">
          <h2
            id="invite-title"
            className="text-[clamp(1.5rem,1.15rem+1.4vw,2.375rem)] leading-tight font-semibold tracking-tight text-text-primary"
          >
            {c.title}
          </h2>
          <p className="mt-4 text-body leading-relaxed text-text-secondary">{c.body}</p>
        </div>
        <Link
          to={href('/consultation')}
          data-consultation-cta
          className={buttonClasses('primary', 'lg', 'w-full sm:w-auto')}
        >
          {c.cta}
          <ArrowRight aria-hidden className="size-5" />
        </Link>
      </div>
    </section>
  );
}
