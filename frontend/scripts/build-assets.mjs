/**
 * Generates PDA BLISS CORE raster assets from code-defined SVG sources.
 *
 *   npm run assets
 *
 * All visuals are abstract (orbits, networks, operational geometry) — no stock
 * photography. Outputs are small WebP/AVIF/PNG files in /public. The site never
 * depends on them for readability: every surface has a CSS fallback.
 */
import { mkdir, writeFile } from 'node:fs/promises';
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

/* ---------- Department signature motifs ---------- */
const frame = (
  body,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs><radialGradient id="g" cx="80%" cy="10%" r="80%"><stop offset="0" stop-color="${C.primary}" stop-opacity=".35"/><stop offset="1" stop-color="${C.base}" stop-opacity="0"/></radialGradient></defs>
  <rect width="640" height="400" fill="${C.base}"/><rect width="640" height="400" fill="url(#g)"/>${body}</svg>`;

const line = (x1, y1, x2, y2, o = 0.5, c = C.glow) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-opacity="${o}" stroke-width="1.5"/>`;

const motifs = {
  // Ascending order flow
  sales: frame(
    Array.from({ length: 9 }, (_, i) => {
      const h = 60 + i * 26;
      return `<rect x="${60 + i * 62}" y="${360 - h}" width="34" height="${h}" rx="6" fill="${C.primary}" fill-opacity="${0.15 + i * 0.06}"/>`;
    }).join('') +
      `<path d="M60 300 C 220 260, 380 180, 600 80" stroke="${C.glow}" stroke-width="2" fill="none" stroke-opacity=".7"/>`,
  ),
  // Rack grid with lot markers
  warehouse: frame(
    Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 7 }, (_, c) => {
        const lit = (r * 7 + c) % 5 === 0;
        return `<rect x="${50 + c * 80}" y="${50 + r * 80}" width="64" height="56" rx="6" fill="${lit ? C.primary : C.raised}" fill-opacity="${lit ? 0.45 : 0.9}" stroke="${C.soft}" stroke-opacity=".12"/>`;
      }).join(''),
    ).join(''),
  ),
  // Supplier network converging to one node
  purchasing: frame(
    (() => {
      const r = rng(3);
      const pts = Array.from({ length: 10 }, () => [40 + r() * 260, 30 + r() * 340]);
      return (
        pts
          .map(
            ([x, y]) =>
              line(x, y, 500, 200, 0.35) +
              `<circle cx="${x}" cy="${y}" r="6" fill="${C.cool}" fill-opacity=".6"/>`,
          )
          .join('') +
        `<circle cx="500" cy="200" r="34" fill="${C.deep}" stroke="${C.glow}" stroke-width="2"/>`
      );
    })(),
  ),
  // Work order timeline / gantt
  operations: frame(
    Array.from({ length: 6 }, (_, i) => {
      const x = 60 + ((i * 97) % 280);
      const w = 140 + ((i * 53) % 160);
      return `<rect x="${x}" y="${50 + i * 52}" width="${w}" height="24" rx="12" fill="${i === 2 ? C.cool : C.primary}" fill-opacity="${0.25 + (i % 3) * 0.15}"/>`;
    }).join('') + line(330, 30, 330, 370, 0.6),
  ),
  // Ledger lines with linked document chips
  accounting: frame(
    Array.from({ length: 9 }, (_, i) => line(60, 60 + i * 34, 580, 60 + i * 34, 0.12, C.soft)).join(
      '',
    ) +
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="${80 + i * 130}" y="170" width="96" height="60" rx="10" fill="${C.raised}" stroke="${C.glow}" stroke-opacity=".5"/>`,
        )
        .join('') +
      [0, 1, 2].map((i) => line(176 + i * 130, 200, 210 + i * 130, 200, 0.8)).join(''),
  ),
  // Concentric KPI rings
  reports: frame(
    [150, 110, 70]
      .map(
        (rad, i) =>
          `<circle cx="320" cy="200" r="${rad}" fill="none" stroke="${[C.primary, C.cool, C.glow][i]}" stroke-width="14" stroke-opacity=".4" stroke-dasharray="${rad * 4} ${rad * 2.3}" stroke-linecap="round"/>`,
      )
      .join(''),
  ),
  // Command view: orbit with all departments
  executive: frame(
    `<circle cx="320" cy="200" r="150" fill="none" stroke="${C.glow}" stroke-opacity=".25" stroke-dasharray="3 9"/>` +
      Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const x = 320 + 150 * Math.cos(a);
        const y = 200 + 150 * Math.sin(a);
        return (
          line(x, y, 320, 200, 0.3) +
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="${C.raised}" stroke="${C.glow}" stroke-opacity=".7"/>`
        );
      }).join('') +
      `<circle cx="320" cy="200" r="40" fill="${C.deep}" stroke="${C.glow}" stroke-width="2"/>`,
  ),
};

/* ---------- Brand mark (favicon / touch icon / OG) ---------- */
function mark(size, padding = 0) {
  const s = 40;
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `<circle cx="${(20 + 17 * Math.cos(a)).toFixed(2)}" cy="${(20 + 17 * Math.sin(a)).toFixed(2)}" r="2" fill="${C.glow}"/>`;
  }).join('');
  const inner = `<radialGradient id="c" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="${C.soft}"/><stop offset=".55" stop-color="${C.glow}"/><stop offset="1" stop-color="${C.deep}"/></radialGradient>`;
  const body = `<circle cx="20" cy="20" r="17" fill="none" stroke="${C.primary}" stroke-opacity=".6" stroke-width="1.2"/>${nodes}<circle cx="20" cy="20" r="8" fill="url(#c)"/><circle cx="20" cy="20" r="11.5" fill="none" stroke="${C.glow}" stroke-opacity=".3"/>`;
  const vb = `${-padding} ${-padding} ${s + padding * 2} ${s + padding * 2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}"><defs>${inner}</defs>${padding ? `<rect x="${-padding}" y="${-padding}" width="${s + padding * 2}" height="${s + padding * 2}" rx="${(s + padding * 2) * 0.22}" fill="${C.dark}"/>` : ''}${body}</svg>`;
}

function ogImage() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="a" cx="78%" cy="45%" r="55%"><stop offset="0" stop-color="${C.primary}" stop-opacity=".45"/><stop offset="1" stop-color="${C.dark}" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="${C.dark}"/><rect width="1200" height="630" fill="url(#a)"/>
  <g transform="translate(930 315)">
    <circle r="220" fill="none" stroke="${C.glow}" stroke-opacity=".2" stroke-dasharray="3 10"/>
    ${Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const x = (220 * Math.cos(a)).toFixed(1);
      const y = (220 * Math.sin(a)).toFixed(1);
      return `<line x1="${x}" y1="${y}" x2="0" y2="0" stroke="${C.primary}" stroke-opacity=".35" stroke-width="2"/><rect x="${x - 26}" y="${y - 26}" width="52" height="52" rx="14" fill="${C.raised}" stroke="${C.glow}" stroke-opacity=".5"/>`;
    }).join('')}
    <circle r="90" fill="${C.raised}" stroke="${C.glow}" stroke-width="3"/>
    <text y="12" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="40" letter-spacing="5" fill="#eef6f3">CORE</text>
  </g>
  <text x="80" y="250" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="8" fill="${C.glow}">PDA BLISS</text>
  <text x="76" y="335" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="92" fill="#eef6f3">CORE</text>
  <text x="80" y="400" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#a3b8b2">Department Operations Platform</text>
</svg>`;
}

const tasks = [
  out('hero/atmosphere.webp', atmosphere(), {
    width: 1600,
    height: 1000,
    formats: ['webp', 'avif'],
  }),
  ...Object.entries(motifs).map(([id, svg]) =>
    out(`departments/${id}.webp`, svg, { width: 640, height: 400, formats: ['webp'] }),
  ),
  out('favicon.png', mark(64), { width: 64, height: 64, formats: ['png'] }),
  out('brand/apple-touch-icon.png', mark(180, 6), { width: 180, height: 180, formats: ['png'] }),
  out('brand/og-image.png', ogImage(), { width: 1200, height: 630, formats: ['png'] }),
];

await Promise.all(tasks);
await writeFile(join(root, 'favicon.svg'), mark(64));
await writeFile(join(root, 'brand', 'logo-mark.svg'), mark(40));
console.log('wrote public/favicon.svg, public/brand/logo-mark.svg');
