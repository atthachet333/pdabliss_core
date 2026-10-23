import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MEGA_GROUPS, MEGA_ORDER } from '@/config/navigation';
import { th } from '@/i18n/messages/th';
import { renderRoute } from '@/test/render';

const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/how-core-works',
  '/departments',
  '/solutions',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  // EP06 department pages
  '/departments/executive',
  '/departments/sales',
  '/departments/operations',
  '/departments/warehouse',
  '/departments/purchasing',
  '/departments/accounting',
];

const THAI_TOP_LEVEL = [
  'ภาพรวม',
  'แผนก',
  'แพ็คเกจ',
  'วิธีการทำงาน',
  'โซลูชัน',
  'สำหรับองค์กร',
  'เกี่ยวกับเรา',
  'ติดต่อเรา',
];

async function desktopNav(path = '/') {
  const utils = renderRoute(path);
  const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
  return { nav, ...utils };
}

describe('public header (EP05)', () => {
  it('shows the approved Thai top-level navigation, in order', async () => {
    const { nav } = await desktopNav();
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(THAI_TOP_LEVEL);
    // No English labels on the Thai experience.
    for (const english of [
      'Product',
      'Departments',
      'Solutions',
      'Industries',
      'Enterprise',
      'Resources',
      'Company',
    ]) {
      expect(within(nav).queryByText(english)).toBeNull();
    }
  });

  it('links ภาพรวม and ติดต่อเรา directly; the six others open mega menus', async () => {
    const { nav } = await desktopNav();
    expect(within(nav).getByRole('link', { name: 'ภาพรวม' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'ติดต่อเรา' })).toHaveAttribute(
      'href',
      '/contact',
    );
    const triggers = within(nav).getAllByRole('button');
    expect(triggers.map((b) => b.textContent)).toEqual(THAI_TOP_LEVEL.slice(1, 7));
    for (const b of triggers) expect(b).toHaveAttribute('aria-expanded', 'false');

    const header = nav.closest('header')!;
    expect(within(header).getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(header).getByRole('button', { name: 'ภาษา: ภาษาไทย' })).toBeInTheDocument();
  });

  it('every mega menu has editorial content and only live destinations', async () => {
    const { nav } = await desktopNav();
    for (const id of MEGA_ORDER) {
      const copy = th.nav.groups[id];
      await userEvent.click(within(nav).getByRole('button', { name: copy.label }));
      const panel = screen.getByRole('region', { name: `เมนู${copy.label}` });
      // Heading, intro and the highlight statement are present.
      expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(
        copy.heading.replace('\n', ' '),
      );
      expect(panel).toHaveTextContent(copy.intro);
      expect(panel).toHaveTextContent(copy.highlight.statement.replace('\n', ' '));
      for (const item of MEGA_GROUPS[id].items) {
        const text = copy.items[item.id]!;
        expect(panel).toHaveTextContent(text.description);
        const link = within(panel).queryByRole('link', { name: new RegExp(text.label) });
        if (item.to) expect(link, `${id}/${item.id}`).not.toBeNull();
        else expect(link, `${id}/${item.id} is informational`).toBeNull();
      }
      for (const a of within(panel).getAllByRole('link')) {
        const href = a.getAttribute('href')!;
        expect(PUBLIC_ROUTES, `${copy.label}: ${a.textContent}`).toContain(
          href.split('#')[0]!.split('?')[0],
        );
      }
    }
  });

  it('shows the department items and highlight from the approved copy', async () => {
    const { nav } = await desktopNav();
    await userEvent.click(within(nav).getByRole('button', { name: 'แผนก' }));
    const panel = screen.getByRole('region', { name: 'เมนูแผนก' });
    expect(
      within(panel).getByRole('heading', { name: 'ทำงานตามหน้าที่ของแต่ละแผนก' }),
    ).toBeInTheDocument();
    for (const label of [
      'ผู้บริหาร',
      'ฝ่ายขาย',
      'ฝ่ายปฏิบัติการ',
      'คลังสินค้า',
      'จัดซื้อ',
      'บัญชีและการเงิน',
    ]) {
      expect(within(panel).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent('Department Experience');
    expect(within(panel).getByRole('link', { name: /สำรวจทุกแผนก/ })).toHaveAttribute(
      'href',
      '/departments',
    );
  });

  it('marks planned enterprise capabilities as information, not links', async () => {
    const { nav } = await desktopNav();
    await userEvent.click(within(nav).getByRole('button', { name: 'สำหรับองค์กร' }));
    const panel = screen.getByRole('region', { name: 'เมนูสำหรับองค์กร' });
    expect(within(panel).queryByRole('link', { name: /API & Integration/ })).toBeNull();
    expect(within(panel).getAllByText('อยู่ในแผนพัฒนา').length).toBe(2);
    expect(within(panel).getByRole('link', { name: /พูดคุยกับทีม PDA BLISS/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('packages menu invents no prices', async () => {
    const { nav } = await desktopNav();
    await userEvent.click(within(nav).getByRole('button', { name: 'แพ็คเกจ' }));
    const panel = screen.getByRole('region', { name: 'เมนูแพ็คเกจ' });
    for (const plan of ['Starter', 'Business', 'Professional', 'Enterprise']) {
      expect(within(panel).getByRole('link', { name: new RegExp(plan) })).toBeInTheDocument();
    }
    expect(panel.textContent).not.toMatch(/฿|\d+\s?บาท/);
    expect(within(panel).getByRole('link', { name: /ขอคำปรึกษา/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('supports the disclosure keyboard pattern', async () => {
    const { nav } = await desktopNav();
    const overview = within(nav).getByRole('link', { name: 'ภาพรวม' });
    const departments = within(nav).getByRole('button', { name: 'แผนก' });

    overview.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(departments).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(departments).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'เมนูแผนก' });
    expect(departments).toHaveAttribute('aria-controls', panel.id);
    await waitFor(() => expect(within(panel).getAllByRole('link')[0]).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    expect(departments).toHaveAttribute('aria-expanded', 'false');
    expect(departments).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'เมนูแผนก' })).toBeNull());

    // ← wraps from the first item to the last.
    overview.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(within(nav).getByRole('link', { name: 'ติดต่อเรา' })).toHaveFocus();
  });

  it('closes on outside click', async () => {
    const { nav } = await desktopNav();
    await userEvent.click(within(nav).getByRole('button', { name: 'โซลูชัน' }));
    expect(screen.getByRole('region', { name: 'เมนูโซลูชัน' })).toBeInTheDocument();
    await userEvent.click(document.getElementById('main')!);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'เมนูโซลูชัน' })).toBeNull());
  });

  it('a mega-menu section link scrolls to the homepage chapter', async () => {
    const { nav, router } = await desktopNav('/about');
    await userEvent.click(within(nav).getByRole('button', { name: 'โซลูชัน' }));
    const panel = screen.getByRole('region', { name: 'เมนูโซลูชัน' });
    await userEvent.click(within(panel).getByRole('link', { name: /ลด Human Error/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.hash).toBe('#error-control');
    expect(
      await screen.findByRole('heading', { level: 2, name: /ไม่ควรรอให้ความผิดพลาดเกิดขึ้น/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'เมนูโซลูชัน' })).toBeNull());
  }, 15000);
});

describe('mobile navigation', () => {
  it('opens a full-screen, focus-trapped menu with groups, language, contact and sign-in', async () => {
    renderRoute('/');
    const toggle = await screen.findByRole('button', { name: 'เปิดเมนู' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    const dialog = screen.getByRole('dialog', { name: 'เมนู' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const close = within(dialog).getByRole('button', { name: 'ปิดเมนู' });
    expect(close).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');

    const groups = within(dialog).getAllByRole('button', { expanded: false });
    expect(groups).toHaveLength(MEGA_ORDER.length);
    await userEvent.click(within(dialog).getByRole('button', { name: /แผนก/ }));
    expect(within(dialog).getByRole('link', { name: /คลังสินค้า/ })).toHaveAttribute(
      'href',
      '/departments/warehouse',
    );

    const language = within(dialog).getByRole('navigation', { name: 'ภาษา' });
    expect(within(language).getByRole('link', { name: 'ภาษาไทย' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(language).getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en');
    expect(within(language).getByRole('link', { name: '简体中文' })).toHaveAttribute('href', '/zh');

    for (const a of within(dialog).getAllByRole('link', { name: /ติดต่อเรา/ })) {
      expect(a).toHaveAttribute('href', '/contact');
    }
    expect(within(dialog).getByRole('link', { name: /เข้าสู่ระบบ/ })).toHaveAttribute(
      'href',
      '/login',
    );

    // Shift+Tab from the first control wraps inside the dialog.
    within(dialog).getByRole('link', { name: 'PDA BLISS CORE หน้าแรก' }).focus();
    await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เมนู' })).toBeNull());
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes after following a link', async () => {
    const { router } = renderRoute('/');
    await userEvent.click(await screen.findByRole('button', { name: 'เปิดเมนู' }));
    const dialog = screen.getByRole('dialog', { name: 'เมนู' });
    await userEvent.click(within(dialog).getByRole('button', { name: /วิธีการทำงาน/ }));
    await userEvent.click(within(dialog).getByRole('link', { name: /Workflow และ Approval/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/how-core-works'));
    expect(router.state.location.hash).toBe('#approval');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เมนู' })).toBeNull());
  });
});
