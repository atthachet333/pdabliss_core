import { startTransition, useEffect, useState } from 'react';
import { WebSiteSchema } from '@/components/seo/WebSiteSchema';
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

let firstVisit = true;

/**
 * EP20: on a fresh document load that opens at the top of the homepage, the
 * hero paints first and chapters 02–11 mount right after it, in a transition —
 * measured: mounting all eleven at once was a single ~0.9 s main-thread task
 * on a 4× throttled CPU before anything showed; split, the hero is ~0.26 s and
 * the chapters ~0.3 s. (Smaller batches measured worse: more total work.)
 * Reloads, back/forward, #chapter links and in-app navigation render the whole
 * page at once, so scroll restoration and anchors always find their target.
 */
function startsAtHeroOnly(): boolean {
  if (!firstVisit || window.location.hash || window.scrollY > 0) return false;
  const nav = performance.getEntriesByType?.('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return nav?.type === 'navigate';
}

function useChaptersReady(): boolean {
  const [ready, setReady] = useState(() => !startsAtHeroOnly());
  useEffect(() => {
    firstVisit = false;
    if (ready) return;
    // After the hero's first frame has been painted.
    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => startTransition(() => setReady(true)));
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [ready]);
  return ready;
}

/**
 * The homepage is one story in eleven chapters (see docs/HOMEPAGE_EXPERIENCE.md):
 * WOW → curiosity → trust → product understanding. Pricing lives on /pricing.
 */
export default function HomePage() {
  usePageMeta(null);
  const chapters = useChaptersReady();

  return (
    <>
      <WebSiteSchema />
      {/* Observes the chapters, so it mounts with them (same place in the tab order). */}
      {chapters && <ChapterProgress />}
      <HeroExperience />
      {chapters ? (
        <>
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
      ) : (
        // Below the fold while the chapters mount: keeps the footer out of view.
        <div aria-hidden className="min-h-dvh" />
      )}
    </>
  );
}
