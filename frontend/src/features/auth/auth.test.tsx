import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DEMO_COMPANY,
  DEMO_ONBOARDING,
  fail,
  fakeApi,
  identity,
  ok,
  signedIn,
  signedOut,
} from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import { destinationFor, safeNext, withPlan } from './session';

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
  /** Step 1 with valid values (labels carry a visible "*" and a hidden "(required)"). */
  async function fillAccount(overrides: { password?: string; confirm?: string } = {}) {
    await userEvent.type(screen.getByLabelText(/^ชื่อ-นามสกุล/), 'สมชาย ใจดี');
    await userEvent.type(screen.getByLabelText(/^เบอร์โทรศัพท์/), '081-234-5678');
    await userEvent.type(screen.getByLabelText(/^อีเมล/), 'new.person@example.com');
    await userEvent.type(screen.getByLabelText(/^รหัสผ่าน\*/), overrides.password ?? PASSWORD);
    await userEvent.type(screen.getByLabelText(/^ยืนยันรหัสผ่าน/), overrides.confirm ?? PASSWORD);
  }

  it('step 1 validates the person and the sign-in details before moving on', async () => {
    const api = fakeApi({});
    renderRoute('/register?plan=business');
    await screen.findByRole('heading', { level: 1, name: 'เริ่มต้นกับ PDA BLISS CORE' });
    noindex();
    expect(document.querySelector('[data-plan="business"]')).toHaveTextContent('Business');
    expect(document.querySelector('[data-steps="1"]')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /ไปต่อ/ }));
    expect(screen.getByLabelText(/^ชื่อ-นามสกุล/)).toHaveFocus();
    await waitFor(() =>
      expect(screen.getByLabelText(/^ชื่อ-นามสกุล/)).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByText('กรุณากรอกชื่อ-นามสกุล')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกเบอร์โทรศัพท์')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกอีเมล')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^ชื่อ-นามสกุล/), 'สมชาย ใจดี');
    await userEvent.type(screen.getByLabelText(/^เบอร์โทรศัพท์/), '12345');
    await userEvent.type(screen.getByLabelText(/^อีเมล/), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/^รหัสผ่าน\*/), 'short');
    await userEvent.type(screen.getByLabelText(/^ยืนยันรหัสผ่าน/), 'different');
    await userEvent.click(screen.getByRole('button', { name: /ไปต่อ/ }));
    expect(screen.getByLabelText(/^เบอร์โทรศัพท์/)).toHaveFocus();
    expect(screen.getByText(/เบอร์โทรศัพท์ไม่ถูกต้อง/)).toBeInTheDocument();
    expect(screen.getByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
    expect(screen.getByText('รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร')).toBeInTheDocument();
    expect(screen.getByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
    // The live rules say which ones are not met yet.
    expect(document.querySelector('[data-rule="length"]')).toHaveAttribute('data-met', 'false');
    expect(document.querySelector('[data-rule="match"]')).toHaveAttribute('data-met', 'false');
    expect(document.querySelector('[data-register-step="1"]')).toBeInTheDocument();
    expect(api.called('POST /api/v1/auth/register')).toHaveLength(0);
    // Many real interaction steps: more than the default budget under a parallel run.
  }, 20_000);

  it('step 2 collects the business context, then sends ONE request and shows "check your email"', async () => {
    const api = fakeApi({
      'POST /api/v1/auth/register': { status: 202, body: { status: 'verification_sent' } },
      'POST /api/v1/auth/verification/resend': { status: 202, body: { status: 'accepted' } },
    });
    renderRoute('/register?plan=business');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.selectOptions(screen.getByLabelText(/^บทบาทในบริษัท/), 'ACCOUNTING');
    await fillAccount();
    await userEvent.click(screen.getByRole('button', { name: /ไปต่อ/ }));

    // Step 2: focus starts at its heading; Back keeps what was typed.
    const heading = await screen.findByRole('heading', { level: 2, name: /ธุรกิจของคุณ/ });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/ยังไม่ใช่การสร้างบริษัทใน CORE/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
    expect(screen.getByLabelText(/^อีเมล/)).toHaveValue('new.person@example.com');
    await userEvent.click(screen.getByRole('button', { name: /ไปต่อ/ }));
    await screen.findByRole('heading', { level: 2, name: /ธุรกิจของคุณ/ });

    // Required business basics and the terms.
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));
    expect(screen.getByLabelText(/^ชื่อบริษัทหรือองค์กร/)).toHaveFocus();
    expect(screen.getByText('กรุณาเลือกประเภทธุรกิจ')).toBeInTheDocument();
    expect(screen.getByText('กรุณาเลือกขนาดทีม')).toBeInTheDocument();
    expect(screen.getByText('กรุณายอมรับข้อกำหนดเพื่อสมัครใช้งาน')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^ชื่อบริษัทหรือองค์กร/), 'บริษัท สยามเทรด จำกัด');
    await userEvent.selectOptions(screen.getByLabelText(/^ประเภทธุรกิจ/), 'DISTRIBUTION');
    await userEvent.selectOptions(screen.getByLabelText(/^ขนาดทีม/), 'SIZE_51_200');
    // LINE needs an ID.
    await userEvent.click(screen.getByRole('radio', { name: 'LINE' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'คลังสินค้า' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'จัดซื้อ' }));
    await userEvent.type(screen.getByLabelText(/^ความต้องการ/), 'สต็อกไม่ตรงกับบัญชี');
    await userEvent.click(screen.getByRole('checkbox', { name: /ฉันยอมรับ/ }));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));
    expect(screen.getByLabelText(/^LINE ID/)).toHaveFocus();
    await userEvent.type(screen.getByLabelText(/^LINE ID/), '@siamtrade');
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบัญชี' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'ตรวจสอบอีเมลของคุณ' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('new.person@example.com');
    const calls = api.called('POST /api/v1/auth/register');
    expect(calls).toHaveLength(1);
    // Exactly the allowed fields — never a role, a company id or a status.
    expect(calls[0]!.body).toEqual({
      fullName: 'สมชาย ใจดี',
      phone: '081-234-5678',
      jobFunction: 'ACCOUNTING',
      email: 'new.person@example.com',
      password: PASSWORD,
      business: {
        companyName: 'บริษัท สยามเทรด จำกัด',
        industry: 'DISTRIBUTION',
        teamSize: 'SIZE_51_200',
        preferredContact: 'LINE',
        lineId: '@siamtrade',
        interests: ['WAREHOUSE', 'PURCHASING'],
        note: 'สต็อกไม่ตรงกับบัญชี',
      },
      locale: 'th',
      plan: 'business',
      acceptTerms: true,
    });
    expect(screen.getByRole('button', { name: /ส่งอีกครั้งได้ใน/ })).toBeDisabled();
    // ~30 real keystroke / click steps: more than the default budget under a parallel run.
  }, 20_000);

  it('ignores an unknown plan value and speaks English (and Chinese) when asked', async () => {
    renderRoute('/en/register?plan=free');
    await screen.findByRole('heading', { level: 1, name: 'Get started with PDA BLISS CORE' });
    expect(document.querySelector('[data-plan]')).toBeNull();
    expect(screen.getByLabelText(/^Full name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Phone number/)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('shows the server password rule when it refuses', async () => {
    fakeApi({
      'POST /api/v1/auth/register': fail(400, 'PASSWORD_POLICY', { problem: 'too_common' }),
    });
    renderRoute('/register');
    await screen.findByRole('heading', { level: 1 });
    await fillAccount({ password: '1234567890', confirm: '1234567890' });
    await userEvent.click(screen.getByRole('button', { name: /ไปต่อ/ }));
    await screen.findByRole('heading', { level: 2, name: /ธุรกิจของคุณ/ });
    await userEvent.type(screen.getByLabelText(/^ชื่อบริษัทหรือองค์กร/), 'ACME');
    await userEvent.selectOptions(screen.getByLabelText(/^ประเภทธุรกิจ/), 'OTHER');
    await userEvent.selectOptions(screen.getByLabelText(/^ขนาดทีม/), 'SIZE_1_10');
    await userEvent.click(screen.getByRole('checkbox', { name: /ฉันยอมรับ/ }));
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
    fakeApi({
      ...signedIn(identity()),
      'GET /api/v1/account/onboarding': ok({
        stage: 'NEEDS_PACKAGE',
        selectedPlan: null,
        company: null,
        canEnterCore: false,
      }),
    });
    renderRoute('/account');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    noindex();
    // EP24: the onboarding progress, the package step, and no charge.
    const progress = await screen.findByRole('navigation', { name: 'ขั้นตอนการเริ่มใช้งาน' });
    expect(within(progress).getByText('ยืนยันบัญชีแล้ว')).toBeInTheDocument();
    expect(within(progress).getByText('เลือกแพ็กเกจ').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('การเลือกแพ็กเกจยังไม่มีการเรียกเก็บเงิน')).toBeInTheDocument();
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

  it('starts keyboard focus at the page content once signed in (EP23 QA)', async () => {
    fakeApi(signedIn(identity()));
    renderRoute('/account');
    await screen.findByRole('heading', { level: 1, name: 'บัญชีของคุณ' });
    // Focus was on <body> after the sign-in page went away; now it is on <main>.
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus());
  });

  it('shows a demo company owner their company, labelled as demo', async () => {
    fakeApi({
      ...signedIn(
        identity({
          company: {
            id: 'c1',
            name: 'PDA BLISS CORE DEMO COMPANY',
            isDemo: true,
            role: 'COMPANY_OWNER',
          },
        }),
      ),
      'GET /api/v1/account/onboarding': ok(DEMO_ONBOARDING),
      'GET /api/v1/company/current': ok(DEMO_COMPANY),
    });
    renderRoute('/account');
    const company = await screen.findByText('PDA BLISS CORE DEMO COMPANY');
    const panel = company.closest('section')!;
    expect(panel).toHaveTextContent('บริษัทสาธิต — ข้อมูลตัวอย่าง ไม่ใช่ลูกค้าจริง');
    expect(panel).toHaveTextContent('เจ้าของบริษัท');
    // Professional demo entitlement, all six departments, no payment history.
    expect(document.querySelector('[data-subscription-plan]')).toHaveAttribute(
      'data-subscription-plan',
      'PROFESSIONAL',
    );
    expect(document.querySelectorAll('[data-company-departments] > span')).toHaveLength(6);
    expect(document.querySelector('[data-company-message]')).toHaveTextContent(
      'ไม่มีประวัติการชำระเงิน',
    );
    expect(document.body).not.toHaveTextContent(/ชำระเงินแล้ว|payment complete/i);
  });

  it('a platform operator is sent from /account to /platform', async () => {
    fakeApi({
      ...signedIn(identity({ platformRole: 'PLATFORM_ADMIN' })),
      'GET /api/v1/platform/overview': ok({
        operator: {},
        users: {},
        companies: { customer: 0, demo: 0 },
        activeSessions: 0,
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

  it('carries a known plan onto /account only (EP24)', () => {
    expect(withPlan('/account', 'business')).toBe('/account?plan=business');
    expect(withPlan('/account', 'free')).toBe('/account');
    expect(withPlan('/account', null)).toBe('/account');
    expect(withPlan('/platform', 'business')).toBe('/platform');
    expect(withPlan('/app/warehouse', 'business')).toBe('/app/warehouse');
  });

  it('a signed-in customer arriving at /login?plan=business lands on the package step with it chosen', async () => {
    fakeApi({
      ...signedIn(identity()),
      'GET /api/v1/account/onboarding': ok({
        stage: 'NEEDS_PACKAGE',
        selectedPlan: null,
        company: null,
        canEnterCore: false,
      }),
    });
    const { router } = renderRoute('/login?plan=business');
    await screen.findByRole('heading', { name: 'เลือกแพ็กเกจ' });
    expect(router.state.location.pathname).toBe('/account');
    expect(router.state.location.search).toBe('?plan=business');
    expect(screen.getByRole('radio', { name: /Business/ })).toBeChecked();
  });

  it('never sends a customer into /platform, nor an operator into /account', () => {
    expect(destinationFor(customer, '/platform')).toBe('/account');
    expect(destinationFor(customer, null)).toBe('/account');
    expect(destinationFor(owner, '/account')).toBe('/platform');
    expect(destinationFor(owner, null)).toBe('/platform');
  });
});
