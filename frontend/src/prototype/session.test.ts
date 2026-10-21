import { afterEach, describe, expect, it } from 'vitest';
import { PROTOTYPE_SESSION_KEY } from './config';
import {
  getPrototypeSession,
  lastWorkspace,
  prototypeSignIn,
  prototypeSignOut,
  rememberWorkspace,
} from './session';

describe('prototype demo session', () => {
  afterEach(() => {
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it('accepts only the demo reviewer account', () => {
    expect(prototypeSignIn('user1', 'wrong')).toBe(false);
    expect(prototypeSignIn('USER1', 'pass1')).toBe(false);
    expect(prototypeSignIn('admin', 'pass1')).toBe(false);
    expect(getPrototypeSession()).toBeNull();
    expect(prototypeSignIn(' user1 ', 'pass1')).toBe(true);
    expect(getPrototypeSession()).toEqual({ username: 'user1' });
  });

  it('stores only a flag in sessionStorage — never the password', () => {
    prototypeSignIn('user1', 'pass1');
    const stored = Object.keys(window.sessionStorage).map((k) => window.sessionStorage.getItem(k));
    expect(window.sessionStorage.getItem(PROTOTYPE_SESSION_KEY)).toBe('user1');
    expect(stored.join(' ')).not.toContain('pass1');
  });

  it('signs out', () => {
    prototypeSignIn('user1', 'pass1');
    prototypeSignOut();
    expect(getPrototypeSession()).toBeNull();
  });

  it('remembers the last valid workspace and falls back to executive', () => {
    expect(lastWorkspace()).toBe('executive');
    rememberWorkspace('purchasing');
    expect(lastWorkspace()).toBe('purchasing');
    window.sessionStorage.setItem('pbc.prototype.lastWorkspace', 'not-a-workspace');
    expect(lastWorkspace()).toBe('executive');
  });
});
