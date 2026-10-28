import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getIdentityState } from '@/features/auth/session';
import { fakeApi, identity, signedIn, signedOut } from '@/test/fakeApi';
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
    expect(screen.getByRole('link', { name: /ขอคำปรึกษา/ })).toHaveAttribute(
      'href',
      '/consultation',
    );
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

  it('asks what to talk about before anything else on /consultation (EP13; EP24.1.4.3)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderRoute('/consultation');
    await userEvent.click(await screen.findByRole('button', { name: /ถัดไป/ }));
    expect(await screen.findByText('กรุณาเลือกเรื่องที่อยากคุย')).toBeInTheDocument();
  });
});

describe('workspace route groups (prototype, behind real sign-in since EP23)', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it.each(WORKSPACE_ORDER)('keeps /app/%s behind a real session', async (id) => {
    fakeApi(signedOut);
    const { router } = renderRoute(`/app/${id}`);
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่พื้นที่ทำงานของคุณ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent(`/app/${id}`)}`);
  });

  it.each(WORKSPACE_ORDER)('renders the %s workspace with its own navigation', async (id) => {
    fakeApi(signedIn(identity()));
    renderRoute(`/app/${id}`);
    const nav = await screen.findByRole('navigation', { name: `เมนู${WORKSPACES[id].nameTh}` });
    for (const item of WORKSPACES[id].nav) {
      expect(nav).toHaveTextContent(item.label);
    }
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริงของบริษัท/)).toBeInTheDocument();
  });

  it('has no company picker: /app opens a workspace directly', async () => {
    fakeApi(signedIn(identity()));
    const { router } = renderRoute('/app');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toMatch(/^\/app\/[a-z]+$/);
    expect(screen.queryByText(/เลือกบริษัท|select company/i)).not.toBeInTheDocument();
  });
});

describe('prototype workspace switcher and real sign-out', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('switches between department workspaces', async () => {
    fakeApi(signedIn(identity()));
    const { router } = renderRoute('/app/executive');
    await userEvent.click(await screen.findByRole('button', { name: /สลับพื้นที่ทำงาน/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /คลังสินค้า/ }));
    await screen.findByRole('heading', { level: 1, name: 'งานคลังวันนี้' });
    expect(router.state.location.pathname).toBe('/app/warehouse');
  });

  it('signs out on the server and returns to the login page', async () => {
    const api = fakeApi(signedIn(identity()));
    const { router } = renderRoute('/app/sales');
    await userEvent.click(await screen.findByRole('button', { name: 'เมนูผู้ใช้' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'ออกจากระบบ' }));
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่พื้นที่ทำงานของคุณ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(api.called('POST /api/v1/auth/logout')).toHaveLength(1);
    expect(getIdentityState().status).toBe('anonymous');
  });
});
