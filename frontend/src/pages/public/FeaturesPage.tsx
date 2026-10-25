import { Boxes, FileStack, GitBranch, Layers, LayoutDashboard, Lock } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container, SectionHeader } from '@/components/ui/Section';
import { useSafeguards } from '@/features/landing/safeguards';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { FEATURES_COPY } from './features.copy';

const ICONS = [LayoutDashboard, GitBranch, Boxes, FileStack, Lock, Layers];


export default function FeaturesPage() {
  const c = useCopy(FEATURES_COPY);
  const safeguards = useSafeguards();
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="Features" title={c.title} lead={c.lead} />
      <Container className="pb-12">
        <Reveal stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.groups.map(({ title, items }, gi) => {
            const Icon = ICONS[gi]!;
            return (
              <RevealItem
                key={gi}
                className="rounded-card border border-border-soft bg-surface-base/80 p-6"
              >
                <Icon className="size-6 text-brand-glow" aria-hidden />
                <h2 className="mt-4 text-h3 text-text-primary">{title}</h2>
                <ul className="mt-3 space-y-1.5 text-label text-text-secondary">
                  {items.map((i) => (
                    <li key={i}>• {i}</li>
                  ))}
                </ul>
              </RevealItem>
            );
          })}
        </Reveal>
      </Container>
      <Container className="py-20">
        <SectionHeader eyebrow="Safeguards" title={c.safeguards} />
        <Reveal stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {safeguards.map(({ icon: Icon, title, body }) => (
            <RevealItem
              key={title}
              className="rounded-2xl border border-border-soft bg-surface-raised/40 p-5"
            >
              <Icon className="size-5 text-brand-glow" aria-hidden />
              <h3 className="mt-3 text-label font-semibold text-text-primary">{title}</h3>
              <p className="mt-1.5 text-label text-text-secondary">{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </>
  );
}
