import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/Providers';
import { patchRoutesOnNavigation, routes } from '@/app/router';
import { getPrototypeSession, prototypeSignOut } from '@/prototype/session';
import { renderRoute } from '@/test/render';
import { LOGIN_COPY } from './copy';

/*
 * EP15: the CORE Gateway sign-in. A visual layer over the unchanged
 * EP01-PROTOTYPE sign-in, so these tests cover both the experience and the
 * preserved mechanics (valid, invalid, `?next=`, session flag only).
 */

afterEach(() => {
  prototypeSignOut();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const THAI = /[฀-฾เ-๿]/;
const TEST_USER = ['user', '1'].join('');
const TEST_PASS = ['pass', '1'].join('');

async function open(path = '/login') {
  const r = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return r;
}

async function fill(username: string, password: string) {
  await userEvent.type(screen.getByLabelText(/^ชื่อผู้ใช้$|^Username$/), username);
  await userEvent.type(screen.getByLabelText(/^รหัสผ่าน$|^Password$/), password);
}

function withReducedMotion() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...original(query),
    matches: query.includes('prefers-reduced-motion'),
  })) as typeof window.matchMedia;
  return () => (window.matchMedia = original);
}

describe('the CORE Gateway', () => {
  it('is one focused page: one H1, a real form, labels and autocomplete', async () => {
    await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'เข้าสู่พื้นที่ทำงานของคุณ',
    );
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByLabelText('ชื่อผู้ใช้')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveAttribute('autocomplete', 'current-password');
    // Not inside the public header/footer: its own chrome.
    expect(screen.queryByRole('navigation', { name: 'เมนูหลัก' })).toBeNull();
    expect(document.querySelector('footer')).toBeNull();
  });

  it('shows the six departments around one gate (decorative)', async () => {
    await open();
    const wide = document.querySelector('[data-gateway="wide"]')!;
    expect(wide).toHaveAttribute('aria-hidden', 'true');
    expect(wide.querySelectorAll('[data-signal]')).toHaveLength(6);
    expect(wide).toHaveTextContent('คลังสินค้า');
    expect(wide.querySelector('[data-gate]')).not.toBeNull();
    expect(document.querySelector('[data-gateway="compact"]')).not.toBeNull();
  });

  it('settles as fields take focus', async () => {
    await open();
    const phase = () => document.querySelector('[data-panel]')!.getAttribute('data-phase');
    expect(phase()).toBe('idle');
    await userEvent.click(screen.getByLabelText('ชื่อผู้ใช้'));
    expect(phase()).toBe('user');
    await userEvent.click(screen.getByLabelText('รหัสผ่าน'));
    expect(phase()).toBe('pass');
    expect(document.querySelector('[data-status]')).toHaveTextContent('กำลังระบุตัวตน');
  });
});

describe('prototype sign-in (mechanics preserved)', () => {
  it('signs in with the keyboard and resolves into the workspace', async () => {
    const log = vi.spyOn(console, 'log');
    const { router } = await open('/login?next=%2Fapp%2Fwarehouse');
    await fill(TEST_USER, TEST_PASS);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: /กำลังเข้าสู่ระบบ/ })).toBeDisabled();
    expect(document.querySelector('[data-status]')).toHaveTextContent('กำลังตรวจสอบ');
    await waitFor(() =>
      expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'success'),
    );
    await screen.findByRole('heading', { level: 1, name: 'งานคลังวันนี้' }, { timeout: 4000 });
    expect(router.state.location.pathname).toBe('/app/warehouse');
    expect(getPrototypeSession()).toEqual({ username: TEST_USER });
    // The password is never stored or logged.
    const stored = JSON.stringify({ ...window.sessionStorage, ...window.localStorage });
    expect(stored).not.toContain(TEST_PASS);
    expect(log).not.toHaveBeenCalled();
  });

  it('blocks a wrong password calmly: amber state, clear message, focus back', async () => {
    const { router } = await open();
    await fill(TEST_USER, 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    const password = screen.getByLabelText('รหัสผ่าน');
    expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'fail');
    expect(document.querySelector('[data-status]')).toHaveTextContent('ยังเข้าไม่ได้');
    expect(password).toHaveFocus();
    expect(password).toHaveValue('');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.pathname).toBe('/login');
    expect(getPrototypeSession()).toBeNull();
    // Typing again clears the failed state.
    await userEvent.type(password, 'x');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'pass');
  });

  it('shows and hides the password with a labelled 44 px control', async () => {
    await open();
    const input = screen.getByLabelText('รหัสผ่าน');
    const toggle = screen.getByRole('button', { name: 'แสดงรหัสผ่าน' });
    expect(toggle).toHaveClass('w-12');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    // EP19: one state signal — the label — not label + aria-pressed.
    expect(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' })).not.toHaveAttribute(
      'aria-pressed',
    );
    await userEvent.click(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('warns about Caps Lock', async () => {
    await open();
    fireEvent.keyDown(screen.getByLabelText('รหัสผ่าน'), { key: 'A', modifierCapsLock: true });
    expect(document.querySelector('[data-caps]')).toHaveTextContent('Caps Lock');
  });

  it('still validates required fields and ignores off-site redirects', async () => {
    const { router } = await open('/login?next=https%3A%2F%2Fevil.example');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByText('กรุณากรอกชื่อผู้ใช้')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument();
    await fill(TEST_USER, TEST_PASS);
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    await screen.findByRole('heading', { level: 1, name: 'ภาพรวมองค์กร' }, { timeout: 4000 });
    expect(router.state.location.pathname).toBe('/app/executive');
  });

  it('moves instantly under reduced motion, with no idle pulses', async () => {
    const restore = withReducedMotion();
    const { router } = await open();
    expect(document.querySelectorAll('animateMotion')).toHaveLength(0);
    await fill(TEST_USER, TEST_PASS);
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: 'ภาพรวมองค์กร' });
    expect(router.state.location.pathname).toBe('/app/executive');
    restore();
  });

  it('runs a slow idle pulse when motion is allowed', async () => {
    await open();
    expect(document.querySelectorAll('[data-gateway="wide"] animateMotion')).toHaveLength(3);
  });
});

describe('ways out and around', () => {
  it('returns to the website, and links quietly to the demo and security', async () => {
    await open();
    expect(document.querySelector('[data-link="home"]')).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'PDA BLISS CORE หน้าแรก' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(document.querySelector('[data-link="demo"]')).toHaveAttribute('href', '/demo');
    expect(document.querySelector('[data-link="security"]')).toHaveAttribute('href', '/security');
    expect(document.querySelector('[data-link="security"]')).toHaveTextContent(
      'แนวทางด้าน Security และการควบคุมสิทธิ์',
    );
  });

  it('speaks the visitor’s language from /en/login, keeping one /login URL', async () => {
    const { router } = await open('/en/login');
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Enter your workspace');
    expect(document.querySelector('[data-link="home"]')).toHaveAttribute('href', '/en');
    expect(document.querySelector('[data-link="security"]')).toHaveAttribute(
      'href',
      '/en/security',
    );
    expect(document.querySelector('[data-link="demo"]')).toHaveAttribute('href', '/en/demo');
    expect(document.querySelector('main')!.textContent).not.toMatch(THAI);
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
  });

  it('carries the language from the header link', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/zh'], patchRoutesOnNavigation });
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );
    const header = (await screen.findByRole('navigation', { name: '主导航' })).closest('header')!;
    await userEvent.click(within(header).getByRole('link', { name: '登录' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '进入您的工作空间' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('keeps sign-in out of search results while it is open', async () => {
    const { router } = await open();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await router.navigate('/');
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toBeNull());
  });
});

describe('credential boundary', () => {
  it('never shows the prototype credentials in copy or on the page', async () => {
    for (const s of JSON.stringify(LOGIN_COPY).split('"')) {
      expect(s).not.toContain(TEST_USER);
      expect(s).not.toContain(TEST_PASS);
    }
    await open();
    expect(document.body.textContent).not.toContain(TEST_USER);
    expect(document.body.textContent).not.toContain(TEST_PASS);
  });

  it('keeps the demo password only in the isolated prototype config', () => {
    const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const holders = Object.entries(sources)
      .filter(([, text]) => text.includes(`'${TEST_PASS}'`))
      .map(([path]) => path);
    expect(holders).toEqual(['/src/prototype/config.ts']);
  });
});
