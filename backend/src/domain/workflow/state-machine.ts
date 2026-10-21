import { BusinessRuleError, ConflictError } from '../../lib/errors.js';

/**
 * Generic, per-document workflow state machine.
 *
 * Each document type (Purchase Request, Purchase Order, Goods Receipt,
 * Sales Order, Work Order, …) declares its OWN states and transitions.
 * There is deliberately no universal status enum shared by all documents.
 */

export type GuardResult = { ok: true } | { ok: false; code: string; message: string };

export interface TransitionDefinition<S extends string, A extends string, C> {
  readonly action: A;
  readonly from: readonly S[];
  readonly to: S;
  /** Reject reasons, cancellation reasons, etc. are captured for the audit trail. */
  readonly requiresReason?: boolean;
  /** Business rule evaluated before the transition is allowed. */
  readonly guard?: (context: C) => GuardResult;
}

export interface MachineDefinition<S extends string, A extends string, C> {
  readonly name: string;
  readonly initial: S;
  readonly states: readonly S[];
  readonly terminal: readonly S[];
  readonly transitions: readonly TransitionDefinition<S, A, C>[];
}

export interface TransitionResult<S extends string, A extends string> {
  readonly machine: string;
  readonly action: A;
  readonly from: S;
  readonly to: S;
  readonly reason?: string;
}

export function defineMachine<S extends string, A extends string, C>(
  definition: MachineDefinition<S, A, C>,
): MachineDefinition<S, A, C> {
  const known = new Set<string>(definition.states);
  for (const state of [definition.initial, ...definition.terminal]) {
    if (!known.has(state)) throw new Error(`${definition.name}: unknown state "${state}"`);
  }
  for (const t of definition.transitions) {
    for (const state of [...t.from, t.to]) {
      if (!known.has(state)) {
        throw new Error(
          `${definition.name}: transition "${t.action}" uses unknown state "${state}"`,
        );
      }
    }
    const fromTerminal = t.from.find((s) => definition.terminal.includes(s));
    if (fromTerminal) {
      throw new Error(
        `${definition.name}: transition "${t.action}" leaves terminal "${fromTerminal}"`,
      );
    }
  }
  return definition;
}

/** Actions currently permitted by the state machine and its guards. */
export function availableActions<S extends string, A extends string, C>(
  machine: MachineDefinition<S, A, C>,
  current: S,
  context: C,
): A[] {
  return machine.transitions
    .filter((t) => t.from.includes(current) && (t.guard?.(context).ok ?? true))
    .map((t) => t.action);
}

/**
 * Validates and resolves a transition. Pure: it does not persist anything —
 * the caller records the resulting WorkflowEvent and AuditLog entry.
 */
export function applyTransition<S extends string, A extends string, C>(
  machine: MachineDefinition<S, A, C>,
  current: S,
  action: A,
  context: C,
  options: { reason?: string } = {},
): TransitionResult<S, A> {
  const transition = machine.transitions.find(
    (t) => t.action === action && t.from.includes(current),
  );
  if (!transition) {
    throw new ConflictError(
      'INVALID_TRANSITION',
      `${machine.name}: action "${action}" is not allowed from state "${current}"`,
      { machine: machine.name, from: current, action },
    );
  }

  const reason = options.reason?.trim();
  if (transition.requiresReason && !reason) {
    throw new BusinessRuleError(
      'REASON_REQUIRED',
      `${machine.name}: action "${action}" requires a reason`,
      { machine: machine.name, action },
    );
  }

  const verdict = transition.guard?.(context) ?? { ok: true };
  if (!verdict.ok) {
    throw new BusinessRuleError(verdict.code, verdict.message, { machine: machine.name, action });
  }

  return {
    machine: machine.name,
    action,
    from: current,
    to: transition.to,
    ...(reason ? { reason } : {}),
  };
}
