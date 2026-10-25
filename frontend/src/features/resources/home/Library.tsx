import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Head } from '@/features/enterprise/parts';
import { QuietLink } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { fill } from '@/lib/fill';
import { RESOURCES_COPY } from '../copy';
import { GLOSSARY, termAnchor, type TermId } from '../glossary';
import { JOURNEY_NAMES, JOURNEY_STEPS } from '../journey';
import { RESOURCE_META } from '../meta';
import { ChipGroup, ResourceRow } from '../parts';
import {
  FILTER_OF,
  FILTERS,
  RESOURCE_LINKS,
  RESOURCES,
  resourcePath,
  type Filter,
} from '../registry';

/* ------------------------------------------------------------------ */
/* 06 Library — every guide, filterable (an index, not a thumbnail wall) */
/* ------------------------------------------------------------------ */

export function LibraryChapter() {
  const c = useCopy(RESOURCES_COPY).library;
  const meta = useCopy(RESOURCE_META);
  const [filter, setFilter] = useState<Filter>('all');
  const shown = RESOURCES.filter((r) => filter === 'all' || FILTER_OF[r.category] === filter);
  return (
    <Chapter id="library" labelledBy="library-title" plane="navy" space="md">
      <Frame width="base">
        <Head eyebrow={c.eyebrow} id="library-title" title={c.title} lead={c.lead} />
        <ChipGroup
          label={c.filter}
          options={FILTERS.map((f) => ({ value: f, label: meta.filters[f] }))}
          value={filter}
          onChange={setFilter}
          dataKey="data-filter"
          className="-mx-4 mt-10 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        />
        <p aria-live="polite" className="mt-4 text-caption text-text-muted">
          {fill(c.count, { n: shown.length })}
        </p>
        <ol data-library className="mt-3 divide-y divide-border-soft border-y border-border-soft">
          {shown.map((r) => (
            <li key={r.id} data-library-item={r.id}>
              <ResourceRow id={r.id} index={RESOURCES.indexOf(r)} summary />
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Glossary — highlighted definitions                                */
/* ------------------------------------------------------------------ */

const FEATURED_TERMS: readonly TermId[] = [
  'workItem',
  'handoff',
  'exception',
  'fefo',
  'informationBoundary',
  'operationalFinance',
];

export function GlossaryTeaser() {
  const c = useCopy(RESOURCES_COPY).glossary;
  const g = useCopy(GLOSSARY);
  const { href } = useLocale();
  return (
    <Chapter id="glossary" labelledBy="glossary-title" space="md">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="glossary-title" title={c.title} lead={c.lead} />
        <dl className="mt-12 grid grid-cols-1 gap-x-12 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
          {FEATURED_TERMS.map((t) => (
            <div key={t} data-term-teaser={t} className="border-t border-border-soft pt-4 pb-3">
              <dt>
                <Link
                  to={href(`${resourcePath('coreGlossary')}#${termAnchor(t)}`)}
                  className="inline-flex min-h-11 items-center text-label font-semibold text-text-primary hover:text-brand-soft"
                >
                  <mark className="rounded bg-brand-primary/15 px-1.5 py-0.5 text-inherit">
                    {g.terms[t].name}
                  </mark>
                </Link>
              </dt>
              <dd className="text-label text-text-secondary">{g.terms[t].definition}</dd>
            </div>
          ))}
        </dl>
        <QuietLink to={resourcePath('coreGlossary')} data="glossary" className="mt-6">
          {c.all}
        </QuietLink>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 08 Security & Data · 09 Implementation                               */
/* ------------------------------------------------------------------ */

export function SecurityAndImplementation() {
  const c = useCopy(RESOURCES_COPY);
  const names = useCopy(JOURNEY_NAMES);
  return (
    // EP19: no chapter name — its two teasers are the named regions (no duplicate landmark).
    <Chapter id="practice" plane="deep" space="md">
      <Frame width="wide" className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
        <section aria-labelledby="security-teaser-title" data-teaser="security">
          <Kicker tone="clear">{c.security.eyebrow}</Kicker>
          <h2 id="security-teaser-title" className="mt-4 text-h2 text-text-primary">
            {c.security.title}
          </h2>
          <p className="mt-4 max-w-xl text-body text-text-secondary">{c.security.body}</p>
          <div className="mt-6 flex flex-col items-start">
            <QuietLink to={resourcePath('securityAndData')} data="security-guide">
              {c.security.guide}
            </QuietLink>
            <QuietLink to={RESOURCE_LINKS.security} data="security-center">
              {c.security.center}
            </QuietLink>
          </div>
        </section>
        <section aria-labelledby="implementation-teaser-title" data-teaser="implementation">
          <Kicker tone="clear">{c.implementation.eyebrow}</Kicker>
          <h2
            id="implementation-teaser-title"
            className="mt-4 text-h2 whitespace-pre-line text-text-primary"
          >
            {c.implementation.title}
          </h2>
          <p className="mt-4 max-w-xl text-body text-text-secondary">{c.implementation.body}</p>
          <ol className="mt-6 flex flex-wrap gap-x-1.5 gap-y-2 text-caption text-text-secondary">
            {JOURNEY_STEPS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <span className="rounded-full px-2.5 py-1 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]">
                  <span className="text-text-muted tabular">{i + 1}</span> {names[s.id]}
                </span>
                {i < JOURNEY_STEPS.length - 1 && (
                  <span aria-hidden className="text-text-muted">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col items-start">
            <QuietLink to={resourcePath('implementationGuide')} data="implementation-guide">
              {c.implementation.guide}
            </QuietLink>
            <QuietLink to={RESOURCE_LINKS.industries} data="industries">
              {c.implementation.industries}
            </QuietLink>
          </div>
        </section>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 10 CTA                                                               */
/* ------------------------------------------------------------------ */

export function ResourcesCta() {
  const c = useCopy(RESOURCES_COPY).cta;
  const { href } = useLocale();
  return (
    <Chapter id="consult" labelledBy="resources-cta-title" plane="clear" space="lg">
      <Frame width="narrow" className="text-center">
        <h2
          id="resources-cta-title"
          className="text-[clamp(1.75rem,1.2rem+1.9vw,2.85rem)] leading-[1.25] font-semibold tracking-tight text-balance text-text-primary"
        >
          {c.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-body text-text-secondary">{c.lead}</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={href(RESOURCE_LINKS.consult)}
            data-cta="consult"
            className={buttonClasses('primary', 'lg', 'whitespace-normal')}
          >
            {c.primary}
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          </Link>
          <Link
            to={href(RESOURCE_LINKS.demo)}
            data-cta="demo"
            className={buttonClasses('secondary', 'lg')}
          >
            {c.demo}
          </Link>
        </div>
      </Frame>
    </Chapter>
  );
}
