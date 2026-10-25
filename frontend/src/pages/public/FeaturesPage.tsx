import { Boxes, FileStack, GitBranch, Layers, LayoutDashboard, Lock } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { Container, SectionHeader } from '@/components/ui/Section';
import { useSafeguards } from '@/features/landing/safeguards';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';
import { motion } from 'framer-motion';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { reveal } from '@/motion/tokens';
import { FEATURES_COPY } from './features.copy';

const ICONS = [LayoutDashboard, GitBranch, Boxes, FileStack, Lock, Layers];


export default function FeaturesPage() {
  const c = useCopy(FEATURES_COPY);
  const safeguards = useSafeguards();
  usePageMeta(c.metaTitle, c.metaDescription);
  return (
    <>
      <PageHero eyebrow="Features" title={c.title} lead={c.lead} />
      {/* EP18: an editorial index — numbered rows on hairlines, not a wall of icon cards. */}
      <Container className="pb-8">
        <Reveal stagger>
          <ol data-feature-index className="border-t border-border-soft">
            {c.groups.map(({ title, items }, gi) => {
              const Icon = ICONS[gi]!;
              return (
                <motion.li key={gi} variants={reveal} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-border-soft py-7 md:grid-cols-[3rem_minmax(0,0.9fr)_minmax(0,1.4fr)] md:gap-x-10">
                    <span className="pt-1 font-mono text-caption text-text-muted tabular">
                      {String(gi + 1).padStart(2, '0')}
                    </span>
                    <h2 className="flex items-center gap-3 text-h3 text-text-primary">
                      <Icon className="size-5 shrink-0 text-brand-soft" aria-hidden />
                      {title}
                    </h2>
                    <ul className="col-start-2 mt-3 grid gap-x-8 gap-y-1.5 text-label text-text-secondary sm:grid-cols-2 md:col-start-3 md:mt-1">
                      {items.map((i) => (
                        <li key={i} className="flex gap-2.5">
                          <span aria-hidden className="mt-[0.7rem] h-px w-3 shrink-0 bg-brand-glow/50" />
                          {i}
                        </li>
                      ))}
                    </ul>
                  </motion.li>
              );
            })}
          </ol>
        </Reveal>
      </Container>
      <Container className="py-20">
        <SectionHeader eyebrow="Safeguards" title={c.safeguards} />
        <Reveal stagger className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {safeguards.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title} className="border-t border-border-soft pt-5">
              <Icon className="size-5 text-brand-soft" aria-hidden />
              <h3 className="mt-3 text-label font-semibold text-text-primary">{title}</h3>
              <p className="mt-1.5 text-label text-text-secondary">{body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </Container>
    </>
  );
}
