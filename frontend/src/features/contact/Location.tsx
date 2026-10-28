import { ArrowUpRight } from 'lucide-react';
import { CONTACT } from '@/config/contact';
import { mapEmbedUrl, OFFICE_LOCATION } from '@/config/location';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { LOCATION_COPY } from './locationCopy';

/*
 * Where PDA BLISS is (EP24.1.4.1 – EP24.1.4.3): the company name, the
 * address, a large live Google map and one way to open directions — nothing
 * else. Since EP24.1.4.3 /contact no longer shares the screen with the
 * consultation, so the map takes the width: on wide screens an asymmetric
 * pair (a narrow column with the name, address and action; the map beside
 * it); on phones name and address → map → action, in reading order.
 *
 * The map loads with the page (owner decision, EP24.1.4.1): a plain keyless
 * Google Maps iframe — no API key, no Maps JavaScript SDK — only on /contact.
 * The cookie banner and the Privacy Policy say it is Google's third-party
 * service.
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
      className={cn(
        'grid min-w-0 gap-6 lg:grid-cols-[minmax(13rem,17rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-8',
        className,
      )}
    >
      <div className="lg:col-start-1 lg:row-start-1">
        <h2
          id="location-title"
          className="text-label font-semibold tracking-wide text-text-primary"
        >
          {CONTACT.company}
        </h2>
        <address
          lang="th"
          className="mt-3 text-body leading-relaxed text-text-secondary not-italic"
        >
          {/* One line each, but read and copied as one address (spaces between parts). */}
          {ADDRESS_LINES.map((line, i) => (
            <span key={line} className="block">
              {line}
              {i < ADDRESS_LINES.length - 1 && ' '}
            </span>
          ))}
        </address>
      </div>

      {/* The map is the moment: a quiet frame, nothing laid over Google's controls. */}
      <div className="rounded-[1.75rem] bg-[#07131c] p-2 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22),0_40px_100px_-60px_rgb(0_0_0/0.9)] lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="relative h-[340px] overflow-hidden rounded-[1.25rem] bg-[#0b1a24] sm:h-[420px] lg:h-[clamp(30rem,60vh,37.5rem)]">
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

      <div className="lg:col-start-1 lg:row-start-2 lg:self-end">
        <a
          href={OFFICE_LOCATION.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-map-open
          className="inline-flex min-h-12 items-center gap-2.5 rounded-full px-6 text-label font-semibold text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)] transition-colors hover:bg-brand-primary/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none"
        >
          {c.open}
          <ArrowUpRight aria-hidden className="size-4 shrink-0" />
          <span className="sr-only"> {t.contact.opensInNewTab}</span>
        </a>
      </div>
    </section>
  );
}
