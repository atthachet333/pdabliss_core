import { useMemo, useState } from 'react';
import { ProblemChapter, EntersChapter, RoutingChapter, HandoffChapter } from '@/features/workflow/ChaptersStart';
import {
  ApprovalChapter,
  DecisionsChapter,
  ExceptionsChapter,
  HumanErrorChapter,
} from '@/features/workflow/ChaptersFlow';
import {
  AdaptChapter,
  HowCta,
  ReplayChapter,
  RolesChapter,
  TraceChapter,
} from '@/features/workflow/ChaptersView';
import { WORKFLOW } from '@/features/workflow/copy';
import { HowHero } from '@/features/workflow/HowHero';
import { DEFAULT_DECISIONS, type Decisions } from '@/features/workflow/model';
import { WorkflowContext, type WorkflowState } from '@/features/workflow/state';
import { useCopy } from '@/i18n/useCopy';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * /how-core-works (EP08): one illustrative piece of work travelling through
 * the company. Every chapter renders the same workflow model; the decisions
 * chosen at the forks are shared with the replay. Presentation only — no
 * workflow engine, state or persistence behind it.
 */
export default function HowCoreWorksPage() {
  const c = useCopy(WORKFLOW);
  usePageMeta(c.meta.title, c.meta.description);
  const [decisions, setDecisions] = useState<Decisions>(DEFAULT_DECISIONS);
  const value = useMemo<WorkflowState>(
    () => ({
      decisions,
      setDecision: (id, v) => setDecisions((d) => ({ ...d, [id]: v })),
      reset: () => setDecisions(DEFAULT_DECISIONS),
    }),
    [decisions],
  );
  return (
    <WorkflowContext.Provider value={value}>
      <HowHero />
      <ProblemChapter />
      <EntersChapter />
      <RoutingChapter />
      <HandoffChapter />
      <DecisionsChapter />
      <ApprovalChapter />
      <ExceptionsChapter />
      <HumanErrorChapter />
      <RolesChapter />
      <TraceChapter />
      <ReplayChapter />
      <AdaptChapter />
      <HowCta />
    </WorkflowContext.Provider>
  );
}
