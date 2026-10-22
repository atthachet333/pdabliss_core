import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/render';
import { detectQuality, lowerQuality } from './core-world/quality';
import { WebGLBoundary } from './core-world/WebGLBoundary';

const DEPARTMENTS = ['ฝ่ายขาย', 'ปฏิบัติการ', 'คลังสินค้า', 'จัดซื้อ', 'บัญชีและการเงิน', 'รายงาน'];

function mockMatchMedia(matches: (query: string) => boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matches(query),
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

/** A minimal WebGL context so the capability probe succeeds. */
function mockWebGL(renderer = 'ANGLE (NVIDIA GeForce RTX)') {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => ({
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 1 }
        : { loseContext: () => {} },
    getParameter: () => renderer,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

describe('homepage hero — CORE Universe', () => {
  it('renders crawlable hero copy with the two CTAs', async () => {
    renderRoute('/');
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('ทุกแผนกทำงานได้เต็มที่');
    expect(h1).toHaveTextContent('ทุกงานเชื่อมเป็นระบบเดียว');
    expect(screen.getByText('Department Operations Platform')).toBeInTheDocument();
    expect(screen.getAllByText(/ออกแบบมาเพื่องานของตัวเอง/)[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ดูภาพรวมระบบ/ })).toHaveAttribute('href', '#preview');
    expect(screen.getByRole('link', { name: /สำรวจ CORE/ })).toHaveAttribute('href', '#core-story');
    // Anchor targets exist on the page.
    expect(document.getElementById('preview')).not.toBeNull();
    expect(document.getElementById('core-story')).not.toBeNull();
  });

  it('exposes one accessible control per orbiting department (no Admin in the orbit)', async () => {
    renderRoute('/');
    const group = await screen.findByRole('group', { name: 'แผนกที่เชื่อมกับ CORE' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(DEPARTMENTS);
    expect(within(group).queryByText(/ผู้ดูแลระบบ|ผู้บริหาร/)).not.toBeInTheDocument();
  });

  it('selecting a department opens its detail, and Escape closes it', async () => {
    renderRoute('/');
    const group = await screen.findByRole('group', { name: 'แผนกที่เชื่อมกับ CORE' });
    const warehouse = within(group).getByRole('button', { name: 'คลังสินค้า' });
    await userEvent.click(warehouse);
    expect(warehouse).toHaveAttribute('aria-pressed', 'true');
    const detail = document.getElementById('core-department-detail')!;
    await waitFor(() => expect(detail).toHaveTextContent('คลังสินค้า'));
    for (const item of ['รับสินค้า', 'Stock', 'Lot / Batch', 'วันหมดอายุ']) {
      expect(detail).toHaveTextContent(item);
    }
    expect(within(detail).getByRole('link', { name: /ดูแผนกนี้/ })).toHaveAttribute(
      'href',
      '/departments#warehouse',
    );
    // Warehouse detail never mentions money.
    expect(detail.textContent).not.toMatch(/฿|บาท|ราคา|ต้นทุน/);

    await userEvent.keyboard('{Escape}');
    expect(warehouse).toHaveAttribute('aria-pressed', 'false');
  });

  it('keyboard focus previews a department (same state as hovering its node)', async () => {
    renderRoute('/');
    const group = await screen.findByRole('group', { name: 'แผนกที่เชื่อมกับ CORE' });
    const sales = within(group).getByRole('button', { name: 'ฝ่ายขาย' });
    act(() => sales.focus());
    const detail = document.getElementById('core-department-detail')!;
    await waitFor(() => expect(detail).toHaveTextContent('Customer PO'));
    expect(detail).toHaveTextContent('Sales Order');
    await userEvent.keyboard('{Enter}');
    expect(sales).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the static CORE fallback when WebGL is unavailable', async () => {
    const { container } = renderRoute('/');
    const figure = await screen.findByRole('figure', { name: /CORE Universe/ });
    await waitFor(() =>
      expect(figure.querySelector('[data-quality]')).toHaveAttribute('data-quality', 'static'),
    );
    expect(figure.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    // CORE identity is still present without WebGL.
    expect(figure).toHaveTextContent('PDA BLISS');
    expect(figure).toHaveTextContent('CORE');
  });

  it('presents the story as four slides with crawlable headings and the real product UI', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    for (const id of ['core-world', 'core-story', 'core-flow', 'from-core-to-product']) {
      expect(document.getElementById(id)).toHaveAttribute('data-slide');
    }
    expect(
      screen.getByRole('heading', { level: 2, name: /ทุกแผนกมีพื้นที่ทำงานของตัวเอง/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /งานส่งต่อกันเอง/ })).toBeInTheDocument();
    const route = screen.getByRole('list', { name: 'ลำดับงานที่ส่งต่อกันระหว่างแผนก' });
    expect(within(route).getAllByRole('listitem')).toHaveLength(6);
    expect(
      screen.getByRole('heading', { level: 2, name: 'จากแนวคิด สู่หน้าจอที่ใช้งานจริง' }),
    ).toBeInTheDocument();
    // The product preview is the real Warehouse workspace UI (lazy), price-free.
    const product = screen.getByRole('figure', { name: /พื้นที่ทำงานคลังสินค้า/ });
    await within(product).findByText('งานคลังวันนี้');
    expect(product.textContent).not.toMatch(/฿|บาท|ราคา|ต้นทุน/);
  });

  it('offers a quiet slide indicator whose links target each slide', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'ส่วนของการนำเสนอ' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '#core-world',
      '#core-story',
      '#core-flow',
      '#from-core-to-product',
    ]);
  });

  it('never snaps or hijacks scrolling: free native scroll between slides', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(getComputedStyle(document.documentElement).scrollSnapType).not.toMatch(
      /mandatory|proximity/,
    );
    for (const id of ['core-world', 'core-story', 'core-flow', 'from-core-to-product']) {
      expect(document.getElementById(id)?.className).not.toMatch(/snap-/);
    }
  });

  it('never exposes prototype credentials on the public homepage', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    expect(document.body.textContent).not.toMatch(/pass1|user1/);
  });

  it('public navigation reaches other pages', async () => {
    const { router } = renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
    await userEvent.click(within(nav).getByRole('link', { name: 'ฟีเจอร์' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/features'));
  });
});

describe('reduced motion', () => {
  let restore: (() => void)[] = [];
  afterEach(() => {
    restore.forEach((r) => r());
    restore = [];
  });

  it('renders the full hero and story without motion', async () => {
    restore.push(mockMatchMedia((q) => q.includes('prefers-reduced-motion')));
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'ทุกแผนกทำงานได้เต็มที่',
    );
    expect(screen.getByRole('group', { name: 'แผนกที่เชื่อมกับ CORE' })).toBeInTheDocument();
    expect(document.getElementById('core-flow')).toBeInTheDocument();
  });

  it('selects the reduced quality tier (static scene, no loops)', () => {
    restore.push(mockWebGL());
    restore.push(mockMatchMedia((q) => q.includes('prefers-reduced-motion')));
    expect(detectQuality()).toBe('reduced');
  });
});

describe('adaptive quality', () => {
  let restore: (() => void)[] = [];
  afterEach(() => {
    restore.forEach((r) => r());
    restore = [];
  });

  it('falls back to static without WebGL or on a software renderer', () => {
    expect(detectQuality()).toBe('static');
    restore.push(mockWebGL('Google SwiftShader'));
    expect(detectQuality()).toBe('static');
  });

  it('uses the low tier on touch devices', () => {
    restore.push(mockWebGL());
    restore.push(mockMatchMedia((q) => q.includes('pointer: coarse')));
    expect(detectQuality()).toBe('low');
  });

  it('only ever steps quality down at runtime', () => {
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBe('low');
    expect(lowerQuality('reduced')).toBe('reduced');
  });
});

describe('WebGL failure', () => {
  it('a scene error is contained and reported, never blanking the page', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFail = vi.fn();
    function Broken(): never {
      throw new Error('Error creating WebGL context.');
    }
    render(
      <div>
        <p>hero copy stays</p>
        <WebGLBoundary onFail={onFail}>
          <Broken />
        </WebGLBoundary>
      </div>,
    );
    expect(onFail).toHaveBeenCalledOnce();
    expect(screen.getByText('hero copy stays')).toBeInTheDocument();
    warn.mockRestore();
    error.mockRestore();
  });
});
