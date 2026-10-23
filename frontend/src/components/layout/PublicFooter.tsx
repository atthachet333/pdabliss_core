import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { Container } from '@/components/ui/Section';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { FOOTER_GROUPS } from '@/config/navigation';
import { COPYRIGHT_YEAR } from '@/config/site';
import { useCookieSettings } from '@/features/consent/useCookieSettings';
import { useLocale } from '@/i18n/useLocale';
import type { ShellMessages } from '@/i18n/types';

type FooterLinkId = (typeof FOOTER_GROUPS)[number]['links'][number]['id'];

function linkLabel(t: ShellMessages, id: FooterLinkId) {
  return id === 'overview' || id === 'contact' ? t.nav[id] : t.nav.groups[id].label;
}

/** Restrained network lines and CORE orbit — background only (intensity ~2/10). */
function FooterGeometry() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden size-full md:block"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1440 520"
    >
      <defs>
        <radialGradient id="footer-glow" cx="12%" cy="0%" r="55%">
          <stop offset="0%" stopColor="rgb(25 195 154)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="rgb(25 195 154)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="footer-line" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--color-brand-glow)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-brand-glow)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-brand-glow)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1440" height="520" fill="url(#footer-glow)" />
      <g fill="none" stroke="url(#footer-line)" strokeWidth="0.8">
        <path d="M0 410 C 260 360, 420 440, 700 380 S 1160 300, 1440 350" />
        <path d="M0 470 C 300 430, 520 500, 820 450 S 1240 390, 1440 420" />
      </g>
      <g fill="none" stroke="var(--color-brand-glow)" strokeOpacity="0.06" strokeWidth="0.8">
        <circle cx="1290" cy="90" r="150" />
        <circle cx="1290" cy="90" r="96" />
      </g>
      <g fill="var(--color-brand-glow)" fillOpacity="0.22">
        <circle cx="1290" cy="-60" r="2.5" />
        <circle cx="1420" cy="165" r="2.5" />
        <circle cx="1160" cy="165" r="2.5" />
      </g>
    </svg>
  );
}

function Shortcut({
  href,
  icon: Icon,
  label,
  external,
  newTabNote,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
  newTabNote?: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-surface-base/60 py-1.5 pr-4 pl-1.5 text-label text-text-secondary transition-colors duration-200 hover:border-border-brand hover:text-text-primary"
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-brand-deep/35">
        <Icon className="size-4 text-brand-soft" aria-hidden />
      </span>
      {label}
      {external && newTabNote && <span className="sr-only"> {newTabNote}</span>}
    </a>
  );
}

/**
 * Public footer (EP05) — a calm ending: CORE identity and quick contact on the
 * left, a light IA in the middle, full company contact details on the right,
 * and a restrained legal bar. Contact values come from config/contact.ts.
 */
export function PublicFooter() {
  const { t, href } = useLocale();
  const { openPreferences } = useCookieSettings();

  return (
    <footer className="relative overflow-hidden border-t border-border-soft bg-surface-dark">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/45 to-transparent"
      />
      {/* Phones: the glow alone — stretched network lines would read as stray strokes. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.08),transparent_70%)] md:hidden"
      />
      <FooterGeometry />

      <Container className="relative grid gap-12 pt-16 pb-12 md:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_minmax(0,1.25fr)] lg:gap-10 xl:gap-14">
        {/* Column 1 — brand */}
        <div className="md:col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-1.5 pl-[2.875rem] text-caption text-text-muted">{t.footer.byline}</p>
          <p className="mt-6 text-label font-medium text-text-primary">{t.footer.lead}</p>
          <p className="mt-2 max-w-sm text-label text-text-secondary">{t.footer.description}</p>
          <ul aria-label={t.footer.shortcuts} className="mt-6 flex flex-wrap gap-2">
            <li>
              <Shortcut href={telHref()} icon={Phone} label={t.footer.call} />
            </li>
            <li>
              <Shortcut
                href={CONTACT.lineUrl}
                icon={MessageCircle}
                label={t.footer.line}
                external
                newTabNote={t.contact.opensInNewTab}
              />
            </li>
            <li>
              <Shortcut href={mailtoHref()} icon={Mail} label={t.footer.email} />
            </li>
          </ul>
          <p className="mt-6 text-caption text-text-muted">{t.footer.developedBy}</p>
        </div>

        {/* Columns 2–3 — light navigation */}
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.id} aria-label={t.footer.groups[group.id]}>
            <h2 className="text-caption font-semibold text-text-muted">
              {t.footer.groups[group.id]}
            </h2>
            <ul className="mt-4 space-y-1">
              {group.links.map((link) => (
                <li key={link.id}>
                  <Link
                    to={href(link.to)}
                    className="inline-flex min-h-9 items-center text-label text-text-secondary transition-colors duration-200 hover:text-brand-glow"
                  >
                    {linkLabel(t, link.id)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* Column 4 — contact */}
        <section aria-labelledby="footer-contact" className="md:col-span-2 lg:col-span-1">
          <h2 id="footer-contact" className="text-label font-semibold text-text-primary">
            {t.footer.contactHeading}
          </h2>
          <ContactDetails className="mt-5" />
        </section>
      </Container>

      {/* Legal bar */}
      <div className="relative border-t border-border-soft">
        {/* Right/bottom clearance keeps the legal links clear of the floating utility dock. */}
        <Container className="flex flex-col gap-3 pt-6 pb-24 text-caption text-text-muted md:flex-row md:items-center md:justify-between md:pr-24 md:pb-6 xl:pr-28">
          <p>
            © {COPYRIGHT_YEAR} {CONTACT.company}. {t.footer.rightsReserved}
          </p>
          <nav aria-label={t.footer.legal}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <li>
                <Link
                  to={href('/privacy')}
                  className="inline-flex min-h-9 items-center transition-colors hover:text-text-primary"
                >
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link
                  to={href('/terms')}
                  className="inline-flex min-h-9 items-center transition-colors hover:text-text-primary"
                >
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={openPreferences}
                  className="inline-flex min-h-9 items-center transition-colors hover:text-text-primary"
                >
                  {t.footer.cookieSettings}
                </button>
              </li>
            </ul>
          </nav>
        </Container>
      </div>
    </footer>
  );
}
