import { ArrowUpRight } from 'lucide-react';
import { CONTACT } from '@/config/contact';
import { mapEmbedUrl, OFFICE_LOCATION } from '@/config/location';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { LOCATION_COPY } from './locationCopy';

/*
 * The location side of the one Contact workspace (EP24.1.4.1, simplified in
 * EP24.1.4.2 at the owner's request): only the company name, the address,
 * the live Google map and one way to open it in Google Maps. Talking to
 * PDA BLISS happens in the consultation beside it; nothing else competes
 * with the map.
 *
 * The map loads with the page (owner decision in EP24.1.4.1; it superseded
 * the earlier click-to-load): a plain keyless Google Maps iframe — no API
 * key, no Maps JavaScript SDK — only on /contact. The cookie banner and the
 * Privacy Policy say that it is Google's third-party service.
 */

/** The office address on separate lines: house number · sub-district · district · province. */
const ADDRESS_LINES = CONTACT.address.split(/ (?=[ตอจ]\.)/);

export function CoreLocation({ className }: { className?: string }) {
  const c = useCopy(LOCATION_COPY);
  const { locale, t } = useLocale();
  return (
    <section
      id="location"
      aria-labelledby="location-title"
      data-location
      className={cn('min-w-0', className)}
    >
      <h2 id="location-title" className="text-label font-semibold tracking-wide text-text-primary">
        {CONTACT.company}
      </h2>
      <address lang="th" className="mt-2 text-label leading-relaxed text-text-secondary not-italic">
        {/* One line each, but read and copied as one address (spaces between parts). */}
        {ADDRESS_LINES.map((line, i) => (
          <span key={line} className="block">
            {line}
            {i < ADDRESS_LINES.length - 1 && ' '}
          </span>
        ))}
      </address>

      {/* The map is the anchor: a quiet frame, nothing laid over Google's controls. */}
      <div className="mt-6 rounded-[1.75rem] bg-[#07131c] p-2 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22),0_30px_80px_-50px_rgb(0_0_0/0.9)]">
        <div className="relative h-[340px] overflow-hidden rounded-[1.25rem] bg-[#0b1a24] sm:h-[440px] xl:h-[clamp(30rem,62vh,38.75rem)]">
          <iframe
            src={mapEmbedUrl(locale)}
            title={c.mapTitle}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            data-map-frame
            className="absolute inset-0 size-full border-0"
          />
        </div>
      </div>

      <a
        href={OFFICE_LOCATION.listingUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-map-open
        className="mt-5 inline-flex min-h-12 items-center gap-2.5 rounded-full px-6 text-label font-semibold text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)] transition-colors hover:bg-brand-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
      >
        {c.open}
        <ArrowUpRight aria-hidden className="size-4" />
        <span className="sr-only"> {t.contact.opensInNewTab}</span>
      </a>
    </section>
  );
}
