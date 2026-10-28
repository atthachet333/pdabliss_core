import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fail, fakeApi, identity, ok, signedIn, type Reply } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { CompanyInfo, Onboarding, PlanCode } from './api';

/*
 * EP24 onboarding in the Account Portal and the platform company list, against
 * a fake API that keeps state like the server does. The server rules
 * themselves are tested in backend/test/company.test.ts.
 */

function pendingCompany(plan: PlanCode, departments: string[]): CompanyInfo {
  return {
    company: {
      id: 'c9',
      displayName: 'ตัวอย่าง',
      legalName: 'บริษัท ตัวอย่าง จำกัด',
      taxId: null,
      registrationNumber: null,
      status: 'PENDING_SUBSCRIPTION',
      onboardingStatus: 'COMPLETED',
      isDemo: false,
      createdAt: '2026-10-26T03:00:00.000Z',
      activatedAt: null,
    },
    role: 'COMPANY_OWNER',
    headOffice: {
      id: 'b9',
      code: '00000',
      name: 'สำนักงานใหญ่',
      type: 'HEAD_OFFICE',
      status: 'ACTIVE',
      address: {
        line1: '1 ถนนตัวอย่าง',
        line2: null,
        subdistrict: null,
        district: null,
        province: 'นนทบุรี',
        postalCode: '11000',
        countryCode: 'TH',
      },
      phone: null,
    },
    departments: departments as CompanyInfo['departments'],
    subscription: {
      id: 's9',
      plan,
      status: 'PENDING',
      billingCycle: 'MONTHLY',
      monthlyPriceThb: plan === 'STARTER' ? 399 : 699,
      catalogVersion: 1,
      createdAt: '2026-10-26T03:00:00.000Z',
      activatedAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    entitlements: {
      plan,
      catalogVersion: 1,
      maxDepartments: plan === 'STARTER' ? 2 : 4,
      executiveAllowed: plan !== 'STARTER',
      storage: { gb: plan === 'STARTER' ? 3 : 10 },
      api: plan === 'STARTER' ? 'NONE' : 'ADD_ON',
      allBranchesIncluded: true,
      warehouseLotExpiryFefo: 'INCLUDED_WITH_WAREHOUSE',
    },
    access: { canEnterCore: false },
  };
}

/** A fake server: package selection and company creation advance the onboarding stage. */
function onboardingServer(
  start: { plan?: PlanCode | null; createReply?: (body: unknown) => Reply } = {},
) {
  let plan: PlanCode | null = start.plan ?? null;
  let company: CompanyInfo | null = null;
  const onboarding = (): Onboarding =>
    company
      ? {
          stage: 'PENDING_ACTIVATION',
          selectedPlan: null,
          company: { id: 'c9', displayName: 'ตัวอย่าง', isDemo: false, role: 'COMPANY_OWNER' },
          canEnterCore: false,
        }
      : {
          stage: plan ? 'NEEDS_COMPANY' : 'NEEDS_PACKAGE',
          selectedPlan: plan,
          company: null,
          canEnterCore: false,
        };
  return fakeApi({
    ...signedIn(identity()),
    'GET /api/v1/account/onboarding': () => ok(onboarding()),
    'POST /api/v1/account/package': (body) => {
      plan = (body as { plan: PlanCode }).plan;
      return ok({ selectedPlan: plan });
    },
    'POST /api/v1/company/onboarding': (body) => {
      if (start.createReply) return start.createReply(body);
      company = pendingCompany(plan!, (body as { departments: string[] }).departments);
      return { status: 201, body: company };
    },
    'GET /api/v1/company/current': () => (company ? ok(company) : fail(404, 'NOT_FOUND')),
  });
}

async function fillCompany() {
  await userEvent.type(screen.getByLabelText(/ชื่อนิติบุคคล/), 'บริษัท ตัวอย่าง จำกัด');
  await userEvent.type(screen.getByLabelText(/ชื่อที่ใช้แสดงใน CORE/), 'ตัวอย่าง');
  await userEvent.type(screen.getByLabelText(/^ที่อยู่$/), '1 ถนนตัวอย่าง');
  await userEvent.type(screen.getByLabelText(/^จังหวัด/), 'นนทบุรี');
  await userEvent.type(screen.getByLabelText(/^รหัสไปรษณีย์/), '11000');
}

describe('package selection', () => {
  it('carries the plan from the pricing page and saves the API plan code', async () => {
    const api = onboardingServer();
    renderRoute('/account?plan=professional');
    const step = (await screen.findByRole('heading', { name: 'เลือกแพ็กเกจ' })).closest('section')!;
    expect(within(step).getByText(/เลือก Professional ไว้จากหน้าราคา/)).toBeInTheDocument();
    expect(within(step).getByRole('radio', { name: /Professional/ })).toBeChecked();
    // Prices are the frozen public values.
    expect(step).toHaveTextContent('฿399 / เดือน');
    expect(step).toHaveTextContent('฿699 / เดือน');
    expect(step).toHaveTextContent('฿999 / เดือน');
    expect(step).toHaveTextContent('ราคาตามใบเสนอราคา');
    await userEvent.click(within(step).getByRole('button', { name: 'เลือกแพ็กเกจนี้' }));
    expect(api.called('POST /api/v1/account/package')[0]!.body).toEqual({ plan: 'PROFESSIONAL' });
    // Next: the company form with the chosen package.
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    expect(document.querySelector('[data-chosen-plan]')).toHaveAttribute(
      'data-chosen-plan',
      'PROFESSIONAL',
    );
  });

  it('offers a pricing-page plan once when it differs from the saved one', async () => {
    const api = onboardingServer({ plan: 'BUSINESS' });
    renderRoute('/account?plan=professional');
    const step = (await screen.findByRole('heading', { name: 'เลือกแพ็กเกจ' })).closest('section')!;
    expect(within(step).getByRole('radio', { name: /Professional/ })).toBeChecked();
    // Keeping the saved plan is a choice too: the form follows, no loop back.
    await userEvent.click(within(step).getByRole('radio', { name: /Business/ }));
    await userEvent.click(within(step).getByRole('button', { name: 'เลือกแพ็กเกจนี้' }));
    expect(api.called('POST /api/v1/account/package')[0]!.body).toEqual({ plan: 'BUSINESS' });
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    expect(document.querySelector('[data-chosen-plan]')).toHaveAttribute(
      'data-chosen-plan',
      'BUSINESS',
    );
  });

  it('a pricing-page plan equal to the saved one goes straight to the company form', async () => {
    onboardingServer({ plan: 'BUSINESS' });
    renderRoute('/account?plan=business');
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    expect(screen.queryByRole('heading', { name: 'เลือกแพ็กเกจ' })).not.toBeInTheDocument();
  });

  it('Enterprise explains the quotation path instead of a checkout', async () => {
    onboardingServer();
    renderRoute('/account');
    const step = (await screen.findByRole('heading', { name: 'เลือกแพ็กเกจ' })).closest('section')!;
    await userEvent.click(within(step).getByRole('radio', { name: /Enterprise/ }));
    expect(document.querySelector('[data-enterprise-note]')).toHaveTextContent('ใบเสนอราคา');
    expect(within(step).getByRole('link', { name: 'คุยกับทีม PDA BLISS' })).toHaveAttribute(
      'href',
      '/consultation?topic=enterprise&plan=enterprise',
    );
  });

  it('speaks English and Chinese', async () => {
    onboardingServer();
    renderRoute('/account?lang=en');
    expect(await screen.findByRole('heading', { name: 'Choose a package' })).toBeInTheDocument();
    expect(screen.getByText('Choosing a package does not charge anything')).toBeInTheDocument();
  });

  it('speaks Simplified Chinese', async () => {
    onboardingServer({ plan: 'STARTER' });
    renderRoute('/account?lang=zh');
    expect(await screen.findByRole('heading', { name: '创建您的公司' })).toBeInTheDocument();
    expect(screen.getByText(/创建公司不会产生任何费用/)).toBeInTheDocument();
  });
});

describe('company form', () => {
  it('Starter: Executive is not offered and two departments are the limit', async () => {
    onboardingServer({ plan: 'STARTER' });
    renderRoute('/account');
    const form = (await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' })).closest(
      'section',
    )!;
    const group = within(form).getByRole('group', { name: 'แผนกที่จะใช้' });
    expect(within(group).getByRole('checkbox', { name: /ผู้บริหาร/ })).toBeDisabled();
    expect(group).toHaveTextContent('ไม่รวมในแพ็กเกจนี้');
    await userEvent.click(within(group).getByRole('checkbox', { name: 'ฝ่ายขาย' }));
    await userEvent.click(within(group).getByRole('checkbox', { name: 'คลังสินค้า' }));
    expect(within(group).getByRole('checkbox', { name: 'จัดซื้อ' })).toBeDisabled();
    expect(within(group).getByRole('status')).toHaveTextContent('ครบจำนวนแผนกของแพ็กเกจแล้ว');
  });

  it('validates, focuses the first problem, then creates a pending company — never claiming payment', async () => {
    const api = onboardingServer({ plan: 'STARTER' });
    renderRoute('/account');
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบริษัท' }));
    expect(screen.getByLabelText(/ชื่อนิติบุคคล/)).toHaveFocus();
    expect(screen.getByLabelText(/ชื่อนิติบุคคล/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('ตรวจสอบช่องที่ทำเครื่องหมายไว้');
    expect(api.called('POST /api/v1/company/onboarding')).toHaveLength(0);

    await fillCompany();
    await userEvent.type(screen.getByLabelText(/เลขประจำตัวผู้เสียภาษี/), '0105536000012');
    await userEvent.click(screen.getByRole('checkbox', { name: 'คลังสินค้า' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ฝ่ายขาย' }));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบริษัท' }));
    expect(screen.getByLabelText(/เลขประจำตัวผู้เสียภาษี/)).toHaveFocus();
    expect(screen.getByText('เลขผู้เสียภาษีไม่ถูกต้อง (13 หลัก)')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/เลขประจำตัวผู้เสียภาษี/));
    await userEvent.type(screen.getByLabelText(/เลขประจำตัวผู้เสียภาษี/), '0-1055-36000-01-1');
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบริษัท' }));
    const summary = await waitFor(() => {
      const el = document.querySelector('[data-company-summary]');
      expect(el).not.toBeNull();
      return el!;
    });
    const [call] = api.called('POST /api/v1/company/onboarding');
    // Only company facts: no plan, price, status or owner from the browser; canonical department order.
    expect(Object.keys(call!.body as object).sort()).toEqual(
      ['billingCycle', 'departments', 'displayName', 'headOffice', 'legalName', 'taxId'].sort(),
    );
    expect(call!.body).toMatchObject({
      departments: ['SALES', 'WAREHOUSE'],
      billingCycle: 'MONTHLY',
    });
    expect(summary).toHaveAttribute('data-company-status', 'PENDING_SUBSCRIPTION');
    expect(document.querySelector('[data-subscription-status]')).toHaveTextContent(
      'รอเปิดใช้งาน (ยังไม่ชำระเงิน)',
    );
    expect(document.querySelector('[data-company-message]')).toHaveTextContent(
      'ยังไม่มีการชำระเงิน',
    );
    expect(document.querySelector('[data-control-center]')).toBeNull();
    expect(document.body).not.toHaveTextContent(/ชำระเงินแล้ว/);
  });

  it('maps a server department-limit refusal to the departments group', async () => {
    onboardingServer({
      plan: 'BUSINESS',
      createReply: () => fail(422, 'DEPARTMENT_LIMIT', { problem: 'too_many' }),
    });
    renderRoute('/account');
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    await fillCompany();
    await userEvent.click(screen.getByRole('checkbox', { name: 'ฝ่ายขาย' }));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบริษัท' }));
    expect(await screen.findByText('แผนกที่เลือกเกินสิทธิ์ของแพ็กเกจ')).toBeInTheDocument();
    expect(document.activeElement?.getAttribute('type')).toBe('checkbox');
  });

  it('a retried submit that finds the company already created shows that company', async () => {
    let created = false;
    const api = fakeApi({
      ...signedIn(identity()),
      'GET /api/v1/account/onboarding': () =>
        ok(
          created
            ? {
                stage: 'PENDING_ACTIVATION',
                selectedPlan: null,
                company: {
                  id: 'c9',
                  displayName: 'ตัวอย่าง',
                  isDemo: false,
                  role: 'COMPANY_OWNER',
                },
                canEnterCore: false,
              }
            : {
                stage: 'NEEDS_COMPANY',
                selectedPlan: 'STARTER',
                company: null,
                canEnterCore: false,
              },
        ),
      'POST /api/v1/company/onboarding': () => {
        created = true;
        return fail(409, 'COMPANY_EXISTS', { companyId: 'c9' });
      },
      'GET /api/v1/company/current': ok(pendingCompany('STARTER', ['SALES'])),
    });
    renderRoute('/account');
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    await fillCompany();
    await userEvent.click(screen.getByRole('checkbox', { name: 'ฝ่ายขาย' }));
    await userEvent.click(screen.getByRole('button', { name: 'สร้างบริษัท' }));
    await waitFor(() => expect(document.querySelector('[data-company-summary]')).not.toBeNull());
    expect(api.called('GET /api/v1/company/current')).toHaveLength(1);
  });

  it('can go back and change the package before the company exists', async () => {
    onboardingServer({ plan: 'STARTER' });
    renderRoute('/account');
    await screen.findByRole('heading', { name: 'สร้างบริษัทของคุณ' });
    await userEvent.click(screen.getByRole('button', { name: 'เปลี่ยนแพ็กเกจ' }));
    expect(await screen.findByRole('heading', { name: 'เลือกแพ็กเกจ' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Starter/ })).toBeChecked();
  });
});
