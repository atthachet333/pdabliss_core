import {
  ConsultChapter,
  ControlChapter,
  DataChapter,
  EnforcementChapter,
  FaqChapter,
  ReadinessChapter,
  RolesChapter,
  TraceChapter,
} from '@/features/security/Chapters';
import { SECURITY_COPY } from '@/features/security/copy';
import { SecurityHero, VisibilityChapter, WarehouseChapter } from '@/features/security/Visibility';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /security (EP15): the public Trust Center. Access, responsibility and
 * boundaries as product philosophy, with honest EP10 statuses. It describes
 * principles and readiness — never certifications, uptime or infrastructure.
 */
export default function SecurityPage() {
  const c = useCopy(SECURITY_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <SecurityHero />
      <VisibilityChapter />
      <WarehouseChapter />
      <RolesChapter />
      <EnforcementChapter />
      <TraceChapter />
      <ControlChapter />
      <DataChapter />
      <ReadinessChapter />
      <FaqChapter />
      <ConsultChapter />
    </>
  );
}
