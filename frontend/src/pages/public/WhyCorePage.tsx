import { WHY_CORE } from '@/features/why-core/copy';
import { OriginChapter, WhyCoreHero } from '@/features/why-core/Hero';
import {
  ConnectedChapter,
  DepartmentsChapter,
  ExecutiveChapter,
  HumanErrorChapter,
  NextActionChapter,
  SeeChapter,
  ShiftChapter,
} from '@/features/why-core/Principles';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /why-core (EP12): why this specific product exists — work gets stuck
 * between departments as organizations grow, so CORE gives each department
 * its own workspace on one shared work state. /about covers the company.
 */
export default function WhyCorePage() {
  const c = useCopy(WHY_CORE);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <WhyCoreHero />
      <OriginChapter />
      <ShiftChapter />
      <DepartmentsChapter />
      <ConnectedChapter />
      <HumanErrorChapter />
      <ExecutiveChapter />
      <NextActionChapter />
      <SeeChapter />
    </>
  );
}
