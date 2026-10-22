import { usePageMeta } from '@/lib/usePageMeta';
import { ChapterProgress } from '@/features/landing/home/ChapterProgress';
import { ComplexityChapter } from '@/features/landing/home/ComplexityChapter';
import { ConnectedFlowChapter } from '@/features/landing/home/ConnectedFlowChapter';
import { DepartmentWorldsChapter } from '@/features/landing/home/DepartmentWorldsChapter';
import { EnterpriseChapter } from '@/features/landing/home/EnterpriseChapter';
import { ErrorControlChapter } from '@/features/landing/home/ErrorControlChapter';
import { ExecutiveChapter } from '@/features/landing/home/ExecutiveChapter';
import { FinalChapter } from '@/features/landing/home/FinalChapter';
import { TrustChapter } from '@/features/landing/home/TrustChapter';
import { WhoForChapter } from '@/features/landing/home/WhoForChapter';
import { WhyCoreChapter } from '@/features/landing/home/WhyCoreChapter';
import { HeroExperience } from '@/features/landing/sections/HeroExperience';

/**
 * The homepage is one story in eleven chapters (see docs/HOMEPAGE_EXPERIENCE.md):
 * WOW → curiosity → trust → product understanding. Pricing lives on /pricing.
 */
export default function HomePage() {
  usePageMeta(null);

  return (
    <>
      <ChapterProgress />
      <HeroExperience />
      <WhoForChapter />
      <ComplexityChapter />
      <WhyCoreChapter />
      <DepartmentWorldsChapter />
      <ConnectedFlowChapter />
      <ErrorControlChapter />
      <ExecutiveChapter />
      <EnterpriseChapter />
      <TrustChapter />
      <FinalChapter />
    </>
  );
}
