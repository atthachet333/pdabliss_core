import { describe, expect, it } from 'vitest';
import { WORKSPACE_ORDER, WORKSPACES } from './registry';

describe('workspace registry', () => {
  it('defines all seven workspaces', () => {
    expect(WORKSPACE_ORDER).toEqual([
      'executive',
      'sales',
      'warehouse',
      'purchasing',
      'operations',
      'accounting',
      'admin',
    ]);
  });

  it('starts every workspace with its overview and has unique module paths', () => {
    for (const id of WORKSPACE_ORDER) {
      const nav = WORKSPACES[id].nav;
      expect(nav[0]?.path).toBe('');
      expect(new Set(nav.map((n) => n.path)).size).toBe(nav.length);
    }
  });

  it('gives each department its own navigation rather than relabelled copies', () => {
    const signatures = WORKSPACE_ORDER.map((id) =>
      WORKSPACES[id].nav
        .slice(1)
        .filter((n) => n.path !== 'reports')
        .map((n) => n.path)
        .join('|'),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('keeps the warehouse navigation free of pricing or payment modules', () => {
    const labels = WORKSPACES.warehouse.nav.map((n) => `${n.path} ${n.label}`).join(' ');
    expect(labels).not.toMatch(/price|cost|payment|ราคา|ต้นทุน|จ่ายเงิน/i);
  });
});
