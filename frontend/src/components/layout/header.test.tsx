import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MEGA_GROUPS, MEGA_ORDER } from '@/config/navigation';
import { th } from '@/i18n/messages/th';
import { PUBLIC_ROUTES } from '@/test/publicRoutes';
import { renderRoute } from '@/test/render';

/*
 * EP05 header, consolidated in EP18: ภาพรวม + four menus (Product, Solutions,
 * Resources, About), with ติดต่อเรา and เข้าสู่ระบบ as actions.
 */

const THAI_TOP_LEVEL = ['ภาพรวม', 'ผลิตภัณฑ์', 'โซลูชัน', 'ความรู้', 'เกี่ยวกับเรา'];

async function desktopNav(path = '/') {
  const utils = renderRoute(path);
  const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
  return { nav, ...utils };
}

async function openMenu(nav: HTMLElement, label: string) {
  await userEvent.click(within(nav).getByRole('button', { name: label }));
  return screen.getByRole('region', { name: `เมนู${label}` });
}

const hrefs = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));

describe('public header (EP18)', () => {
  it('shows the consolidated Thai top-level navigation, in order', async () => {
    const { nav } = await desktopNav();
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(THAI_TOP_LEVEL);
    // No English labels on the Thai experience.
    for (const english of ['Product', 'Solutions', 'Resources', 'About', 'Company']) {
      expect(within(nav).queryByText(english)).toBeNull();
    }
  });

  it('links ภาพรวม directly; four menus; contact and a labelled sign-in as actions', async () => {
    const { nav } = await desktopNav();
    expect(within(nav).getByRole('link', { name: 'ภาพรวม' })).toHaveAttribute('href', '/');
    const triggers = within(nav).getAllByRole('button');
    expect(triggers.map((b) => b.textContent)).toEqual(THAI_TOP_LEVEL.slice(1));
    for (const b of triggers) expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'ติดต่อเรา' })).toBeNull();

    const header = nav.closest('header')!;
    const contact = within(header).getByRole('link', { name: 'ติดต่อเรา' });
    expect(contact).toHaveAttribute('href', '/contact');
    const login = within(header).getByRole('link', { name: 'เข้าสู่ระบบ' });
    expect(login).toHaveAttribute('href', '/login');
    // EP18: the sign-in label is real text, never visually hidden.
    expect(login.querySelector('.sr-only')).toBeNull();
    expect(login).toHaveTextContent('เข้าสู่ระบบ');
    expect(contact.compareDocumentPosition(login) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'ภาษา: ภาษาไทย' })).toBeInTheDocument();
  });

  it('every menu has an intro, titled sections, live links and one featured destination', async () => {
    const { nav } = await desktopNav();
    for (const id of MEGA_ORDER) {
      const copy = th.nav.groups[id];
      const group = MEGA_GROUPS[id];
      const panel = await openMenu(nav, copy.label);
      expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(
        copy.heading.replace('\n', ' '),
      );
      expect(panel).toHaveTextContent(copy.intro);
      expect(panel).toHaveTextContent(copy.highlight.statement.replace('\n', ' '));
      for (const section of group.sections)
        expect(panel).toHaveTextContent(copy.sections[section.id]!);
      for (const item of group.items) {
        const text = copy.items[item.id]!;
        // Anchored: a feature link's name is its label followed by its description.
        const link = within(panel).getAllByRole('link', { name: new RegExp(`^${text.label}`) })[0]!;
        expect(link, `${id}/${item.id}`).toHaveAttribute('href', item.to);
        if (text.description) expect(panel).toHaveTextContent(text.description);
      }
      expect(panel.querySelector('[data-mega-cta]')).toHaveAttribute('href', group.cta);
      for (const href of hrefs(panel)) {
        expect(PUBLIC_ROUTES as readonly string[], `${copy.label}: ${href}`).toContain(
          href!.split('#')[0]!.split('?')[0],
        );
      }
      // Hierarchy, not a wall: no menu shows more than a dozen links.
      expect(hrefs(panel).length).toBeLessThanOrEqual(12);
    }
  });

  it('Product answers “what is CORE and how do I use it” — every department one step away', async () => {
    const { nav } = await desktopNav();
    const panel = await openMenu(nav, 'ผลิตภัณฑ์');
    for (const [label, href] of [
      ['CORE ทำงานอย่างไร', '/how-core-works'],
      ['แผนก', '/departments'],
      ['ทดลองใช้งาน CORE', '/demo'],
      ['แพ็คเกจ', '/pricing'],
      ['ผู้บริหาร', '/departments/executive'],
      ['คลังสินค้า', '/departments/warehouse'],
      ['บัญชีและการเงิน', '/departments/accounting'],
    ] as const) {
      expect(within(panel).getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute(
        'href',
        href,
      );
    }
    // The menu names packages but never prices.
    expect(panel.textContent).not.toMatch(/฿|\d+\s?บาท/);
  });

  it('Solutions answers “where does CORE fit my business” — industries one step away', async () => {
    const { nav } = await desktopNav();
    const panel = await openMenu(nav, 'โซลูชัน');
    for (const [label, href] of [
      ['ปัญหาที่ CORE ช่วยจัดการ', '/solutions'],
      ['ประเภทธุรกิจ', '/industries'],
      ['สำหรับองค์กร', '/enterprise'],
      ['ธุรกิจค้าปลีก', '/industries/retail'],
      ['การผลิต', '/industries/manufacturing'],
    ] as const) {
      expect(within(panel).getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  it('opens ความรู้ onto the seven guides and the Resource Center (EP16)', async () => {
    const { nav } = await desktopNav();
    const panel = await openMenu(nav, 'ความรู้');
    for (const [label, href] of [
      ['เริ่มต้นกับ CORE', '/resources/getting-started'],
      ['Workflow & Operations', '/resources/how-core-works'],
      ['Human Error', '/resources/human-error'],
      ['Warehouse Privacy', '/resources/warehouse-privacy'],
      ['Implementation Guide', '/resources/implementation-guide'],
      ['Security & Data', '/resources/security-and-data'],
      ['CORE Glossary', '/resources/core-glossary'],
    ] as const) {
      expect(within(panel).getByRole('link', { name: new RegExp(label) })).toHaveAttribute(
        'href',
        href,
      );
    }
    for (const title of ['เริ่มที่นี่', 'แนวคิดหลัก', 'อ้างอิง'])
      expect(panel).toHaveTextContent(title);
    expect(within(panel).getByRole('link', { name: /เปิดคลังความรู้/ })).toHaveAttribute(
      'href',
      '/resources',
    );
  });

  it('About holds the company, its reasons and trust (Security moved here in EP18)', async () => {
    const { nav } = await desktopNav();
    const panel = await openMenu(nav, 'เกี่ยวกับเรา');
    for (const [label, href] of [
      ['PDA BLISS', '/about'],
      ['ทำไมเราถึงสร้าง CORE', '/why-core'],
      ['Security & Trust', '/security'],
      ['แนวทางการพัฒนาระบบ', '/about#approach'],
    ] as const) {
      expect(
        within(panel).getAllByRole('link', { name: new RegExp(`^${label}`) })[0],
      ).toHaveAttribute('href', href);
    }
  });

  it.each([
    ['/pricing', 'ผลิตภัณฑ์'],
    ['/departments/warehouse', 'ผลิตภัณฑ์'],
    ['/industries/retail', 'โซลูชัน'],
    ['/enterprise', 'โซลูชัน'],
    ['/resources/human-error', 'ความรู้'],
    ['/why-core', 'เกี่ยวกับเรา'],
    ['/security', 'เกี่ยวกับเรา'],
  ])('marks the menu that holds %s as current', async (path, label) => {
    const { nav } = await desktopNav(path);
    for (const b of within(nav).getAllByRole('button')) {
      if (b.textContent === label) expect(b).toHaveAttribute('aria-current', 'true');
      else expect(b).not.toHaveAttribute('aria-current');
    }
  });

  it('marks no menu on the homepage', async () => {
    const { nav } = await desktopNav('/');
    for (const b of within(nav).getAllByRole('button'))
      expect(b).not.toHaveAttribute('aria-current');
  });

  it('supports the disclosure keyboard pattern', async () => {
    const { nav } = await desktopNav();
    const overview = within(nav).getByRole('link', { name: 'ภาพรวม' });
    const product = within(nav).getByRole('button', { name: 'ผลิตภัณฑ์' });

    overview.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(product).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(product).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'เมนูผลิตภัณฑ์' });
    expect(product).toHaveAttribute('aria-controls', panel.id);
    await waitFor(() => expect(within(panel).getAllByRole('link')[0]).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    expect(product).toHaveAttribute('aria-expanded', 'false');
    expect(product).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'เมนูผลิตภัณฑ์' })).toBeNull());

    // ← wraps from the first item to the last.
    overview.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(within(nav).getByRole('button', { name: 'เกี่ยวกับเรา' })).toHaveFocus();
  });

  it('closes on outside click', async () => {
    const { nav } = await desktopNav();
    await openMenu(nav, 'โซลูชัน');
    await userEvent.click(document.getElementById('main')!);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'เมนูโซลูชัน' })).toBeNull());
  });

  it('a menu link to a chapter opens it on another page and closes the menu', async () => {
    const { nav, router } = await desktopNav('/pricing');
    const panel = await openMenu(nav, 'เกี่ยวกับเรา');
    await userEvent.click(within(panel).getByRole('link', { name: /แนวทางการพัฒนาระบบ/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/about'));
    expect(router.state.location.hash).toBe('#approach');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'เมนูเกี่ยวกับเรา' })).toBeNull(),
    );
  }, 15000);

  it('keeps the locale on menus and the contact action (EP16)', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Resources' }));
    const panel = screen.getByRole('region', { name: /Resources/ });
    expect(within(panel).getByRole('link', { name: /Warehouse privacy/ })).toHaveAttribute(
      'href',
      '/en/resources/warehouse-privacy',
    );
    expect(within(panel).getByRole('link', { name: /Open the Resource Center/ })).toHaveAttribute(
      'href',
      '/en/resources',
    );
    const header = nav.closest('header')!;
    expect(within(header).getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      '/en/contact',
    );
    await userEvent.click(within(nav).getByRole('button', { name: 'Product' }));
    expect(screen.getByRole('link', { name: /^Warehouse$/ })).toHaveAttribute(
      'href',
      '/en/departments/warehouse',
    );
  });
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
    // Collapsed by default: no guide link is shown until ความรู้ is opened.
    expect(within(dialog).queryByRole('link', { name: /CORE Glossary/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: /ผลิตภัณฑ์/ }));
    expect(within(dialog).getByRole('link', { name: /^คลังสินค้า$/ })).toHaveAttribute(
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
    await userEvent.click(within(dialog).getByRole('button', { name: /ความรู้/ }));
    await userEvent.click(within(dialog).getByRole('link', { name: /CORE Glossary/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/resources/core-glossary'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'เมนู' })).toBeNull());
  });
});
