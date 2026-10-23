import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MEGA_GROUPS, MEGA_ORDER } from '@/config/navigation';
import { renderRoute } from '@/test/render';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALES,
  localeFromPath,
  localizePath,
  resolveLocale,
  stripLocale,
  switchLocalePath,
} from './locales';
import { en } from './messages/en';
import { th } from './messages/th';
import { zhCN } from './messages/zh-CN';

const MESSAGES = { th, en, 'zh-CN': zhCN } as const;

describe('locale foundation', () => {
  it('supports Thai (default), English and Simplified Chinese', () => {
    expect(LOCALES).toEqual(['th', 'en', 'zh-CN']);
    expect(DEFAULT_LOCALE).toBe('th');
    expect(LOCALES.map((l) => LOCALE_META[l].nativeName)).toEqual([
      'ภาษาไทย',
      'English',
      '简体中文',
    ]);
  });

  it('falls back to Thai for anything unknown', () => {
    expect(resolveLocale(undefined)).toBe('th');
    expect(resolveLocale('')).toBe('th');
    expect(resolveLocale('fr')).toBe('th');
    expect(resolveLocale('zh-TW')).toBe('th'); // Traditional is not offered.
    expect(resolveLocale('EN-us')).toBe('en');
    expect(resolveLocale('zh-cn')).toBe('zh-CN');
    expect(resolveLocale('zh-Hans')).toBe('zh-CN');
  });

  it('maps paths between locales', () => {
    expect(localizePath('/', 'th')).toBe('/');
    expect(localizePath('/', 'en')).toBe('/en');
    expect(localizePath('/#why-core', 'zh-CN')).toBe('/zh#why-core');
    expect(localizePath('/departments#sales', 'en')).toBe('/en/departments#sales');
    expect(localizePath('/login', 'en')).toBe('/login');
    expect(localizePath('/app/warehouse', 'zh-CN')).toBe('/app/warehouse');
    expect(localizePath('https://line.me/x', 'en')).toBe('https://line.me/x');
    expect(localeFromPath('/en/about')).toBe('en');
    expect(localeFromPath('/zh')).toBe('zh-CN');
    expect(localeFromPath('/english')).toBe('th');
    expect(stripLocale('/zh/pricing')).toBe('/pricing');
    expect(stripLocale('/en')).toBe('/');
    expect(switchLocalePath('/en/departments', '#sales', 'th')).toBe('/departments#sales');
    expect(switchLocalePath('/', '', 'zh-CN')).toBe('/zh');
  });

  it('every navigation item has text in every locale', () => {
    for (const locale of LOCALES) {
      const t = MESSAGES[locale];
      for (const id of MEGA_ORDER) {
        const g = t.nav.groups[id];
        expect(g.label, `${locale}/${id}`).toBeTruthy();
        expect(g.heading).toBeTruthy();
        expect(g.highlight.statement).toBeTruthy();
        if (MEGA_GROUPS[id].cta) expect(g.highlight.cta, `${locale}/${id} cta`).toBeTruthy();
        for (const item of MEGA_GROUPS[id].items) {
          expect(g.items[item.id]?.label, `${locale}/${id}/${item.id}`).toBeTruthy();
          expect(g.items[item.id]?.description).toBeTruthy();
        }
      }
    }
  });

  it('keeps the Chinese dictionary in Simplified characters', () => {
    const text = JSON.stringify(MESSAGES['zh-CN'], (_k, v: unknown) =>
      typeof v === 'function' ? String(v) : v,
    );
    // Common Traditional-only forms that must never appear.
    expect(text).not.toMatch(/[這們體為與開關說門業務訊設隱權條聯絡網頁點擊選擇]/);
  });
});

describe('locale routes', () => {
  it('serves Thai at / by default', async () => {
    renderRoute('/');
    await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    expect(document.documentElement.lang).toBe('th');
  });

  it('serves the English shell at /en', async () => {
    renderRoute('/en/departments');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(
      within(nav)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Overview',
      'Departments',
      'Packages',
      'How it works',
      'Solutions',
      'Enterprise',
      'About',
      'Contact',
    ]);
    expect(within(nav).getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/en/contact',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    // Page bodies are localized too, so <main> inherits the page language.
    expect(document.getElementById('main')).not.toHaveAttribute('lang');
  });

  it('serves the Simplified Chinese shell at /zh', async () => {
    renderRoute('/zh');
    const nav = await screen.findByRole('navigation', { name: '主导航' });
    expect(within(nav).getByRole('link', { name: '概览' })).toHaveAttribute('href', '/zh');
    await waitFor(() => expect(document.documentElement.lang).toBe('zh-CN'));
  });

  it.each([
    ['/th/departments', '/departments'],
    ['/zh-CN/pricing', '/zh/pricing'],
    ['/en/login', '/login'],
  ])('redirects %s to %s', async (from, to) => {
    const { router } = renderRoute(from);
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
  });

  it('an unknown locale prefix falls back to the Thai not-found page', async () => {
    renderRoute('/fr/departments');
    await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    expect(document.documentElement.lang).toBe('th');
  });
});
