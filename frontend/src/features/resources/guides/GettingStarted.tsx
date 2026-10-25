import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES, deptPath } from '@/features/departments/catalog';
import { DeptDot } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import {
  Callout,
  Compare,
  Example,
  Figure,
  Flow,
  List,
  P,
  ResourceArticle,
  Section,
} from '../article/Article';
import { RESOURCE_LINKS } from '../registry';
import { GETTING_STARTED } from './gettingStarted.copy';

/** /resources/getting-started — what CORE is, is not, and where to begin. */
export default function GettingStarted() {
  const c = useCopy(GETTING_STARTED);
  const departments = useDepartments();
  const { href } = useLocale();
  return (
    <ResourceArticle
      id="gettingStarted"
      links={[
        { to: RESOURCE_LINKS.demo, label: c.links.demo, data: 'demo' },
        { to: RESOURCE_LINKS.whyCore, label: c.links.why, data: 'why-core' },
        { to: RESOURCE_LINKS.pricing, label: c.links.pricing, data: 'pricing' },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: RESOURCE_LINKS.consult, label: c.cta.primary, data: 'consult' },
        secondary: { to: RESOURCE_LINKS.pricing, label: c.cta.secondary, data: 'pricing' },
      }}
    >
      <Section id="what" n={1} title={c.what.title}>
        <P>{c.what.p1}</P>
        <P>{c.what.p2}</P>
        <Callout tone="key">{c.what.key}</Callout>
      </Section>

      <Section id="not" n={2} title={c.not.title}>
        <Compare
          left={{ title: c.not.is, items: c.not.isItems }}
          right={{ title: c.not.isNot, items: c.not.isNotItems }}
        />
        <P>{c.not.after}</P>
      </Section>

      <Section id="who" n={3} title={c.who.title}>
        <P>{c.who.p}</P>
        <List items={c.who.items} />
      </Section>

      <Section id="departments" n={4} title={c.departments.title}>
        <P>{c.departments.p}</P>
        <dl className="mt-6 divide-y divide-border-soft border-y border-border-soft">
          {DEPT_PAGES.map((d) => {
            const dept = departments.find((x) => x.id === d)!;
            return (
              <div
                key={d}
                className="grid grid-cols-1 gap-1 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
              >
                <dt>
                  <Link
                    to={href(deptPath(d))}
                    aria-label={`${c.departments.open}: ${dept.name}`}
                    className="inline-flex min-h-11 items-center gap-2 text-label font-semibold text-text-primary hover:text-brand-soft sm:min-h-0"
                  >
                    <DeptDot id={d} />
                    {dept.name}
                    <ArrowUpRight aria-hidden className="size-3.5 text-text-muted" />
                  </Link>
                </dt>
                <dd className="text-label text-text-secondary">{dept.purpose}</dd>
              </div>
            );
          })}
        </dl>
      </Section>

      <Section id="workflow" n={5} title={c.workflow.title}>
        <P>{c.workflow.p1}</P>
        <Figure caption={c.workflow.caption}>
          <Flow steps={c.workflow.flow} />
        </Figure>
        <P>{c.workflow.p2}</P>
        <Example>{c.workflow.example}</Example>
      </Section>

      <Section id="demo" n={6} title={c.demo.title}>
        <List ordered items={c.demo.steps} />
        <Callout>{c.demo.note}</Callout>
      </Section>

      <Section id="next" n={7} title={c.next.title}>
        <P>{c.next.p}</P>
        <List items={c.next.items} />
      </Section>
    </ResourceArticle>
  );
}
