import { afterEach, describe, expect, it } from 'vitest';
import * as config from './config';
import { lastWorkspace, rememberWorkspace } from './session';

describe('prototype workspace review (EP23: no prototype credential)', () => {
  afterEach(() => window.sessionStorage.clear());

  it('has no demo account or browser-only session any more', () => {
    expect(Object.keys(config).sort()).toEqual([
      'PROTOTYPE_ENABLED',
      'PROTOTYPE_LAST_WORKSPACE_KEY',
    ]);
  });

  it('remembers the last valid workspace and falls back to executive', () => {
    expect(lastWorkspace()).toBe('executive');
    rememberWorkspace('purchasing');
    expect(lastWorkspace()).toBe('purchasing');
    window.sessionStorage.setItem('pbc.prototype.lastWorkspace', 'not-a-workspace');
    expect(lastWorkspace()).toBe('executive');
  });
});
