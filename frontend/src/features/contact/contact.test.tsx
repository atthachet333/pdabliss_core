import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CONTACT } from '@/config/contact';
import type { Localized } from '@/i18n/useCopy';
import { renderRoute } from '@/test/render';
import { CONTACT_COPY, type ContactCopy } from './copy';
import { getInquiryDelivery } from './delivery';
import {
  contactPath,
  emptyInquiry,
  INQUIRY_GROUPS,
  INQUIRY_TYPES,
  parsePrefill,
  PROBLEMS,
  SIZES,
  STEPS,
} from './model';
import { validateDetails } from './validation';

/*
 * EP13: /contact — the guided consultation. Model, prefill contract and
 * validation are tested directly; the flow as rendered, in every locale.
 */

beforeAll(() => {
  if (!document.querySelector('meta[name="description"]')) {
    const meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

const LOCALES = ['th', 'en', 'zh-CN'] as const;
const THAI = /[฀-฾เ-๿]/;
const TRADITIONAL = /[們個發這開時關庫說價購資費號門運營權證統線際體與變]/;
const FAKE_SUCCESS =
  /ส่งเรียบร้อย|ส่งสำเร็จ|sent successfully|has been sent|message sent|已发送成功|发送成功/i;
const RESPONSE_TIME = /ภายใน\s?\d|within \d|\d+\s?(ชั่วโมง|นาที|hours?|minutes?|小时|分钟)|24\/7/i;
const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(strings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];

async function open(path = '/contact') {
  const utils = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}
const main = () => document.getElementById('main')!;
const flow = () => document.querySelector<HTMLElement>('[data-flow]')!;
const next = () => userEvent.click(within(flow()).getByRole('button', { name: /ถัดไป/ }));
function visibleText() {
  const m = main().cloneNode(true) as HTMLElement;
  m.querySelectorAll('[inert], [aria-hidden="true"]').forEach((n) => n.remove());
  return (m.textContent ?? '').replace(CONTACT.address, '');
}
async function toDetails() {
  for (let i = 0; i < 4; i++) await next();
  expect(flow()).toHaveAttribute('data-step', 'details');
}

/* ------------------------------------------------------------------ */

describe('inquiry model', () => {
  it('offers seven consultation paths in three intent groups', () => {
    expect(INQUIRY_TYPES).toEqual([
      'demo',
      'consulting',
      'enterprise',
      'plans',
      'integration',
      'implementation',
      'general',
    ]);
    expect(INQUIRY_GROUPS.flatMap((g) => g.types).sort()).toEqual([...INQUIRY_TYPES].sort());
    expect(STEPS).toEqual(['topic', 'organization', 'situation', 'method', 'details', 'review']);
    expect(SIZES).toEqual(['1-20', '21-50', '51-100', '101-300', '301-1000', '1000+']);
    expect(PROBLEMS).toHaveLength(11);
  });

  it('reads the stable query contract and ignores anything unknown', () => {
    const p = (q: string) => parsePrefill(new URLSearchParams(q));
    expect(p('interest=demo')).toEqual({ type: 'demo' });
    expect(p('interest=plans')).toEqual({ type: 'plans' });
    expect(p('interest=enterprise')).toEqual({ type: 'enterprise' });
    expect(p('interest=integration')).toEqual({ type: 'integration' });
    expect(p('interest=implementation')).toEqual({ type: 'implementation' });
    expect(p('interest=consulting')).toEqual({ type: 'consulting' });
    expect(p('interest=quote')).toEqual({ type: 'enterprise' });
    expect(p('plan=professional')).toEqual({ type: 'plans', plan: 'professional' });
    expect(p('plan=enterprise')).toEqual({ type: 'enterprise', plan: 'enterprise' });
    expect(p('interest=demo&plan=business')).toEqual({ type: 'demo', plan: 'business' });
    expect(p('industry=manufacturing&department=warehouse')).toEqual({
      industry: 'manufacturing',
      department: 'warehouse',
    });
    expect(p('interest=hack&plan=gold&industry=x&department=hr')).toEqual({});
    expect(contactPath({ type: 'consulting', department: 'sales' })).toBe(
      '/contact?interest=consulting&department=sales',
    );
  });

  it('a department prefill becomes a department of interest', () => {
    expect(emptyInquiry({ department: 'warehouse' }).departments).toEqual(['warehouse']);
  });

  it('never models sensitive data', () => {
    const fields = Object.keys(emptyInquiry().contact).sort();
    expect(fields).toEqual(['company', 'email', 'lineId', 'name', 'phone']);
  });
});

describe('validation', () => {
  const base = { name: 'วิน', company: 'บริษัท ก', phone: '', email: '', lineId: '' };
  it('requires a name, a company and a way to reach the chosen method', () => {
    expect(validateDetails({ ...base, name: '', company: '' }, 'line')).toMatchObject({
      name: 'nameRequired',
      company: 'companyRequired',
      lineId: 'lineForMethod',
    });
    expect(validateDetails({ ...base, phone: '081 234 5678' }, 'line')).toEqual({});
    expect(validateDetails({ ...base, lineId: '@my.line' }, 'line')).toEqual({});
    expect(validateDetails(base, 'phone')).toEqual({ phone: 'phoneForMethod' });
    expect(validateDetails(base, 'email')).toEqual({ email: 'emailForMethod' });
  });

  it('checks formats only when a value is given', () => {
    expect(validateDetails({ ...base, email: 'not-an-email' }, 'email')).toEqual({
      email: 'emailInvalid',
    });
    expect(validateDetails({ ...base, phone: '12' }, 'phone')).toEqual({ phone: 'phoneInvalid' });
    expect(validateDetails({ ...base, lineId: 'has space' }, 'line')).toEqual({
      lineId: 'lineInvalid',
    });
    expect(validateDetails({ ...base, email: 'win@example.com' }, 'email')).toEqual({});
  });

  it('has a localized message for every error in every locale', () => {
    for (const l of LOCALES) {
      for (const k of [
        'nameRequired',
        'companyRequired',
        'emailInvalid',
        'phoneInvalid',
        'lineInvalid',
        'phoneForMethod',
        'emailForMethod',
        'lineForMethod',
      ] as const) {
        expect(CONTACT_COPY[l].errors[k], `${l} ${k}`).toBeTruthy();
      }
    }
  });
});

describe('copy', () => {
  it('is complete in every locale, without response times or fake success', () => {
    const shape = (c: ContactCopy) => Object.keys(c.types).join() + Object.keys(c.problems).join();
    const all: Localized<ContactCopy> = CONTACT_COPY;
    for (const l of LOCALES) {
      expect(shape(all[l])).toBe(shape(all.th));
      for (const s of strings(all[l])) {
        expect(s, s).not.toMatch(RESPONSE_TIME);
        expect(s, s).not.toMatch(FAKE_SUCCESS);
      }
    }
    for (const s of strings(all.en)) expect(s).not.toMatch(THAI);
    for (const s of strings(all['zh-CN'])) expect(s).not.toMatch(TRADITIONAL);
  });

  it('has no delivery today', () => {
    expect(getInquiryDelivery().available).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('/contact page', () => {
  it('opens on the problem-first statement with a guided selector, not a form', async () => {
    await open();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('เริ่มจากปัญหา');
    expect(h1).toHaveTextContent('ไม่จำเป็นต้องเริ่มจากชื่อฟีเจอร์');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 2, name: 'คุณอยากคุยเรื่องอะไร?' }),
    ).toBeInTheDocument();
    const groups = within(flow()).getAllByRole('group');
    expect(groups).toHaveLength(3);
    expect(within(flow()).getAllByRole('radio')).toHaveLength(7);
    for (const name of [
      'ขอ Demo',
      'ปรึกษาการวางระบบ',
      'ขอใบเสนอราคา Enterprise',
      'ปรึกษา Package',
      'API / Integration',
      'Training / Implementation',
      'ติดต่อทั่วไป',
    ]) {
      expect(
        within(flow()).getByRole('radio', { name: new RegExp(name.replace(/[/]/g, '\\/')) }),
      ).toBeInTheDocument();
    }
    // Only the first question is on screen — no long form.
    expect(
      main().querySelectorAll('input[type="text"], input[type="email"], textarea'),
    ).toHaveLength(0);
  });

  it('asks for a topic before moving on', async () => {
    await open();
    await next();
    expect(await screen.findByText('กรุณาเลือกเรื่องที่อยากคุย')).toBeInTheDocument();
    expect(flow()).toHaveAttribute('data-step', 'topic');
  });

  it.each([
    ['/contact?interest=demo', 'ขอ Demo'],
    ['/contact?interest=consulting', 'ปรึกษาการวางระบบ'],
    ['/contact?interest=enterprise', 'ขอใบเสนอราคา Enterprise'],
    ['/contact?interest=plans', 'ปรึกษา Package'],
    ['/contact?interest=integration', 'API / Integration'],
    ['/contact?interest=implementation', 'Training / Implementation'],
    ['/contact?interest=general', 'ติดต่อทั่วไป'],
  ])('prefills %s', async (path, label) => {
    await open(path);
    expect(
      within(flow()).getByRole('radio', { name: new RegExp(label.replace(/[/]/g, '\\/')) }),
    ).toBeChecked();
  });

  it('shows the plan context from pricing and keeps it in the summary', async () => {
    await open('/contact?plan=enterprise');
    expect(document.querySelector('[data-context]')).toHaveTextContent('คุณกำลังสอบถาม Enterprise');
    expect(within(flow()).getByRole('radio', { name: /ขอใบเสนอราคา Enterprise/ })).toBeChecked();
    expect(
      document.querySelector('[data-direct-panel] [data-summary-row="plan"]'),
    ).toHaveTextContent('Enterprise');
  });

  it('shows department and industry context and preselects them', async () => {
    await open('/contact?interest=consulting&department=warehouse&industry=manufacturing');
    const ctx = document.querySelector('[data-context]')!;
    expect(ctx).toHaveTextContent('คุณกำลังสนใจ คลังสินค้า');
    expect(ctx).toHaveTextContent('คุณกำลังดู การผลิต');
    await next();
    expect(within(flow()).getByRole('radio', { name: 'การผลิต' })).toBeChecked();
    expect(within(flow()).getByRole('checkbox', { name: /คลังสินค้า/ })).toBeChecked();
  });

  it('collects industry, size, departments and problems, and the live summary follows', async () => {
    await open('/contact?interest=demo');
    await next();
    await userEvent.click(within(flow()).getByRole('radio', { name: 'กระจายสินค้า / ค้าส่ง' }));
    await userEvent.click(within(flow()).getByRole('radio', { name: '51–100 คน' }));
    await userEvent.click(within(flow()).getByRole('checkbox', { name: /ฝ่ายขาย/ }));
    await userEvent.click(within(flow()).getByRole('checkbox', { name: /จัดซื้อ/ }));
    await next();
    expect(
      screen.getByRole('heading', { level: 2, name: 'ตอนนี้กำลังเจอปัญหาอะไร?' }),
    ).toHaveFocus();
    await userEvent.click(within(flow()).getByRole('checkbox', { name: 'ต้องตามถามสถานะ' }));
    await userEvent.click(within(flow()).getByRole('checkbox', { name: 'Supplier' }));
    const panel = document.querySelector('[data-direct-panel]')!;
    expect(panel.querySelector('[data-summary-row="industry"]')).toHaveTextContent(
      'กระจายสินค้า / ค้าส่ง',
    );
    expect(panel.querySelector('[data-summary-row="size"]')).toHaveTextContent('51–100 คน');
    expect(panel.querySelector('[data-summary-row="departments"]')).toHaveTextContent(
      'ฝ่ายขาย / จัดซื้อ',
    );
    expect(panel.querySelector('[data-summary-row="problems"]')).toHaveTextContent(
      'ต้องตามถามสถานะ / Supplier',
    );
  }, 20000);

  it('optional steps can be skipped and the reply method chosen', async () => {
    await open('/contact?interest=general');
    await next();
    await userEvent.click(within(flow()).getByRole('button', { name: 'ข้าม' }));
    await userEvent.click(within(flow()).getByRole('button', { name: 'ข้าม' }));
    expect(flow()).toHaveAttribute('data-step', 'method');
    expect(within(flow()).getByRole('radio', { name: /LINE/ })).toBeChecked();
    await userEvent.click(within(flow()).getByRole('radio', { name: /อีเมล/ }));
    expect(
      document.querySelector('[data-direct-panel] [data-summary-row="method"]'),
    ).toHaveTextContent('อีเมล');
  });

  it('validates contact details inline and moves focus to the first problem', async () => {
    await open('/contact?interest=demo');
    await toDetails();
    await next();
    expect(await screen.findByText('กรุณากรอกชื่อผู้ติดต่อ')).toBeInTheDocument();
    expect(screen.getByText('กรุณากรอกชื่อบริษัท')).toBeInTheDocument();
    expect(screen.getByText('คุณเลือก LINE — กรุณากรอก LINE ID หรือเบอร์โทร')).toBeInTheDocument();
    expect(document.querySelector('[data-error-summary]')).toHaveTextContent(
      'มี 3 ช่องที่ต้องแก้ไข',
    );
    expect(screen.getByLabelText('ชื่อผู้ติดต่อ')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('ชื่อผู้ติดต่อ')).toHaveFocus();
    await userEvent.type(screen.getByLabelText(/อีเมล/), 'nope');
    await next();
    expect(await screen.findByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
  }, 20000);

  it('reviews a summary, prepares the message and never pretends it was sent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await open('/contact?interest=enterprise&plan=enterprise&industry=distribution');
    await toDetails();
    await userEvent.type(screen.getByLabelText('ชื่อผู้ติดต่อ'), 'คุณทดสอบ');
    await userEvent.type(screen.getByLabelText('ชื่อบริษัท'), 'บริษัท ทดสอบ จำกัด');
    await userEvent.type(screen.getByLabelText(/LINE ID/), 'test.line');
    await next();
    expect(flow()).toHaveAttribute('data-step', 'review');
    const summary = flow().querySelector('[data-summary]')!;
    expect(summary.querySelector('[data-summary-row="type"]')).toHaveTextContent(
      'ขอใบเสนอราคา Enterprise',
    );
    expect(summary.querySelector('[data-summary-row="industry"]')).toHaveTextContent(
      'กระจายสินค้า / ค้าส่ง',
    );
    expect(summary.querySelector('[data-summary-row="method"]')).toHaveTextContent('LINE');
    expect(summary.querySelector('[data-summary-row="contact"]')).toHaveTextContent(
      'บริษัท ทดสอบ จำกัด',
    );
    expect(flow().querySelector('[data-delivery-notice]')).toHaveTextContent(
      'ยังไม่มีระบบรับข้อความออนไลน์',
    );

    await userEvent.click(
      within(flow()).getByRole('button', { name: /เตรียมข้อความให้ PDA BLISS/ }),
    );
    const status = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-prepared]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('data-delivery', 'unavailable');
    expect(status).toHaveTextContent('ข้อความพร้อมแล้ว — แต่ยังไม่ได้ส่ง');
    expect(main().textContent).not.toMatch(FAKE_SUCCESS);
    expect(fetchSpy).not.toHaveBeenCalled();

    const mail = status.querySelector('[data-handoff="email"]')!.getAttribute('href')!;
    expect(mail.startsWith(`mailto:${CONTACT.email}?subject=`)).toBe(true);
    expect(decodeURIComponent(mail)).toContain('บริษัท ทดสอบ จำกัด');
    expect(status.querySelector('[data-handoff="line"]')).toHaveAttribute('href', CONTACT.lineUrl);
    expect(status.querySelector('[data-handoff="phone"]')).toHaveAttribute(
      'href',
      `tel:${CONTACT.phone.e164}`,
    );
    await userEvent.click(within(status).getByRole('button', { name: /กลับไปแก้ไข/ }));
    expect(document.querySelector('[data-prepared]')).toBeNull();
  }, 20000);

  it('always shows direct phone, LINE and email links from the central config', async () => {
    await open();
    const panel = document.querySelector<HTMLElement>('[data-direct-panel]')!;
    expect(panel.querySelector('[data-direct-link="phone"]')).toHaveAttribute(
      'href',
      `tel:${CONTACT.phone.e164}`,
    );
    expect(panel).toHaveTextContent(`${CONTACT.phone.display} (คุณวิน)`);
    const line = panel.querySelector('[data-direct-link="line"]')!;
    expect(line).toHaveAttribute('href', CONTACT.lineUrl);
    expect(line).toHaveAttribute('target', '_blank');
    expect(line).toHaveAttribute('rel', 'noopener noreferrer');
    expect(line).toHaveTextContent('คุยผ่าน LINE OA');
    expect(panel.querySelector('[data-direct-link="email"]')).toHaveAttribute(
      'href',
      `mailto:${CONTACT.email}`,
    );
    expect(panel).toHaveTextContent('บริษัท พีดีเอ บลิส จำกัด');
    expect(panel).toHaveTextContent(CONTACT.address);
  });

  it('asks for no sensitive data and offers no file upload', async () => {
    await open('/contact?interest=demo');
    await toDetails();
    expect(main().querySelector('input[type="file"], input[type="password"]')).toBeNull();
    const names = [...main().querySelectorAll('input, textarea')].map((i) =>
      i.getAttribute('name'),
    );
    expect(
      names.filter((n) => n && /id_card|national|passport|bank|card|tax|password/i.test(n)),
    ).toEqual([]);
  });

  it('adds factual Organization structured data', async () => {
    await open();
    // Added by an effect after the page commits.
    await waitFor(() =>
      expect(document.head.querySelector('script[data-schema="organization"]')).not.toBeNull(),
    );
  });
});

describe('localization', () => {
  it('renders English without Thai, with English validation', async () => {
    await open('/en/contact?interest=integration');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Start from the problem');
    expect(within(flow()).getByRole('radio', { name: /API \/ Integration/ })).toBeChecked();
    expect(visibleText()).not.toMatch(THAI);
    for (let i = 0; i < 5; i++)
      await userEvent.click(within(flow()).getByRole('button', { name: /^Next/ }));
    expect(await screen.findByText('Please enter a contact name')).toBeInTheDocument();
    expect(visibleText()).not.toMatch(THAI);
  }, 20000);

  it('renders Simplified Chinese without Thai or Traditional characters', async () => {
    await open('/zh/contact?interest=implementation');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('从问题开始');
    expect(visibleText()).not.toMatch(THAI);
    expect(visibleText()).not.toMatch(TRADITIONAL);
    for (let i = 0; i < 5; i++)
      await userEvent.click(within(flow()).getByRole('button', { name: /下一步/ }));
    expect(await screen.findByText('请输入联系人姓名')).toBeInTheDocument();
  }, 20000);

  it('gives each locale a unique title and description', async () => {
    const seen = new Set<string>();
    for (const path of ['/contact', '/en/contact', '/zh/contact']) {
      const { unmount } = await open(path);
      await waitFor(() => expect(document.title).toContain('|'));
      seen.add(document.title);
      seen.add(document.querySelector('meta[name="description"]')!.getAttribute('content')!);
      unmount();
    }
    expect(seen.size).toBe(6);
  });
});
