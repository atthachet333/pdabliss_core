import { describe, expect, it } from 'vitest';

/*
 * EP21 release-candidate guards: findings fixed in the public-frontend audit
 * (docs/EP21_RELEASE_AUDIT.md) that no other test would catch if they returned.
 */

const raw = (files: Record<string, unknown>) => files as Record<string, string>;
const COPY = raw(
  import.meta.glob(
    [
      '/src/features/**/*.ts',
      '/src/config/*.ts',
      '/src/pages/**/*.ts',
      '/src/i18n/messages/*.ts',
      '!**/*.test.ts',
    ],
    { query: '?raw', import: 'default', eager: true },
  ),
);
/** Every single-quoted string literal in a source file. */
const literals = (src: string) => [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]!);

describe('server-side enforcement is described as design, not as live behaviour', () => {
  // No backend enforces permissions yet (EP23+). Product pages may describe what
  // CORE is designed to do; the Security Center separates today from planned.
  const PRODUCT_COPY = [
    '/src/features/landing/safeguards.ts',
    '/src/config/departments.ts',
    '/src/features/departments/warehouse/copy.ts',
  ];
  const SERVER = /\bserver\b|เซิร์ฟเวอร์|服务器/i;
  const DESIGN = /design|ออกแบบ|设计/i;

  it('qualifies every server statement in product copy', () => {
    for (const file of PRODUCT_COPY) {
      expect(COPY[file], file).toBeDefined();
      for (const s of literals(COPY[file]!).filter((s) => SERVER.test(s)))
        if (s.length > 30) expect(s, file).toMatch(DESIGN);
    }
  });

  it('never claims server enforcement as a finished fact anywhere', () => {
    const banned = [
      /Server-enforced permissions/,
      /the server sends no price/i,
      /บังคับใช้สิทธิ์ที่เซิร์ฟเวอร์/,
      /ไม่มีข้อมูลราคาส่งมาจากเซิร์ฟเวอร์/,
      /服务器端权限控制/,
      /服务器不发送任何价格数据/,
    ];
    for (const [file, src] of Object.entries(COPY))
      for (const re of banned) expect(src, `${file} ${re}`).not.toMatch(re);
  });
});

describe('call-to-action wording', () => {
  it('uses one label per locale for the generic "talk to the team" action', () => {
    const variants = [/^ปรึกษาทีม PDA BLISS$/, /^พูดคุยกับทีม PDA BLISS$/, /^咨询 PDA BLISS 团队$/];
    for (const [file, src] of Object.entries(COPY))
      for (const s of literals(src)) for (const re of variants) expect(s, file).not.toMatch(re);
  });
});

describe('public folder', () => {
  it('ships no developer notes', () => {
    const notes = Object.keys(import.meta.glob('/public/**/*.md'));
    expect(notes).toEqual([]);
  });
});
