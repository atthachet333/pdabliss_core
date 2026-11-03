import { describe, expect, it } from 'vitest';
import { WORKSPACE_IDENTITY } from './identity';
import { WORKSPACES, type WorkspaceId } from './registry';

describe('workspace identity (public previews)', () => {
  it('matches the prototype registry for every workspace', () => {
    for (const [id, w] of Object.entries(WORKSPACES) as [
      WorkspaceId,
      (typeof WORKSPACES)[WorkspaceId],
    ][]) {
      const i = WORKSPACE_IDENTITY[id];
      expect(i.accent, id).toBe(w.accent);
      expect(i.icon, id).toBe(w.icon);
      expect(i.shortTh, id).toBe(w.shortTh);
      expect(
        i.nav.map((n) => [n.path, n.label, n.icon]),
        id,
      ).toEqual(w.nav.slice(0, 7).map((n) => [n.path, n.label, n.icon]));
    }
    expect(Object.keys(WORKSPACE_IDENTITY).sort()).toEqual(Object.keys(WORKSPACES).sort());
  });
});
