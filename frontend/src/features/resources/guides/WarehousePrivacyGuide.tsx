import { CircleCheck, CircleMinus } from 'lucide-react';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { Callout, Compare, Figure, List, P, ResourceArticle, Section } from '../article/Article';
import { RESOURCE_LINKS } from '../registry';
import { CLASSES, CLEARANCE, WAREHOUSE_PRIVACY_GUIDE } from './warehousePrivacy.copy';

/** /resources/warehouse-privacy — the canonical explanation of the Warehouse boundary. */
export default function WarehousePrivacyGuide() {
  const c = useCopy(WAREHOUSE_PRIVACY_GUIDE);
  return (
    <ResourceArticle
      id="warehousePrivacy"
      links={[
        { to: RESOURCE_LINKS.security, label: c.links.security, data: 'security' },
        { to: '/demo?role=warehouse', label: c.links.demo, data: 'demo-warehouse' },
        { to: '/departments/warehouse', label: c.links.department, data: 'warehouse-page' },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: '/demo?role=warehouse', label: c.cta.primary, data: 'demo-warehouse' },
        secondary: { to: RESOURCE_LINKS.security, label: c.cta.secondary, data: 'security' },
      }}
    >
      <P className="mt-10">{c.intro}</P>

      <Section id="sees" n={1} title={c.sees.title}>
        <P>{c.sees.p}</P>
        <Figure caption={c.sees.caption}>
          <div data-warehouse-view>
            <p className="flex items-center gap-2 text-label font-semibold text-ws-warehouse">
              <DeptDot id="warehouse" />
              {c.sees.view}
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-white/[0.05] sm:grid-cols-2">
              {c.sees.fields.map((f) => (
                <div key={f.label} className="bg-[rgb(9_19_26)] px-4 py-3">
                  <dt className="text-caption text-text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-label text-text-primary">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Figure>
        <Compare
          left={{ title: c.compare.sees, items: c.compare.seesItems }}
          right={{ title: c.compare.not, items: c.compare.notItems }}
        />
      </Section>

      <Section id="why" n={2} title={c.why.title}>
        <P>{c.why.p}</P>
        <ol className="mt-6 space-y-5">
          {c.why.reasons.map((r, i) => (
            <li key={r.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
              <span aria-hidden className="font-mono text-caption text-text-muted tabular">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-label font-semibold text-text-primary">{r.title}</p>
                <p className="mt-1 text-[1.0625rem] leading-[1.8] text-text-secondary">{r.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Callout tone="key">{c.why.note}</Callout>
      </Section>

      <Section id="classes" n={3} title={c.classes.title}>
        <P>{c.classes.p}</P>
        <Figure caption={c.classes.caption} wide>
          <table data-clearance className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr>
                <td className="w-[36%] sm:w-[28%]" />
                {CLASSES.map((k) => (
                  <th
                    key={k}
                    scope="col"
                    className="px-1 pb-3 align-bottom text-[0.6875rem] font-semibold [overflow-wrap:anywhere] text-text-primary sm:px-2 sm:text-caption"
                  >
                    {c.classes.names[k].name}
                    <span className="mt-0.5 hidden font-normal text-text-muted sm:block">
                      {c.classes.names[k].body}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLEARANCE.map((row) => (
                <tr key={row.view} data-view={row.view} className="border-t border-white/[0.06]">
                  <th scope="row" className="py-3 pr-2 text-label font-medium text-text-primary">
                    <span className="flex items-center gap-2">
                      <DeptDot id={row.view} />
                      {c.classes.views[row.view]}
                    </span>
                  </th>
                  {CLASSES.map((k) => {
                    const on = (row.classes as readonly string[]).includes(k);
                    return (
                      <td key={k} data-class={k} data-receives={on} className="px-1 py-3 sm:px-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-caption',
                            on ? 'text-brand-soft' : 'text-text-muted',
                          )}
                        >
                          {on ? (
                            <CircleCheck aria-hidden className="size-4" />
                          ) : (
                            <CircleMinus aria-hidden className="size-4 text-warning/70" />
                          )}
                          <span className="max-sm:sr-only">
                            {on ? c.classes.receives : c.classes.not}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Figure>
      </Section>

      <Section id="enforce" n={4} title={c.enforce.title}>
        <P>{c.enforce.p1}</P>
        <P>{c.enforce.p2}</P>
        <Callout tone="boundary">{c.enforce.now}</Callout>
      </Section>

      <Section id="value" n={5} title={c.value.title}>
        <P>{c.value.p}</P>
        <List ordered items={c.value.items} />
        <Callout>{c.value.note}</Callout>
      </Section>

      <Section id="ask" n={6} title={c.ask.title}>
        <P>{c.ask.p}</P>
        <List ordered items={c.ask.items} />
      </Section>
    </ResourceArticle>
  );
}
