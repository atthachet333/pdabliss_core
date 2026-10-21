import { usePageMeta } from '@/lib/usePageMeta';
import { ConnectedWorkflowSection } from '@/features/landing/sections/ConnectedWorkflowSection';
import { DepartmentExperiencesSection } from '@/features/landing/sections/DepartmentExperiencesSection';
import { DifferenceSection } from '@/features/landing/sections/DifferenceSection';
import { ErrorPreventionSection } from '@/features/landing/sections/ErrorPreventionSection';
import { FinalCtaSection } from '@/features/landing/sections/FinalCtaSection';
import { HeroSection } from '@/features/landing/sections/HeroSection';
import { PlansSection } from '@/features/landing/sections/PlansSection';
import { ProductPreviewSection } from '@/features/landing/sections/ProductPreviewSection';
import { RoleWorkspaceSection } from '@/features/landing/sections/RoleWorkspaceSection';

export default function HomePage() {
  usePageMeta(null);
  return (
    <>
      <HeroSection />
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
