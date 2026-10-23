import { DeptCta } from '@/features/departments/ui';
import { OVERVIEW } from '@/features/departments/overview/copy';
import {
  AltitudeModel,
  ConnectedMap,
  DepartmentIndex,
  DepartmentStage,
  OverviewHero,
  WhyWorkspaces,
} from '@/features/departments/overview/OverviewSections';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /departments (EP06) — the department-centric philosophy, not a directory:
 * why roles need their own workspaces, a focused department stage, the six
 * workspaces, how they connect, and how each level of the organization sees
 * the same data. See docs/DEPARTMENT_EXPERIENCE.md.
 */
export default function DepartmentsPage() {
  const c = useCopy(OVERVIEW);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <OverviewHero />
      <WhyWorkspaces />
      <DepartmentStage />
      <DepartmentIndex />
      <ConnectedMap />
      <AltitudeModel />
      <DeptCta id="departments-cta" />
    </>
  );
}
