/**
 * Generates the PDA BLISS CORE brand asset set (EP24.1.3) from the single
 * vector source, src/components/brand/geometry.ts — the same geometry the
 * React logo renders, so files and site chrome never drift apart.
 *
 *   npm run assets:brand      (also part of `npm run assets`)
 *
 * Outputs (public/):
 *   brand/core-logo-{dark,light,mono-white,mono-dark}.svg   primary logo
 *   brand/core-mark-{dark,light,mono-white,mono-dark}.svg   symbol only
 *   brand/core-mark-large.svg · brand/core-app-icon.svg      large optical size
 *   brand/core-micro.svg                                    round favicon mark (16 px drawing)
 *   favicon.svg · favicon.ico (16/32/48) · favicon.png (32)
 *   brand/favicon-16.png · brand/favicon-48.png
 *   brand/apple-touch-icon.png (180) · brand/icon-192.png · brand/icon-512.png
 *   brand/og-image.png (1200 × 630)
 *
 * Node ≥ 22.18 imports the .ts module directly (type stripping).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  PALETTE,
  appIconInner,
  logoInner,
  markInner,
  microInner,
  svgDoc,
} from '../src/components/brand/geometry.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const NAME = 'PDA BLISS CORE';
const VARIANTS = ['dark', 'light', 'mono-white', 'mono-dark'];

async function write(rel, data) {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log('wrote', `public/${rel}`, `${(data.length / 1024).toFixed(1)} KiB`);
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

/* ---------- Vector files ---------- */
for (const v of VARIANTS) {
  const logo = logoInner('l', v);
  await write(`brand/core-logo-${v}.svg`, svgDoc(`0 0 ${logo.width} 64`, logo.markup, NAME));
  await write(`brand/core-mark-${v}.svg`, svgDoc('0 0 64 64', markInner('m', v), NAME));
}
// Large optical size (app icons, showcases): richest detail.
await write(
  'brand/core-mark-large.svg',
  svgDoc('0 0 64 64', markInner('g', 'dark', 'large'), NAME),
);
await write('brand/core-app-icon.svg', svgDoc('-12 -12 88 88', appIconInner('a', 12), NAME));
// The favicon is its own round mark, drawn for 16 px; 32 / 48 px use its derived drawing.
const micro = svgDoc('0 0 64 64', microInner('u', 16), NAME);
const micro32 = svgDoc('0 0 64 64', microInner('u', 32), NAME);
await write('brand/core-micro.svg', micro);
await write('favicon.svg', micro);

/* ---------- Favicons (micro mark) ---------- */
const sizes = [16, 32, 48];
const favicons = await Promise.all(sizes.map((s) => png(s >= 32 ? micro32 : micro, s)));
await write('favicon.png', favicons[1]);
await write('brand/favicon-16.png', favicons[0]);
await write('brand/favicon-48.png', favicons[2]);

// favicon.ico: an ICONDIR with PNG payloads (supported by every current browser).
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(favicons[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += favicons[i].length;
});
await write('favicon.ico', Buffer.concat([header, ...favicons]));

/* ---------- App icons (large mark on the dark field) ---------- */
// Apple masks its own corners, so the touch icon is full-bleed; 192 / 512 carry the squircle.
const appIcon = (pad, rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + pad * 2} ${64 + pad * 2}">${appIconInner('a', pad, rounded)}</svg>`;
await write('brand/apple-touch-icon.png', await png(appIcon(11, false), 180));
await write('brand/icon-192.png', await png(appIcon(12, true), 192));
await write('brand/icon-512.png', await png(appIcon(12, true), 512));

/* ---------- Open Graph image ---------- */
const logo = logoInner('o', 'dark', 'large');
const k = 840 / logo.width; // logo 840 px wide
const top = (630 - (64 * k + 84)) / 2;
const left = (1200 - 840) / 2;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="g"><stop offset="0" stop-color="${PALETTE.coreTeal}" stop-opacity=".2"/><stop offset="1" stop-color="${PALETTE.coreTeal}" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="${PALETTE.darkSurface}"/>
  <circle cx="${left + 32 * k}" cy="${top + 32 * k}" r="${60 * k}" fill="url(#g)"/>
  <g transform="translate(${left} ${top}) scale(${k})">${logo.markup}</g>
  <text x="600" y="${top + 64 * k + 74}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="8" fill="#A3B8B2">DEPARTMENT OPERATIONS PLATFORM</text>
</svg>`;
await write(
  'brand/og-image.png',
  await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true }).toBuffer(),
);

/* ---------- Retired ---------- */
await rm(join(root, 'brand', 'logo-mark.svg'), { force: true });
