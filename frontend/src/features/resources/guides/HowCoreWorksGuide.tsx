import { useCopy } from '@/i18n/useCopy';
import {
  Callout,
  Example,
  Figure,
  Flow,
  List,
  P,
  ResourceArticle,
  Section,
} from '../article/Article';
import { RESOURCE_LINKS } from '../registry';
import { HOW_CORE_WORKS_GUIDE } from './howCoreWorks.copy';

const ORDER = [
  'item',
  'owner',
  'state',
  'handoff',
  'approval',
  'exception',
  'trace',
  'completion',
] as const;

/** Every stage has a title and a paragraph; the rest is optional per stage. */
type StageView = {
  title: string;
  p: string;
  p2?: string;
  example?: string;
  parts?: readonly string[];
};

/** /resources/how-core-works — the written guide to EP08, one stage at a time. */
export default function HowCoreWorksGuide() {
  const c = useCopy(HOW_CORE_WORKS_GUIDE);
  return (
    <ResourceArticle
      id="howCoreWorks"
      links={[
        { to: '/how-core-works', label: c.links.full, data: 'how-core-works' },
        { to: RESOURCE_LINKS.demo, label: c.links.demo, data: 'demo' },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: { to: RESOURCE_LINKS.demo, label: c.cta.primary, data: 'demo' },
        secondary: { to: '/how-core-works', label: c.cta.secondary, data: 'how-core-works' },
      }}
    >
      <P className="mt-10">{c.intro}</P>
      <Figure caption={c.map.caption} wide>
        <Flow steps={c.map.steps} highlight={5} />
      </Figure>

      {ORDER.map((id, i) => {
        const s: StageView = c.stages[id];
        return (
          <Section key={id} id={id} n={i + 1} title={s.title}>
            <P>{s.p}</P>
            {s.parts && <List ordered items={s.parts} />}
            {s.p2 && (id === 'exception' ? <Callout tone="key">{s.p2}</Callout> : <P>{s.p2}</P>)}
            {s.example && <Example>{s.example}</Example>}
          </Section>
        );
      })}
    </ResourceArticle>
  );
}
