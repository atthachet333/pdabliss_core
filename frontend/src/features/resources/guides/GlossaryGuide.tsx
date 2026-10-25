import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { fill } from '@/lib/fill';
import { P, ResourceArticle } from '../article/Article';
import { GLOSSARY, TERM_CATEGORIES, TERMS, termAnchor, type TermCategory } from '../glossary';
import { RESOURCE_META } from '../meta';
import { ChipGroup } from '../parts';
import { RESOURCE_LINKS, resourcePath } from '../registry';
import { normalize } from '../search';
import { GLOSSARY_PAGE } from './glossaryPage.copy';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SORTED = [...TERMS].sort((a, b) => a.en.localeCompare(b.en, 'en'));

/** /resources/core-glossary — searchable, filterable, indexed; never a giant table. */
export default function GlossaryGuide() {
  const c = useCopy(GLOSSARY_PAGE);
  const g = useCopy(GLOSSARY);
  const meta = useCopy(RESOURCE_META);
  const { href } = useLocale();
  const id = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TermCategory | 'all'>('all');

  const shown = useMemo(() => {
    const q = normalize(query).split(' ').filter(Boolean);
    return SORTED.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      const text = normalize(`${t.en} ${g.terms[t.id].name} ${g.terms[t.id].definition}`);
      return q.every((w) => text.includes(w));
    });
  }, [query, category, g]);
  const firstOf = (letter: string) => shown.find((t) => t.en.toUpperCase().startsWith(letter));

  return (
    <ResourceArticle
      id="coreGlossary"
      links={[
        { to: RESOURCE_LINKS.demo, label: c.links.demo, data: 'demo' },
        { to: '/how-core-works', label: c.links.how, data: 'how-core-works' },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: RESOURCE_LINKS.demo, label: c.cta.primary, data: 'demo' },
        secondary: {
          to: resourcePath('gettingStarted'),
          label: c.cta.secondary,
          data: 'getting-started',
        },
      }}
    >
      <P className="mt-10">{c.intro}</P>

      <div
        data-glossary-tools
        className="sticky top-16 z-10 -mx-4 mt-8 bg-surface-dark/90 px-4 pt-3 pb-3 backdrop-blur-md sm:top-20"
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          {c.search}
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-muted"
          />
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder={c.placeholder}
            autoComplete="off"
            className="h-12 w-full rounded-full border border-border-strong bg-surface-raised/70 pr-4 pl-11 text-body text-text-primary placeholder:text-text-muted focus:border-brand-glow focus:outline-none"
          />
        </div>
        <ChipGroup
          label={c.categories}
          options={(['all', ...TERM_CATEGORIES] as const).map((k) => ({
            value: k,
            label: k === 'all' ? c.all : g.categories[k],
          }))}
          value={category}
          onChange={setCategory}
          dataKey="data-term-filter"
          className="-mx-4 mt-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        />
      </div>

      <nav aria-label={c.index} className="mt-4">
        <ol data-letter-index className="flex flex-wrap gap-1">
          {LETTERS.map((l) => {
            const t = firstOf(l);
            return (
              <li key={l}>
                {t ? (
                  <a
                    href={`#${termAnchor(t.id)}`}
                    className="flex size-11 items-center justify-center rounded-lg font-mono text-label text-text-primary hover:bg-white/[0.06] hover:text-brand-soft"
                  >
                    {l}
                  </a>
                ) : (
                  <span
                    aria-hidden
                    className="flex size-11 items-center justify-center font-mono text-label text-text-muted/40"
                  >
                    {l}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <p id={`${id}-count`} aria-live="polite" className="mt-4 text-caption text-text-muted">
        {shown.length ? fill(c.count, { n: shown.length }) : fill(c.none, { q: query.trim() })}
      </p>

      <dl data-glossary className="mt-2">
        {shown.map((t) => {
          const x = g.terms[t.id];
          return (
            <div
              key={t.id}
              id={termAnchor(t.id)}
              data-term={t.id}
              data-term-category={t.category}
              className="scroll-mt-48 border-t border-border-soft py-5 target:rounded-2xl target:bg-brand-primary/[0.07] target:px-4 target:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]"
            >
              <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-h3 font-semibold text-text-primary">{x.name}</span>
                {x.name !== t.en && (
                  <span className="font-mono text-caption text-text-muted" title={c.english}>
                    {t.en}
                  </span>
                )}
                <span className="text-caption text-text-muted">· {g.categories[t.category]}</span>
              </dt>
              <dd className="mt-2 text-[1.0625rem] leading-[1.8] text-text-secondary">
                {x.definition}
              </dd>
              {x.example && (
                <dd className="mt-2 text-label text-text-muted">
                  <span className="text-text-secondary">{c.example}:</span> {x.example}
                </dd>
              )}
              <dd className="mt-2">
                <Link
                  to={href(resourcePath(t.see))}
                  data-term-see={t.see}
                  className="inline-flex min-h-11 items-center text-caption text-brand-soft underline-offset-4 hover:underline"
                >
                  {c.see} “{meta.resources[t.see].title}”
                </Link>
              </dd>
            </div>
          );
        })}
      </dl>
    </ResourceArticle>
  );
}
