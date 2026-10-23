import { createContext, useContext } from 'react';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { WORKFLOW } from './copy';
import type { DecisionId, Decisions, Lane } from './model';

/** The decisions chosen at the forks — shared by the decision chapter and the replay. */
export interface WorkflowState {
  decisions: Decisions;
  setDecision: (id: DecisionId, value: boolean) => void;
  reset: () => void;
}

export const WorkflowContext = createContext<WorkflowState | null>(null);

export function useWorkflow(): WorkflowState {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error('useWorkflow must be used inside the how-core-works page');
  return value;
}

/** Localized lane names: department names from the shared config, plus the supplier. */
export function useLaneName() {
  const departments = useDepartments();
  const c = useCopy(WORKFLOW).common;
  return (lane: Lane) =>
    lane === 'supplier' ? c.supplier : departments.find((d) => d.id === lane)!.name;
}

/** Lane accent colour (decorative; never the only signal). */
export const laneColor = (lane: Lane) =>
  lane === 'supplier' ? 'var(--color-text-muted)' : `var(--color-ws-${lane})`;
