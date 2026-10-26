import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fail, fakeApi, identity, ok, signedIn, signedOut } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import { destinationFor, safeNext } from './session';

/*
 * EP23 account screens against a fake API: register, verify email,
 * forgot/reset password, Account Portal, Platform Control Center and the
 * invitation page. Server rules themselves are tested in backend/test.
 */

const PASSWORD = 'a long and memorable phrase';
const TOKEN = 'tok_'.padEnd(43, 'x');

const noindex = () =>
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

describe('register', () => {
  it('validates before sending, then shows "check your email"', async () => {
    const api = fakeApi({
      'POST /api/v1/auth/register': { status: 202, body: { status: 'verification_sent' } },
      'POST /api/v1/auth/verification/resend': { status: 202, body: { status: 'accepted' } },
    });
    renderRoute('/register?plan=business');
    await screen.findByRole('heading', { level: 1, name: 'เริ่มต้นกับ PDA BLISS CORE' });
    noindex();
    expect(document.querySelector('[data-plan="business"]')).toHaveTextContent('Business');

    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));
    expect(screen.getByLabelText('อีเมล')).toHaveFocus();
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('กรุณายอมรับข้อกำหนดเพื่อสมัครใช้งาน')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('อีเมล'), 'new.person@example.com');
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'short');
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), 'different');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));
    expect(screen.getByText('รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร')).toBeInTheDocument();
    expect(screen.getByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
    expect(api.called('POST /api/v1/auth/register')).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText('รหัสผ่าน'));
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), PASSWORD);
    await userEvent.clear(screen.getByLabelText('ยืนยันรหัสผ่าน'));
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'ตรวจสอบอีเมลของคุณ' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('new.person@example.com');
    const [call] = api.called('POST /api/v1/auth/register');
    // Exactly the allowed fields — never a role.
    expect(call!.body).toEqual({
      email: 'new.person@example.com',
      password: PASSWORD,
      locale: 'th',
      plan: 'business',
      acceptTerms: true,
    });
    expect(screen.getByRole('button', { name: /ส่งอีกครั้งได้ใน/ })).toBeDisabled();
  });

  it('ignores an unknown plan value and speaks English when asked', async () => {
    renderRoute('/en/register?plan=free');
    await screen.findByRole('heading', { level: 1, name: 'Get started with PDA BLISS CORE' });
    expect(document.querySelector('[data-plan]')).toBeNull();
  });

  it('shows the server password rule when it refuses', async () => {
    fakeApi({
      'POST /api/v1/auth/register': fail(400, 'PASSWORD_POLICY', { problem: 'too_common' }),
    });
    renderRoute('/register');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.type(screen.getByLabelText('อีเมล'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), '1234567890');
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), '1234567890');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('เดาง่ายเกินไป');
  });
});

describe('verify email', () => {
  it('verifies the token from the link fragment, then removes it from the address', async () => {
    const api = fakeApi({ 'POST /api/v1/auth/verify-email': ok({ status: 'verified' }) });
    window.history.replaceState(null, '', `/verify-email#token=${TOKEN}`);
    renderRoute(`/verify-email#token=${TOKEN}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ยืนยันอีเมลเรียบร้อย' }),
    ).toBeInTheDocument();
    noindex();
    expect(api.called('POST /api/v1/auth/verify-email')).toHaveLength(1);
    expect(api.called('POST /api/v1/auth/verify-email')[0]!.body).toEqual({ token: TOKEN });
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute('href', '/login');
  });

  it.each([
    [fail(410, 'TOKEN_EXPIRED'), 'ลิงก์หมดอายุแล้ว'],
    [fail(410, 'TOKEN_USED'), 'ลิงก์นี้ถูกใช้ไปแล้ว'],
    [fail(400, 'TOKEN_INVALID'), 'ลิงก์ไม่ถูกต้อง'],
    [ok({ status: 'already_verified' }), 'อีเมลนี้ยืนยันไว้แล้ว'],
  ])('handles %j', async (reply, title) => {
    fakeApi({
      'POST /api/v1/auth/verify-email': reply,
      'POST /api/v1/auth/verification/resend': { status: 202, body: { status: 'accepted' } },
    });
    window.history.replaceState(null, '', `/verify-email#token=${TOKEN}`);
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('without a token, offers a new link with a generic answer', async () => {
    const api = fakeApi({
      'POST /api/v1/auth/verification/resend': { status: 202, body: { status: 'accepted' } },
    });
    window.history.replaceState(null, '', '/verify-email');
    renderRoute('/verify-email');
    await screen.findByRole('heading', { level: 1, name: 'ตรวจสอบอีเมลของคุณ' });
    await userEvent.type(screen.getByLabelText('อีเมล'), 'who@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'ส่งลิงก์ยืนยันใหม่' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ถ้าบัญชีนี้ยังไม่ได้ยืนยัน');
    expect(api.called('POST /api/v1/auth/verification/resend')[0]!.body).toEqual({
      email: 'who@example.com',
    });
  });
});

describe('forgot and reset password', () => {
  it('forgot: one generic confirmation', async () => {
    fakeApi({ 'POST /api/v1/auth/password/forgot': { status: 202, body: { status: 'accepted' } } });
    renderRoute('/forgot-password');
    await screen.findByRole('heading', { level: 1, name: 'ตั้งรหัสผ่านใหม่' });
    noindex();
    await userEvent.type(screen.getByLabelText('อีเมล'), 'who@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่าน' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ถ้ามีบัญชีสำหรับอีเมลนี้');
  });

  it('reset: checks the link, sets the new password, and says every device was signed out', async () => {
    const api = fakeApi({
      'POST /api/v1/auth/password/reset/check': ok({ status: 'valid' }),
      'POST /api/v1/auth/password/reset': ok({ status: 'password_reset' }),
    });
    window.history.replaceState(null, '', `/reset-password#token=${TOKEN}`);
    renderRoute('/reset-password');
    await screen.findByRole('heading', { level: 1, name: 'เลือกรหัสผ่านใหม่' });
    expect(window.location.hash).toBe('');
    await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), PASSWORD);
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'เปลี่ยนรหัสผ่านเรียบร้อย' }),
    ).toBeInTheDocument();
    expect(api.called('POST /api/v1/auth/password/reset')[0]!.body).toEqual({
      token: TOKEN,
      password: PASSWORD,
    });
  });

  it.each([
    ['TOKEN_EXPIRED', 'ลิงก์หมดอายุแล้ว'],
    ['TOKEN_USED', 'ลิงก์นี้ถูกใช้ไปแล้ว'],
  ])('reset: %s offers a new link', async (code, title) => {
    fakeApi({ 'POST /api/v1/auth/password/reset/check': fail(410, code) });
    window.history.replaceState(null, '', `/reset-password#token=${TOKEN}`);
    renderRoute('/reset-password');
    await screen.findByRole('heading', { level: 1, name: title });
    expect(screen.getByRole('link', { name: 'ขอลิงก์ใหม่' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('Account Portal', () => {
  it('requires a session: anonymous visitors go to sign-in with next=/account', async () => {
    fakeApi(signedOut);
    const { router } = renderRoute('/account');
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่พื้นที่ทำงานของคุณ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Faccount');
  });

  it('shows the honest onboarding state for a new customer — no fake subscription', async () => {
    fakeApi(signedIn(identity({ planIntent: 'business' })));
    renderRoute('/account');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    noindex();
    const onboarding = document.querySelector('[data-onboarding="onboarding_required"]')!;
    expect(onboarding).toHaveTextContent('ยืนยันบัญชีแล้ว');
    expect(onboarding).toHaveTextContent('ยังไม่ได้ตั้งค่าบริษัท');
    expect(onboarding).toHaveTextContent('เลือกแพ็กเกจเพื่อไปต่อ');
    expect(screen.getByText(/คุณเลือกแพ็กเกจ Business/)).toBeInTheDocument();
    expect(screen.getByText(/ยังไม่มีการเรียกเก็บเงินหรือสมาชิกภาพ/)).toBeInTheDocument();
    expect(screen.queryByText('Platform Control Center')).toBeNull();
    // Devices, with this one marked.
    const list = await waitFor(() => {
      const el = document.querySelector('[data-sessions]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(list).toHaveTextContent('Chrome · Windows');
    expect(list).toHaveTextContent('อุปกรณ์นี้');
  });

  it('shows a demo company owner their company, labelled as demo', async () => {
    fakeApi(
      signedIn(
        identity({
          company: {
            id: 'c1',
            name: 'PDA BLISS CORE DEMO COMPANY',
            isDemo: true,
            role: 'COMPANY_OWNER',
          },
        }),
      ),
    );
    renderRoute('/account');
    const company = await screen.findByText('PDA BLISS CORE DEMO COMPANY');
    const panel = company.closest('[data-onboarding="company_ready"]')!;
    expect(panel).toHaveTextContent('บริษัทสาธิต — ไม่ใช่ลูกค้าจริง');
    expect(panel).toHaveTextContent('เจ้าของบริษัท');
  });

  it('a platform operator is sent from /account to /platform', async () => {
    fakeApi({
      ...signedIn(identity({ platformRole: 'PLATFORM_ADMIN' })),
      'GET /api/v1/platform/overview': ok({
        operator: {},
        users: {},
        companies: { customer: 0, demo: 0 },
        activeSessions: 0,
      }),
      'GET /api/v1/platform/companies': ok({ companies: [] }),
      'GET /api/v1/platform/users': ok({ users: [] }),
      'GET /api/v1/platform/audit': ok({ events: [] }),
    });
    const { router } = renderRoute('/account');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    expect(router.state.location.pathname).toBe('/platform');
  });

  it('signs out of every device and returns to sign-in', async () => {
    const api = fakeApi(signedIn(identity()));
    const { router } = renderRoute('/account');
    await userEvent.click(await screen.findByRole('button', { name: 'ออกจากระบบทุกอุปกรณ์' }));
    await screen.findByRole('heading', { level: 1, name: 'เข้าสู่พื้นที่ทำงานของคุณ' });
    expect(router.state.location.pathname).toBe('/login');
    expect(api.called('POST /api/v1/auth/logout-all')).toHaveLength(1);
  });
});

describe('Platform Control Center', () => {
  const platformData = {
    'GET /api/v1/platform/overview': ok({
      operator: {},
      users: { ACTIVE: 7, PENDING_VERIFICATION: 2 },
      companies: { customer: 0, demo: 1 },
      activeSessions: 3,
    }),
    'GET /api/v1/platform/companies': ok({
      companies: [
        {
          id: 'c1',
          name: 'PDA BLISS CORE DEMO COMPANY',
          isDemo: true,
          members: 4,
          departments: 6,
          createdAt: '2026-10-26T03:00:00.000Z',
        },
      ],
    }),
    'GET /api/v1/platform/users': ok({ users: [] }),
    'GET /api/v1/platform/audit': ok({
      events: [
        {
          id: 'e1',
          type: 'LOGIN_SUCCESS',
          email: 'owner@pdabliss.test',
          ipAddress: null,
          occurredAt: '2026-10-26T03:00:00.000Z',
        },
      ],
    }),
    'GET /api/v1/platform/operators': ok({
      operators: [
        {
          userId: 'u1',
          email: 'owner@pdabliss.test',
          displayName: null,
          status: 'ACTIVE',
          role: 'PLATFORM_OWNER',
          since: '2026-10-26T03:00:00.000Z',
        },
        {
          userId: 'u2',
          email: 'platform.admin@pdabliss.com',
          displayName: null,
          status: 'ACTIVE',
          role: 'PLATFORM_ADMIN',
          since: '2026-10-26T03:00:00.000Z',
        },
      ],
    }),
  };

  it('PLATFORM_OWNER: highest role, owner-only operator area, real data, honest placeholders', async () => {
    const api = fakeApi({
      ...signedIn(identity({ platformRole: 'PLATFORM_OWNER', email: 'owner@pdabliss.test' })),
      ...platformData,
    });
    renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    noindex();
    expect(document.querySelector('[data-platform-role="PLATFORM_OWNER"]')).toHaveTextContent(
      'สิทธิ์สูงสุดของแพลตฟอร์ม',
    );
    expect(screen.getByText(/ไม่ใช่ Company Control Center/)).toBeInTheDocument();
    const owners = await waitFor(() => {
      const el = document.querySelector('[data-owner-only]');
      expect(el).toHaveTextContent('platform.admin@pdabliss.com');
      return el!;
    });
    expect(owners).toHaveTextContent('Platform Owner');
    expect(screen.getByText('PDA BLISS CORE DEMO COMPANY')).toBeInTheDocument();
    expect(screen.getByText('LOGIN_SUCCESS')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-placeholder]')).toHaveLength(2);
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(1);
  });

  it('PLATFORM_ADMIN: reduced center — no owner-only area, no owner-only request', async () => {
    const api = fakeApi({
      ...signedIn(identity({ platformRole: 'PLATFORM_ADMIN' })),
      ...platformData,
    });
    renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'Platform Control Center' });
    expect(document.querySelector('[data-platform-role="PLATFORM_ADMIN"]')).toHaveTextContent(
      'ต่ำกว่า Platform Owner',
    );
    await screen.findByText('PDA BLISS CORE DEMO COMPANY');
    expect(document.querySelector('[data-owner-only]')).toBeNull();
    expect(screen.queryByText('Platform Owner และ Platform Admin')).toBeNull();
    expect(api.called('GET /api/v1/platform/operators')).toHaveLength(0);
  });

  it('a customer account is sent from /platform to /account', async () => {
    fakeApi(signedIn(identity()));
    const { router } = renderRoute('/platform');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    expect(router.state.location.pathname).toBe('/account');
  });
});

describe('invitation acceptance', () => {
  it('keeps the token through sign-in, then accepts it for the signed-in account', async () => {
    const api = fakeApi({
      ...signedIn(identity({ email: 'new.hire@example.com' })),
      'POST /api/v1/auth/invitations/accept': ok({
        status: 'accepted',
        company: { id: 'c1', name: 'Invite Co' },
        role: 'DEPARTMENT_STAFF',
      }),
    });
    window.history.replaceState(null, '', `/account/invitation#token=${TOKEN}`);
    renderRoute('/account/invitation');
    const panel = (
      await screen.findByRole('heading', { level: 2, name: 'คำเชิญเข้าร่วมบริษัท' })
    ).closest('section')!;
    expect(window.location.hash).toBe('');
    await userEvent.click(within(panel).getByRole('button', { name: 'ยอมรับคำเชิญ' }));
    expect(await within(panel).findByRole('status')).toHaveTextContent(
      'คุณเข้าร่วม Invite Co แล้ว',
    );
    expect(api.called('POST /api/v1/auth/invitations/accept')[0]!.body).toEqual({ token: TOKEN });
  });
});

describe('post-sign-in destinations', () => {
  const customer = identity();
  const owner = identity({ platformRole: 'PLATFORM_OWNER' });

  it.each([
    ['/account', '/account'],
    ['/account/invitation', '/account/invitation'],
    ['/app/warehouse', '/app/warehouse'],
    ['https://evil.example', null],
    ['//evil.example', null],
    ['/account/../platform', null],
    ['/ACCOUNT', null],
    ['/login', null],
    ['/account?x=1', null],
  ])('safeNext(%s) → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it('never sends a customer into /platform, nor an operator into /account', () => {
    expect(destinationFor(customer, '/platform')).toBe('/account');
    expect(destinationFor(customer, null)).toBe('/account');
    expect(destinationFor(owner, '/account')).toBe('/platform');
    expect(destinationFor(owner, null)).toBe('/platform');
  });
});
