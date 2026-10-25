import { motion, useScroll } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { deptPath } from '@/features/departments/catalog';
import { getSolution } from '@/features/solutions/model';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { RESOURCES_COPY } from '../copy';
import { RESOURCE_META } from '../meta';
import { CATEGORY_ACCENT } from '../accent';
import { CategoryTag, Minutes, ResourceRow } from '../parts';
import {
  getResource,
  PROBLEM_GUIDE,
  RESOURCES_HOME,
  type ProblemId,
  type ResourceId,
} from '../registry';
import { ARTICLE_COPY } from './copy';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { disclosureItem, disclosureTrigger } from '@/components/ui/overlay';

/*
 * The shared reading system for every guide (EP16): breadcrumb, category,
 * one H1, summary, comfortable long-form body (~44rem measure), contextual
 * diagrams, "read next", related site pages and one fitting call to action.
 * No left sidebar, no author, no date.
 */

export type ArticleLink = { to: string; label: string; data: string };

export function ResourceArticle({
  id,
  children,
  links = [],
  cta,
}: {
  id: ResourceId;
  children: ReactNode;
  /** Guide-specific site links (demo, security, pricing…). */
  links?: readonly ArticleLink[];
  cta: { title: string; body?: string; primary: ArticleLink; secondary?: ArticleLink };
}) {
  const a = useCopy(ARTICLE_COPY);
  const meta = useCopy(RESOURCE_META);
  const home = useCopy(RESOURCES_COPY);
  const departments = useDepartments();
  const { href } = useLocale();
  const r = getResource(id);
  const m = meta.resources[id];
  usePageMeta(m.title, m.summary);
  const { scrollYProgress } = useScroll();

  const solutions = r.relatedSolutions.filter((s): s is ProblemId => s in PROBLEM_GUIDE);
  // Guide-specific links first, then departments, Solutions and How CORE Works
  // chapters — each destination once (a guide link may already name a chapter).
  const candidates: (ArticleLink & { kind?: string; dot?: string })[] = [
    ...links,
    ...r.relatedDepartments.slice(0, 3).map((d) => ({
      to: deptPath(d),
      data: `department-${d}`,
      kind: a.kinds.department,
      label: departments.find((x) => x.id === d)!.name,
      dot: d,
    })),
    ...solutions.slice(0, 2).map((s) => ({
      to: `/solutions#${getSolution(s).anchor}`,
      data: `solution-${s}`,
      kind: a.kinds.solution,
      label: home.problems.items[s].label,
    })),
    ...r.relatedWorkflow.slice(0, 2).map((ch) => ({
      to: `/how-core-works#${ch}`,
      data: `workflow-${ch}`,
      kind: a.kinds.workflow,
      label: home.problems.chapters[ch] ?? ch,
    })),
  ];
  const related = candidates.filter((l, i) => candidates.findIndex((x) => x.to === l.to) === i);

  return (
    <article aria-labelledby="resource-title" data-resource={id} className="relative isolate">
      {/* Subtle reading progress — a hairline, not a widget */}
      <motion.div
        aria-hidden
        data-progress
        className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left"
        style={{ scaleX: scrollYProgress, background: CATEGORY_ACCENT[r.category] }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(ellipse_60%_70%_at_30%_0%,rgb(108_184_255/0.06),transparent_70%)]"
      />

      <Frame width="base" className="pt-28 sm:pt-36">
        <header className="mx-auto max-w-[46rem]">
          <nav aria-label={a.breadcrumb}>
            <ol className="flex flex-wrap items-center gap-1.5 text-caption text-text-muted">
              <li>
                <Link
                  to={href(RESOURCES_HOME)}
                  className="inline-flex min-h-11 items-center hover:text-text-primary"
                >
                  {a.root}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5" />
              </li>
              <li aria-current="page">
                <CategoryTag category={r.category} />
              </li>
            </ol>
          </nav>
          <h1
            id="resource-title"
            className="mt-4 text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] leading-[1.22] font-semibold tracking-tight text-balance text-text-primary"
          >
            {m.title}
          </h1>
          <p className="mt-5 text-body-lg text-text-secondary">{m.summary}</p>
          <Minutes id={id} className="mt-4 block" />
        </header>

        <div data-article-body className="mx-auto max-w-[46rem] pb-8">
          {children}
        </div>
      </Frame>

      {/* Read next — contextual, never "latest" */}
      <Frame width="base" className="mt-12">
        <div className="mx-auto max-w-[46rem]">
          <section aria-labelledby="next-title" data-next>
            <h2 id="next-title" className="text-h3 text-text-primary">
              {a.next}
            </h2>
            <p className="mt-1 text-caption text-text-muted">{a.nextLead}</p>
            <ol className="mt-4 divide-y divide-border-soft border-y border-border-soft">
              {r.next.map((n, i) => (
                <li key={n}>
                  <ResourceRow id={n} index={i} />
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="related-title" data-related className="mt-14">
            <h2 id="related-title" className="text-h3 text-text-primary">
              {a.related}
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {related.map((l) => (
                <RelatedLink key={l.data} {...l} to={href(l.to)} />
              ))}
            </ul>
          </section>
        </div>
      </Frame>

      <section
        aria-labelledby="resource-cta-title"
        data-resource-cta
        className="mt-20 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgb(25_195_154/0.1),transparent_70%)] py-20 sm:py-24"
      >
        <Frame width="narrow" className="text-center">
          <h2
            id="resource-cta-title"
            className="text-[clamp(1.6rem,1.2rem+1.5vw,2.4rem)] leading-[1.3] font-semibold tracking-tight text-balance text-text-primary"
          >
            {cta.title}
          </h2>
          {cta.body && (
            <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{cta.body}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={href(cta.primary.to)}
              data-cta={cta.primary.data}
              className={buttonClasses('primary', 'lg', 'whitespace-normal')}
            >
              {cta.primary.label}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
            {cta.secondary && (
              <Link
                to={href(cta.secondary.to)}
                data-cta={cta.secondary.data}
                className={buttonClasses('secondary', 'lg', 'whitespace-normal')}
              >
                {cta.secondary.label}
              </Link>
            )}
          </div>
        </Frame>
      </section>
    </article>
  );
}

function RelatedLink({
  to,
  data,
  label,
  kind,
  dot,
}: {
  to: string;
  data: string;
  label: string;
  kind?: string;
  dot?: string;
}) {
  return (
    <li className="border-b border-border-soft">
      <Link
        to={to}
        data-related-link={data}
        className="group flex min-h-12 items-center justify-between gap-3 py-2.5"
      >
        <span className="min-w-0">
          {kind && <span className="block text-caption text-text-muted">{kind}</span>}
          <span className="flex items-center gap-2 text-label text-text-primary group-hover:text-brand-soft">
            {dot && <DeptDot id={dot} />}
            {label}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Body building blocks                                                 */
/* ------------------------------------------------------------------ */

/** A chapter of the guide. The number is a quiet scroll marker, not decoration. */
export function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-section={id}
      className="scroll-mt-24 pt-16"
    >
      <p
        aria-hidden
        className="flex items-center gap-3 font-mono text-caption text-text-muted tabular"
      >
        {String(n).padStart(2, '0')}
        <span className="h-px w-10 bg-border-strong" />
      </p>
      <h2
        id={`${id}-title`}
        className="mt-3 text-[clamp(1.45rem,1.2rem+0.9vw,1.9rem)] leading-[1.35] font-semibold tracking-tight text-text-primary"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Long-form paragraph: generous Thai line height, controlled measure. */
export function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-5 text-[1.0625rem] leading-[1.9] text-text-secondary', className)}>
      {children}
    </p>
  );
}

export function List({
  items,
  ordered = false,
}: {
  items: readonly ReactNode[];
  ordered?: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className="mt-5 space-y-2.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-3 text-[1.0625rem] leading-[1.8] text-text-secondary">
          <span
            aria-hidden
            className={cn(
              'shrink-0 text-text-muted tabular',
              !ordered && 'mt-3.5 h-px w-3 bg-current',
            )}
          >
            {ordered ? `${i + 1}.` : ''}
          </span>
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </Tag>
  );
}

/** An annotation in the margin of the text: a note, a boundary or a key idea. */
export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'boundary' | 'key';
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      data-callout={tone}
      className={cn(
        'mt-7 rounded-2xl px-5 py-4 sm:px-6',
        tone === 'boundary'
          ? 'bg-warning/[0.06] shadow-[inset_3px_0_0_rgb(245_184_75/0.7)]'
          : tone === 'key'
            ? 'bg-brand-primary/[0.08] shadow-[inset_3px_0_0_rgb(62_240_192/0.7)]'
            : 'bg-white/[0.03] shadow-[inset_3px_0_0_rgb(190_235_222/0.25)]',
      )}
    >
      {title && <p className="text-label font-semibold text-text-primary">{title}</p>}
      <div className={cn('text-label leading-[1.8] text-text-secondary', title && 'mt-1')}>
        {children}
      </div>
    </aside>
  );
}

/** A diagram with its caption. Wide figures step out of the text measure on desktop. */
export function Figure({
  caption,
  children,
  wide = false,
}: {
  caption: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const a = useCopy(ARTICLE_COPY);
  return (
    <figure data-figure className={cn('mt-9', wide && 'xl:-mx-20')}>
      <div className="rounded-[1.5rem] bg-[linear-gradient(180deg,rgb(13_25_36/0.9),rgb(6_13_20/0.92))] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:p-7">
        {children}
      </div>
      <figcaption className="mt-3 flex gap-2 text-caption text-text-muted">
        <span className="shrink-0 font-mono">{a.diagram}</span>
        <span aria-hidden>—</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

/**
 * A sequence diagram as a real ordered list: across on wide screens,
 * vertical on phones and tablets (never squeezed beside text).
 */
export function Flow({
  steps,
  highlight,
}: {
  steps: readonly { label: string; note?: string }[];
  highlight?: number;
}) {
  return (
    <ol
      data-flow
      className="relative grid grid-cols-1 gap-4 pl-6 lg:auto-cols-fr lg:grid-flow-col lg:gap-3 lg:pt-5 lg:pl-0"
    >
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[0.3rem] w-px bg-brand-glow/30 lg:top-[0.3rem] lg:right-6 lg:bottom-auto lg:left-6 lg:h-px lg:w-auto"
      />
      {steps.map((s, i) => (
        <li key={i} className="relative min-w-0">
          <span
            aria-hidden
            className={cn(
              'absolute top-1.5 -left-6 size-2.5 rounded-full shadow-[0_0_0_4px_rgb(9_19_26)] lg:static lg:mb-3 lg:block',
              highlight === i ? 'bg-warning' : 'bg-brand-glow',
            )}
          />
          <p
            className={cn(
              'text-label font-semibold',
              highlight === i ? 'text-warning' : 'text-text-primary',
            )}
          >
            {s.label}
          </p>
          {s.note && (
            <p className="mt-0.5 text-caption leading-relaxed text-text-muted">{s.note}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Two columns: what something is / is not; sees / does not see. */
export function Compare({
  left,
  right,
}: {
  left: { title: string; items: readonly string[]; mark?: string };
  right: { title: string; items: readonly string[]; mark?: string };
}) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[left, right].map((side, k) => (
        <div
          key={side.title}
          data-compare={k === 0 ? 'left' : 'right'}
          className={cn(
            'rounded-2xl p-5',
            k === 0
              ? 'bg-brand-primary/[0.07] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.2)]'
              : 'bg-white/[0.025] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.22)]',
          )}
        >
          <p
            className={cn('text-label font-semibold', k === 0 ? 'text-brand-soft' : 'text-warning')}
          >
            {side.title}
          </p>
          <ul className="mt-3 space-y-2">
            {side.items.map((x) => (
              <li key={x} className="flex gap-2.5 text-label text-text-secondary">
                <span
                  aria-hidden
                  className={cn(
                    'mt-[0.55rem] size-1.5 shrink-0 rounded-full',
                    k === 0 ? 'bg-brand-glow' : 'bg-warning/80',
                  )}
                />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A contextual example that expands inline (native disclosure). */
export function Example({ title, children }: { title?: string; children: ReactNode }) {
  const a = useCopy(ARTICLE_COPY);
  return (
    <details data-example className={disclosureItem(undefined, 'mt-6')}>
      <summary className={cn(disclosureTrigger, 'min-h-12 text-label font-medium text-brand-soft')}>
        {title ?? a.example}
        <DisclosureIcon size="sm" />
      </summary>
      <div className="px-5 pb-5 text-label leading-[1.8] text-text-secondary">{children}</div>
    </details>
  );
}

/** A highlighted definition inside the text. */
export function Term({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-brand-primary/15 px-1 text-text-primary">{children}</mark>;
}
