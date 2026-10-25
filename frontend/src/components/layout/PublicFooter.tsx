import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { Container } from '@/components/ui/Section';
import { CONTACT } from '@/config/contact';
import { FOOTER_GROUPS, HEADER_CONTACT } from '@/config/navigation';
import { COPYRIGHT_YEAR } from '@/config/site';
import { useCookieSettings } from '@/features/consent/useCookieSettings';
import { useLocale } from '@/i18n/useLocale';

const legalLink = 'inline-flex min-h-9 items-center transition-colors hover:text-text-primary';

/**
 * Public footer (EP05; consolidated in EP18) — a deliberate closing chapter
 * in four zones: BRAND · PRODUCT · EXPLORE · CONTACT, then one quiet legal
 * row. Not a sitemap: anchors, every department, industry and guide live in
 * the header menus and on the pages themselves. Contact values come from
 * config/contact.ts.
 */
export function PublicFooter() {
  const { t, href } = useLocale();
  const { openPreferences } = useCookieSettings();

  return (
    <footer className="relative overflow-hidden border-t border-border-soft bg-surface-dark">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-primary/40 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-48 -left-40 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.06),transparent_70%)]"
      />

      <Container className="relative grid grid-cols-2 gap-x-6 gap-y-12 pt-16 pb-14 sm:gap-x-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,1.15fr)] xl:gap-x-14">
        {/* BRAND */}
        <div className="col-span-2 lg:col-span-1">
          <Link
            to={href('/')}
            aria-label={t.shell.home}
            className="inline-block rounded-lg outline-offset-4"
          >
            <Logo />
          </Link>
          <p className="mt-6 max-w-sm text-label font-medium text-text-primary">{t.footer.lead}</p>
          <p className="mt-2 max-w-sm text-label leading-relaxed text-text-secondary">
            {t.footer.description}
          </p>
          <p className="mt-6 text-caption text-text-muted">{t.footer.developedBy}</p>
        </div>

        {/* PRODUCT · EXPLORE */}
        {FOOTER_GROUPS.map((group) => (
          <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
            <h2 id={`footer-${group.id}`} className="text-caption font-semibold text-text-muted">
              {t.footer.groups[group.id]}
            </h2>
            <ul className="mt-4 space-y-0.5">
              {group.links.map((link) => (
                <li key={link.id}>
                  <Link
                    to={href(link.to)}
                    className="inline-flex min-h-10 items-center text-label text-text-secondary transition-colors duration-200 hover:text-text-primary"
                  >
                    {t.footer.links[link.id]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* CONTACT */}
        <section aria-labelledby="footer-contact" className="col-span-2 lg:col-span-1">
          <h2 id="footer-contact" className="text-caption font-semibold text-text-muted">
            {t.footer.contactHeading}
          </h2>
          <ContactDetails compact className="mt-4" />
          <Link
            to={href(HEADER_CONTACT)}
            data-footer-talk
            className="group mt-5 inline-flex min-h-11 items-center gap-1.5 text-label font-medium text-brand-soft hover:text-brand-glow"
          >
            {t.footer.talk}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </section>
      </Container>

      {/* Legal row — right/bottom clearance keeps it clear of the floating utility dock. */}
      <div className="relative border-t border-border-soft">
        <Container className="flex flex-col gap-2 pt-5 pr-20 pb-24 text-caption text-text-muted md:flex-row md:items-center md:justify-between md:pr-24 md:pb-5 xl:pr-28">
          <p>
            © {COPYRIGHT_YEAR} {CONTACT.company}. {t.footer.rightsReserved}
          </p>
          <nav aria-label={t.footer.legal}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <li>
                <Link to={href('/privacy')} className={legalLink}>
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to={href('/terms')} className={legalLink}>
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <button type="button" onClick={openPreferences} className={legalLink}>
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
