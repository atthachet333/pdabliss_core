import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getPrototypeSession, prototypeSignIn, prototypeSignOut } from '@/prototype/session';
import { WORKSPACE_ORDER, WORKSPACES } from '@/workspaces/registry';
import { PUBLIC_ROUTES } from '@/test/publicRoutes';
import { renderRoute } from './render';

describe('public website', () => {
  it('renders the CORE Universe landing page with the primary CTAs', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'แต่ละแผนกทำงานได้เต็มที่',
    );
    expect(screen.getByRole('figure', { name: /CORE Universe/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'สำรวจ CORE' })).toHaveAttribute('href', '#who-for');
    expect(
      screen.getByRole('link', { name: 'ดูว่า CORE เหมาะกับองค์กรของคุณหรือไม่' }),
    ).toHaveAttribute('href', '#fit');
    expect(screen.getByRole('link', { name: /ขอคำปรึกษา/ })).toHaveAttribute('href', '/contact');
  });

  it('offers every orbiting department as an accessible control in the CORE Universe', async () => {
    renderRoute('/');
    await screen.findByRole('figure', { name: /CORE Universe/ });
    const group = screen.getByRole('group', { name: 'แผนกที่เชื่อมกับ CORE' });
    for (const name of [
      'ฝ่ายขาย',
      'คลังสินค้า',
      'จัดซื้อ',
      'ปฏิบัติการ',
      'บัญชีและการเงิน',
      'รายงาน',
    ]) {
      expect(within(group).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows the four approved packages (EP07)', async () => {
    renderRoute('/pricing');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').filter((t) => t.id.startsWith('plan-tab-'));
    expect(tabs.map((t) => t.dataset.plan)).toEqual([
      'starter',
      'business',
      'professional',
      'enterprise',
    ]);
  });

  it.each([...PUBLIC_ROUTES.filter((r) => r !== '/'), '/login'])(
    'renders %s with a level-1 heading',
    async (path) => {
      renderRoute(path);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    },
  );

  it('validates the contact form with Thai messages before anything is submitted', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderRoute('/contact');
    const submit = await screen.findByRole('button', { name: /ตรวจสอบและส่งข้อความ/ });
    await userEvent.click(submit);
    expect(await screen.findByText('กรุณากรอกชื่อ-นามสกุล')).toBeInTheDocument();
    expect(screen.getByLabelText('ชื่อ-นามสกุล')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('workspace route groups (EP01-PROTOTYPE)', () => {
  afterEach(() => {
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it.each(WORKSPACE_ORDER)('keeps /app/%s behind the demo sign-in', async (id) => {
    const { router } = renderRoute(`/app/${id}`);
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(`/app/${id}`)}`);
  });

  it.each(WORKSPACE_ORDER)('renders the %s workspace with its own navigation', async (id) => {
    prototypeSignIn('user1', 'pass1');
    renderRoute(`/app/${id}`);
    const nav = await screen.findByRole('navigation', { name: `เมนู${WORKSPACES[id].nameTh}` });
    for (const item of WORKSPACES[id].nav) {
      expect(nav).toHaveTextContent(item.label);
    }
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/ไม่ใช่ระบบเข้าสู่ระบบจริง/)).toBeInTheDocument();
  });

  it('has no company picker: /app opens a workspace directly', async () => {
    prototypeSignIn('user1', 'pass1');
    const { router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toMatch(/^\/app\/[a-z]+$/);
    expect(screen.queryByText(/เลือกบริษัท|select company/i)).not.toBeInTheDocument();
  });
});

describe('prototype login', () => {
  afterEach(() => {
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it('validates required fields in Thai', async () => {
    renderRoute('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByText('กรุณากรอกชื่อผู้ใช้')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument();
  });

  it('rejects anything other than the demo account', async () => {
    renderRoute('/login');
    await userEvent.type(await screen.findByLabelText('ชื่อผู้ใช้'), 'user1');
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  });

  it('shows a loading state, then opens the requested workspace', async () => {
    const { router } = renderRoute('/login?next=%2Fapp%2Fwarehouse');
    await userEvent.type(await screen.findByLabelText('ชื่อผู้ใช้'), 'user1');
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'pass1');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByRole('button', { name: /กำลังเข้าสู่ระบบ/ })).toBeDisabled();
    await screen.findByRole('heading', { level: 1, name: 'งานคลังวันนี้' });
    expect(router.state.location.pathname).toBe('/app/warehouse');
  });

  it('toggles password visibility', async () => {
    renderRoute('/login');
    const input = await screen.findByLabelText('รหัสผ่าน');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('ignores off-site redirect targets', async () => {
    const { router } = renderRoute('/login?next=https%3A%2F%2Fevil.example');
    await userEvent.type(await screen.findByLabelText('ชื่อผู้ใช้'), 'user1');
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'pass1');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    await screen.findByRole('heading', { level: 1, name: 'ภาพรวมองค์กร' });
    expect(router.state.location.pathname).toBe('/app/executive');
  });
});

describe('prototype workspace switcher and sign-out', () => {
  afterEach(() => {
    prototypeSignOut();
    window.sessionStorage.clear();
  });

  it('switches between department workspaces', async () => {
    prototypeSignIn('user1', 'pass1');
    const { router } = renderRoute('/app/executive');
    await userEvent.click(await screen.findByRole('button', { name: /สลับพื้นที่ทำงาน/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /คลังสินค้า/ }));
    await screen.findByRole('heading', { level: 1, name: 'งานคลังวันนี้' });
    expect(router.state.location.pathname).toBe('/app/warehouse');
  });

  it('signs out and returns to the login page', async () => {
    prototypeSignIn('user1', 'pass1');
    const { router } = renderRoute('/app/sales');
    await userEvent.click(await screen.findByRole('button', { name: 'เมนูผู้ใช้' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'ออกจากระบบ' }));
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(getPrototypeSession()).toBeNull();
  });
});
