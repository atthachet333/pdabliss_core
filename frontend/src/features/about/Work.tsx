import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { COMPANY, PRODUCTS } from '@/config/company';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { Lines, QuietLink, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { Reveal } from '@/motion/Reveal';
import { ABOUT } from './copy';
import {
  ABOUT_CHAPTER,
  ABOUT_LINKS,
  ACTIVITIES,
  EXCHANGE,
  LAYERS,
  TRUST,
  type Layer,
} from './model';
import { ABOUT_SCENES } from './scenes/copy';
import { ImplementationPath } from './scenes/ImplementationPath';
import { WorkTable } from './scenes/WorkTable';

/* ------------------------------------------------------------------ */
/* 06 Consulting — a working session on one table                       */
/* ------------------------------------------------------------------ */

const PARTIES = ['org', 'us', 'core'] as const;

/** Every topic at a glance — the same content as the work table, as a table. */
function Overview() {
  const c = useCopy(ABOUT).consulting;
  const w = useCopy(ABOUT_SCENES).work;
  return (
    <div className="mt-16">
      <Kicker tone="muted">{w.overview}</Kicker>
      <table data-exchange className="mt-5 w-full max-md:block md:table-fixed">
        <caption className="sr-only">{c.tableCaption}</caption>
        <thead className="max-md:sr-only">
          <tr className="text-left">
            <th scope="col" className="w-40 pb-3 text-caption font-semibold text-text-muted">
              {c.columns.topic}
            </th>
            {PARTIES.map((p) => (
              <th
                key={p}
                scope="col"
                className={cn(
                  'px-4 pb-3 text-caption font-semibold',
                  p === 'core' ? 'text-brand-glow' : 'text-text-muted',
                )}
              >
                {c.columns[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block max-md:space-y-6">
          {EXCHANGE.map((e) => {
            const row = c.exchange[e];
            return (
              <tr
                key={e}
                data-exchange-row={e}
                className="border-t border-border-soft max-md:block max-md:pt-4"
              >
                <th
                  scope="row"
                  className="text-left align-top text-caption font-semibold text-brand-soft max-md:block md:py-4 md:pr-4"
                >
                  {row.topic}
                </th>
                {PARTIES.map((p) => (
                  <td
                    key={p}
                    className={cn(
                      'align-top text-label max-md:mt-2 max-md:block max-md:pl-4 md:px-4 md:py-4',
                      p === 'core' ? 'text-text-primary' : 'text-text-secondary',
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
    </div>
  );
}

export function ConsultingChapter() {
  const c = useCopy(ABOUT).consulting;
  const s = useCopy(ABOUT_SCENES);
  return (
    <Chapter id={ABOUT_CHAPTER.consulting} labelledBy="consulting-title" plane="navy" space="lg">
      <Frame width="wide">
        <StoryHead
          index="06"
          ghost
          notation={s.notation.consulting}
          kicker={c.kicker}
          id="consulting-title"
          title={c.title}
          lead={c.lead}
        />
        <WorkTable />

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
        <Overview />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Implementation — one continuous path                              */
/* ------------------------------------------------------------------ */

export function ImplementationChapter() {
  const c = useCopy(ABOUT).implementation;
  const s = useCopy(ABOUT_SCENES);
  return (
    <Chapter id={ABOUT_CHAPTER.implementation} labelledBy="implementation-approach-title">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <StoryHead
            index="08"
            ghost
            notation={s.notation.implementation}
            kicker={c.kicker}
            id="implementation-approach-title"
            title={c.title}
            lead={c.lead}
          />
          <QuietLink to={ABOUT_LINKS.implementation} data="enterprise-implementation">
            {c.link}
          </QuietLink>
        </div>
        <ImplementationPath />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 08 Built for long-term use — one product, adapted                    */
/* ------------------------------------------------------------------ */

const LAYER_STYLE: Record<Layer, string> = {
  integration:
    'mx-[15%] border border-dashed border-border-strong bg-transparent text-text-secondary',
  workflow:
    'mx-[9%] bg-white/[0.05] text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
  configuration:
    'mx-[4%] bg-white/[0.04] text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
  foundation:
    'bg-[linear-gradient(90deg,rgb(25_195_154/0.22),rgb(25_195_154/0.08))] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.32),0_24px_70px_-36px_rgb(62_240_192/0.6)]',
};

/** NOT: a separate, differently-shaped codebase for every organization. */
function NotACodebasePerOrg() {
  const s = useCopy(ABOUT_SCENES).longTerm;
  const shapes = [
    [70, 55, 85],
    [90, 40, 60, 75],
    [50, 80],
  ];
  return (
    <div data-not className="mt-8 rounded-2xl border border-dashed border-danger/30 p-5">
      <p className="flex items-center gap-2 text-caption font-semibold text-danger">
        <span aria-hidden className="inline-block h-px w-4 bg-current" />
        {s.not}: <span className="line-through decoration-danger/70">{s.notTitle}</span>
      </p>
      <div aria-hidden className="relative mt-4 grid grid-cols-3 gap-4">
        {shapes.map((stack, i) => (
          <div key={i}>
            <div className="flex flex-col items-center gap-1">
              {stack.map((w, k) => (
                <span
                  key={k}
                  className="block h-2.5 rounded-sm bg-white/[0.08]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-center text-[0.6875rem] text-text-muted">{s.orgs[i]}</p>
          </div>
        ))}
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line
            x1="2"
            y1="92"
            x2="98"
            y2="6"
            stroke="#f47272"
            strokeOpacity="0.6"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

export function LongTermChapter() {
  const c = useCopy(ABOUT).longTerm;
  const s = useCopy(ABOUT_SCENES);
  const reduce = usePrefersReducedMotion();
  return (
    <Chapter id={ABOUT_CHAPTER.longTerm} labelledBy="long-term-title" plane="grid" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div>
            <StoryHead
              index="09"
              ghost
              notation={s.notation.longTerm}
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
          <figure aria-label={c.visual} className="m-0">
            {/* The stack assembles from the foundation up */}
            <ol data-layers className="space-y-3">
              {LAYERS.map((l, i) => (
                <motion.li
                  key={l}
                  data-layer={l}
                  initial={reduce ? false : { opacity: 0, y: -22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                  transition={{
                    duration: 0.6,
                    ease: EASE_CORE,
                    delay: (LAYERS.length - 1 - i) * 0.16,
                  }}
                  className={cn('rounded-2xl px-5 py-4 sm:px-6 sm:py-5', LAYER_STYLE[l])}
                >
                  <p className="text-label font-semibold">
                    {l !== 'foundation' && (
                      <span
                        aria-hidden
                        className={cn(
                          'mr-2',
                          l === 'integration' ? 'text-text-muted' : 'text-brand-glow',
                        )}
                      >
                        +
                      </span>
                    )}
                    {c.layers[l].title}
                  </p>
                  <p className="mt-1 text-caption text-text-secondary">{c.layers[l].body}</p>
                </motion.li>
              ))}
            </ol>
            <NotACodebasePerOrg />
          </figure>
        </div>

        {/* The PDA BLISS product family */}
        <div data-products className="mt-24 border-t border-border-soft pt-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-20">
            <div>
              <Kicker tone="muted">{c.productsTitle}</Kicker>
              <p className="mt-3 text-label text-text-muted">{c.productsNote}</p>
            </div>
            <div>
              <p
                aria-hidden
                className="text-center font-mono text-[0.6875rem] tracking-[0.2em] text-text-muted"
              >
                PDA BLISS
              </p>
              <svg
                aria-hidden
                viewBox="0 0 300 30"
                preserveAspectRatio="none"
                className="mt-2 hidden h-6 w-full sm:block"
              >
                <path
                  d="M 150 0 L 150 12 M 50 30 L 50 12 L 250 12 L 250 30 M 150 12 L 150 30"
                  fill="none"
                  stroke="#a3b8b2"
                  strokeOpacity="0.35"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PRODUCTS.map((p) => (
                  <div
                    key={p.id}
                    data-product={p.id}
                    className={cn(
                      'rounded-2xl px-5 py-4',
                      p.current
                        ? 'bg-brand-primary/[0.08] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)] sm:order-2'
                        : 'bg-white/[0.02] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]',
                      p.id === 'one' && 'sm:order-1',
                      p.id === 'property' && 'sm:order-3',
                    )}
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
                    <dd className="mt-2 text-caption text-text-secondary">
                      {c.products[p.id].body}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-center text-caption text-text-muted">{s.longTerm.family}</p>
            </div>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 09 Company information — calm, factual, from the central config      */
/* ------------------------------------------------------------------ */

const linkClass =
  'rounded-sm text-text-primary underline-offset-4 transition-colors hover:text-brand-glow hover:underline';

export function CompanyInfoChapter() {
  const c = useCopy(ABOUT).info;
  const s = useCopy(ABOUT_SCENES);
  const { locale, t } = useLocale();
  return (
    <Chapter id={ABOUT_CHAPTER.info} labelledBy="company-information-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <StoryHead
              index="10"
              notation={s.notation.info}
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
            to={href(ABOUT_LINKS.consult)}
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
