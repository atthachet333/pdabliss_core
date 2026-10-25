import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prototypeSignIn, prototypeSignOut } from '@/prototype/session';
import { renderRoute } from '@/test/render';
import { WORKSPACE_ORDER, WORKSPACES } from '@/workspaces/registry';
import { setNavPreference } from './navPreference';

describe('AppShell (EP02)', () => {
  beforeEach(() => {
    prototypeSignIn('user1', 'pass1');
  });
  afterEach(() => {
    setNavPreference('auto');
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it('renders top bar identity, the workspace sidebar and a skip link', async () => {
    renderRoute('/app/purchasing');
    await screen.findByRole('heading', { level: 1 });
    const banner = screen.getByRole('banner', { name: 'แถบเครื่องมือ PDA BLISS CORE' });
    expect(within(banner).getByRole('link', { name: /PDA BLISS CORE/ })).toHaveAttribute(
      'href',
      '/app/purchasing',
    );
    expect(banner).toHaveTextContent(WORKSPACES.purchasing.shortTh);
    expect(within(banner).getByRole('button', { name: /ค้นหา/ })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: /การแจ้งเตือน/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ข้ามไปยังเนื้อหาหลัก' })).toHaveAttribute(
      'href',
      '#workspace-main',
    );
  });

  it.each(WORKSPACE_ORDER)('shows only the %s modules in its navigation', async (id) => {
    renderRoute(`/app/${id}`);
    const nav = await screen.findByRole('navigation', { name: `เมนู${WORKSPACES[id].nameTh}` });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      WORKSPACES[id].nav.map((n) => (n.path ? `/app/${id}/${n.path}` : `/app/${id}`)),
    );
  });

  it('uses responsive classes: sidebar from 768px, bottom bar below', async () => {
    renderRoute('/app/sales');
    const sidebarNav = await screen.findByRole('navigation', { name: 'เมนูพื้นที่ทำงานฝ่ายขาย' });
    expect(sidebarNav.closest('div.hidden')).toHaveClass('md:block');
    const bottom = screen.getByRole('navigation', { name: 'เมนูหลักพื้นที่ทำงานฝ่ายขาย' });
    expect(bottom).toHaveClass('fixed', 'md:hidden');
  });

  it('collapses the sidebar to an icon rail and remembers the choice', async () => {
    const { container } = renderRoute('/app/sales');
    await screen.findByRole('heading', { level: 1 });
    const shell = container.querySelector('[data-nav]')!;
    expect(shell).toHaveAttribute('data-nav', 'auto');
    // jsdom has no wide viewport, so 'auto' resolves to the rail; expand it.
    const toggle = screen.getByRole('button', { name: 'ขยายเมนูด้านข้าง' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(shell).toHaveAttribute('data-nav', 'expanded');
    expect(window.localStorage.getItem('pbc.app.nav')).toBe('expanded');
    await userEvent.click(screen.getByRole('button', { name: 'ย่อเมนูด้านข้าง' }));
    expect(shell).toHaveAttribute('data-nav', 'collapsed');
  });

  it('puts four destinations in the phone bar and the rest under "เพิ่มเติม"', async () => {
    renderRoute('/app/sales');
    const bottom = await screen.findByRole('navigation', { name: 'เมนูหลักพื้นที่ทำงานฝ่ายขาย' });
    expect(within(bottom).getAllByRole('link')).toHaveLength(4);
    await userEvent.click(within(bottom).getByRole('button', { name: 'เพิ่มเติม' }));
    const sheet = await screen.findByRole('dialog', { name: 'เมนูเพิ่มเติม' });
    expect(within(sheet).getByRole('link', { name: 'ลูกค้า' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'รายงาน' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('ใช้สำหรับตรวจแบบเท่านั้น');
  });

  it('gives Warehouse a centre scan button that opens the scan prototype', async () => {
    renderRoute('/app/warehouse');
    const bottom = await screen.findByRole('navigation', {
      name: 'เมนูหลักพื้นที่ทำงานคลังสินค้า',
    });
    await userEvent.click(within(bottom).getByRole('button', { name: 'สแกนบาร์โค้ด / QR' }));
    expect(await screen.findByRole('dialog', { name: 'สแกนบาร์โค้ด / QR' })).toBeInTheDocument();
  });

  it('opens search with Ctrl+K and jumps to a page of the workspace', async () => {
    const { router } = renderRoute('/app/warehouse');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'ค้นหา' });
    expect(dialog).toHaveTextContent('ต้นแบบ');
    await userEvent.type(within(dialog).getByRole('combobox'), 'ตรวจนับ');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/warehouse/stock-count'));
  });

  it('opens the notification centre with category tabs and marks items read', async () => {
    renderRoute('/app/executive');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /การแจ้งเตือน \(ยังไม่อ่าน 2/ }));
    const drawer = await screen.findByRole('dialog', { name: /การแจ้งเตือน/ });
    for (const tab of ['ทั้งหมด', 'งาน', 'อนุมัติ', 'แจ้งเตือน', 'ระบบ']) {
      expect(within(drawer).getByRole('tab', { name: new RegExp(tab) })).toBeInTheDocument();
    }
    await userEvent.click(
      within(drawer).getByRole('button', { name: /ทำเครื่องหมายว่าอ่านแล้วทั้งหมด/ }),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'การแจ้งเตือน' })).toBeInTheDocument();
  });

  it('profile menu shows the user, the workspace and the Design Lab entry', async () => {
    const { router } = renderRoute('/app/operations');
    await userEvent.click(await screen.findByRole('button', { name: 'เมนูผู้ใช้' }));
    const menu = screen.getByRole('menu', { name: 'เมนูผู้ใช้' });
    expect(menu).toHaveTextContent('user1');
    expect(menu).toHaveTextContent(WORKSPACES.operations.shortTh);
    expect(within(menu).getByRole('menuitem', { name: /โปรไฟล์/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Design Lab/ }));
    await screen.findByRole('heading', { level: 1, name: 'Design Lab' });
    expect(router.state.location.pathname).toBe('/app/prototype/ui');
  });

  it('marks the workspace switcher as prototype-only', async () => {
    renderRoute('/app/admin');
    await userEvent.click(await screen.findByRole('button', { name: /สลับพื้นที่ทำงาน · ต้นแบบ/ }));
    const menu = screen.getByRole('menu', { name: /เฉพาะต้นแบบ/ });
    expect(menu).toHaveTextContent('ใช้สำหรับตรวจแบบเท่านั้น');
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(7);
    expect(within(menu).getByRole('menuitemradio', { name: /ผู้ดูแลระบบ/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('renders a not-found state inside the shell for unknown modules', async () => {
    renderRoute('/app/sales/does-not-exist');
    expect(await screen.findByText('ไม่พบหน้าที่ต้องการ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /กลับไปหน้าภาพรวมฝ่ายขาย/ })).toHaveAttribute(
      'href',
      '/app/sales',
    );
  });

  it('module pages show the blueprint table with an intentional empty state', async () => {
    renderRoute('/app/purchasing/purchase-orders');
    await screen.findByRole('heading', { level: 1, name: 'ใบสั่งซื้อ' });
    expect(screen.getByText('ยังไม่มีใบสั่งซื้อ')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'ค้นหารายการ' }), 'xyz');
    expect(screen.getByText('ไม่พบรายการตามตัวกรอง')).toBeInTheDocument();
  });
});

describe('Design Lab route', () => {
  afterEach(() => {
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it('stays behind the prototype sign-in', async () => {
    const { router } = renderRoute('/app/prototype/ui');
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่พื้นที่ทำงานของคุณ' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('is not part of any workspace navigation', () => {
    for (const id of WORKSPACE_ORDER) {
      expect(WORKSPACES[id].nav.some((n) => n.path.includes('prototype'))).toBe(false);
    }
  });

  it('renders the component gallery', async () => {
    prototypeSignIn('user1', 'pass1');
    renderRoute('/app/prototype/ui');
    await screen.findByRole('heading', { level: 1, name: 'Design Lab' });
    for (const section of ['Buttons', 'Status', 'Forms', 'Table', 'Workflow timeline']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument();
    }
  });
});
