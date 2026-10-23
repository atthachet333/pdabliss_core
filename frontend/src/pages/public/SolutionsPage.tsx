import { SOLUTIONS_COPY } from '@/features/solutions/copy';
import { ProblemMap, SolutionsHero } from '@/features/solutions/HeroAndMap';
import { SolutionNavigator, SolutionsCta } from '@/features/solutions/Navigator';
import {
  ApprovalStory,
  FallingThroughStory,
  HumanErrorStory,
  StatusChasingStory,
} from '@/features/solutions/StoriesA';
import {
  CrossDepartmentStory,
  ManagementStory,
  PaymentStory,
  StockStory,
  SupplierStory,
} from '@/features/solutions/StoriesB';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /solutions (EP09): organizational problems first — where they live between
 * departments, what they cost, and how CORE makes the work visible, connected
 * and controlled. Presentation only; qualitative claims only.
 */
export default function SolutionsPage() {
  const c = useCopy(SOLUTIONS_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <SolutionsHero />
      <ProblemMap />
      <FallingThroughStory />
      <StatusChasingStory />
      <HumanErrorStory />
      <ApprovalStory />
      <StockStory />
      <SupplierStory />
      <PaymentStory />
      <ManagementStory />
      <CrossDepartmentStory />
      <SolutionNavigator />
      <SolutionsCta />
    </>
  );
}
