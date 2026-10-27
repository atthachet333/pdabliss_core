/**
 * Generates PDA BLISS CORE raster assets from code-defined SVG sources.
 *
 *   npm run assets
 *
 * All visuals are abstract (orbits, networks, operational geometry) — no stock
 * photography. Outputs are small WebP/AVIF/PNG files in /public. The site never
 * depends on them for readability: every surface has a CSS fallback.
 * Department scenes are generated separately by build-department-scenes.mjs;
 * the brand set (logo, favicons, app icons, OG image) by build-brand.mjs.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Brand tokens (mirror src/styles/index.css)
const C = {
  dark: '#050b12',
  base: '#08121b',
  raised: '#0c1822',
  primary: '#19c39a',
  deep: '#0b5e4f',
  glow: '#3ef0c0',
  soft: '#b9f5e4',
  cool: '#5aa9ff',
};

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

async function out(rel, svg, { width, height, formats }) {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  const img = sharp(Buffer.from(svg)).resize(width, height);
  for (const f of formats) {
    const target = file.replace(/\.\w+$/, `.${f}`);
    const pipeline =
      f === 'webp'
        ? img.clone().webp({ quality: 72 })
        : f === 'avif'
          ? img.clone().avif({ quality: 50 })
          : img.clone().png({ compressionLevel: 9 });
    await pipeline.toFile(target);
    console.log('wrote', target.replace(root, 'public'));
  }
}

/* ---------- Hero atmosphere: nebula of brand light + data stars ---------- */
function atmosphere() {
  const r = rng(7);
  const stars = Array.from({ length: 220 }, () => {
    const x = r() * 1600;
    const y = r() * 1000;
    const s = 0.4 + r() * 1.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="${C.soft}" opacity="${(0.15 + r() * 0.6).toFixed(2)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <defs>
    <radialGradient id="a" cx="68%" cy="42%" r="45%"><stop offset="0" stop-color="${C.primary}" stop-opacity=".55"/><stop offset=".5" stop-color="${C.deep}" stop-opacity=".25"/><stop offset="1" stop-color="${C.dark}" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="15%" cy="85%" r="40%"><stop offset="0" stop-color="${C.cool}" stop-opacity=".3"/><stop offset="1" stop-color="${C.dark}" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="40"/></filter>
  </defs>
  <rect width="1600" height="1000" fill="${C.dark}"/>
  <g filter="url(#blur)"><rect width="1600" height="1000" fill="url(#a)"/><rect width="1600" height="1000" fill="url(#b)"/></g>
  ${stars}
</svg>`;
}

const tasks = [
  out('hero/atmosphere.webp', atmosphere(), {
    width: 1600,
    height: 1000,
    formats: ['webp', 'avif'],
  }),
];

await Promise.all(tasks);
