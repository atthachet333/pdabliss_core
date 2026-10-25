import { Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { Figure, Flow, List, P, ResourceArticle, Section } from '../article/Article';
import { JOURNEY_NAMES, JOURNEY_STEPS } from '../journey';
import { RESOURCE_LINKS } from '../registry';
import { CHECKLIST, IMPLEMENTATION_GUIDE, type ChecklistId } from './implementation.copy';

/** /resources/implementation-guide — the journey and the preparation checklist. */
export default function ImplementationGuide() {
  const c = useCopy(IMPLEMENTATION_GUIDE);
  const names = useCopy(JOURNEY_NAMES);
  // In memory only: nothing is stored or sent.
  const [ready, setReady] = useState<ReadonlySet<ChecklistId>>(new Set());
  const toggle = (id: ChecklistId) =>
    setReady((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ResourceArticle
      id="implementationGuide"
      links={[
        { to: RESOURCE_LINKS.pricing, label: c.links.pricing, data: 'pricing' },
        {
          to: '/enterprise#implementation',
          label: c.links.enterprise,
          data: 'enterprise-implementation',
        },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: RESOURCE_LINKS.consult, label: c.cta.primary, data: 'consult' },
        secondary: { to: RESOURCE_LINKS.pricing, label: c.cta.secondary, data: 'pricing' },
      }}
    >
      <P className="mt-10">{c.intro.p1}</P>
      <P>{c.intro.p2}</P>

      <Section id="journey" n={1} title={c.journey.title}>
        <Figure caption={c.journey.caption} wide>
          <Flow
            steps={JOURNEY_STEPS.map((s) => ({ label: names[s.id], note: s.phase.toUpperCase() }))}
          />
        </Figure>
        <ol data-journey className="mt-8 space-y-6">
          {JOURNEY_STEPS.map((s, i) => {
            const x = c.journey.steps[s.id];
            return (
              <li
                key={s.id}
                data-step={s.id}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 border-t border-border-soft pt-5"
              >
                <span aria-hidden className="font-mono text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="flex flex-wrap items-baseline gap-x-3 text-label font-semibold text-text-primary">
                    {names[s.id]}
                    <span className="font-mono text-[0.6875rem] font-normal tracking-[0.12em] text-text-muted">
                      {s.phase.toUpperCase()}
                    </span>
                  </h3>
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-label sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                    <dt className="text-text-muted">{c.journey.purpose}</dt>
                    <dd className="text-text-secondary">{x.purpose}</dd>
                    <dt className="text-text-muted">{c.journey.output}</dt>
                    <dd className="text-text-secondary">{x.output}</dd>
                    <dt className="text-text-muted">{c.journey.who}</dt>
                    <dd className="text-text-secondary">{x.who}</dd>
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="checklist" n={2} title={c.checklist.title}>
        <P>{c.checklist.p}</P>
        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p
            aria-live="polite"
            data-checklist-progress
            className="text-label font-medium text-brand-soft"
          >
            {fill(c.checklist.progress, { n: ready.size, total: CHECKLIST.length })}
          </p>
          {ready.size > 0 && (
            <button
              type="button"
              data-checklist-reset
              onClick={() => setReady(new Set())}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-label text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] hover:text-text-primary"
            >
              <RotateCcw aria-hidden className="size-3.5" />
              {c.checklist.reset}
            </button>
          )}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
          <div
            className="h-full rounded-full bg-brand-glow transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(ready.size / CHECKLIST.length) * 100}%` }}
          />
        </div>
        <ul data-checklist className="mt-5 divide-y divide-border-soft border-y border-border-soft">
          {CHECKLIST.map((id) => {
            const on = ready.has(id);
            return (
              <li key={id}>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    data-check={id}
                    checked={on}
                    onChange={() => toggle(id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-glow',
                      on
                        ? 'bg-brand-primary text-text-inverse'
                        : 'shadow-[inset_0_0_0_1.5px_rgb(190_235_222/0.3)]',
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span>
                    <span
                      className={cn(
                        'block text-label font-medium',
                        on ? 'text-text-primary' : 'text-text-primary/90',
                      )}
                    >
                      {c.checklist.items[id].item}
                    </span>
                    <span className="text-caption text-text-muted">
                      {c.checklist.items[id].why}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="pitfalls" n={3} title={c.pitfalls.title}>
        <List items={c.pitfalls.items} />
      </Section>
    </ResourceArticle>
  );
}
