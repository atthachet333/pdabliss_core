import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellLinkTargets } from '@/config/navigation';
import { renderRoute } from '@/test/render';
import { CHAPTERS } from './chapters';
import { FLOWS } from './flows';
import { WORLDS } from './worlds';

async function renderHome() {
  const utils = renderRoute('/');
  await screen.findByRole('heading', { level: 1 });
  return utils;
}

function mockReducedMotion() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('homepage chapters (EP04)', () => {
  it('tells the story in eleven chapters, in order, with one h1 and a heading per chapter', async () => {
    await renderHome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sections = CHAPTERS.map((c) => document.getElementById(c.id));
    sections.forEach((el) => expect(el).not.toBeNull());
    // Document order matches the story order.
    for (let i = 1; i < sections.length; i++) {
      expect(
        sections[i - 1]!.compareDocumentPosition(sections[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    for (const c of CHAPTERS.slice(1)) {
      const section = document.getElementById(c.id)!;
      const labelled = section.getAttribute('aria-labelledby');
      expect(labelled).toBeTruthy();
      expect(document.getElementById(labelled!)?.tagName).toBe('H2');
    }
  });

  it('carries the required statements', async () => {
    await renderHome();
    const text = document.body.textContent ?? '';
    for (const line of [
      'แยกประสบการณ์การทำงาน',
      'แต่ไม่แยกข้อมูล',
      'ระบบที่ดี ไม่ควรรอให้ความผิดพลาดเกิดขึ้น',
      'แล้วค่อยบอกว่าใครเป็นคนผิด',
      'ข้อมูลจากทุกแผนก',
      'กลายเป็นภาพเดียวสำหรับผู้บริหาร',
      'เริ่มจากกระบวนการที่องค์กรใช้วันนี้',
      'และขยายไปพร้อมกับความซับซ้อนในวันข้างหน้า',
      'ระบบที่ดีควรเข้ากับวิธีที่องค์กรของคุณทำงาน',
      'ไม่ใช่บังคับให้องค์กรทำงานตามระบบ',
      'PDA BLISS COMPANY LIMITED',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('has no pricing section on the homepage (pricing stays on /pricing)', async () => {
    await renderHome();
    expect(screen.queryByRole('heading', { name: /แพ็กเกจ|ราคา|Pricing/i })).toBeNull();
    expect(screen.queryByText(/โครงสร้างแพ็กเกจตัวอย่าง/)).toBeNull();
    const main = document.querySelector('main')!;
    expect(main.textContent).not.toMatch(/฿\s?\d|บาท\s?\/\s?เดือน/);
    expect(within(main).queryByRole('link', { name: /ราคา|แพ็กเกจ/ })).toBeNull();
  });

  it('makes no unsupported claims and exposes no prototype credentials', async () => {
    await renderHome();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/100%|70%|99\.99|ISO\s?\d|certified|ลูกค้ามากกว่า|\d+\s?บริษัท/i);
    expect(text).not.toMatch(/pass1|user1/);
  });

  it('every in-page link from the hero, the mega menus and the chapter indicator has a target', async () => {
    await renderHome();
    const hashes = new Set<string>(['who-for', 'fit']);
    for (const to of shellLinkTargets()) if (to.startsWith('/#')) hashes.add(to.slice(2));
    const progress = screen.getByRole('navigation', { name: 'บทของหน้า' });
    for (const a of within(progress).getAllByRole('link')) {
      hashes.add(a.getAttribute('href')!.slice(1));
    }
    for (const id of hashes) expect(document.getElementById(id), `#${id}`).not.toBeNull();
  });
});

describe('department worlds', () => {
  it('offers the six worlds as a keyboard tablist', async () => {
    await renderHome();
    const list = screen.getByRole('tablist', { name: 'เลือกโลกการทำงานของแผนก' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(WORLDS.map((w) => w.nameTh + w.nameEn));
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    tabs[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    const panel = document.getElementById('world-panel')!;
    await userEvent.click(tabs[3]!);
    await waitFor(() => expect(panel).toHaveTextContent(WORLDS[3]!.message));
    expect(within(panel).getByRole('link', { name: /ดูรายละเอียด/ })).toHaveAttribute(
      'href',
      `/departments#${WORLDS[3]!.id}`,
    );
  });

  it('shows a real, price-free Warehouse preview', async () => {
    await renderHome();
    const list = screen.getByRole('tablist', { name: 'เลือกโลกการทำงานของแผนก' });
    await userEvent.click(within(list).getByRole('tab', { name: /คลังสินค้า/ }));
    const figure = screen.getByRole('figure', { name: /ตัวอย่างหน้าจอคลังสินค้า/ });
    await within(figure).findByText('งานคลังวันนี้', {}, { timeout: 5000 });
    expect(figure.textContent).toMatch(/LOT|Lot/);
    expect(figure.textContent).not.toMatch(/฿|บาท|ราคา|ต้นทุน|มูลค่า/);
    expect(document.getElementById('world-panel')!).toHaveTextContent('ไม่แสดงราคาหรือต้นทุน');
  });

  it('keeps previews out of the accessibility tree and free of extra h1s', async () => {
    await renderHome();
    const figure = screen.getByRole('figure', { name: /ตัวอย่างหน้าจอฝ่ายขาย/ });
    await within(figure).findByText('คำสั่งซื้อและการส่งมอบ', {}, { timeout: 5000 });
    expect(figure.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(figure.querySelector('h1')).toBeNull();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('connected flow', () => {
  it('switches between the five illustrative routes', async () => {
    await renderHome();
    const group = screen.getByRole('group', { name: 'เลือกเส้นทางงาน' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(FLOWS.map((f) => f.label));
    expect(radios[0]).toBeChecked();

    await userEvent.click(within(group).getByRole('radio', { name: 'การจัดซื้อ' }));
    const steps = screen.getByRole('list', { name: 'ขั้นตอนเส้นทางการจัดซื้อ' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(FLOWS[1]!.steps.length);
    expect(steps).toHaveTextContent('ใบขอซื้อ (PR)');
    // Honest framing: illustrative, not one fixed line.
    expect(document.getElementById('connected-flow')).toHaveTextContent('เส้นทางนี้เป็นภาพประกอบ');
  });

  it('offers a pause control for the moving route', async () => {
    await renderHome();
    const pause = screen.getByRole('button', { name: 'หยุดภาพเคลื่อนไหวเส้นทาง' });
    await userEvent.click(pause);
    expect(screen.getByRole('button', { name: 'เล่นภาพเคลื่อนไหวเส้นทาง' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('error control', () => {
  it('presents PREVENT / DETECT / ALERT / CONTROL / TRACE through selectable scenarios', async () => {
    await renderHome();
    const principles = screen.getByRole('list', { name: 'หลักการป้องกันความผิดพลาด' });
    expect(
      within(principles)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('PREVENT'),
      expect.stringContaining('DETECT'),
      expect.stringContaining('ALERT'),
      expect.stringContaining('CONTROL'),
      expect.stringContaining('TRACE'),
    ]);
    const tabs = within(screen.getByRole('tablist', { name: 'สถานการณ์ตัวอย่าง' })).getAllByRole(
      'tab',
    );
    expect(tabs).toHaveLength(5);
    await userEvent.click(screen.getByRole('tab', { name: /จ่ายเงินก่อนเอกสารครบ/ }));
    const panel = document.getElementById('scenario-panel')!;
    expect(panel).toHaveTextContent('เอกสารครบและได้รับอนุมัติ');
    expect(panel).toHaveTextContent('CORE ถูกออกแบบมาเพื่อรองรับ');
  });
});

describe('executive perspective', () => {
  it('previews the command view with qualitative states, not financial figures', async () => {
    await renderHome();
    const figure = screen.getByRole('figure', { name: /ภาพรวมผู้บริหาร/ });
    await within(figure).findByText('ภาพรวมองค์กร', {}, { timeout: 5000 });
    expect(figure.textContent).not.toMatch(/฿|บาท|\d{1,3}(,\d{3})+|ล้าน/);
  });
});

describe('homepage under reduced motion', () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it('renders every chapter in its finished state without autoplay controls', async () => {
    restore = mockReducedMotion();
    await renderHome();
    for (const { id } of CHAPTERS) expect(document.getElementById(id)).toBeInTheDocument();
    // Nothing auto-advances, so no pause/replay controls are needed.
    expect(screen.queryByRole('button', { name: /หยุดภาพเคลื่อนไหว/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /เล่นสถานการณ์อีกครั้ง/ })).toBeNull();
    // Every step of the route is presented at once.
    const steps = screen.getByRole('list', { name: /ขั้นตอนเส้นทาง/ });
    expect(within(steps).queryByRole('listitem', { current: 'step' })).toBeNull();
  });
});
