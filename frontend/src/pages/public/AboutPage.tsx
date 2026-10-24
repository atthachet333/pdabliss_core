import { ApproachChapter } from '@/features/about/Method';
import { BeliefChapter, CompanyChapter, ProblemChapter, SystemsChapter } from '@/features/about/Belief';
import { ABOUT } from '@/features/about/copy';
import { AboutHero } from '@/features/about/Hero';
import {
  CompanyInfoChapter,
  ConsultingChapter,
  ImplementationChapter,
  LongTermChapter,
  TalkChapter,
} from '@/features/about/Work';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /about (EP12): who PDA BLISS is and how it works — belief, the operational
 * problem, process before features, consulting, product (not custom code) and
 * the company's real contact details. Nothing here is a metric or a claim.
 */
export default function AboutPage() {
  const c = useCopy(ABOUT);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <AboutHero />
      <CompanyChapter />
      <BeliefChapter />
      <ProblemChapter />
      <SystemsChapter />
      <ApproachChapter />
      <ConsultingChapter />
      <ImplementationChapter />
      <LongTermChapter />
      <CompanyInfoChapter />
      <TalkChapter />
    </>
  );
}
