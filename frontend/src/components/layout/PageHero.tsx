import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Section';
import { DURATION, EASE_CORE } from '@/motion/tokens';

/** Hero band for inner public pages: a quieter echo of the CORE rings. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden pt-36 pb-16 sm:pt-44 sm:pb-20">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_85%_0%,rgb(25_195_154/0.16),transparent_70%)]" />
        <div className="absolute top-[-14rem] right-[-10rem] size-[36rem] rounded-full border border-brand-glow/10" />
        <div className="absolute top-[-8rem] right-[-4rem] size-[24rem] rounded-full border border-brand-glow/15" />
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-70" />
      </div>
      <Container>
        <motion.div
          className="max-w-3xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.reveal, ease: EASE_CORE }}
        >
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-h1 text-text-primary">{title}</h1>
          {lead && <p className="mt-6 text-body-lg text-text-secondary">{lead}</p>}
          {children}
        </motion.div>
      </Container>
    </section>
  );
}
