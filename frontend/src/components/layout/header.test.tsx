import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NAV_GROUPS } from '@/config/navigation';
import { renderRoute } from '@/test/render';

const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/departments',
  '/solutions',
  '/about',
  '/contact',
];

async function desktopNav() {
  renderRoute('/');
  return screen.findByRole('navigation', { name: 'เมนูหลัก' });
}

describe('public header (EP04)', () => {
  it('lists the seven top-level items, with Pricing not among them', async () => {
    const nav = await desktopNav();
    const triggers = within(nav).getAllByRole('button');
    expect(triggers.map((b) => b.textContent)).toEqual([
      'Product',
      'Departments',
      'Solutions',
      'Industries',
      'Enterprise',
      'Resources',
      'Company',
    ]);
    expect(within(nav).queryByRole('button', { name: /Pricing|ราคา/ })).toBeNull();
    const header = nav.closest('header')!;
    expect(within(header).getByRole('link', { name: 'ติดต่อเรา' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(within(header).getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(header).getByText('TH')).toBeInTheDocument();
  });

  it('mega menus contain only links to pages that exist (no dead links)', async () => {
    const nav = await desktopNav();
    for (const g of NAV_GROUPS) {
      await userEvent.click(within(nav).getByRole('button', { name: g.label }));
      const panel = screen.getByRole('region', { name: `เมนู ${g.label}` });
      for (const a of within(panel).getAllByRole('link')) {
        const href = a.getAttribute('href')!;
        expect(href, `${g.label}: ${a.textContent}`).toMatch(/^\//);
        expect(PUBLIC_ROUTES).toContain(href.split('#')[0]);
      }
      // Destinations without a page yet are plain notes, not links.
      for (const note of g.notes?.items ?? []) {
        expect(within(panel).queryByRole('link', { name: new RegExp(note) })).toBeNull();
      }
    }
  });

  it('supports the disclosure keyboard pattern', async () => {
    const nav = await desktopNav();
    const product = within(nav).getByRole('button', { name: 'Product' });
    const departments = within(nav).getByRole('button', { name: 'Departments' });
    expect(product).toHaveAttribute('aria-expanded', 'false');

    product.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(departments).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(departments).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'เมนู Departments' });
    expect(departments).toHaveAttribute('aria-controls', panel.id);
    await waitFor(() => expect(within(panel).getAllByRole('link')[0]).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    expect(departments).toHaveAttribute('aria-expanded', 'false');
    expect(departments).toHaveFocus();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'เมนู Departments' })).toBeNull(),
    );
  });

  it('a mega-menu section link scrolls to the homepage chapter', async () => {
    const { router } = renderRoute('/about');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Solutions' }));
    const panel = screen.getByRole('region', { name: 'เมนู Solutions' });
    await userEvent.click(within(panel).getByRole('link', { name: /ลดความผิดพลาดจากคน/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.hash).toBe('#error-control');
    expect(
      await screen.findByRole('heading', { level: 2, name: /ไม่ควรรอให้ความผิดพลาดเกิดขึ้น/ }),
    ).toBeInTheDocument();
    // The panel closes after navigating.
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'เมนู Solutions' })).toBeNull(),
    );
  }, 15000);
});

describe('mobile navigation', () => {
  it('opens a full-screen menu with grouped sections, contact and sign-in', async () => {
    renderRoute('/');
    const toggle = await screen.findByRole('button', { name: 'เปิดเมนู' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    const dialog = screen.getByRole('dialog', { name: 'เมนู' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('ปิดเมนู');
    const groups = within(dialog).getAllByRole('button', { expanded: false });
    expect(within(dialog).getByRole('button', { name: /Product/, expanded: true })).toBeVisible();
    expect(groups.length).toBe(NAV_GROUPS.length - 1);

    await userEvent.click(within(dialog).getByRole('button', { name: /Departments/ }));
    expect(within(dialog).getByRole('link', { name: /คลังสินค้า/ })).toHaveAttribute(
      'href',
      '/departments#warehouse',
    );
    expect(within(dialog).getByRole('link', { name: /ติดต่อเรา/ })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(within(dialog).getByRole('link', { name: /เข้าสู่ระบบ/ })).toHaveAttribute(
      'href',
      '/login',
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เมนู' })).toBeNull());
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after following a link', async () => {
    const { router } = renderRoute('/');
    await userEvent.click(await screen.findByRole('button', { name: 'เปิดเมนู' }));
    const dialog = screen.getByRole('dialog', { name: 'เมนู' });
    await userEvent.click(within(dialog).getByRole('link', { name: /ฟีเจอร์/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/features'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เมนู' })).toBeNull());
  });
});
