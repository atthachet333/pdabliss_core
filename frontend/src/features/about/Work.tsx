import { ArrowLeftRight, ArrowRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { COMPANY, PRODUCTS } from '@/config/company';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { Lines, QuietLink, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { ABOUT } from './copy';
import {
  ABOUT_CHAPTER,
  ABOUT_LINKS,
  ACTIVITIES,
  EXCHANGE,
  IMPLEMENTATION,
  LAYERS,
  TRUST,
} from './model';

/* ------------------------------------------------------------------ */
/* 06 Consulting — a working session, not a service grid                */
/* ------------------------------------------------------------------ */

const PARTIES = ['org', 'us', 'core'] as const;

export function ConsultingChapter() {
  const c = useCopy(ABOUT).consulting;
  return (
    <Chapter id={ABOUT_CHAPTER.consulting} labelledBy="consulting-title" plane="navy" space="lg">
      <Frame width="wide">
        <StoryHead
          index="06"
          kicker={c.kicker}
          id="consulting-title"
          title={c.title}
          lead={c.lead}
        />

        <table data-exchange className="mt-16 w-full max-md:block md:table-fixed">
          <caption className="sr-only">{c.tableCaption}</caption>
          {/* The three parties of the working session */}
          <thead data-parties className="max-md:sr-only">
            <tr>
              <th scope="col" className="w-40 pb-6 text-left">
                <span className="sr-only">{c.columns.topic}</span>
              </th>
              {PARTIES.map((p, i) => (
                <th key={p} scope="col" className="relative px-2 pb-6">
                  <span
                    className={cn(
                      'inline-block rounded-full px-4 py-2 text-caption font-semibold uppercase',
                      p === 'core'
                        ? 'bg-brand-primary/15 text-brand-glow shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                        : p === 'us'
                          ? 'bg-white/[0.06] text-text-primary'
                          : 'bg-white/[0.03] text-text-secondary',
                    )}
                  >
                    {c.columns[p]}
                  </span>
                  {i < PARTIES.length - 1 && (
                    <ArrowLeftRight
                      aria-hidden
                      className="absolute top-2.5 right-0 size-4 translate-x-1/2 text-brand-soft/70"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-8">
            {EXCHANGE.map((e) => {
              const row = c.exchange[e];
              return (
                <tr
                  key={e}
                  data-exchange-row={e}
                  className="border-t border-border-soft max-md:block max-md:pt-5"
                >
                  <th
                    scope="row"
                    className="text-left align-top text-caption font-semibold text-brand-soft max-md:block md:py-6 md:pr-4"
                  >
                    {row.topic}
                  </th>
                  {PARTIES.map((p) => (
                    <td
                      key={p}
                      className={cn(
                        'align-top text-label max-md:mt-3 max-md:block max-md:border-l-2 max-md:pl-4 md:px-5 md:py-6 md:text-center',
                        p === 'core'
                          ? 'text-text-primary max-md:border-brand-glow/60 md:bg-brand-primary/[0.07]'
                          : p === 'us'
                            ? 'text-text-primary max-md:border-border-strong md:bg-white/[0.03]'
                            : 'text-text-secondary max-md:border-border-soft',
                      )}
                    >
                      <span className="block text-caption text-text-muted md:hidden">
                        {c.columns[p]}
                      </span>
                      {row[p]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-16 grid grid-cols-1 gap-10 border-t border-border-soft pt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Kicker tone="clear">{c.activitiesTitle}</Kicker>
            <ul data-activities className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
              {ACTIVITIES.map((a) => (
                <li key={a} className="flex items-center gap-2.5 text-body text-text-primary">
                  <span aria-hidden className="size-1 rounded-full bg-brand-glow" />
                  {c.activities[a]}
                </li>
              ))}
            </ul>
          </div>
          <p
            data-boundary
            className="self-end border-l-2 border-brand-primary/40 pl-4 text-label text-text-secondary"
          >
            {c.boundary}
          </p>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Implementation — the company's side of the journey                */
/* ------------------------------------------------------------------ */

export function ImplementationChapter() {
  const c = useCopy(ABOUT).implementation;
  return (
    <Chapter id={ABOUT_CHAPTER.implementation} labelledBy="implementation-approach-title">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <StoryHead
            index="07"
            kicker={c.kicker}
            id="implementation-approach-title"
            title={c.title}
            lead={c.lead}
          />
          <QuietLink to={ABOUT_LINKS.implementation} data="enterprise-implementation">
            {c.link}
          </QuietLink>
        </div>
        <ol
          data-implementation
          className="relative mt-14 grid grid-cols-1 gap-5 lg:grid-cols-9 lg:gap-3"
        >
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.7),rgb(62_240_192/0.2))] lg:top-[0.4375rem] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto lg:bg-[linear-gradient(90deg,rgb(62_240_192/0.7),rgb(62_240_192/0.25))]"
          />
          {IMPLEMENTATION.map((s, i) => (
            <li
              key={s}
              data-implementation-step={s}
              className="relative flex items-baseline gap-4 pl-8 lg:block lg:pl-0"
            >
              <span
                aria-hidden
                className="absolute top-1.5 left-0 size-[0.875rem] rounded-full bg-surface-dark shadow-[inset_0_0_0_2px_rgb(62_240_192/0.7)] lg:static lg:block"
              />
              <span aria-hidden className="text-caption text-text-muted tabular lg:mt-4 lg:block">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-label font-semibold text-text-primary lg:mt-1 lg:block">
                {c.steps[s]}
              </span>
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 08 Built for long-term use — a product, adapted                      */
/* ------------------------------------------------------------------ */

const LAYER_STYLE = {
  integration:
    'mx-[14%] border border-dashed border-border-strong bg-transparent text-text-secondary',
  configuration:
    'mx-[6%] bg-white/[0.045] text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
  foundation:
    'bg-[linear-gradient(90deg,rgb(25_195_154/0.22),rgb(25_195_154/0.08))] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.32),0_24px_70px_-36px_rgb(62_240_192/0.6)]',
} as const;

export function LongTermChapter() {
  const c = useCopy(ABOUT).longTerm;
  return (
    <Chapter id={ABOUT_CHAPTER.longTerm} labelledBy="long-term-title" plane="grid" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div>
            <StoryHead
              index="08"
              kicker={c.kicker}
              id="long-term-title"
              title={c.title}
              lead={c.lead}
            />
            <p className="mt-10 text-caption font-semibold text-text-muted">{c.whyTitle}</p>
            <ul className="mt-4 space-y-2.5">
              {c.why.map((w) => (
                <li key={w} className="flex items-baseline gap-3 text-label text-text-primary">
                  <span
                    aria-hidden
                    className="size-1 shrink-0 translate-y-[-0.2em] rounded-full bg-brand-glow"
                  />
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <figure aria-label={c.visual}>
            <ol data-layers className="space-y-3">
              {LAYERS.map((l) => (
                <li
                  key={l}
                  data-layer={l}
                  className={cn('rounded-2xl px-5 py-4 sm:px-6 sm:py-5', LAYER_STYLE[l])}
                >
                  <p className="text-label font-semibold">
                    {l === 'configuration' && (
                      <span aria-hidden className="mr-2 text-brand-glow">
                        +
                      </span>
                    )}
                    {l === 'integration' && (
                      <span aria-hidden className="mr-2 text-text-muted">
                        +
                      </span>
                    )}
                    {c.layers[l].title}
                  </p>
                  <p className="mt-1 text-caption text-text-secondary">{c.layers[l].body}</p>
                </li>
              ))}
            </ol>
          </figure>
        </div>

        <div data-products className="mt-24 border-t border-border-soft pt-12">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-20">
            <div>
              <Kicker tone="muted">{c.productsTitle}</Kicker>
              <p className="mt-3 text-label text-text-muted">{c.productsNote}</p>
            </div>
            <dl className="divide-y divide-border-soft">
              {PRODUCTS.map((p) => (
                <div
                  key={p.id}
                  data-product={p.id}
                  className="grid grid-cols-1 gap-1 py-5 first:pt-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8"
                >
                  <dt>
                    <span
                      className={cn(
                        'block text-body font-semibold',
                        p.current ? 'text-brand-glow' : 'text-text-primary',
                      )}
                    >
                      {p.name}
                    </span>
                    <span className="mt-0.5 block text-caption text-text-muted">
                      {c.products[p.id].role}
                      {p.current && <span className="text-brand-soft"> · {c.current}</span>}
                    </span>
                  </dt>
                  <dd className="text-label text-text-secondary">{c.products[p.id].body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 09 Company information — every value from the central config         */
/* ------------------------------------------------------------------ */

const linkClass =
  'rounded-sm text-text-primary underline-offset-4 transition-colors hover:text-brand-glow hover:underline';

export function CompanyInfoChapter() {
  const c = useCopy(ABOUT).info;
  const { locale, t } = useLocale();
  return (
    <Chapter id={ABOUT_CHAPTER.info} labelledBy="company-information-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <StoryHead
              index="09"
              kicker={c.kicker}
              id="company-information-title"
              title={c.title}
              size="quiet"
            />
            <div className="mt-10" data-company-name>
              <p className="sr-only">{c.labels.name}</p>
              {locale === 'th' && (
                <p lang="th" className="text-h3 text-text-primary">
                  {COMPANY.legalNameTh}
                </p>
              )}
              <p
                className={cn(
                  'tracking-[0.06em]',
                  locale === 'th'
                    ? 'mt-1 text-label text-text-secondary'
                    : 'text-h3 text-text-primary',
                )}
              >
                {COMPANY.legalName}
              </p>
            </div>
          </div>

          <address className="not-italic" data-company-contact>
            <dl className="divide-y divide-border-soft border-y border-border-soft">
              <div className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt className="text-caption font-semibold text-text-muted">{c.labels.address}</dt>
                <dd lang="th" className="text-body text-text-primary">
                  {CONTACT.address}
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt className="text-caption font-semibold text-text-muted">{c.labels.phone}</dt>
                <dd className="text-body tabular">
                  <a
                    href={telHref()}
                    className={cn(linkClass, 'inline-flex min-h-11 items-center')}
                  >
                    {CONTACT.phone.display}
                  </a>{' '}
                  <span className="text-text-muted">({t.contact.phoneLabel})</span>
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt className="text-caption font-semibold text-text-muted">{c.labels.email}</dt>
                <dd className="text-body">
                  <a
                    href={mailtoHref()}
                    className={cn(linkClass, 'inline-flex min-h-11 items-center break-all')}
                  >
                    {CONTACT.email}
                  </a>
                </dd>
              </div>
              <div className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <dt className="text-caption font-semibold text-text-muted">{c.labels.line}</dt>
                <dd className="text-body">
                  <a
                    href={CONTACT.lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(linkClass, 'inline-flex min-h-11 items-center')}
                  >
                    {CONTACT.lineId}
                    <span className="sr-only"> {t.contact.opensInNewTab}</span>
                  </a>
                </dd>
              </div>
            </dl>
          </address>
        </div>

        <div data-trust className="mt-16 lg:ml-[calc(45%+2.5rem)]">
          <Kicker tone="muted">{c.trustTitle}</Kicker>
          <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
            {TRUST.map((k) => (
              <li key={k} className="flex items-baseline gap-3 text-label text-text-secondary">
                <span
                  aria-hidden
                  className="size-1 shrink-0 translate-y-[-0.2em] rounded-full bg-brand-glow"
                />
                {c.trust[k]}
              </li>
            ))}
          </ul>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 10 Talk to PDA BLISS                                                 */
/* ------------------------------------------------------------------ */

export function TalkChapter() {
  const c = useCopy(ABOUT).talk;
  const { href, t } = useLocale();
  return (
    <Chapter id={ABOUT_CHAPTER.talk} labelledBy="talk-title" plane="clear" space="lg">
      <Frame width="base" className="text-center">
        <Reveal>
          <h2
            id="talk-title"
            className="mx-auto max-w-4xl text-[clamp(1.75rem,1.15rem+2.2vw,3.25rem)] leading-[1.25] font-semibold tracking-tight text-text-primary"
          >
            <Lines text={c.title} />
          </h2>
        </Reveal>
        <p className="mx-auto mt-6 max-w-xl text-body-lg text-text-secondary">{c.body}</p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={href(ABOUT_LINKS.contact)}
            data-cta="contact"
            className={buttonClasses('primary', 'lg')}
          >
            {c.primary}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href={CONTACT.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-cta="line"
            className={buttonClasses('secondary', 'lg')}
          >
            <MessageCircle className="size-4" aria-hidden />
            {c.line} {CONTACT.lineId}
            <span className="sr-only"> {t.contact.opensInNewTab}</span>
          </a>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-x-8 sm:flex-row">
          <QuietLink to={ABOUT_LINKS.industries} data="industries">
            {c.industries}
          </QuietLink>
          <QuietLink to={ABOUT_LINKS.whyCore} data="why-core">
            {c.why}
          </QuietLink>
        </div>
      </Frame>
    </Chapter>
  );
}
