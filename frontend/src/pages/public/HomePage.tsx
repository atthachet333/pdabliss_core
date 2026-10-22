import { usePageMeta } from '@/lib/usePageMeta';
import { ConnectedWorkflowSection } from '@/features/landing/sections/ConnectedWorkflowSection';
import { DepartmentExperiencesSection } from '@/features/landing/sections/DepartmentExperiencesSection';
import { DifferenceSection } from '@/features/landing/sections/DifferenceSection';
import { ErrorPreventionSection } from '@/features/landing/sections/ErrorPreventionSection';
import { FinalCtaSection } from '@/features/landing/sections/FinalCtaSection';
import { HeroExperience } from '@/features/landing/sections/HeroExperience';
import {
  DepartmentsSlide,
  PresentationProgress,
  ProcessSlide,
} from '@/features/landing/sections/PresentationSlides';
import { PlansSection } from '@/features/landing/sections/PlansSection';
import { ProductPreviewSection } from '@/features/landing/sections/ProductPreviewSection';
import { ProductTransitionSection } from '@/features/landing/sections/ProductTransitionSection';
import { RoleWorkspaceSection } from '@/features/landing/sections/RoleWorkspaceSection';

export default function HomePage() {
  usePageMeta(null);

  return (
    <>
      <PresentationProgress />
      <HeroExperience />
      <DepartmentsSlide />
      <ProcessSlide />
      <ProductTransitionSection />
      <DifferenceSection />
      <DepartmentExperiencesSection />
      <RoleWorkspaceSection />
      <ConnectedWorkflowSection />
      <ErrorPreventionSection />
      <ProductPreviewSection />
      <PlansSection />
      <FinalCtaSection />
    </>
  );
}
