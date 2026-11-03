import { describe, expect, it } from 'vitest';
import { isEmail } from './email';

// The pattern zod v4 used for `.email()` before EP33 dropped zod from the browser bundle.
describe('isEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const v of [
      'a@b.co',
      'first.last@pdabliss.com',
      "o'neil+tag@mail.example.org",
      'x_y-z@sub.domain.th',
    ]) {
      expect(isEmail(v), v).toBe(true);
    }
  });
  it('refuses malformed ones', () => {
    for (const v of [
      '',
      'plain',
      '@b.co',
      'a@',
      'a@b',
      'a@b.c',
      '.a@b.co',
      'a..b@c.co',
      'a.@b.co',
      'a@-b.co',
      'a b@c.co',
      'ก@ข.คอม',
    ]) {
      expect(isEmail(v), v).toBe(false);
    }
  });
});
