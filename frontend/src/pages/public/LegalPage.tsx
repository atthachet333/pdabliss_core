import { PageHero } from '@/components/layout/PageHero';
import { Container } from '@/components/ui/Section';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { LEGAL_COPY, type LegalKind } from './legal.copy';


export default function LegalPage({ kind }: { kind: LegalKind }) {
  const c = useCopy(LEGAL_COPY);
  const title = c[kind];
  usePageMeta(title, c.lead(title));
  return (
    <>
      <PageHero eyebrow={kind === 'privacy' ? 'Privacy' : 'Terms'} title={title} lead={c.lead(title)} />
      <Container className="pb-24">
        <p className="max-w-2xl text-body text-text-secondary">{c.body}</p>
      </Container>
    </>
  );
}
