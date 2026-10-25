import { useCopy } from '@/i18n/useCopy';
import { Callout, Figure, Flow, List, P, ResourceArticle, Section } from '../article/Article';
import { RESOURCE_LINKS } from '../registry';
import { HUMAN_ERROR_GUIDE, MISTAKE_ROWS, PRINCIPLES } from './humanError.copy';

/** /resources/human-error — PREVENT · DETECT · ALERT · CONTROL · TRACE, with limits. */
export default function HumanErrorGuide() {
  const c = useCopy(HUMAN_ERROR_GUIDE);
  return (
    <ResourceArticle
      id="humanError"
      links={[
        { to: '/demo?role=warehouse', label: c.links.demo, data: 'demo-warehouse' },
        { to: '/solutions#human-error', label: c.links.solutions, data: 'solutions-human-error' },
        {
          to: '/how-core-works#human-error',
          label: c.links.workflow,
          data: 'workflow-human-error',
        },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: '/demo?role=warehouse', label: c.cta.primary, data: 'demo-warehouse' },
        secondary: { to: RESOURCE_LINKS.consult, label: c.cta.secondary, data: 'consult' },
      }}
    >
      <P className="mt-10">{c.intro.p1}</P>
      <P>{c.intro.p2}</P>
      <Callout tone="boundary">{c.intro.boundary}</Callout>
      <Figure caption={c.map.caption} wide>
        <Flow
          steps={PRINCIPLES.map((p) => ({
            label: c.principles[p].name,
            note: c.principles[p].when,
          }))}
        />
      </Figure>

      {PRINCIPLES.map((p, i) => {
        const x = c.principles[p];
        return (
          <Section key={p} id={p} n={i + 1} title={x.title}>
            <P>{x.p}</P>
            <Callout tone="key" title={c.labels.example}>
              {x.example}
            </Callout>
            <Callout tone="boundary" title={c.labels.limit}>
              {x.limit}
            </Callout>
            <p className="mt-5 border-l border-border-strong pl-4 text-label text-text-primary italic">
              <span className="text-caption text-text-muted not-italic">{c.labels.ask} — </span>
              {x.ask}
            </p>
          </Section>
        );
      })}

      <Section id="cases" n={PRINCIPLES.length + 1} title={c.table.title}>
        <table data-mistakes className="mt-7 w-full border-collapse text-left">
          <caption className="caption-bottom pt-3 text-left text-caption text-text-muted">
            {c.table.caption}
          </caption>
          <thead className="max-sm:sr-only">
            <tr className="text-caption text-text-muted">
              <th scope="col" className="pb-2 font-medium">
                {c.table.mistake}
              </th>
              <th scope="col" className="pb-2 font-medium">
                {c.table.principle}
              </th>
              <th scope="col" className="pb-2 font-medium">
                {c.table.action}
              </th>
            </tr>
          </thead>
          <tbody>
            {MISTAKE_ROWS.map((r) => (
              <tr
                key={r.id}
                data-mistake={r.id}
                data-principle={r.principle}
                className="border-t border-border-soft max-sm:block max-sm:py-3"
              >
                <th
                  scope="row"
                  className="py-3 pr-4 align-top text-label font-medium text-text-primary max-sm:block max-sm:py-0"
                >
                  {c.table.rows[r.id].mistake}
                </th>
                <td className="py-3 pr-4 align-top max-sm:block max-sm:py-1">
                  <span className="rounded-full bg-brand-primary/12 px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap text-brand-soft">
                    {c.principles[r.principle].name}
                  </span>
                </td>
                <td className="py-3 align-top text-label text-text-secondary max-sm:block max-sm:py-0">
                  {c.table.rows[r.id].action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="design" n={PRINCIPLES.length + 2} title={c.design.title}>
        <P>{c.design.p}</P>
        <List items={c.design.items} />
      </Section>
    </ResourceArticle>
  );
}
