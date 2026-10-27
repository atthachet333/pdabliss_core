import { describe, expect, it } from 'vitest';
import { normalizePhone as serverNormalize } from '../../../../backend/src/auth/profile';
import { normalizePhone } from './profile';

/*
 * EP24.1: the registration form checks phone numbers with the same rule the
 * server enforces (backend/src/auth/profile.ts). If either side changes, this
 * fails — the form must never accept what the server refuses, or the reverse.
 */
const CASES = [
  '0812345678',
  '081-234-5678',
  '02 123 4567',
  '(081) 234.5678',
  '+66 81 234 5678',
  '+66812345678',
  '+1 415 555 0100',
  '0044 20 7946 0958',
  '12345',
  '081-234',
  'call me',
  '+66 0812345678',
  '+0123456789',
  '',
  '+6612345',
];

describe('phone rule parity (client ↔ server)', () => {
  it.each(CASES)('%s', (input) => {
    expect(normalizePhone(input)).toBe(serverNormalize(input));
  });
});
