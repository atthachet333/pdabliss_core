import { OrganizationSchema } from '@/components/seo/OrganizationSchema';
import { ApproachChapter } from '@/features/about/Method';
import { BeliefChapter, CompanyChapter, ProblemChapter, SystemsChapter } from '@/features/about/Belief';
import { ABOUT } from '@/features/about/copy';
import { AboutHero } from '@/features/about/Hero';
import { ChapterRail } from '@/features/about/Rail';
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
 * EP13: four signature scenes (hero, design table, defense rings, work
 * table) whose motion is state transformation, never decoration.
 */
export default function AboutPage() {
  const c = useCopy(ABOUT);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <OrganizationSchema />
      <ChapterRail />
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
