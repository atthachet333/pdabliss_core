import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PALETTE,
  appIconInner,
  logoInner,
  markInner,
  microInner,
  type MarkVariant,
} from './geometry';
import { Logo, LogoMark } from './Logo';
import indexHtml from '../../../index.html?raw';

/* EP24.1.3 — production brand identity: geometry, generated files, wiring. */

// The shipped public files, read through Vite (text as-is, binaries as base64).
const TEXT = import.meta.glob<string>('/public/**/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BIN = import.meta.glob<string>(['/public/**/*.png', '/public/favicon.ico'], {
  query: '?inline',
  import: 'default',
  eager: true,
});
const exists = (p: string) => `/public${p}` in TEXT || `/public${p}` in BIN;
const text = (p: string) => TEXT[`/public/${p}`]!;
function bytes(p: string) {
  const b64 = BIN[`/public/${p}`]!.split(',')[1]!;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
const VARIANTS: MarkVariant[] = ['dark', 'light', 'mono-white', 'mono-dark'];

/** Width × height from a PNG's IHDR chunk. */
function pngSize(p: string) {
  const b = new DataView(bytes(p).buffer);
  expect(b.getUint32(0)).toBe(0x89504e47); // PNG
  return { w: b.getUint32(16), h: b.getUint32(20) };
}

describe('brand geometry', () => {
  it.each(VARIANTS)('the %s mark and logo are clean, finite vectors', (v) => {
    for (const svg of [
      markInner('t', v),
      markInner('t', v, 'large'),
      logoInner('t', v).markup,
      microInner('t'),
      appIconInner('t', 12),
    ]) {
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      // Vector only: no raster, no filters, no external references.
      expect(svg).not.toMatch(/<image|<filter|data:|href=|<text/);
    }
    expect(logoInner('t', v).width).toBeGreaterThan(200);
  });

  it('scopes gradient ids by instance id', () => {
    expect(markInner('a1', 'dark')).toContain('id="a1c"');
    expect(markInner('a1', 'dark')).toContain('url(#a1c)');
    expect(markInner('b2', 'dark')).not.toContain('a1');
  });

  it('is an optical-size system: micro simplest, mark medium, large richest', () => {
    const count = (svg: string) => (svg.match(/<(path|circle|ellipse)\b/g) ?? []).length;
    const micro = microInner('u');
    const mark = markInner('m', 'dark');
    const large = markInner('g', 'dark', 'large');
    expect(count(micro)).toBeLessThan(count(mark));
    expect(count(mark)).toBeLessThan(count(large));
    expect(markInner('x', 'dark', 'micro')).toBe(microInner('x'));
  });

  it('the favicon is its own round mark, drawn for 16 px first', () => {
    const micro = microInner('u', 16);
    // Round object: a disc field (transparent outside it), no square tile.
    expect(micro).toContain('<circle cx="32" cy="32" r="32"');
    expect(micro).not.toMatch(/<rect/);
    // Core ≈ 56 % of the diameter; one ring, one teal node, nothing translucent.
    expect(micro).toContain('<circle cx="32" cy="32" r="18"');
    expect(micro.split(PALETTE.coreTeal)).toHaveLength(2);
    expect(micro).not.toMatch(/opacity=/);
    // No hairlines: every stroke ≥ 1 px at 16 px (4 units).
    const widths = [...micro.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(4);
    // 32 / 48 px is a derived drawing, not the same one scaled.
    expect(microInner('u', 32)).not.toBe(micro);
  });

  it('keeps colour out of the monochrome variants and gold out of the logo', () => {
    expect(markInner('m', 'mono-white')).not.toMatch(/#00E5C2|Gradient/);
    expect(markInner('m', 'mono-dark')).not.toMatch(/#00E5C2|Gradient/);
    for (const v of VARIANTS) expect(logoInner('x', v).markup).not.toContain(PALETTE.authorityGold);
  });
});

describe('brand files', () => {
  const svgs = [
    ...VARIANTS.flatMap((v) => [`brand/core-logo-${v}.svg`, `brand/core-mark-${v}.svg`]),
    'brand/core-mark-large.svg',
    'brand/core-app-icon.svg',
    'brand/core-micro.svg',
    'favicon.svg',
  ];

  it.each(svgs)('%s is a titled, vector-only SVG', (f) => {
    const svg = text(f);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
    expect(svg).toContain('<title>PDA BLISS CORE</title>');
    expect(svg).not.toMatch(/<image|<filter|data:|NaN/);
  });

  it('ships every raster size', () => {
    expect(pngSize('favicon.png')).toEqual({ w: 32, h: 32 });
    expect(pngSize('brand/favicon-16.png')).toEqual({ w: 16, h: 16 });
    expect(pngSize('brand/favicon-48.png')).toEqual({ w: 48, h: 48 });
    expect(pngSize('brand/apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
    expect(pngSize('brand/icon-192.png')).toEqual({ w: 192, h: 192 });
    expect(pngSize('brand/icon-512.png')).toEqual({ w: 512, h: 512 });
    expect(pngSize('brand/og-image.png')).toEqual({ w: 1200, h: 630 });
  });

  // Not linked (saves a line in every prerendered head); served for /favicon.ico defaults.
  it('favicon.ico holds 16, 32 and 48 px images', () => {
    const ico = new DataView(bytes('favicon.ico').buffer);
    expect(ico.getUint16(2, true)).toBe(1);
    expect(ico.getUint16(4, true)).toBe(3);
    expect([0, 1, 2].map((i) => ico.getUint8(6 + 16 * i))).toEqual([16, 32, 48]);
  });

  it('every icon and social link in index.html resolves to a shipped file', () => {
    const html = indexHtml;
    const links = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(links).toEqual([
      '/favicon.svg',
      '/favicon.png',
      '/brand/icon-192.png',
      '/brand/apple-touch-icon.png',
    ]);
    for (const l of links) expect(exists(l), l).toBe(true);
    const og = /property="og:image" content="https:\/\/core\.pdabliss\.com(\/[^"]+)"/.exec(html);
    expect(exists(og![1]!)).toBe(true);
    expect(html).toContain('href="/favicon.png" type="image/png" sizes="32x32"');
  });

  it('the retired placeholder mark is gone', () => {
    expect(exists('/brand/logo-mark.svg')).toBe(false);
  });
});

describe('<Logo /> and <LogoMark />', () => {
  it('names the logo once; the artwork stays decorative', () => {
    const { container } = render(
      <a href="/">
        <Logo compact />
      </a>,
    );
    expect(screen.getByRole('link', { name: 'PDA BLISS CORE' })).toBeInTheDocument();
    for (const svg of container.querySelectorAll('a > span > svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.querySelectorAll('path').length).toBeGreaterThan(10); // vector wordmark
  });

  it('the full lockup adds Department Operations', () => {
    render(
      <a href="/">
        <Logo />
      </a>,
    );
    expect(
      screen.getByRole('link', { name: 'PDA BLISS CORE Department Operations' }),
    ).toBeInTheDocument();
  });

  it('a labelled link keeps its own name (no duplicate announcement)', () => {
    render(
      <a href="/" aria-label="PDA BLISS CORE Department Operations — home">
        <Logo />
      </a>,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'PDA BLISS CORE Department Operations — home' }),
    ).toBeInTheDocument();
  });

  it('gives every instance its own gradient ids', () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
        <Logo compact />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(3);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = [...container.querySelectorAll('[fill^="url(#"],[stroke^="url(#"],[mask]')].map(
      (el) =>
        (['fill', 'stroke', 'mask'] as const)
          .map((a) => el.getAttribute(a))
          .find((v) => v?.startsWith('url(#'))!
          .slice(5, -1),
    );
    expect(refs.length).toBeGreaterThan(6);
    for (const ref of refs) expect(container.querySelector(`[id="${ref}"]`)).not.toBeNull();
  });
});
