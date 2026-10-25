import { RESOURCES_COPY } from '@/features/resources/copy';
import {
  DepartmentsChapter,
  ProblemsChapter,
  StagesChapter,
  StartHere,
} from '@/features/resources/home/Guided';
import { ResourcesHero } from '@/features/resources/home/Hero';
import {
  GlossaryTeaser,
  LibraryChapter,
  ResourcesCta,
  SecurityAndImplementation,
} from '@/features/resources/home/Library';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /resources (EP16): the CORE Knowledge Library — not a blog. Search first,
 * then guided entries (start, problem, department, stage), the library index
 * and the deeper areas. Guides themselves load as separate route chunks.
 */
export default function ResourcesPage() {
  const c = useCopy(RESOURCES_COPY);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <ResourcesHero />
      <StartHere />
      <ProblemsChapter />
      <DepartmentsChapter />
      <StagesChapter />
      <LibraryChapter />
      <GlossaryTeaser />
      <SecurityAndImplementation />
      <ResourcesCta />
    </>
  );
}
