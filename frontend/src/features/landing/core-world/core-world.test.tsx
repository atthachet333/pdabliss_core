import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ORBIT_DEPARTMENTS } from '@/config/departments';
import { renderRoute } from '@/test/render';

/*
 * EP05 revision: the CORE World shows each orbiting department as an image
 * "world card", and the detail opened from the selector shows the
 * department's scene. jsdom has no WebGL, so this exercises the static
 * fallback, which uses the same layout and the same cards as the 3D scene.
 */

const original = window.matchMedia;

beforeEach(() => {
  // Wide screen: world cards are shown from 640px.
  window.matchMedia = ((query: string) => ({
    ...original(query),
    matches: query.includes('min-width'),
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original;
});

describe('CORE World department imagery', () => {
  it('anchors an image card for each of the six departments', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    const cards = document.querySelectorAll<HTMLElement>('[data-world-card]');
    expect([...cards].map((c) => c.dataset.worldCard)).toEqual([...ORBIT_DEPARTMENTS]);
    for (const card of cards) {
      const id = card.dataset.worldCard!;
      // Decorative image + readable text label; hidden from AT (the selector is the control).
      expect(card).toHaveAttribute('aria-hidden', 'true');
      expect(card.querySelector('img')).toHaveAttribute('src', `/departments/${id}-sm.webp`);
      expect(card.querySelector('img')).toHaveAttribute('alt', '');
      expect(card.firstElementChild).toHaveClass(
        'transition-[scale,border-color,box-shadow,opacity,filter]',
      );
    }
    expect(cards[0]).toHaveTextContent('ฝ่ายขาย');
    expect(cards[0]).toHaveTextContent('Sales');
  });

  it('localizes the card labels with the page', async () => {
    renderRoute('/zh');
    await screen.findByRole('heading', { level: 1 });
    const warehouse = document.querySelector('[data-world-card="warehouse"]')!;
    expect(warehouse).toHaveTextContent('仓库');
    renderRoute('/en');
    await waitFor(() =>
      expect(document.querySelectorAll('[data-world-card="sales"]')[1]).toHaveTextContent('Sales'),
    );
  });

  it('selecting a department reveals its scene and localized detail', async () => {
    renderRoute('/en');
    await screen.findByRole('heading', { level: 1 });
    const group = screen.getByRole('group', { name: 'Departments connected to CORE' });
    await userEvent.click(within(group).getByRole('button', { name: 'Warehouse' }));
    const detail = document.getElementById('core-department-detail')!;
    await waitFor(() => expect(detail.querySelector('img')).not.toBeNull());
    expect(detail.querySelector('img')).toHaveAttribute('src', '/departments/warehouse.webp');
    expect(detail).toHaveTextContent('Receive goods, check quality');
    expect(within(detail).getByRole('link', { name: /View this department/ })).toHaveAttribute(
      'href',
      '/en/departments/warehouse',
    );
    expect(within(group).getByRole('button', { name: 'Warehouse' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('never suggests prices in the warehouse world', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    const card = document.querySelector('[data-world-card="warehouse"]')!;
    expect(card.textContent).not.toMatch(/฿|ราคา|price|cost/i);
  });
});
