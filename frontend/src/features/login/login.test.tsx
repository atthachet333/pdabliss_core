import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/Providers';
import { patchRoutesOnNavigation, routes } from '@/app/router';
import { getIdentityState } from '@/features/auth/session';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import { LOGIN_COPY } from './copy';

/*
 * The CORE Gateway sign-in: EP15's experience, real authentication since
 * EP23 (email + password → emailed code when required → account home).
 * The API is faked here; the server rules are covered by the backend suites.
 */

const THAI = /[฀-฾เ-๿]/;
const EMAIL = 'person@example.com';
const PASSWORD = 'correct horse battery staple';
const CHALLENGE = {
  id: '6f1c2a40-1111-4222-8333-944455556666',
  purpose: 'LOGIN',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  maskedEmail: 'p•••@example.com',
};
const anonymous = { 'GET /api/v1/auth/me': fail(401, 'UNAUTHENTICATED') };
const otpRequired = (trustDeviceAllowed = true) =>
  ok({ status: 'otp_required', challenge: CHALLENGE, trustDeviceAllowed });

async function open(path = '/login') {
  const r = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return r;
}

async function fill(email: string, password: string) {
  await userEvent.type(screen.getByLabelText(/^อีเมล$|^Email$/), email);
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
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('type', 'email');
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
    await userEvent.click(screen.getByLabelText('อีเมล'));
    expect(phase()).toBe('user');
    await userEvent.click(screen.getByLabelText('รหัสผ่าน'));
    expect(phase()).toBe('pass');
    expect(document.querySelector('[data-status]')).toHaveTextContent('กำลังระบุตัวตน');
  });
});

describe('real sign-in (EP23)', () => {
  it('signs in with the keyboard, asks for the emailed code, and opens the Account Portal', async () => {
    const api = fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': otpRequired(),
      'POST /api/v1/auth/login/otp': ok({ status: 'authenticated', identity: identity() }),
      'GET /api/v1/auth/sessions': ok({ sessions: [] }),
    });
    const log = vi.spyOn(console, 'log');
    const { router } = await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    const code = await screen.findByLabelText('รหัสยืนยัน 6 หลัก');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
    await waitFor(() => expect(code).toHaveFocus());
    expect(screen.getByText(/p•••@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /จดจำเบราว์เซอร์นี้/ })).toBeInTheDocument();
    // A pasted code with a space still gives six digits, and submits by itself.
    await userEvent.click(code);
    await userEvent.paste('123 456');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' }, { timeout: 4000 });
    expect(router.state.location.pathname).toBe('/account');

    const [login] = api.called('POST /api/v1/auth/login');
    expect(login!.body).toEqual({ email: EMAIL, password: PASSWORD });
    expect(login!.credentials).toBe('include');
    expect(api.called('POST /api/v1/auth/login/otp')[0]!.body).toEqual({
      challengeId: CHALLENGE.id,
      code: '123456',
      trustDevice: false,
    });
    // Nothing secret is kept in the browser or logged.
    const stored = JSON.stringify({ ...window.sessionStorage, ...window.localStorage });
    expect(stored).not.toContain(PASSWORD);
    expect(stored).not.toContain('123456');
    expect(log).not.toHaveBeenCalled();
  });

  it('a platform account lands in the Platform Control Center, never offered a trusted browser', async () => {
    const owner = identity({ platformRole: 'PLATFORM_OWNER', email: 'owner@pdabliss.test' });
    fakeApi({
      ...signedIn(owner),
      ...anonymous,
      'POST /api/v1/auth/login': otpRequired(false),
      'POST /api/v1/auth/login/otp': ok({ status: 'authenticated', identity: owner }),
      'GET /api/v1/platform/overview': ok({
        operator: {},
        users: {},
        companies: { customer: 0, demo: 0 },
        activeSessions: 1,
        attention: {
          readyToActivate: 0,
          onboardingIncomplete: 0,
          suspendedCompanies: 0,
          suspendedAccounts: 0,
          awaitingCompany: 0,
          unverifiedAccounts: 0,
        },
      }),
      'GET /api/v1/platform/companies': ok({ companies: [] }),
      'GET /api/v1/platform/users': ok({ users: [] }),
      'GET /api/v1/platform/audit': ok({ events: [] }),
      'GET /api/v1/platform/operators': ok({ operators: [] }),
    });
    const { router } = await open();
    await fill('owner@pdabliss.test', PASSWORD);
    await userEvent.keyboard('{Enter}');
    await screen.findByLabelText('รหัสยืนยัน 6 หลัก');
    expect(screen.queryByRole('checkbox', { name: /จดจำเบราว์เซอร์นี้/ })).toBeNull();
    await userEvent.type(screen.getByLabelText('รหัสยืนยัน 6 หลัก'), '654321');
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Platform Control Center' },
      { timeout: 4000 },
    );
    expect(router.state.location.pathname).toBe('/platform');
  });

  it('a trusted browser goes straight in, honouring a safe ?next=', async () => {
    fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': ok({ status: 'authenticated', identity: identity() }),
      'GET /api/v1/auth/sessions': ok({ sessions: [] }),
    });
    const { router } = await open('/login?next=%2Faccount');
    await fill(EMAIL, PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByRole('button', { name: /กำลังเข้าสู่ระบบ/ })).toBeDisabled();
    await waitFor(() =>
      expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'success'),
    );
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' }, { timeout: 4000 });
    expect(router.state.location.pathname).toBe('/account');
    expect(getIdentityState().status).toBe('ready');
  });

  it.each([
    'https%3A%2F%2Fevil.example',
    '%2F%2Fevil.example',
    '%2Fplatform',
    'javascript%3Aalert(1)',
  ])('ignores the unsafe or unauthorized next=%s', async (next) => {
    fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': ok({ status: 'authenticated', identity: identity() }),
      'GET /api/v1/auth/sessions': ok({ sessions: [] }),
    });
    const { router } = await open(`/login?next=${next}`);
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' }, { timeout: 4000 });
    expect(router.state.location.pathname).toBe('/account');
  });

  it('blocks a wrong password calmly: amber state, one generic message, focus back', async () => {
    fakeApi({ ...anonymous, 'POST /api/v1/auth/login': fail(401, 'INVALID_CREDENTIALS') });
    const { router } = await open();
    await fill(EMAIL, 'wrong password!');
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    const password = screen.getByLabelText('รหัสผ่าน');
    expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'fail');
    expect(document.querySelector('[data-status]')).toHaveTextContent('ยังเข้าไม่ได้');
    expect(password).toHaveFocus();
    expect(password).toHaveValue('');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.pathname).toBe('/login');
    // Typing again clears the failed state.
    await userEvent.type(password, 'x');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('[data-panel]')).toHaveAttribute('data-phase', 'pass');
  });

  it('offers a new verification link for an unverified account', async () => {
    const api = fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': fail(403, 'EMAIL_NOT_VERIFIED'),
      'POST /api/v1/auth/verification/resend': { status: 202, body: { status: 'accepted' } },
    });
    await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('ยังไม่ได้ยืนยันอีเมล');
    await userEvent.click(screen.getByRole('button', { name: 'ส่งลิงก์ยืนยันอีกครั้ง' }));
    expect(await screen.findByText(/ได้ส่งลิงก์ใหม่ไปแล้ว/)).toBeInTheDocument();
    expect(api.called('POST /api/v1/auth/verification/resend')[0]!.body).toEqual({ email: EMAIL });
  });

  it.each([
    [403, 'ACCOUNT_UNAVAILABLE', 'บัญชีนี้เข้าสู่ระบบไม่ได้'],
    [429, 'LOGIN_THROTTLED', 'ลองเข้าสู่ระบบหลายครั้งเกินไป'],
    [503, 'AUTH_UNAVAILABLE', 'ระบบบัญชียังไม่พร้อม'],
  ])('explains %s %s safely', async (status, code, text) => {
    fakeApi({ ...anonymous, 'POST /api/v1/auth/login': fail(status, code) });
    await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('reports an unreachable service', async () => {
    await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('เชื่อมต่อระบบไม่ได้');
  });

  it('an incorrect code says how many tries are left; a locked one offers to start again', async () => {
    let attempts = 0;
    fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': otpRequired(),
      'POST /api/v1/auth/login/otp': () =>
        ++attempts === 1
          ? fail(400, 'OTP_INCORRECT', { attemptsRemaining: 4 })
          : fail(429, 'OTP_LOCKED'),
    });
    await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    const code = await screen.findByLabelText('รหัสยืนยัน 6 หลัก');
    await userEvent.type(code, '111111');
    expect(await screen.findByRole('alert')).toHaveTextContent('เหลือโอกาสอีก 4 ครั้ง');
    expect(code).toHaveValue('');
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(code, '222222');
    expect(await screen.findByRole('alert')).toHaveTextContent('ใส่รหัสผิดหลายครั้งเกินไป');
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มใหม่' }));
    expect(await screen.findByLabelText('อีเมล')).toBeInTheDocument();
  });

  it('resend waits for its countdown', async () => {
    fakeApi({ ...anonymous, 'POST /api/v1/auth/login': otpRequired() });
    await open();
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('button', { name: /ส่งรหัสใหม่ได้ใน \d+ วินาที/ }),
    ).toBeDisabled();
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

  it('validates required fields and the email format before calling the API', async () => {
    const api = fakeApi(anonymous);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByText('กรุณากรอกอีเมล')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument();
    await fill('not-an-email', PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(await screen.findByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
    expect(api.called('POST /api/v1/auth/login')).toHaveLength(0);
  });

  it('moves instantly under reduced motion, with no idle pulses', async () => {
    const restore = withReducedMotion();
    fakeApi({
      ...anonymous,
      'POST /api/v1/auth/login': ok({ status: 'authenticated', identity: identity() }),
      'GET /api/v1/auth/sessions': ok({ sessions: [] }),
    });
    const { router } = await open();
    expect(document.querySelectorAll('animateMotion')).toHaveLength(0);
    await fill(EMAIL, PASSWORD);
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    expect(router.state.location.pathname).toBe('/account');
    restore();
  });

  it('runs a slow idle pulse when motion is allowed', async () => {
    await open();
    expect(document.querySelectorAll('[data-gateway="wide"] animateMotion')).toHaveLength(3);
  });

  it('sends an already signed-in visitor to their home', async () => {
    fakeApi(signedIn(identity()));
    const { router } = renderRoute('/login');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    expect(router.state.location.pathname).toBe('/account');
  });

  it('links to registration and password recovery in the visitor’s language', async () => {
    const { router } = await open('/en/login');
    expect(document.querySelector('[data-link="register"]')).toHaveAttribute('href', '/register');
    // EP23 QA: a 44 px target (it measured 20 px).
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveClass('min-h-11');
    await userEvent.click(screen.getByRole('link', { name: 'Forgot password?' }));
    await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    expect(router.state.location.pathname).toBe('/forgot-password');
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

  it('speaks the language an email link asks for (?lang=zh)', async () => {
    await open('/login?lang=zh');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('进入您的工作空间');
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

describe('credential boundary (EP23: the prototype credential is gone)', () => {
  const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const OLD_USER = ['user', '1'].join('');
  const OLD_PASS = ['pass', '1'].join('');

  it('no source file holds the old prototype account or a sign-in shortcut', () => {
    const holders = Object.entries(sources)
      .filter(([, text]) => text.includes(`'${OLD_PASS}'`) || text.includes(`'${OLD_USER}'`))
      .map(([path]) => path);
    expect(holders).toEqual([]);
    for (const [path, text] of Object.entries(sources)) {
      expect(text, path).not.toMatch(/DEMO_ACCOUNT|prototypeSignIn/);
    }
  });

  it('no copy or page shows a credential', async () => {
    for (const s of JSON.stringify(LOGIN_COPY).split('"')) {
      expect(s).not.toContain(OLD_PASS);
      expect(s).not.toMatch(/\.demo@pdabliss\.com/);
    }
    await open();
    expect(document.body.textContent).not.toContain(OLD_PASS);
    expect(document.body.textContent).not.toMatch(/\.demo@pdabliss\.com/);
  });
});
