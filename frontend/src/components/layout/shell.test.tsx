import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTACT } from '@/config/contact';
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from '@/features/consent/consent';
import { renderRoute } from '@/test/render';

const LINE_URL = 'https://line.me/R/ti/p/@593oiwec';
const ADDRESS = '186/42 หมู่ 6 ต.ทวีวัฒนา อ.ไทรน้อย จ.นนทบุรี 11110';
const PHONE = '063-869-3614';
const PHONE_E164 = '+66638693614';

function storedConsent() {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

function acceptStored() {
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      version: CONSENT_VERSION,
      essential: true,
      analytics: false,
      preferences: false,
      marketing: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
}

describe('central contact configuration', () => {
  it('holds the approved company contact details', () => {
    expect(CONTACT.address).toBe(ADDRESS);
    // EP05 revision: exactly one public phone number.
    expect(CONTACT.phone).toEqual({ display: PHONE, e164: PHONE_E164 });
    expect('phones' in CONTACT).toBe(false);
    expect(CONTACT.email).toBe('pdablissoffice@gmail.com');
    expect(CONTACT.lineId).toBe('@593oiwec');
    expect(CONTACT.lineUrl).toBe(LINE_URL);
  });

  it('no other source file hardcodes contact values', () => {
    const sources = import.meta.glob<string>(
      ['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/config/contact.ts'],
      { query: '?raw', import: 'default', eager: true },
    );
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const needles = [
      '593oiwec',
      'pdablissoffice',
      '064-924-5544',
      '090-662-5464',
      '063-869-3614',
      'line.me/',
      'ทวีวัฒนา',
    ];
    const offenders = Object.entries(sources).flatMap(([file, text]) =>
      needles.filter((n) => text.includes(n)).map((n) => `${file}: ${n}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('public footer', () => {
  it('shows the CORE brand column, light navigation and full contact details', async () => {
    acceptStored();
    renderRoute('/about');
    const footer = await screen.findByRole('contentinfo');
    expect(footer).toHaveTextContent('PDA BLISS CORE');
    expect(footer).toHaveTextContent('by PDA BLISS');
    expect(footer).toHaveTextContent('Department Operations Platform สำหรับองค์กร');
    expect(footer).toHaveTextContent('พัฒนาโดย PDA BLISS COMPANY LIMITED');
    expect(footer).not.toHaveTextContent('S2 Accounting');

    const quick = within(footer).getByRole('navigation', { name: 'ลิงก์ด่วน' });
    expect(
      within(quick)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['ภาพรวม', 'แผนก', 'แพ็คเกจ', 'วิธีการทำงาน', 'ความรู้']);
    const org = within(footer).getByRole('navigation', { name: 'องค์กร' });
    expect(
      within(org)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'โซลูชัน',
      'ประเภทธุรกิจ',
      'สำหรับองค์กร',
      'ความปลอดภัย',
      'เกี่ยวกับเรา',
      'ติดต่อเรา',
    ]);

    const contact = within(footer).getByRole('heading', { name: 'ติดต่อเรา' }).closest('section')!;
    expect(contact).toHaveTextContent(ADDRESS);
    // A single phone row — no Office / คุณผึ้ง / คุณอิน rows any more.
    const phones = within(contact).getAllByRole('link', { name: /^0\d{2}-\d{3}-\d{4}$/ });
    expect(phones).toHaveLength(1);
    expect(phones[0]).toHaveTextContent(PHONE);
    expect(phones[0]).toHaveAttribute('href', `tel:${PHONE_E164}`);
    expect(contact).toHaveTextContent(`${PHONE} (คุณวิน)`);
    for (const old of ['064-924-5544', '090-662-5464', 'คุณผึ้ง', 'คุณอิน', 'Office']) {
      expect(footer).not.toHaveTextContent(old);
    }
    expect(contact).toHaveTextContent('LINE OA');
    expect(within(contact).getByRole('link', { name: 'pdablissoffice@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:pdablissoffice@gmail.com',
    );
    const line = within(contact).getByRole('link', { name: /@593oiwec/ });
    expect(line).toHaveAttribute('href', LINE_URL);
    expect(line).toHaveAttribute('rel', 'noopener noreferrer');

    const shortcuts = within(footer).getByRole('list', { name: 'ช่องทางติดต่อด่วน' });
    expect(within(shortcuts).getByRole('link', { name: 'โทร' })).toHaveAttribute(
      'href',
      `tel:${PHONE_E164}`,
    );
    expect(within(shortcuts).getByRole('link', { name: /LINE/ })).toHaveAttribute('href', LINE_URL);
    expect(within(shortcuts).getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:pdablissoffice@gmail.com',
    );

    expect(footer).toHaveTextContent('© 2026 PDA BLISS COMPANY LIMITED. All rights reserved.');
    const legal = within(footer).getByRole('navigation', { name: 'ข้อมูลทางกฎหมาย' });
    expect(within(legal).getByRole('link', { name: 'นโยบายความเป็นส่วนตัว' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(legal).getByRole('link', { name: 'ข้อกำหนดการใช้งาน' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(within(legal).getByRole('button', { name: 'การตั้งค่าคุกกี้' })).toBeInTheDocument();
  });

  it('every LINE link on the public shell uses the central URL', async () => {
    acceptStored();
    renderRoute('/contact');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'เปิดช่องทางติดต่อ' }));
    const lines = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="line.me"]'));
    // footer shortcut + footer details + contact page + floating panel
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const a of lines) expect(a.getAttribute('href')).toBe(LINE_URL);
  });
});

describe('cookie consent', () => {
  it('shows the banner to a first-time visitor and persists Accept All', async () => {
    renderRoute('/');
    const banner = await screen.findByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' });
    expect(banner).toHaveTextContent('ขณะนี้เว็บไซต์ยังไม่ได้ใช้คุกกี้วิเคราะห์หรือคุกกี้การตลาด');
    expect(within(banner).getByRole('link', { name: 'นโยบายความเป็นส่วนตัว' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    await userEvent.click(within(banner).getByRole('button', { name: 'ยอมรับทั้งหมด' }));
    expect(storedConsent()).toMatchObject({
      version: CONSENT_VERSION,
      essential: true,
      analytics: true,
      preferences: true,
      marketing: true,
    });
    expect(typeof storedConsent()!.updatedAt).toBe('string');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' })).toBeNull(),
    );
  });

  it('Reject Non-Essential keeps only essential storage', async () => {
    renderRoute('/');
    const banner = await screen.findByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' });
    await userEvent.click(within(banner).getByRole('button', { name: 'ปฏิเสธคุกกี้ที่ไม่จำเป็น' }));
    expect(storedConsent()).toMatchObject({
      essential: true,
      analytics: false,
      preferences: false,
      marketing: false,
    });
  });

  it('Cookie Settings: essential is locked on, choices save, and the dialog reopens from the footer', async () => {
    renderRoute('/about');
    const banner = await screen.findByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' });
    await userEvent.click(within(banner).getByRole('button', { name: 'ตั้งค่าคุกกี้' }));

    let dialog = screen.getByRole('dialog', { name: 'การตั้งค่าคุกกี้' });
    expect(within(dialog).getByRole('button', { name: 'ปิดการตั้งค่าคุกกี้' })).toHaveFocus();
    const essential = within(dialog).getByRole('switch', { name: /คุกกี้ที่จำเป็น/ });
    expect(essential).toBeChecked();
    expect(essential).toBeDisabled();
    expect(dialog).toHaveTextContent('เปิดใช้งานเสมอ');
    // Honest status: optional categories are not in use today.
    expect(within(dialog).getAllByText('ยังไม่ได้ใช้งานบนเว็บไซต์นี้')).toHaveLength(3);

    const analytics = within(dialog).getByRole('switch', { name: /คุกกี้วิเคราะห์การใช้งาน/ });
    expect(analytics).not.toBeChecked();
    await userEvent.click(analytics);
    expect(analytics).toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'บันทึกการตั้งค่า' }));
    expect(storedConsent()).toMatchObject({
      essential: true,
      analytics: true,
      preferences: false,
      marketing: false,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const footer = screen.getByRole('contentinfo');
    await userEvent.click(within(footer).getByRole('button', { name: 'การตั้งค่าคุกกี้' }));
    dialog = screen.getByRole('dialog', { name: 'การตั้งค่าคุกกี้' });
    expect(within(dialog).getByRole('switch', { name: /คุกกี้วิเคราะห์การใช้งาน/ })).toBeChecked();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a stored choice hides the banner; a stale version asks again', async () => {
    acceptStored();
    const first = renderRoute('/');
    await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    expect(screen.queryByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' })).toBeNull();
    first.unmount();

    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ version: 0, analytics: true }),
    );
    renderRoute('/');
    expect(
      await screen.findByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' }),
    ).toBeInTheDocument();
  });

  it('never sends consent anywhere', async () => {
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockClear();
    renderRoute('/about');
    const banner = await screen.findByRole('region', { name: 'คุกกี้และความเป็นส่วนตัว' });
    await userEvent.click(within(banner).getByRole('button', { name: 'ยอมรับทั้งหมด' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('floating utilities', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('back-to-top is hidden near the top, appears after scrolling, and returns to top', async () => {
    acceptStored();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderRoute('/about');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'กลับขึ้นด้านบน' })).toBeNull();

    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    fireEvent.scroll(window);
    const top = await screen.findByRole('button', { name: 'กลับขึ้นด้านบน' });
    await userEvent.click(top);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(document.getElementById('main')).toHaveFocus();
    scrollTo.mockRestore();
  });

  it('back-to-top jumps instantly under reduced motion', async () => {
    acceptStored();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })) as typeof window.matchMedia;
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderRoute('/about');
    await screen.findByRole('heading', { level: 1 });
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    fireEvent.scroll(window);
    await userEvent.click(await screen.findByRole('button', { name: 'กลับขึ้นด้านบน' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    scrollTo.mockRestore();
    window.matchMedia = original;
  });

  it('the contact control opens a stack of exact contact actions and closes with Escape', async () => {
    acceptStored();
    renderRoute('/about');
    await screen.findByRole('heading', { level: 1 });
    const trigger = screen.getByRole('button', { name: 'เปิดช่องทางติดต่อ' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAccessibleName('ปิดช่องทางติดต่อ');
    const panel = screen.getByRole('region', { name: 'ติดต่อทีม PDA BLISS' });
    expect(trigger).toHaveAttribute('aria-controls', panel.id);
    const call = within(panel).getByRole('link', { name: /โทรหาเรา/ });
    // The floating panel shows the same single number as the footer.
    expect(call).toHaveAttribute('href', `tel:${PHONE_E164}`);
    expect(call).toHaveTextContent(`${PHONE} (คุณวิน)`);
    await waitFor(() => expect(call).toHaveFocus());
    const line = within(panel).getByRole('link', { name: /LINE OA/ });
    expect(line).toHaveAttribute('href', LINE_URL);
    expect(line).toHaveTextContent('@593oiwec');
    expect(within(panel).getByRole('link', { name: /ส่งอีเมล/ })).toHaveAttribute(
      'href',
      'mailto:pdablissoffice@gmail.com',
    );
    expect(within(panel).getByRole('link', { name: /ขอรับคำปรึกษา/ })).toHaveAttribute(
      'href',
      '/contact',
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'ติดต่อทีม PDA BLISS' })).toBeNull(),
    );
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('"ขอรับคำปรึกษา" goes to /contact and closes the stack', async () => {
    acceptStored();
    const { router } = renderRoute('/about');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'เปิดช่องทางติดต่อ' }));
    await userEvent.click(screen.getByRole('link', { name: /ขอรับคำปรึกษา/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/contact'));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'ติดต่อทีม PDA BLISS' })).toBeNull(),
    );
  });

  it('stays hidden while the homepage CORE World section is on screen', async () => {
    acceptStored();
    let heroBottom = 2000;
    const original = Element.prototype.getBoundingClientRect;
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.id === 'core-world') return { bottom: heroBottom } as DOMRect;
      return original.call(this);
    });
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'เปิดช่องทางติดต่อ' })).toBeNull();
    heroBottom = 120;
    fireEvent.scroll(window);
    expect(await screen.findByRole('button', { name: 'เปิดช่องทางติดต่อ' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
