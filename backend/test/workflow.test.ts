import { describe, expect, it } from 'vitest';
import { purchaseRequestWorkflow as pr } from '../src/domain/purchasing/purchase-request.workflow.js';
import {
  applyTransition,
  availableActions,
  defineMachine,
} from '../src/domain/workflow/state-machine.js';
import { BusinessRuleError, ConflictError } from '../src/lib/errors.js';

const ctx = { lineCount: 2, requestedBy: 'u_warehouse', actorId: 'u_purchasing' };

describe('purchase request workflow', () => {
  it('moves through the happy path', () => {
    expect(applyTransition(pr, 'draft', 'submit', ctx).to).toBe('submitted');
    expect(applyTransition(pr, 'submitted', 'approve', ctx).to).toBe('approved');
    expect(applyTransition(pr, 'approved', 'convert_to_po', ctx).to).toBe('converted');
  });

  it('rejects invalid transitions with a 409 conflict', () => {
    expect(() => applyTransition(pr, 'draft', 'approve', ctx)).toThrow(ConflictError);
    expect(() => applyTransition(pr, 'converted', 'cancel', ctx)).toThrow(ConflictError);
  });

  it('requires a reason to reject', () => {
    expect(() => applyTransition(pr, 'submitted', 'reject', ctx)).toThrow(BusinessRuleError);
    expect(() => applyTransition(pr, 'submitted', 'reject', ctx, { reason: '   ' })).toThrow(
      BusinessRuleError,
    );
    const result = applyTransition(pr, 'submitted', 'reject', ctx, { reason: 'Over budget' });
    expect(result).toMatchObject({ to: 'rejected', reason: 'Over budget' });
  });

  it('prevents submitting an empty request', () => {
    expect(() => applyTransition(pr, 'draft', 'submit', { ...ctx, lineCount: 0 })).toThrow(
      /at least one line/,
    );
  });

  it('enforces segregation of duties on approval', () => {
    const self = { ...ctx, actorId: ctx.requestedBy };
    expect(() => applyTransition(pr, 'submitted', 'approve', self)).toThrow(BusinessRuleError);
    expect(availableActions(pr, 'submitted', self)).not.toContain('approve');
    expect(availableActions(pr, 'submitted', ctx)).toEqual(
      expect.arrayContaining(['approve', 'reject', 'cancel']),
    );
  });

  it('refuses machine definitions that reference unknown or terminal states', () => {
    expect(() =>
      defineMachine({
        name: 'broken',
        initial: 'a',
        states: ['a', 'b'],
        terminal: ['b'],
        transitions: [{ action: 'reopen', from: ['b'], to: 'a' }],
      }),
    ).toThrow(/terminal/);
  });
});
