import { ArrowUpRight, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ContactDetails } from '@/components/contact/ContactDetails';
import { COMPANY, companyName } from '@/config/company';
import { CONTACT } from '@/config/contact';
import { mapEmbedUrl, OFFICE_LOCATION } from '@/config/location';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { LOCATION_COPY } from './locationCopy';

/*
 * /contact location (EP24.1.4): who PDA BLISS is, how to reach it and where
 * it is — contact identity on one side, the map on the other (stacked on
 * phones). The address is always written out; the map only adds to it.
 *
 * Consent: the map is third-party content (Google). The site's cookie
 * categories do not cover embedded third-party content and the banner says
 * no marketing cookies are used, so the map never loads by itself — not
 * even after "Accept all". It loads only when the visitor presses "Show map"
 * on this page view; the placeholder says what that loads. "Open in Google
 * Maps" always works without loading anything here.
 */
export function LocationSection() {
  const c = useCopy(LOCATION_COPY);
  const { locale, t } = useLocale();
  return (
    <section
      id="location"
      aria-labelledby="location-title"
      data-location
      className="mt-16 scroll-mt-24 sm:mt-24"
    >
      <div className="grid overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,rgb(11_24_32/0.92),rgb(5_12_18/0.96))] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08),0_50px_140px_-70px_rgb(0_0_0/0.9)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <div className="relative p-6 sm:p-8 lg:px-10 lg:py-8">
          {/* The teal edge: CORE's operational line, on the identity side only. */}
          <span
            aria-hidden
            className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(62_240_192/0.6),transparent)] sm:inset-x-8 lg:inset-x-10"
          />
          <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
            <span aria-hidden className="h-px w-6 bg-current opacity-70" />
            {c.eyebrow}
          </p>
          <h2 id="location-title" className="mt-3 text-h3 text-text-primary">
            {c.title}
          </h2>
          <p className="mt-2 text-caption leading-relaxed text-text-secondary">{c.lead}</p>

          <div className="mt-6 border-t border-border-soft pt-5">
            <p
              className="text-label font-semibold text-text-primary"
              lang={locale === 'th' ? 'th' : undefined}
            >
              {companyName(locale)}
            </p>
            {locale === 'th' && (
              <p className="mt-0.5 text-caption text-text-muted">{COMPANY.legalName}</p>
            )}
            <ContactDetails compact className="mt-4" />
          </div>

          <a
            href={OFFICE_LOCATION.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-map-open
            className="mt-6 inline-flex min-h-12 items-center gap-2.5 rounded-full px-6 text-label font-semibold text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)] transition-colors hover:bg-brand-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
          >
            <MapPin aria-hidden className="size-4" />
            {c.open}
            <ArrowUpRight aria-hidden className="size-4" />
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </div>

        <MapFrame />
      </div>
    </section>
  );
}

/** The map area: a deliberate placeholder until the visitor asks, then the Google embed. */
function MapFrame() {
  const c = useCopy(LOCATION_COPY);
  const { locale, href, t } = useLocale();
  const [shown, setShown] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Keyboard users land on the map they asked for (the button is gone).
  useEffect(() => {
    if (shown) frameRef.current?.focus();
  }, [shown]);

  return (
    <div
      data-map={shown ? 'shown' : 'placeholder'}
      className={cn(
        'relative border-t border-border-soft lg:min-h-[480px] lg:border-t-0 lg:border-l',
        // The embed needs a height; the placeholder grows with its text on narrow phones.
        shown ? 'h-[340px] sm:h-[400px] lg:h-auto' : 'min-h-[340px] sm:min-h-[400px]',
      )}
    >
      {shown ? (
        <>
          <iframe
            ref={frameRef}
            src={mapEmbedUrl(locale)}
            title={c.mapTitle}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            data-map-frame
            className="absolute inset-0 size-full border-0 bg-[#0b1a24]"
          />
          <p role="status" className="sr-only">
            {c.shown}
          </p>
        </>
      ) : (
        <div
          data-map-placeholder
          className="relative grid h-full min-h-[inherit] place-items-center overflow-hidden bg-[#06111a] px-6 py-10 text-center lg:absolute lg:inset-0"
        >
          {/* A quiet map-like ground: grid, rings around the location, no fake streets. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,black,transparent_80%)] opacity-25"
          />
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="size-64 rounded-full shadow-[inset_0_0_0_1px_rgb(62_240_192/0.08)]" />
          </div>
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="size-40 rounded-full shadow-[inset_0_0_0_1px_rgb(62_240_192/0.14)]" />
          </div>
          <div className="relative grid max-w-sm justify-items-center gap-4">
            <span
              aria-hidden
              className="grid size-14 place-items-center rounded-full bg-[#050b12] text-brand-glow shadow-[0_0_0_6px_rgb(6_17_26),inset_0_0_0_1px_rgb(62_240_192/0.5),0_0_60px_-10px_rgb(62_240_192/0.5)]"
            >
              <MapPin className="size-6" />
            </span>
            <div>
              <p className="text-label font-semibold text-text-primary">{CONTACT.company}</p>
              <p lang="th" className="mt-1 text-caption text-text-secondary">
                {CONTACT.address}
              </p>
            </div>
            <p className="text-caption leading-relaxed text-text-muted">
              <span className="font-semibold text-text-secondary">{c.placeholder}</span> —{' '}
              {c.consent}{' '}
              <Link
                to={href('/privacy')}
                className="whitespace-nowrap text-brand-soft underline underline-offset-4 hover:text-brand-glow"
              >
                {c.privacy}
              </Link>
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setShown(true)}
                data-show-map
                className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-brand-primary px-6 text-label font-semibold text-text-inverse shadow-glow-sm transition-colors hover:bg-brand-glow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
              >
                <MapPin aria-hidden className="size-4" />
                {c.show}
              </button>
              <a
                href={OFFICE_LOCATION.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-label font-semibold text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.25)] transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
              >
                {c.open}
                <ArrowUpRight aria-hidden className="size-4" />
                <span className="sr-only"> {t.contact.opensInNewTab}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
