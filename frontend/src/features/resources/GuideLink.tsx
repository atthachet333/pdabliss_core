import { QuietLink } from '@/features/story/parts';
import { useCopy, type Localized } from '@/i18n/useCopy';
import { RESOURCE_META } from './meta';
import { resourcePath, type ResourceId } from './registry';

const READ: Localized<string> = { th: 'อ่านคู่มือ', en: 'Read the guide', 'zh-CN': '阅读指南' };

/**
 * EP17: a quiet contextual link from a product page into the Resource Center
 * guide that explains the same idea — titles come from the registry, so the
 * link never drifts from the guide it names. Locale is kept by QuietLink.
 */
export function GuideLink({ id, className }: { id: ResourceId; className?: string }) {
  const read = useCopy(READ);
  const title = useCopy(RESOURCE_META).resources[id].title;
  return (
    <QuietLink to={resourcePath(id)} data={`guide-${id}`} className={className}>
      {read}: {title}
    </QuietLink>
  );
}
