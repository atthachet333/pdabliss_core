import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONTACT } from '@/config/contact';
import { renderRoute } from '@/test/render';
import {
  ADDON_AVAILABILITY,
  ADDON_IDS,
  adjustDepartments,
  annualPrices,
  getPlan,
  PLAN_IDS,
  PLANS,
  recommendPlan,
  STANDARD_DEPARTMENTS,
  toggleDepartment,
  type FitAnswers,
} from './plans';

/*
 * EP07: CORE packages and subscription experience. Plan facts are tested on
 * plans.ts (the single source of truth) and on the rendered page.
 */

const original = window.matchMedia;
beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => {
  window.matchMedia = original;
});

async function openPricing(path = '/pricing') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const main = () => document.getElementById('main')!;
const panel = () => document.getElementById('plan-panel')!;
const tab = (id: string) => document.getElementById(`plan-tab-${id}`)!;
const summary = () => document.querySelector<HTMLElement>('[data-config-summary]')!;
const deptButton = (id: string) => document.querySelector<HTMLElement>(`[data-dept="${id}"]`)!;

describe('plan facts (plans.ts)', () => {
  it('has exactly four packages and no free plan', () => {
    expect(PLAN_IDS).toEqual(['starter', 'business', 'professional', 'enterprise']);
    expect(PLANS.map((p) => p.name)).toEqual(['Starter', 'Business', 'Professional', 'Enterprise']);
    expect(PLANS.some((p) => /free/i.test(p.name) || p.monthlyPrice === 0)).toBe(false);
  });

  it('uses the approved monthly prices; Enterprise has none', () => {
    expect(PLANS.map((p) => p.monthlyPrice)).toEqual([399, 699, 999, null]);
    expect(getPlan('enterprise').cta).toBe('quote');
  });

  it('recommends Business only', () => {
    expect(PLANS.filter((p) => p.recommended).map((p) => p.id)).toEqual(['business']);
  });

  it('prices per company with every branch included', () => {
    for (const p of PLANS) {
      expect(p.companies).toBe(1);
      expect(p.allBranches).toBe(true);
    }
  });

  it('limits departments 2 / 4 / all / custom and Executive from Business', () => {
    expect(PLANS.map((p) => p.departmentLimit)).toEqual([2, 4, 'all', 'custom']);
    expect(PLANS.map((p) => p.executiveAccess)).toEqual([false, true, true, true]);
    expect(STANDARD_DEPARTMENTS).toEqual([
      'executive',
      'sales',
      'operations',
      'warehouse',
      'purchasing',
      'accounting',
    ]);
  });

  it('has storage 3 / 10 / 30 GB / as agreed', () => {
    expect(PLANS.map((p) => p.storageGb)).toEqual([3, 10, 30, null]);
  });

  it('tiers reporting, custom reports and API correctly', () => {
    expect(PLANS.map((p) => p.reports)).toEqual([
      'basic',
      'advanced',
      'advancedCustom',
      'organization',
    ]);
    expect(PLANS.map((p) => p.customReports)).toEqual(['no', 'addon', 'included', 'included']);
    expect(PLANS.map((p) => p.api)).toEqual(['no', 'addon', 'included', 'included']);
  });

  it('tiers workflow and approval', () => {
    expect(PLANS.map((p) => p.workflow)).toEqual([
      'basic',
      'crossDepartment',
      'custom',
      'organization',
    ]);
    expect(PLANS.map((p) => p.approval)).toEqual(['single', 'multiStep', 'multiLevel', 'custom']);
    expect(PLANS.map((p) => p.automation)).toEqual(['no', 'addon', 'included', 'included']);
  });

  it('tiers support without guaranteed response times', () => {
    expect(PLANS.map((p) => p.support)).toEqual([
      'standard',
      'priority',
      'higherPriority',
      'dedicated',
    ]);
  });

  it('applies the annual relationship: 12 months, then 10 of 12, then 15 % off', () => {
    expect(annualPrices(399)).toEqual({
      normal: 4788,
      year1: 4788,
      year2: 3990,
      year3Exact: 4069.8,
      year3: 4070,
    });
    expect(annualPrices(699)).toEqual({
      normal: 8388,
      year1: 8388,
      year2: 6990,
      year3Exact: 7129.8,
      year3: 7130,
    });
    expect(annualPrices(999)).toEqual({
      normal: 11988,
      year1: 11988,
      year2: 9990,
      year3Exact: 10189.8,
      year3: 10190,
    });
  });

  it('keeps add-ons price-free and consistent with plan facts', () => {
    expect(ADDON_IDS).toHaveLength(12);
    for (const id of PLAN_IDS) {
      expect(ADDON_AVAILABILITY.api[id]).toBe(getPlan(id).api);
      expect(ADDON_AVAILABILITY.report[id]).toBe(getPlan(id).customReports);
    }
    expect(ADDON_AVAILABILITY.department.starter).toBe('no');
    expect(ADDON_AVAILABILITY.department.business).toBe('addon');
  });

  it('enforces department rules and adjusts selections safely', () => {
    const starter = getPlan('starter');
    const business = getPlan('business');
    expect(toggleDepartment(starter, [], 'executive')).toEqual([]);
    expect(toggleDepartment(starter, ['sales', 'warehouse'], 'purchasing')).toEqual([
      'sales',
      'warehouse',
    ]);
    expect(
      toggleDepartment(business, ['sales', 'warehouse', 'purchasing'], 'executive'),
    ).toHaveLength(4);
    expect(adjustDepartments(starter, ['executive', 'sales', 'warehouse'])).toEqual({
      selected: ['sales', 'warehouse'],
      removed: ['executive'],
    });
    expect(adjustDepartments(business, [...STANDARD_DEPARTMENTS]).selected).toHaveLength(4);
    expect(adjustDepartments(getPlan('professional'), ['sales']).selected).toEqual([
      ...STANDARD_DEPARTMENTS,
    ]);
  });

  it('recommends deterministically', () => {
    const base: FitAnswers = {
      departments: '1-2',
      executive: false,
      customWorkflow: false,
      api: false,
      customReports: false,
      complex: false,
    };
    expect(recommendPlan(base).plan).toBe('starter');
    expect(recommendPlan({ ...base, executive: true }).plan).toBe('business');
    expect(recommendPlan({ ...base, departments: '3-4' }).plan).toBe('business');
    expect(recommendPlan({ ...base, departments: '5-6' }).plan).toBe('professional');
    expect(recommendPlan({ ...base, api: true }).plan).toBe('professional');
    expect(recommendPlan({ ...base, customWorkflow: true }).plan).toBe('professional');
    expect(recommendPlan({ ...base, departments: 'more' }).plan).toBe('enterprise');
    expect(recommendPlan({ ...base, complex: true, departments: '3-4' }).plan).toBe('enterprise');
  });
});

describe('/pricing page', () => {
  it('renders one H1 and the editorial hero with the starting price and demo CTA', async () => {
    await openPricing();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('เลือกระบบ');
    expect(main()).toHaveTextContent('เริ่มต้น฿399/ เดือน');
    const demo = screen.getAllByRole('link', { name: /ขอ Demo/ });
    expect(demo.length).toBeGreaterThan(0);
    expect(demo[0]).toHaveAttribute('href', '/contact?interest=demo');
  });

  it('shows four plan tabs with exact prices, Business recommended and selected by default', async () => {
    await openPricing();
    expect(tab('starter')).toHaveTextContent('฿399 / เดือน');
    expect(tab('business')).toHaveTextContent('฿699 / เดือน');
    expect(tab('professional')).toHaveTextContent('฿999 / เดือน');
    expect(tab('business')).toHaveTextContent('แนะนำ');
    expect(tab('business')).toHaveAttribute('aria-selected', 'true');
    expect(tab('enterprise')).toHaveTextContent('ขอใบเสนอราคา');
    expect(tab('enterprise').textContent).not.toMatch(/฿/);
  });

  it('expands the selected plan with its allowances and switches by keyboard', async () => {
    await openPricing();
    expect(panel()).toHaveTextContent('สูงสุด 4 แผนก');
    expect(panel()).toHaveTextContent('10 GB');
    expect(panel()).toHaveTextContent('ทุกสาขาของบริษัท');
    expect(panel()).toHaveTextContent('ตามที่ลงทะเบียนและขอบเขตบริการ');
    tab('business').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(tab('starter')).toHaveAttribute('aria-selected', 'true');
    expect(tab('starter')).toHaveFocus();
    expect(panel()).toHaveTextContent('สูงสุด 2 แผนก');
    expect(panel()).toHaveTextContent('3 GB');
    expect(panel()).toHaveTextContent('ไม่มี · เริ่มที่ Business');
    await userEvent.keyboard('{End}');
    expect(panel()).toHaveTextContent('ขอใบเสนอราคา');
    expect(panel()).toHaveTextContent('ตามข้อตกลง');
    expect(panel().textContent).not.toMatch(/฿/);
    expect(within(panel()).getByRole('link', { name: /ขอใบเสนอราคา/ })).toHaveAttribute(
      'href',
      '/contact?interest=enterprise&plan=enterprise',
    );
  });

  it('never publishes a fixed user limit', async () => {
    await openPricing();
    for (const id of PLAN_IDS) {
      await userEvent.click(tab(id));
      expect(panel().textContent).not.toMatch(/\d+\s*(ผู้ใช้|คน|users?)/i);
    }
  });

  it('updates the displayed price with the billing cycle', async () => {
    await openPricing();
    const group = screen.getAllByRole('radiogroup', { name: 'รอบการชำระเงิน' })[0]!;
    await userEvent.click(within(group).getByRole('radio', { name: /รายปี/ }));
    expect(panel()).toHaveTextContent('ปีแรก');
    expect(panel()).toHaveTextContent('฿8,388');
    expect(panel()).toHaveTextContent('จ่าย 10 เดือน ใช้ 12 เดือน');
    expect(panel()).toHaveTextContent('฿6,990');
    expect(panel()).toHaveTextContent('ลด 15% จากราคารายปีปกติ');
    expect(panel()).toHaveTextContent('ประมาณ ฿7,130');
    expect(tab('starter')).toHaveTextContent('฿4,788');
  });

  it('explains the annual relationship for every priced plan', async () => {
    await openPricing();
    const section = document.getElementById('billing')!;
    const row = (id: string) => section.querySelector(`[data-annual-row="${id}"]`)!;
    expect(row('starter')).toHaveTextContent(/฿4,788.*฿3,990.*ประมาณ ฿4,070/);
    expect(row('business')).toHaveTextContent(/฿8,388.*฿6,990.*ประมาณ ฿7,130/);
    expect(row('professional')).toHaveTextContent(/฿11,988.*฿9,990.*ประมาณ ฿10,190/);
    expect(section).toHaveTextContent('เลือกแบบรายเดือนได้ และยกเลิกได้เมื่อจบรอบบิล');
    expect(section).toHaveTextContent('อัปเกรดได้ทุกเมื่อ');
    expect(section).toHaveTextContent('ดาวน์เกรดได้ตามเงื่อนไขของรอบบิล');
  });

  it('makes one company, every branch clear', async () => {
    await openPricing();
    const section = document.getElementById('company')!;
    expect(section).toHaveTextContent('หนึ่งบริษัท ทุกสาขา');
    expect(section).toHaveTextContent('หนึ่ง Subscription = หนึ่งบริษัท');
    expect(section).toHaveTextContent('ทำไมคิดต่อบริษัท ไม่ใช่ต่อผู้ใช้');
  });

  it('adds no VAT claim, free plan, countdown or invented social proof', async () => {
    await openPricing();
    const text = main().textContent!;
    expect(text).not.toMatch(/VAT|ภาษีมูลค่าเพิ่ม/);
    // "Free" appears only to say there is no free plan or free trial.
    const withoutDenials = text
      .replace(/ไม่มีแพ็คเกจฟรี(หรือ Free Trial)?/g, '')
      .replace(/มี Free Trial ไหม\?/g, '');
    expect(withoutDenials).not.toMatch(/ฟรี|free/i);
    expect(text).not.toMatch(/ลูกค้ากว่า|uptime|ROI|เหลือเวลา/i);
  });
});

describe('configurator', () => {
  it('exposes the configuration summary as a named region inside main', async () => {
    await openPricing();
    expect(within(main()).getByRole('region', { name: 'สรุปการตั้งค่า' })).toContainElement(
      summary(),
    );
  });

  it('blocks Executive in Starter, explaining why, and enforces 2 departments', async () => {
    await openPricing('/pricing?plan=starter');
    expect(deptButton('executive')).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelector('[data-executive-blocked]')).toHaveTextContent(
      'Executive Workspace เริ่มที่ Business',
    );
    await userEvent.click(deptButton('executive'));
    expect(deptButton('executive')).toHaveAttribute('aria-pressed', 'false');
    // sales + warehouse are preselected: the limit of 2 is reached.
    expect(deptButton('purchasing')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(deptButton('purchasing'));
    expect(deptButton('purchasing')).toHaveAttribute('aria-pressed', 'false');
  });

  it('enforces 4 departments in Business and adjusts the selection on plan change', async () => {
    await openPricing('/pricing?plan=business');
    for (const d of ['executive', 'operations']) await userEvent.click(deptButton(d));
    expect(document.querySelector('[data-dept-count]')).toHaveTextContent('เลือกแล้ว 4 จาก 4 แผนก');
    expect(deptButton('accounting')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(tab('starter'));
    expect(document.querySelector('[data-dept-adjusted]')).toHaveTextContent('นำ ผู้บริหาร');
    expect(deptButton('executive')).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('[data-dept-count]')).toHaveTextContent('เลือกแล้ว 2 จาก 2 แผนก');
  });

  it('includes all standard departments in Professional', async () => {
    await openPricing('/pricing?plan=professional');
    for (const d of STANDARD_DEPARTMENTS)
      expect(deptButton(d)).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-dept-count]')).toHaveTextContent('รวมทุกแผนกมาตรฐานแล้ว');
  });

  it('shows only the base package price and never invents add-on totals', async () => {
    await openPricing('/pricing?plan=business');
    await userEvent.click(document.querySelector<HTMLElement>('[data-addon="api"]')!);
    await userEvent.click(document.querySelector<HTMLElement>('[data-addon="storage"]')!);
    const s = summary();
    expect(s).toHaveTextContent('฿699');
    expect(s.querySelector('[data-summary-addon="api"]')).toHaveTextContent('ต้องประเมินเพิ่มเติม');
    expect(s.querySelector('[data-summary-addon="storage"]')).toHaveTextContent(
      'ต้องประเมินเพิ่มเติม',
    );
    expect(s.textContent!.match(/฿[\d,]+/g)).toEqual(['฿699']);
    expect(s).toHaveTextContent('การจำลองเพื่อการนำเสนอเท่านั้น');
  });

  it('marks included add-ons and blocks unavailable ones', async () => {
    await openPricing('/pricing?plan=starter');
    const api = document.querySelector<HTMLElement>('[data-addon="api"]')!;
    expect(api).toHaveAttribute('aria-disabled', 'true');
    expect(api).toHaveTextContent('เริ่มที่ Business');
    await userEvent.click(tab('professional'));
    expect(document.querySelector('[data-addon="api"]')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-addon="api"]')).toHaveTextContent('รวมในแพ็คเกจแล้ว');
  });

  it('switches Enterprise to quote mode', async () => {
    await openPricing('/pricing?plan=enterprise');
    expect(summary()).toHaveAttribute('data-mode', 'quote');
    expect(summary()).toHaveTextContent('Enterprise ใช้ใบเสนอราคา');
    expect(summary().textContent).not.toMatch(/฿/);
    expect(within(summary()).getByRole('link', { name: /ขอใบเสนอราคา/ })).toHaveAttribute(
      'href',
      '/contact?interest=enterprise&plan=enterprise',
    );
  });

  it('represents the future purchase flow without any payment', async () => {
    await openPricing();
    const flow = document.querySelector('[data-purchase-flow]')!;
    expect(flow.querySelectorAll('li')).toHaveLength(8);
    expect(flow).toHaveTextContent('ชำระเงิน');
    expect(flow).toHaveTextContent('สร้าง CORE Workspace');
    expect(main().querySelector('input[autocomplete*="cc"], input[name*="card"]')).toBeNull();
    expect(main()).toHaveTextContent('กำลังเตรียมเปิดให้บริการ');
  });
});

describe('recommendation, comparison and services', () => {
  it('recommends a package from simple answers and opens it', async () => {
    await openPricing();
    const result = () => document.querySelector('[data-recommendation]')!;
    expect(result()).toHaveAttribute('data-recommendation', 'starter');
    const q = screen.getByRole('radiogroup', { name: 'ต้องการใช้งานกี่แผนก?' });
    await userEvent.click(within(q).getByRole('radio', { name: /3–4 แผนก/ }));
    expect(result()).toHaveAttribute('data-recommendation', 'business');
    const complex = screen.getByRole('radiogroup', { name: /กระบวนการซับซ้อน/ });
    await userEvent.click(within(complex).getByRole('radio', { name: /ใช่/ }));
    expect(result()).toHaveAttribute('data-recommendation', 'enterprise');
    await userEvent.click(
      within(result() as HTMLElement).getByRole('button', { name: /ดูแพ็คเกจนี้/ }),
    );
    expect(tab('enterprise')).toHaveAttribute('aria-selected', 'true');
  });

  it('compares grouped features consistently with plan data', async () => {
    await openPricing('/pricing?plan=starter');
    const section = document.getElementById('compare')!;
    await userEvent.click(within(section).getByRole('button', { name: 'เปิดทุกหมวด' }));
    const row = (k: string) => section.querySelector(`[data-row="${k}"]`)!;
    expect(row('executive')).toHaveTextContent('ไม่มี · เริ่มที่ Business');
    expect(row('api')).toHaveTextContent('ไม่รวม');
    expect(row('reports')).toHaveTextContent('รายงานพื้นฐาน');
    expect(row('warehouseCore')).toHaveTextContent('รวม เมื่อเปิดใช้คลังสินค้า');
    const plans = screen.getByRole('radiogroup', { name: 'แพ็คเกจที่แสดง' });
    await userEvent.click(within(plans).getByRole('radio', { name: /Business/ }));
    expect(row('api')).toHaveTextContent('Add-on');
    expect(row('customReports')).toHaveTextContent('Add-on');
    expect(row('deptLimit')).toHaveTextContent('สูงสุด 4 แผนก');
    expect(row('deptLimit').textContent).not.toMatch(/ทุกแผนก/);
    await userEvent.click(within(plans).getByRole('radio', { name: /Professional/ }));
    expect(row('api')).toHaveTextContent('รวมในแพ็คเกจ');
    expect(row('customReports')).toHaveTextContent('รวมในแพ็คเกจ');
    expect(row('reports')).toHaveTextContent('รายงานขั้นสูง + Custom Reports');
    expect(row('storage')).toHaveTextContent('30 GB');
  });

  it('shows add-ons without prices', async () => {
    await openPricing();
    const section = document.getElementById('add-ons')!;
    expect(section.querySelectorAll('[data-addon-card]')).toHaveLength(12);
    expect(section).toHaveTextContent('ประเมินตามขอบเขต');
    expect(section.textContent).not.toMatch(/฿|\d+\s?บาท/);
  });

  it('explains migration, training and support', async () => {
    await openPricing();
    const s = document.getElementById('onboarding')!;
    expect(s).toHaveTextContent('ย้ายข้อมูลเริ่มต้นโดยไม่มีค่าใช้จ่าย');
    expect(s).toHaveTextContent('ขอบเขตการย้ายข้อมูลขึ้นอยู่กับรูปแบบและความพร้อมของข้อมูลเดิม');
    expect(s).toHaveTextContent('คิดค่าบริการตามการใช้บริการแต่ละครั้ง');
    expect(s).toHaveTextContent('Priority Support');
    expect(s).toHaveTextContent('Dedicated Support · SLA ตามที่ตกลง');
  });

  it('has the Enterprise consultation flow and the Early Access panel', async () => {
    await openPricing();
    const flow = document.querySelector('[data-enterprise-flow]')!;
    expect(flow.querySelectorAll('li')).toHaveLength(4);
    expect(flow).toHaveTextContent('ใบเสนอราคา');
    const early = document.getElementById('early-access')!;
    expect(early).toHaveTextContent('สิทธิพิเศษสำหรับองค์กร');
    expect(early.textContent).not.toMatch(/%|฿/);
  });

  it('splits the FAQ into two columns in reading order', async () => {
    await openPricing();
    const cols = [...document.querySelectorAll<HTMLElement>('[data-faq-column]')];
    expect(cols).toHaveLength(2);
    const idx = cols.map((c) =>
      [...c.querySelectorAll<HTMLElement>('[data-faq]')].map((li) => Number(li.dataset.faq)),
    );
    expect(idx[0]!.length - idx[1]!.length).toBeLessThanOrEqual(1);
    expect([...idx[0]!, ...idx[1]!]).toEqual([...Array(idx[0]!.length + idx[1]!.length).keys()]);
    // One answer open at a time across both columns.
    const faq = document.getElementById('faq')!;
    const last = idx[1]![idx[1]!.length - 1]!;
    await userEvent.click(faq.querySelector<HTMLElement>(`#faq-q-${last}`)!);
    expect(faq.querySelector(`#faq-a-${last}`)).not.toHaveAttribute('hidden');
    expect(faq.querySelector('#faq-a-0')).toHaveAttribute('hidden');
  });

  it('answers the FAQ from plan data', async () => {
    await openPricing();
    const faq = document.getElementById('faq')!;
    expect(faq.querySelectorAll('[data-faq]').length).toBeGreaterThanOrEqual(13);
    expect(faq).toHaveTextContent(
      'Starter ฿399 / เดือน · Business ฿699 / เดือน · Professional ฿999 / เดือน',
    );
    await userEvent.click(within(faq).getByRole('button', { name: 'เพิ่มแผนกได้ไหม?' }));
    expect(faq).toHaveTextContent('Starter ใช้ได้สูงสุด 2 แผนก และ Business สูงสุด 4 แผนก');
    await userEvent.click(within(faq).getByRole('button', { name: 'มี Free Trial ไหม?' }));
    expect(faq).toHaveTextContent('ไม่มีแพ็คเกจฟรีหรือ Free Trial');
    await userEvent.click(within(faq).getByRole('button', { name: 'API มีในแพ็คเกจไหน?' }));
    expect(faq).toHaveTextContent('Business เพิ่มเป็น Add-on ได้');
  });
});

describe('URL state', () => {
  it('loads the plan from ?plan= and falls back safely', async () => {
    const { unmount } = await openPricing('/pricing?plan=professional');
    expect(tab('professional')).toHaveAttribute('aria-selected', 'true');
    unmount();
    const second = await openPricing('/pricing?plan=free');
    expect(tab('business')).toHaveAttribute('aria-selected', 'true');
    second.unmount();
    await openPricing('/pricing#plan-starter');
    expect(tab('starter')).toHaveAttribute('aria-selected', 'true');
  });

  it('writes the selected plan to the URL', async () => {
    const { router } = await openPricing();
    await userEvent.click(tab('enterprise'));
    await waitFor(() => expect(router.state.location.search).toBe('?plan=enterprise'));
  });
});

describe('localization', () => {
  const THAI = /[฀-฾เ-๿]/; // Thai script, excluding the baht sign ฿ (U+0E3F)
  function visibleText() {
    const m = main().cloneNode(true) as HTMLElement;
    m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
    return (m.textContent ?? '').replace(CONTACT.address, '');
  }

  it('renders English with exact prices and no Thai', async () => {
    await openPricing('/en/pricing');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Choose the system');
    expect(tab('starter')).toHaveTextContent('฿399 / month');
    expect(tab('business')).toHaveTextContent('Recommended');
    expect(tab('enterprise')).toHaveTextContent('Request a quotation');
    expect(main()).toHaveTextContent('Prices in Thai Baht (THB)');
    expect(visibleText()).not.toMatch(THAI);
  });

  it('renders Simplified Chinese with Thai Baht identified and no Thai', async () => {
    await openPricing('/zh/pricing');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('选择系统');
    expect(tab('starter')).toHaveTextContent('399 泰铢 / 月');
    expect(tab('professional')).toHaveTextContent('999 泰铢 / 月');
    expect(tab('business')).toHaveTextContent('推荐');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(/[們個發這開時關庫說價購資費號]/);
  });

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/pricing', '/en/pricing', '/zh/pricing']) {
      const { unmount } = await openPricing(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });

  it('links Packages from the Product menu, keeping the locale (EP18)', async () => {
    renderRoute('/en');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Product' }));
    expect(document.querySelector('header a[href="/en/pricing"]')).toHaveTextContent('Packages');
    // Plan choice (?plan=…) happens on the page itself, still deep-linkable.
    renderRoute('/en/pricing?plan=business');
    await screen.findAllByRole('heading', { level: 1 });
    expect(PLAN_IDS).toContain('business');
  });

  it('pre-selects the package topic on the contact flow from a pricing link (EP13)', async () => {
    renderRoute('/contact?interest=plans&plan=business');
    expect(await screen.findByRole('radio', { name: /ปรึกษา Package/ })).toBeChecked();
    expect(document.querySelector('[data-context]')).toHaveTextContent('Business');
  });
});

describe('reduced motion', () => {
  it('renders every pricing section in its final state', async () => {
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    await openPricing();
    // The capability visual has no autoplay: the lit layers follow the selection.
    const layers = panel().querySelectorAll('[data-layer][data-active="true"]');
    expect(layers).toHaveLength(2);
  });
});
