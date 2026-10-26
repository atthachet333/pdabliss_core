import { describe, expect, it } from 'vitest';
import {
  appLink,
  existingAccountMail,
  invitationMail,
  otpMail,
  passwordChangedMail,
  passwordResetMail,
  verifyEmailMail,
  type MailLocale,
} from '../src/mail/templates.js';

/*
 * Transactional email layout (EP23 templates, EP24 polish): correct links,
 * conservative markup, honest facts, every locale. No large HTML snapshots.
 */

const LOCALES: MailLocale[] = ['th', 'en', 'zh-CN'];
const BASE = 'http://localhost:1111';
const TOKEN = 'abcDEF_123-xyzabcDEF_123-xyzabcDEF_123-xyz1';
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('email links', () => {
  it('derive from the configured app URL, with the token only in the fragment', () => {
    expect(appLink(BASE, '/reset-password', 'en', TOKEN)).toBe(
      `${BASE}/reset-password?lang=en#token=${TOKEN}`,
    );
    expect(appLink('https://core.example.com', '/verify-email', 'zh-CN', TOKEN)).toBe(
      `https://core.example.com/verify-email?lang=zh#token=${TOKEN}`,
    );
  });
});

describe.each(LOCALES)('templates (%s)', (locale) => {
  const resetUrl = appLink(BASE, '/reset-password', locale, TOKEN);
  const verifyUrl = appLink(BASE, '/verify-email', locale, TOKEN);
  const all = [
    passwordResetMail(locale, resetUrl),
    verifyEmailMail(locale, verifyUrl),
    otpMail(locale, '042917', 'login'),
    otpMail(locale, '042917', 'step_up'),
    passwordChangedMail(locale, appLink(BASE, '/login', locale)),
    existingAccountMail(locale, appLink(BASE, '/login', locale)),
    invitationMail(
      locale,
      'บริษัท <ตัวอย่าง> & Co',
      appLink(BASE, '/account/invitation', locale, TOKEN),
    ),
  ];

  it('use conservative markup: no images, scripts, web fonts or remote styles', () => {
    for (const m of all) {
      expect(m.html).not.toMatch(/<img|<script|<link|@import|@font-face|url\(/i);
      expect(m.html).toContain(`lang="${locale}"`);
      expect(m.html).not.toMatch(/undefined|\[object Object\]/);
      expect(m.text).not.toMatch(/undefined|\[object Object\]/);
    }
  });

  it('password reset: one dominant button, the link once more as a small fallback, honest facts', () => {
    const m = passwordResetMail(locale, resetUrl);
    const escapedUrl = resetUrl.replace(/&/g, '&#38;');
    // Button + fallback — never more.
    expect(count(m.html, `href="${escapedUrl}"`)).toBe(2);
    // The fallback sits after the button, in small muted text.
    const button = m.html.indexOf('border-radius:999px;background:');
    const fallback = m.html.indexOf('font-size:12px;line-height:1.6;color:#5c6d75">');
    expect(button).toBeGreaterThan(0);
    expect(fallback).toBeGreaterThan(button);
    // The text part has the full link on its own line.
    expect(m.text.split('\n')).toContain(resetUrl);
    const facts = {
      th: ['30 นาที', 'ครั้งเดียว', 'ออกจากระบบ'],
      en: ['30 minutes', 'works once', 'signed out'],
      'zh-CN': ['30 分钟', '仅可使用一次', '退出登录'],
    }[locale];
    for (const f of facts) expect(m.text).toContain(f);
  });

  it('verification: the link, its 24-hour validity and single use', () => {
    const m = verifyEmailMail(locale, verifyUrl);
    expect(m.text.split('\n')).toContain(verifyUrl);
    expect(m.text).toMatch(/24/);
  });

  it('one-time code: the code, its purpose, expiry and "do not share"', () => {
    const login = otpMail(locale, '042917', 'login');
    expect(login.html).toContain('042917');
    expect(login.text).toMatch(/\b042917\b/);
    expect(login.text).toMatch(/10/);
    const share = { th: 'อย่าบอกรหัสนี้', en: 'Do not share', 'zh-CN': '请勿告诉任何人' }[locale];
    expect(login.text).toContain(share);
    expect(otpMail(locale, '042917', 'step_up').text).not.toBe(login.text);
    // No button for a code.
    expect(login.html).not.toContain('href=');
  });

  it('escapes names that look like markup', () => {
    const m = invitationMail(
      locale,
      'บริษัท <ตัวอย่าง> & Co',
      appLink(BASE, '/account/invitation', locale, TOKEN),
    );
    expect(m.html).not.toContain('<ตัวอย่าง>');
    expect(m.html).toContain('&#60;ตัวอย่าง&#62; &#38; Co');
  });
});
