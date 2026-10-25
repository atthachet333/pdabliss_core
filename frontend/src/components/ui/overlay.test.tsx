import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';

/*
 * EP18.1: the shared overlay and disclosure language — current page and
 * language are explicit, and every disclosure shows its state.
 */

describe('header menus', () => {
  it('marks the page you are on inside its menu, and nothing else', async () => {
    renderRoute('/pricing');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('button', { name: 'ผลิตภัณฑ์' }));
    const panel = screen.getByRole('region', { name: 'เมนูผลิตภัณฑ์' });
    const current = panel.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/pricing');
  });

  it('marks a department chip as current on its page, keeping the locale', async () => {
    renderRoute('/en/departments/warehouse');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Product' }));
    const panel = screen.getByRole('region', { name: /Product/ });
    const chip = within(panel).getByRole('link', { name: 'Warehouse' });
    expect(chip).toHaveAttribute('href', '/en/departments/warehouse');
    expect(chip).toHaveAttribute('aria-current', 'page');
  });
});

describe('language selector', () => {
  it('opens a list where the current language is explicit', async () => {
    renderRoute('/zh/resources');
    const trigger = await screen.findByRole('button', { name: /^语言/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const current = screen.getByRole('link', { name: /简体中文/ });
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(current.querySelector('svg')).not.toBeNull(); // the check mark
    // The short code badge is decorative: names stay the language's own name.
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en/resources');
  });
});

describe('mobile menu', () => {
  it('marks the current section and page in the expanded group', async () => {
    renderRoute('/resources/human-error');
    await userEvent.click(await screen.findByRole('button', { name: 'เปิดเมนู' }));
    const dialog = screen.getByRole('dialog', { name: 'เมนู' });
    const group = within(dialog).getByRole('button', { name: /ความรู้/ });
    expect(group).toHaveAttribute('aria-current', 'true');
    await userEvent.click(group);
    expect(within(dialog).getByRole('link', { name: /^Human Error/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('disclosures', () => {
  it('shows the open state on the icon, not only in the text', async () => {
    renderRoute('/pricing');
    await screen.findByRole('heading', { level: 1 });
    const iconOf = (q: HTMLElement) => q.querySelector('[data-disclosure-icon]')!;
    // The first answer starts open; the second starts closed.
    const first = document.getElementById('faq-q-0')!;
    const second = document.getElementById('faq-q-1')!;
    expect(iconOf(first)).toHaveAttribute('data-disclosure-icon', 'open');
    expect(iconOf(second)).toHaveAttribute('data-disclosure-icon', 'closed');
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(iconOf(second)).toHaveAttribute('data-disclosure-icon', 'open');
    expect(iconOf(first)).toHaveAttribute('data-disclosure-icon', 'closed');
  });
});
