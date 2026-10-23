import { BranchesChapter, IntegrationChapter, WorkflowChapter } from '@/features/enterprise/Adapt';
import { AuditChapter, ControlChapter, ExecutiveChapter } from '@/features/enterprise/Control';
import { ENTERPRISE } from '@/features/enterprise/copy';
import { EnterpriseHero } from '@/features/enterprise/Hero';
import {
  ConsultChapter,
  ImplementationChapter,
  ReadinessChapter,
  SupportChapter,
} from '@/features/enterprise/Partnership';
import {
  AccessChapter,
  ComplexityChapter,
  OrganizationChapter,
} from '@/features/enterprise/Structure';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /enterprise (EP10): the same CORE philosophy with stronger organizational
 * controls, adaptation and implementation support. Presentation only — every
 * capability carries an honest status; nothing here is a certification.
 */
export default function EnterprisePage() {
  const c = useCopy(ENTERPRISE);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <EnterpriseHero />
      <ComplexityChapter />
      <OrganizationChapter />
      <AccessChapter />
      <ControlChapter />
      <AuditChapter />
      <ExecutiveChapter />
      <WorkflowChapter />
      <IntegrationChapter />
      <BranchesChapter />
      <ImplementationChapter />
      <SupportChapter />
      <ReadinessChapter />
      <ConsultChapter />
    </>
  );
}
