import { ArrowUpRight } from 'lucide-react';
import { CONTACT } from '@/config/contact';
import { mapEmbedUrl, OFFICE_LOCATION } from '@/config/location';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { SectionMark } from './ContactOverview';
import { CONTACT_PAGE_COPY } from './contactPageCopy';
import { controlArrow } from './coreControls';
import { LOCATION_COPY } from './locationCopy';

/*
 * Where PDA BLISS is (EP24.1.4.1 – EP24.1.4.4): the company name, the
 * address, a large live Google map and one way to open directions — nothing
 * else. The location is the strongest visual of /contact: on wide screens an
 * editorial split (≈ one third identity, two thirds map) with a thin
 * connector running from the address into the map frame; on phones name and
 * address → map → action, in reading order.
 *
 * The map loads with the page (owner decision, EP24.1.4.1): a plain keyless
 * Google Maps iframe — no API key, no Maps JavaScript SDK — only on /contact.
 * The cookie banner and the Privacy Policy say it is Google's third-party
 * service.
 */

/** The office address on separate lines: house number · sub-district · district · province. */
const ADDRESS_LINES = CONTACT.address.split(/ (?=[ตอจ]\.)/);

/** Small corner brackets that square the map frame off — the one ornament. */
function Corners() {
  const base = 'absolute size-3 border-brand-primary/60';
  return (
    <>
      <span aria-hidden className={cn(base, '-top-1.5 -left-1.5 border-t border-l')} />
      <span aria-hidden className={cn(base, '-top-1.5 -right-1.5 border-t border-r')} />
      <span aria-hidden className={cn(base, '-bottom-1.5 -left-1.5 border-b border-l')} />
      <span aria-hidden className={cn(base, '-right-1.5 -bottom-1.5 border-r border-b')} />
    </>
  );
}

export function CoreLocation({ className }: { className?: string }) {
  const c = useCopy(LOCATION_COPY);
  const section = useCopy(CONTACT_PAGE_COPY).sections;
  const { locale, t } = useLocale();
  return (
    <section
      id="location"
      aria-labelledby="location-title"
      data-location
      className={cn(
        'grid min-w-0 gap-7 lg:grid-cols-[minmax(15rem,0.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10',
        className,
      )}
    >
      <div className="relative lg:col-start-1 lg:row-start-1 lg:pt-2">
        <SectionMark index="02">{section.location}</SectionMark>
        <h2
          id="location-title"
          className="mt-6 text-h3 leading-snug font-semibold tracking-[0.01em] text-text-primary"
        >
          {CONTACT.company}
        </h2>
        <div className="relative mt-5">
          {/* Connector: from the address into the map frame (wide screens). */}
          <span
            aria-hidden
            className="absolute top-3.5 left-[calc(100%-4rem)] hidden h-px w-[8.375rem] bg-[linear-gradient(90deg,transparent,rgb(62_240_192/0.5))] after:absolute after:-top-[2px] after:-right-[2px] after:size-[5px] after:rounded-full after:bg-brand-glow lg:block"
          />
          <address
            lang="th"
            className="border-l border-brand-primary/40 pl-5 text-body leading-[1.85] text-text-secondary not-italic"
          >
            {/* One line each, but read and copied as one address (spaces between parts). */}
            {ADDRESS_LINES.map((line, i) => (
              <span key={line} className={cn('block', i === 0 && 'font-medium text-text-primary')}>
                {line}
                {i < ADDRESS_LINES.length - 1 && ' '}
              </span>
            ))}
          </address>
        </div>
      </div>

      {/* The map is the visual: a deep, precise frame — nothing laid over Google's controls. */}
      <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Corners />
        <div className="rounded-[12px] bg-[linear-gradient(180deg,#0a1822,#060f16)] p-1.5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1),0_36px_80px_-56px_rgb(0_0_0/0.95)]">
          <span
            aria-hidden
            className="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(62_240_192/0.6),transparent)]"
          />
          <div className="relative h-[320px] overflow-hidden rounded-[8px] bg-[#0b1a24] sm:h-[420px] lg:h-[clamp(30rem,58vh,36rem)]">
            <iframe
              src={mapEmbedUrl(locale)}
              title={c.mapTitle}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              data-map-frame
              className="absolute inset-0 size-full border-0 [filter:invert(0.9)_hue-rotate(180deg)_saturate(0.65)_brightness(0.92)_contrast(0.95)]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2 lg:justify-between">
        <a
          href={OFFICE_LOCATION.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-map-open
          className="group/ctl inline-flex min-h-11 items-center gap-2.5 self-start border-b border-brand-primary/40 pb-0.5 text-label font-semibold text-brand-soft transition-colors hover:border-brand-glow hover:text-brand-glow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus motion-reduce:transition-none"
        >
          {c.open}
          <ArrowUpRight aria-hidden className={controlArrow} />
          <span className="sr-only"> {t.contact.opensInNewTab}</span>
        </a>
        {/* Where the map comes from, said plainly (fig. caption, as on /about). */}
        <p data-map-caption className="flex items-center gap-3 text-caption text-text-muted">
          <span
            aria-hidden
            lang="en"
            className="shrink-0 font-mono text-[0.6875rem] tracking-[0.14em] whitespace-nowrap"
          >
            fig. 02
          </span>
          <span aria-hidden className="h-px w-4 shrink-0 bg-white/15" />
          {c.caption}
        </p>
      </div>
    </section>
  );
}
