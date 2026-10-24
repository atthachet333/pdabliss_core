import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, CircleDot } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { useMediaQuery } from '@/components/core/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { tabKeys } from '@/features/departments/tabs';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import {
  FIT,
  fitResult,
  INDUSTRIES,
  INDUSTRY_IDS,
  industryPath,
  PRINCIPLES,
  type FitId,
  type IndustryId,
  type Principle,
} from '../model';
import { DeptDot, Ending, Head, MotifGlyph } from '../parts';
import { useDeptName } from '../useIndustryMeta';

/* ------------------------------------------------------------------ */
/* 02 Selector — a cinematic rail; one environment open at a time       */
/* ------------------------------------------------------------------ */

/** The open environment: operating model, friction, departments, workflow, fit, link. */
function EnvironmentDetail({ id }: { id: IndustryId }) {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  const name = useDeptName();
  const s = c.industries[id];
  const ind = INDUSTRIES[id];
  return (
    <div data-selected-industry={id} className="flex h-full flex-col">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-10">
        <div>
          <p className="text-caption text-text-muted">{c.common.model}</p>
          <p className="mt-2 text-body-lg text-text-primary">{s.model}</p>
          <p className="mt-6 flex items-center gap-1.5 text-caption font-semibold text-warning">
            <AlertTriangle aria-hidden className="size-3.5" />
            {c.common.friction}
          </p>
          <p className="mt-2 text-body text-text-secondary">“{s.friction}”</p>
        </div>
        <div>
          <p className="text-caption text-text-muted">{c.common.departments}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {ind.departments.map((d) => (
              <li key={d} className="flex items-center gap-1.5 text-label text-text-primary">
                <DeptDot id={d} />
                {name(d)}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-caption text-text-muted">{c.common.capabilities}</p>
          <ul className="mt-2 space-y-1.5">
            {(['workflow', 'exceptions', 'executive'] as const).map((p) => (
              <li key={p} className="text-label text-text-secondary">
                <span className="text-brand-soft">{c.principles.names[p]}</span> — {s.principles[p]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t border-white/[0.06] pt-6">
        <Kicker tone="warm">{c.common.example}</Kicker>
        <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2" data-mini-workflow>
          {ind.workflow.map((st, i) => (
            <li key={st.id} className="flex items-center gap-1">
              <span
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-caption',
                  st.id === ind.stuckAt
                    ? 'bg-[rgb(245_184_75/0.12)] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                    : 'bg-white/[0.05] text-text-secondary',
                )}
              >
                <DeptDot id={st.dept} className="size-1.5" />
                {s.steps[st.id]}
              </span>
              {i < ind.workflow.length - 1 && (
                <ChevronRight aria-hidden className="size-3 text-text-muted" />
              )}
            </li>
          ))}
        </ol>
      </div>
      <Link
        to={href(industryPath(id))}
        data-open-industry={id}
        className="group mt-8 inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-brand-primary/15 px-5 text-label font-medium text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)] hover:bg-brand-primary/25"
      >
        {c.common.open} · {s.short}
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}

export function SelectorChapter() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const wide = useMediaQuery('(min-width: 64rem)');
  const [index, setIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = INDUSTRY_IDS[index]!;
  const step = (d: number) => setIndex((i) => (i + d + INDUSTRY_IDS.length) % INDUSTRY_IDS.length);
  return (
    <Chapter id="environments" labelledBy="environments-title" space="lg">
      <Frame width="full">
        <Head id="environments-title" eyebrow={c.selector.eyebrow} title={c.selector.title} />

        {wide ? (
          <div
            role="tablist"
            aria-label={c.selector.label}
            onKeyDown={(e) => tabKeys(INDUSTRY_IDS.length, index, setIndex, refs)(e)}
            className="mt-14 flex min-h-[40rem] gap-2"
          >
            {INDUSTRY_IDS.map((x, i) => {
              const on = i === index;
              return (
                <div
                  key={x}
                  className={cn(
                    'relative flex min-w-0 flex-col overflow-hidden rounded-[2rem] transition-[flex-grow,background-color] duration-500 ease-out',
                    on
                      ? 'grow-[7] bg-[linear-gradient(160deg,rgb(14_30_38),rgb(6_13_20))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.18)]'
                      : 'grow bg-white/[0.025] hover:bg-white/[0.05]',
                  )}
                  style={{ flexBasis: 0 }}
                >
                  <button
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`env-tab-${x}`}
                    aria-selected={on}
                    aria-controls={on ? 'env-panel' : undefined}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setIndex(i)}
                    data-env-tab={x}
                    className={cn(
                      'flex shrink-0 text-left',
                      on
                        ? 'items-center gap-4 px-8 pt-8'
                        : 'h-full flex-col items-center justify-between px-2 py-6',
                    )}
                  >
                    <MotifGlyph
                      motif={INDUSTRIES[x].motif}
                      className={on ? 'h-12 w-18 text-brand-glow' : 'h-7 w-10 text-text-muted'}
                    />
                    <span
                      className={cn(
                        'font-semibold',
                        on
                          ? 'text-h3 text-text-primary'
                          : 'text-label text-text-secondary [writing-mode:vertical-rl]',
                      )}
                    >
                      {on ? c.industries[x].label : c.industries[x].short}
                    </span>
                  </button>
                  {on && (
                    <div
                      id="env-panel"
                      role="tabpanel"
                      aria-labelledby={`env-tab-${x}`}
                      className="flex-1 px-8 pt-6 pb-8"
                    >
                      <EnvironmentDetail id={x} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Stage glow="clear" className="mt-10 p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={c.selector.prev}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-text-primary"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <div className="flex min-w-0 flex-col items-center text-center" aria-live="polite">
                <MotifGlyph motif={INDUSTRIES[id].motif} className="text-brand-glow" />
                <p className="mt-1 text-body font-semibold text-text-primary">
                  {c.industries[id].label}
                </p>
                <p className="text-caption text-text-muted tabular">
                  {index + 1} / {INDUSTRY_IDS.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={c.selector.next}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-text-primary"
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
            <div className="mt-8">
              <EnvironmentDetail id={id} />
            </div>
          </Stage>
        )}
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Atlas — six workflow silhouettes side by side                     */
/* ------------------------------------------------------------------ */

/** Node positions (viewBox 1000×120) that give each workflow its shape. */
function silhouette(id: IndustryId): { x: number; y: number }[] {
  const ind = INDUSTRIES[id];
  const n = ind.workflow.length;
  const x = (i: number) => 20 + (i / (n - 1)) * 960;
  switch (ind.motif) {
    // A route with a replenishment detour.
    case 'network':
      return ind.workflow.map((w, i) => ({ x: x(i), y: w.dept === 'purchasing' ? 22 : 70 }));
    // Office above, field below — work drops to site and comes back.
    case 'schedule':
      return ind.workflow.map((w, i) => ({ x: x(i), y: w.dept === 'operations' ? 95 : 28 }));
    // A rising staircase of phases.
    case 'milestones':
      return ind.workflow.map((_, i) => ({ x: x(i), y: 105 - (i / (n - 1)) * 90 }));
    // A closed replenishment loop.
    case 'branches':
      return ind.workflow.map((_, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return { x: 500 + 300 * Math.cos(a), y: 60 + 48 * Math.sin(a) };
      });
    // A straight line with a fork for vendors / materials.
    case 'sites':
      return ind.workflow.map((w, i) => ({ x: x(i), y: w.dept === 'purchasing' ? 104 : 40 }));
    // Zig-zag across department lanes.
    case 'lanes': {
      const lane: Partial<Record<string, number>> = {
        sales: 14,
        warehouse: 46,
        operations: 78,
        purchasing: 108,
      };
      return ind.workflow.map((w, i) => ({ x: x(i), y: lane[w.dept] ?? 60 }));
    }
  }
}

export function AtlasChapter() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  return (
    <Chapter id="silhouettes" labelledBy="silhouettes-title" plane="grid" space="lg">
      <Frame width="wide">
        <Head
          id="silhouettes-title"
          eyebrow={c.atlas.eyebrow}
          title={c.atlas.title}
          lead={c.atlas.lead}
        />
        <ol className="mt-14 divide-y divide-border-soft border-y border-border-soft">
          {INDUSTRY_IDS.map((id) => {
            const ind = INDUSTRIES[id];
            const s = c.industries[id];
            const stuck = ind.workflow.findIndex((w) => w.id === ind.stuckAt);
            return (
              <li
                key={id}
                data-silhouette={id}
                data-steps={ind.workflow.length}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center lg:gap-8"
              >
                <Link
                  to={href(industryPath(id))}
                  className="group flex min-h-11 items-center gap-3 text-body font-semibold text-text-primary"
                >
                  <MotifGlyph motif={ind.motif} className="h-7 w-10 text-brand-soft" />
                  {s.short}
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <div>
                  {/* The silhouette: each industry's work has its own shape */}
                  <svg
                    aria-hidden
                    viewBox="0 0 1000 120"
                    className="hidden h-20 w-full md:block"
                    data-shape={ind.motif}
                  >
                    {(() => {
                      const pts = silhouette(id);
                      const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
                      return (
                        <>
                          <path
                            d={ind.motif === 'branches' ? `${d} Z` : d}
                            fill="none"
                            stroke="var(--color-border-strong)"
                            strokeWidth="1.5"
                          />
                          {pts.map((p, i) => {
                            const w = ind.workflow[i]!;
                            return i === stuck ? (
                              <circle
                                key={w.id}
                                cx={p.x}
                                cy={p.y}
                                r="9"
                                fill="var(--color-surface-dark)"
                                stroke="var(--color-warning)"
                                strokeWidth="2.5"
                              />
                            ) : (
                              <circle
                                key={w.id}
                                cx={p.x}
                                cy={p.y}
                                r="5.5"
                                fill={`var(--color-ws-${w.dept})`}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-label text-text-secondary md:mt-1">
                    <span className="inline-flex items-center gap-1 text-caption font-semibold text-warning">
                      <CircleDot aria-hidden className="size-3" />
                      {c.atlas.stuck}
                    </span>
                    <span className="text-text-primary" data-stuck-at={ind.stuckAt}>
                      {s.steps[ind.stuckAt]}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span>{fill(c.common.stepCount, { n: ind.workflow.length })}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Shared principles — one grid of how each principle appears        */
/* ------------------------------------------------------------------ */

export function PrinciplesChapter() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const wide = useMediaQuery('(min-width: 80rem)');
  const [p, setP] = useState<Principle>('workflow');
  return (
    <Chapter id="principles" labelledBy="principles-title" plane="deep" space="lg">
      <Frame width="full">
        <Head
          id="principles-title"
          eyebrow={c.principles.eyebrow}
          title={c.principles.title}
          lead={c.principles.lead}
        />
        {wide ? (
          <div className="mt-14 overflow-hidden rounded-[2rem] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]">
            <table className="w-full table-fixed border-collapse text-left" data-principles-matrix>
              <caption className="sr-only">{c.principles.title}</caption>
              <thead>
                <tr className="bg-white/[0.03]">
                  <th
                    scope="col"
                    className="w-52 px-5 py-4 text-caption font-semibold text-text-muted"
                  >
                    <span className="sr-only">{c.principles.pick}</span>
                  </th>
                  {INDUSTRY_IDS.map((id) => (
                    <th
                      key={id}
                      scope="col"
                      className="px-4 py-4 text-label font-semibold text-text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <MotifGlyph
                          motif={INDUSTRIES[id].motif}
                          className="h-5 w-7 text-brand-soft"
                        />
                        {c.industries[id].short}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRINCIPLES.map((pr) => (
                  <tr key={pr} data-principle-row={pr} className="border-t border-white/[0.05]">
                    <th
                      scope="row"
                      className="px-5 py-4 align-top text-label font-semibold text-brand-soft"
                    >
                      {c.principles.names[pr]}
                    </th>
                    {INDUSTRY_IDS.map((id) => (
                      <td key={id} className="px-4 py-4 align-top text-caption text-text-secondary">
                        {c.industries[id].principles[pr]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-10">
            <Segmented
              label={c.principles.pick}
              options={PRINCIPLES.map((x) => ({ value: x, label: c.principles.names[x] }))}
              value={p}
              onChange={setP}
              size="sm"
              className="grid w-full grid-cols-2 sm:grid-cols-4"
            />
            <dl
              className="mt-6 divide-y divide-border-soft"
              data-principle-list={p}
              aria-live="polite"
            >
              {INDUSTRY_IDS.map((id) => (
                <div key={id} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                  <dt className="flex shrink-0 items-center gap-2 text-label font-semibold text-text-primary sm:w-44">
                    <MotifGlyph motif={INDUSTRIES[id].motif} className="h-5 w-7 text-brand-soft" />
                    {c.industries[id].short}
                  </dt>
                  <dd className="text-label text-text-secondary">
                    {c.industries[id].principles[p]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Find your fit — deterministic, nothing collected                  */
/* ------------------------------------------------------------------ */

export function FitChapter() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  const [choice, setChoice] = useState<FitId | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = choice ? FIT.findIndex((f) => f.id === choice) : 0;
  const result = choice ? fitResult(choice) : null;
  return (
    <Chapter id="fit" labelledBy="fit-title" plane="navy">
      <Frame width="base">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Head id="fit-title" eyebrow={c.fit.eyebrow} title={c.fit.title} lead={c.fit.lead} />
            <div
              role="radiogroup"
              aria-label={c.fit.label}
              onKeyDown={(e) => tabKeys(FIT.length, index, (i) => setChoice(FIT[i]!.id), refs)(e)}
              className="mt-8 space-y-1.5"
            >
              {FIT.map((f, i) => {
                const on = f.id === choice;
                return (
                  <button
                    key={f.id}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on || (!choice && i === 0) ? 0 : -1}
                    onClick={() => setChoice(f.id)}
                    data-fit={f.id}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-label transition-colors',
                      on
                        ? 'bg-brand-primary/15 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                        : 'bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-full border',
                        on ? 'border-brand-glow' : 'border-border-strong',
                      )}
                    >
                      {on && <span className="size-2 rounded-full bg-brand-glow" />}
                    </span>
                    {c.fit.options[f.id]}
                  </button>
                );
              })}
            </div>
          </div>
          <div aria-live="polite" className="lg:pt-24">
            {result ? (
              <Stage glow="clear" grid={false} className="p-6 sm:p-8">
                <div data-fit-result={result}>
                  <p className="text-caption text-text-muted">{c.fit.result}</p>
                  <p className="mt-3 flex items-center gap-3 text-h3 font-semibold text-text-primary">
                    <MotifGlyph motif={INDUSTRIES[result].motif} className="text-brand-glow" />
                    {c.industries[result].label}
                  </p>
                  <p className="mt-3 text-body text-text-secondary">{c.industries[result].model}</p>
                  <Link
                    to={href(industryPath(result))}
                    className="group mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-primary px-6 text-label font-medium text-text-inverse hover:bg-brand-glow"
                  >
                    {c.common.open}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <p className="mt-5 text-caption text-text-muted">{c.fit.note}</p>
                </div>
              </Stage>
            ) : (
              <div
                aria-hidden
                className="hidden h-full min-h-48 grid-cols-3 place-items-center gap-6 rounded-[2rem] border border-dashed border-border-soft p-8 lg:grid"
              >
                {INDUSTRY_IDS.map((x) => (
                  <MotifGlyph
                    key={x}
                    motif={INDUSTRIES[x].motif}
                    className="h-10 w-16 text-text-muted/50"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

export function IndustriesCta() {
  const c = useCopy(INDUSTRIES_SUMMARY).cta;
  return (
    <Chapter labelledBy="industries-cta" plane="clear" space="lg" className="pb-32 sm:pb-40">
      <Frame width="base">
        <Ending id={null}>
          <h2 id="industries-cta" className="text-h2 text-balance text-text-primary">
            {c.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-body text-text-secondary">{c.lead}</p>
        </Ending>
      </Frame>
    </Chapter>
  );
}
