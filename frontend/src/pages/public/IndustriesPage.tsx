import { INDUSTRIES_SUMMARY } from '@/features/industries/copy/summary';
import {
  AtlasChapter,
  FitChapter,
  IndustriesCta,
  PrinciplesChapter,
  SelectorChapter,
} from '@/features/industries/overview/Explore';
import { DifferChapter, IndustriesHero } from '@/features/industries/overview/HeroDiffer';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /industries (EP11): the same CORE principles, adapted to six operating
 * environments. Illustrative only — no industry templates or engines.
 */
export default function IndustriesPage() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <>
      <IndustriesHero />
      <DifferChapter />
      <SelectorChapter />
      <AtlasChapter />
      <PrinciplesChapter />
      <FitChapter />
      <IndustriesCta />
    </>
  );
}
