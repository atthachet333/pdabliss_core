import type { GLOSSARY } from './glossary';
import { TERMS, type TermId } from './glossary';
import type { RESOURCE_META } from './meta';
import { RESOURCES, type ResourceId } from './registry';

/*
 * In-memory resource search (EP16). Frontend only — no service, no fuzzy
 * library. Text is normalized (NFKC, lower case, collapsed whitespace,
 * zero-width characters removed), the query is split on spaces, and every
 * token must appear somewhere in the item. Thai and Chinese have no word
 * spaces, so a token simply matches as a substring.
 */

export type MatchField = 'title' | 'tag' | 'term' | 'category' | 'summary';

export type SearchResult =
  | { kind: 'resource'; id: ResourceId; field: MatchField; detail?: string; score: number }
  | { kind: 'term'; id: TermId; field: 'term' | 'definition'; score: number };

const WEIGHT: Record<MatchField | 'definition', number> = {
  title: 8,
  tag: 6,
  term: 6,
  category: 4,
  summary: 2,
  definition: 1,
};

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (query: string) => normalize(query).split(' ').filter(Boolean);

type Meta = (typeof RESOURCE_META)['th'];
type Glossary = (typeof GLOSSARY)['th'];

/** Searches resources and glossary terms in one locale's words. */
export function searchResources(query: string, meta: Meta, glossary: Glossary): SearchResult[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  const all = (text: string) => q.every((t) => normalize(text).includes(t));
  const some = (text: string) => q.some((t) => normalize(text).includes(t));
  const out: SearchResult[] = [];

  for (const r of RESOURCES) {
    const m = meta.resources[r.id];
    const category = meta.categories[r.category];
    const terms = TERMS.filter((t) => t.see === r.id).map(
      (t) => `${t.en} ${glossary.terms[t.id].name}`,
    );
    const haystack = [m.title, m.short, m.summary, category, ...m.tags, ...terms].join(' ');
    if (!all(haystack)) continue;
    // Explain the strongest reason it matched.
    const tag = m.tags.find(some);
    const term = TERMS.find((t) => t.see === r.id && some(`${t.en} ${glossary.terms[t.id].name}`));
    const field: MatchField = some(m.title)
      ? 'title'
      : tag
        ? 'tag'
        : term
          ? 'term'
          : some(category)
            ? 'category'
            : 'summary';
    const detail =
      field === 'tag' ? tag : field === 'term' && term ? glossary.terms[term.id].name : undefined;
    out.push({
      kind: 'resource',
      id: r.id,
      field,
      detail,
      score: WEIGHT[field] + (r.featured ? 0.5 : 0),
    });
  }

  for (const t of TERMS) {
    const text = glossary.terms[t.id];
    const name = `${t.en} ${text.name}`;
    if (all(name)) out.push({ kind: 'term', id: t.id, field: 'term', score: WEIGHT.term + 1 });
    else if (all(`${name} ${text.definition}`))
      out.push({ kind: 'term', id: t.id, field: 'definition', score: WEIGHT.definition });
  }

  return out.sort((a, b) => b.score - a.score);
}
