import { BookText, Search, X } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Frame, Kicker } from '@/components/editorial/Layout';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { RESOURCES_COPY } from '../copy';
import { GLOSSARY, TERMS, termAnchor } from '../glossary';
import { RESOURCE_META } from '../meta';
import { CategoryTag } from '../parts';
import { getResource, RESOURCES, resourcePath, type ResourceId } from '../registry';
import { searchResources } from '../search';

/* ------------------------------------------------------------------ */
/* Search — instant, in memory, in the visitor's language               */
/* ------------------------------------------------------------------ */

export function ResourceSearch() {
  const c = useCopy(RESOURCES_COPY).search;
  const meta = useCopy(RESOURCE_META);
  const glossary = useCopy(GLOSSARY);
  const { href } = useLocale();
  const id = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () => searchResources(deferred, meta, glossary),
    [deferred, meta, glossary],
  );
  const active = deferred.trim().length > 0;

  return (
    <div role="search" data-resource-search className="mt-9">
      <label htmlFor={`${id}-q`} className="text-label font-medium text-text-primary">
        {c.label}
      </label>
      <div className="relative mt-2.5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-text-muted"
        />
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder={c.placeholder}
          autoComplete="off"
          aria-describedby={`${id}-status`}
          aria-controls={`${id}-results`}
          className="h-13 w-full rounded-full border border-border-strong bg-surface-raised/70 pr-12 pl-11 text-body text-text-primary placeholder:text-text-muted focus:border-brand-glow focus:shadow-glow-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={c.clear}
            className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <p
        id={`${id}-status`}
        aria-live="polite"
        className="mt-3 min-h-5 text-caption text-text-muted"
      >
        {active &&
          fill(results.length ? c.results : c.none, { n: results.length, q: deferred.trim() })}
      </p>

      <div id={`${id}-results`}>
        {active && results.length > 0 && (
          <ul
            data-search-results
            className="mt-1 divide-y divide-border-soft border-y border-border-soft"
          >
            {results.map((r) => {
              if (r.kind === 'term') {
                const t = TERMS.find((x) => x.id === r.id)!;
                const text = glossary.terms[r.id];
                return (
                  <li key={`t-${r.id}`} data-result="term" data-term={r.id}>
                    <Link
                      to={href(`${resourcePath('coreGlossary')}#${termAnchor(r.id)}`)}
                      className="flex min-h-11 items-start gap-3 py-3 hover:text-brand-soft"
                    >
                      <BookText aria-hidden className="mt-1 size-4 shrink-0 text-text-muted" />
                      <span className="min-w-0">
                        <span className="text-caption text-text-muted">{c.term}</span>
                        <span className="block text-label font-semibold text-text-primary">
                          {text.name}
                          {text.name !== t.en && (
                            <span className="font-normal text-text-muted"> · {t.en}</span>
                          )}
                        </span>
                        <span className="line-clamp-2 text-caption text-text-secondary">
                          {text.definition}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              }
              const m = meta.resources[r.id];
              return (
                <li
                  key={`r-${r.id}`}
                  data-result="resource"
                  data-resource={r.id}
                  data-field={r.field}
                >
                  <Link
                    to={href(resourcePath(r.id))}
                    className="block min-h-11 py-3 hover:text-brand-soft"
                  >
                    <CategoryTag category={getResource(r.id).category} />
                    <span className="mt-0.5 block text-label font-semibold text-text-primary">
                      {m.title}
                    </span>
                    <span className="text-caption text-text-muted">
                      {fill(c.why[r.field], { d: r.detail ?? '' })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {active && results.length === 0 && (
          <div data-search-empty className="mt-1">
            <p className="text-caption text-text-secondary">{c.tryThese}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="min-h-11 rounded-full border border-border-strong px-4 text-label text-text-secondary hover:border-border-brand hover:text-text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Knowledge map — fragments → connected map → learning paths           */
/* ------------------------------------------------------------------ */

/** Node positions in a 100 × 100 frame (left: concepts → right: practice). */
const NODES: Record<ResourceId, { x: number; y: number }> = {
  gettingStarted: { x: 15, y: 22 },
  coreGlossary: { x: 15, y: 78 },
  howCoreWorks: { x: 41, y: 50 },
  humanError: { x: 63, y: 18 },
  warehousePrivacy: { x: 61, y: 84 },
  implementationGuide: { x: 85, y: 40 },
  securityAndData: { x: 85, y: 66 },
};

/** Edges from each guide's "read next" list, without duplicates. */
const EDGES = (() => {
  const seen = new Set<string>();
  const out: [ResourceId, ResourceId][] = [];
  for (const r of RESOURCES)
    for (const n of r.next) {
      const key = [r.id, n].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push([r.id, n]);
      }
    }
  return out;
})();

export function KnowledgeMap() {
  const c = useCopy(RESOURCES_COPY).hero;
  const meta = useCopy(RESOURCE_META);
  const { href } = useLocale();
  const [hot, setHot] = useState<ResourceId | null>(null);
  return (
    <nav
      aria-label={c.map}
      data-knowledge-map
      className="relative hidden aspect-[1.2] w-full lg:block"
    >
      {/* Zone annotations, faint, like margin notes on a map */}
      <ol
        aria-hidden
        className="absolute inset-x-0 -top-2 flex justify-between font-mono text-[0.6875rem] tracking-[0.12em] text-text-muted/70 uppercase"
      >
        {c.zones.map((z, i) => (
          <li key={z}>
            {String(i + 1).padStart(2, '0')} {z}
          </li>
        ))}
      </ol>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        {EDGES.map(([a, b]) => {
          const on = hot === a || hot === b;
          return (
            <line
              key={`${a}-${b}`}
              data-edge={`${a}-${b}`}
              x1={NODES[a].x}
              y1={NODES[a].y}
              x2={NODES[b].x}
              y2={NODES[b].y}
              vectorEffect="non-scaling-stroke"
              stroke={on ? 'rgb(62 240 192 / 0.85)' : 'rgb(190 235 222 / 0.14)'}
              strokeWidth={on ? 1.4 : 1}
              strokeDasharray={on ? '6 6' : undefined}
              className={cn(
                on && 'animate-[resource-flow_1.2s_linear_infinite] motion-reduce:animate-none',
              )}
            />
          );
        })}
      </svg>
      <ul>
        {(Object.keys(NODES) as ResourceId[]).map((id) => {
          const n = NODES[id];
          const r = getResource(id);
          return (
            <li
              key={id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <Link
                to={href(resourcePath(id))}
                data-map-node={id}
                onMouseEnter={() => setHot(id)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(id)}
                onBlur={() => setHot(null)}
                className={cn(
                  'flex min-h-11 w-[10.5rem] flex-col justify-center rounded-2xl px-3.5 py-2 text-left backdrop-blur-sm transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none',
                  hot === id
                    ? 'bg-[rgb(12_28_36/0.95)] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.55),0_20px_60px_-30px_rgb(62_240_192/0.7)]'
                    : 'bg-[rgb(9_18_26/0.85)] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
                )}
              >
                <CategoryTag category={r.category} className="text-[0.6875rem]" />
                <span className="mt-0.5 text-caption leading-snug font-semibold text-text-primary">
                  {meta.resources[id].title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ResourcesHero() {
  const c = useCopy(RESOURCES_COPY).hero;
  return (
    <section aria-labelledby="resources-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[46rem] bg-[radial-gradient(ellipse_55%_60%_at_78%_10%,rgb(108_184_255/0.07),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-16 sm:pt-36 lg:pb-24">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
          <div className="max-w-2xl">
            <Kicker tone="clear">{c.eyebrow}</Kicker>
            <h1
              id="resources-title"
              className="mt-5 text-[clamp(2.25rem,1.35rem+3.3vw,4.25rem)] leading-[1.15] font-semibold tracking-tight whitespace-pre-line text-text-primary"
            >
              {c.title}
            </h1>
            <p className="mt-6 text-body-lg text-text-secondary">{c.lead}</p>
            <p className="mt-3 text-label text-text-muted">{c.line}</p>
            <ResourceSearch />
          </div>
          <KnowledgeMap />
        </div>
      </Frame>
    </section>
  );
}
