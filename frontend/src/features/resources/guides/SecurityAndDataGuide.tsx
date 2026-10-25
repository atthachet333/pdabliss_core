import { QuietLink } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { Callout, Figure, Flow, List, P, ResourceArticle, Section } from '../article/Article';
import { RESOURCE_LINKS } from '../registry';
import { SECURITY_AND_DATA_GUIDE } from './securityAndData.copy';

/** /resources/security-and-data — the plain-language summary of /security. */
export default function SecurityAndDataGuide() {
  const c = useCopy(SECURITY_AND_DATA_GUIDE);
  return (
    <ResourceArticle
      id="securityAndData"
      links={[
        { to: RESOURCE_LINKS.security, label: c.links.center, data: 'security' },
        { to: RESOURCE_LINKS.enterprise, label: c.links.enterprise, data: 'enterprise' },
      ]}
      cta={{
        title: c.cta.title,
        body: c.cta.body,
        primary: {
          to: RESOURCE_LINKS.implementation,
          label: c.cta.primary,
          data: 'implementation',
        },
        secondary: { to: RESOURCE_LINKS.security, label: c.cta.secondary, data: 'security' },
      }}
    >
      <P className="mt-10">{c.intro}</P>
      <QuietLink to={RESOURCE_LINKS.security} data="security-center" className="mt-3">
        {c.center}
      </QuietLink>

      <Section id="boundaries" n={1} title={c.boundaries.title}>
        <P>{c.boundaries.p1}</P>
        <P>{c.boundaries.p2}</P>
        <Callout tone="key">{c.boundaries.key}</Callout>
      </Section>

      <Section id="enforcement" n={2} title={c.enforcement.title}>
        <P>{c.enforcement.p1}</P>
        <P>{c.enforcement.p2}</P>
        <Figure caption={c.enforcement.caption}>
          <Flow steps={c.enforcement.flow} />
        </Figure>
        <Callout tone="boundary">{c.enforcement.now}</Callout>
      </Section>

      <Section id="trace" n={3} title={c.trace.title}>
        <P>{c.trace.p}</P>
        <List items={c.trace.items} />
        <P>{c.trace.p2}</P>
      </Section>

      <Section id="readiness" n={4} title={c.readiness.title}>
        <P>{c.readiness.p}</P>
        <List items={c.readiness.items} />
      </Section>

      <Section id="claims" n={5} title={c.claims.title}>
        <P>{c.claims.p}</P>
        <List items={c.claims.items} />
        <Callout>{c.claims.close}</Callout>
      </Section>

      <Section id="ask" n={6} title={c.ask.title}>
        <P>{c.ask.p}</P>
        <List ordered items={c.ask.items} />
      </Section>
    </ResourceArticle>
  );
}
