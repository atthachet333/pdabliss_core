/**
 * PDA BLISS CORE — department scenes (EP05 revision).
 *
 *   npm run assets          (runs this after build-assets.mjs)
 *   node scripts/build-department-scenes.mjs --out <dir>   (preview elsewhere)
 *
 * Seven cinematic, one-point-perspective environments — "the world of each
 * department inside CORE" — drawn in code and rendered to WebP. No stock
 * photography, no people's faces, no brand logos, no prices. Every scene
 * shares one camera, one room language and the CORE palette (obsidian, deep
 * navy, emerald / teal / cyan light), so the set reads as one brand world.
 *
 * Outputs per department:  public/departments/<id>.webp     960×540 (detail)
 *                          public/departments/<id>-sm.webp  400×225 (cards)
 *
 * The images are decorative: the site never relies on them for meaning (every
 * card also carries the department name and description as text). They can be
 * replaced by any 16:9 artwork with the same file names.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf('--out');
const outDir =
  outArg > -1 ? resolve(process.argv[outArg + 1]) : join(here, '..', 'public', 'departments');

/* ------------------------------------------------------------------------ */
/* Palette and camera                                                        */
/* ------------------------------------------------------------------------ */

const C = {
  void: '#03070b',
  dark: '#050b12',
  base: '#08131c',
  wall: '#0a1822',
  raised: '#0f202c',
  line: '#1b3340',
  glow: '#3ef0c0',
  primary: '#19c39a',
  deep: '#0b5e4f',
  teal: '#2bb5a8',
  cyan: '#7fd6ff',
  soft: '#b9f5e4',
  text: '#d9efe9',
  muted: '#6f8f89',
  amber: '#f5b84b',
};

const W = 1600;
const H = 900;
const F = 980; // focal length (px)
const CX = 800;
const CY = 430;
const EYE = 1.55; // camera height (m)

/** World (metres) → screen. x right, y up, z forward (away from the camera). */
const P = (x, y, z) => [CX + (F * x) / z, CY - (F * (y - EYE)) / z];
const n = (v) => Number(v.toFixed(1));
const pts = (list) => list.map((p) => `${n(p[0])},${n(p[1])}`).join(' ');
const poly = (list, attrs) => `<polygon points="${pts(list)}" ${attrs}/>`;
/** Plane facing the camera (constant z). */
const qz = (x0, x1, y0, y1, z) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
/** Plane parallel to the side walls (constant x). */
const qx = (x, y0, y1, z0, z1) => [P(x, y0, z0), P(x, y0, z1), P(x, y1, z1), P(x, y1, z0)];
/** Horizontal plane (constant y). */
const qy = (x0, x1, y, z0, z1) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ------------------------------------------------------------------------ */
/* Shared defs, room and finishing                                           */
/* ------------------------------------------------------------------------ */

function defs(accent) {
  return `<defs>
  <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="dof" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#03070b"/><stop offset="1" stop-color="#08141c"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#07121a"/><stop offset="1" stop-color="#010305"/>
  </linearGradient>
  <linearGradient id="side" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#010305"/><stop offset="1" stop-color="#050d13"/>
  </linearGradient>
  <linearGradient id="sideR" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="#010305"/><stop offset="1" stop-color="#050d13"/>
  </linearGradient>
  <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#010204"/><stop offset="1" stop-color="#040a0f"/>
  </linearGradient>
  <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0c2230"/><stop offset="1" stop-color="#071722"/>
  </linearGradient>
  <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#132631"/><stop offset="1" stop-color="#091520"/>
  </linearGradient>
  <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${accent}" stop-opacity=".09"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="sky" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="${accent}" stop-opacity=".32"/><stop offset=".35" stop-color="#06161c"/><stop offset="1" stop-color="#02060a"/>
  </linearGradient>
  <radialGradient id="vignette" cx="50%" cy="48%" r="75%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".78"/>
  </radialGradient>
  <radialGradient id="pool" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="${accent}" stop-opacity=".13"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}

/** Room shell: floor, walls, ceiling with light strips. */
function room({ width = 6.2, depth = 11, height = 3.7, near = 1.1, accent }) {
  const floor = poly(qy(-width, width, 0, near, depth), 'fill="url(#floor)"');
  const back = poly(qz(-width, width, 0, height, depth), 'fill="url(#wall)"');
  const left = poly(qx(-width, 0, height, near, depth), 'fill="url(#side)"');
  const right = poly(qx(width, 0, height, near, depth), 'fill="url(#sideR)"');
  const ceil = poly(qy(-width, width, height, near, depth), 'fill="url(#ceil)"');
  // Floor seams converging to the vanishing point, plus cross seams.
  let grid = '';
  for (let x = -width; x <= width + 0.01; x += 1.2) {
    const a = P(x, 0, near);
    const b = P(x, 0, depth);
    grid += `<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`;
  }
  for (let z = 2; z < depth; z *= 1.32) {
    const a = P(-width, 0, z);
    const b = P(width, 0, z);
    grid += `<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}"/>`;
  }
  // Recessed downlights with soft light cones (volumetric haze).
  let strips = '';
  let cones = '';
  for (const z of [4.6, 6.8, 9.0]) {
    for (const x of [-3, 0, 3]) {
      strips += poly(
        qy(x - 0.16, x + 0.16, height - 0.01, z, z + 0.22),
        `fill="${C.soft}" opacity=".85"`,
      );
      const top = [P(x - 0.16, height, z + 0.1), P(x + 0.16, height, z + 0.1)];
      const bottom = [P(x + 0.9, 0, z + 0.1), P(x - 0.9, 0, z + 0.1)];
      cones += `<polygon points="${pts([...top, ...bottom])}" fill="${C.soft}" opacity=".035"/>`;
    }
  }
  // Accent LED slits on the side walls.
  let pil = '';
  for (const z of [3.2, 5.6, 8.0, 10.2]) {
    pil += poly(
      qx(-width + 0.01, 0.15, height - 0.3, z, z + 0.05),
      `fill="${accent}" opacity=".7"`,
    );
    pil += poly(qx(width - 0.01, 0.15, height - 0.3, z, z + 0.05), `fill="${accent}" opacity=".7"`);
  }
  const pilGlow = `<g filter="url(#soft)">${pil}</g>`;
  // Accent wash on the back wall.
  const c = P(0, 1.9, depth - 0.02);
  const wash = `<ellipse cx="${n(c[0])}" cy="${n(c[1])}" rx="${n((F * 5) / depth)}" ry="${n((F * 1.8) / depth)}" fill="${accent}" opacity=".14" filter="url(#bloom)"/>`;
  // Light line where the floor meets the back wall.
  const joint = poly(qz(-width, width, 0, 0.03, depth - 0.01), `fill="${accent}" opacity=".35"`);
  // Two data lanes on the floor leading to the main display (the CORE thread).
  let lanes = '';
  for (const x of [-0.9, 0.9]) {
    lanes += poly(
      qy(x - 0.025, x + 0.025, 0.002, 1.6, depth - 0.05),
      `fill="${accent}" opacity=".55"`,
    );
  }
  const laneGlow = `<g filter="url(#soft)">${lanes}</g>`;
  return `${back}${wash}${floor}${laneGlow}${lanes}${left}${right}${ceil}${joint}
  <g stroke="${accent}" stroke-opacity=".07" stroke-width="1">${grid}</g>
  <g filter="url(#soft)">${strips}</g>${strips}<g filter="url(#soft)">${cones}</g>${pilGlow}${pil}`;
}

function finish(accent) {
  // Light pools, haze, vignette.
  return `<ellipse cx="${CX}" cy="${CY + 250}" rx="620" ry="120" fill="url(#pool)"/>
  <rect width="${W}" height="${H}" fill="${accent}" opacity=".02"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>`;
}

/* ------------------------------------------------------------------------ */
/* Objects                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * A display facing the camera. `inner` is drawn in a local w×h coordinate
 * space mapped onto the projected rectangle; it glows and reflects on the floor.
 */
function display({
  x0,
  x1,
  y0,
  y1,
  z,
  w = 1000,
  h = 560,
  inner,
  accent,
  glow = 0.7,
  reflect = true,
}) {
  const tl = P(x0, y1, z);
  const br = P(x1, y0, z);
  const sx = (br[0] - tl[0]) / w;
  const sy = (br[1] - tl[1]) / h;
  const frame = poly(
    qz(x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, z),
    `fill="#04090d" stroke="${accent}" stroke-opacity=".35" stroke-width="1.2"`,
  );
  const halo = poly(
    qz(x0, x1, y0, y1, z),
    `fill="${accent}" opacity="${glow}" filter="url(#bloom)"`,
  );
  const body = `<g transform="translate(${n(tl[0])} ${n(tl[1])}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})">
    <rect width="${w}" height="${h}" fill="url(#screen)"/>${inner}
    <rect width="${w}" height="${h}" fill="none" stroke="${accent}" stroke-opacity=".25" stroke-width="2"/>
  </g>`;
  let refl = '';
  if (reflect && y0 > 0.2) {
    const a = P(x0, 0, z - 0.1);
    const b = P(x1, 0, z - 0.1);
    const depthPx = Math.min(140, (F * (y1 - y0)) / z / 2);
    refl = `<polygon points="${n(a[0])},${n(a[1])} ${n(b[0])},${n(b[1])} ${n(b[0] + 30)},${n(b[1] + depthPx)} ${n(a[0] - 30)},${n(a[1] + depthPx)}" fill="url(#reflect)" filter="url(#soft)"/>`;
  }
  return `${halo}${refl}${frame}${body}`;
}

/** A box seen from the camera: inner side face, top (if below eye) and front. */
function box({
  x0,
  x1,
  y0,
  y1,
  z0,
  z1,
  front = 'url(#desk)',
  top = '#16303c',
  side = '#081219',
  stroke,
}) {
  const st = stroke ? `stroke="${stroke}" stroke-opacity=".35" stroke-width="1"` : '';
  let s = '';
  if (x1 < 0) s += poly(qx(x1, y0, y1, z0, z1), `fill="${side}" ${st}`);
  if (x0 > 0) s += poly(qx(x0, y0, y1, z0, z1), `fill="${side}" ${st}`);
  if (y1 < EYE) s += poly(qy(x0, x1, y1, z0, z1), `fill="${top}" ${st}`);
  if (y0 > EYE) s += poly(qy(x0, x1, y0, z0, z1), `fill="${side}" ${st}`);
  s += poly(qz(x0, x1, y0, y1, z0), `fill="${front}" ${st}`);
  return s;
}

/** Desk with a thin glowing edge. */
function desk({ x0, x1, z0, z1, h = 0.76, accent }) {
  const top = box({ x0, x1, y0: h - 0.05, y1: h, z0, z1, top: '#13262f', front: '#0d1c25' });
  const legs = [x0 + 0.08, x1 - 0.12]
    .map((x) =>
      box({
        x0: x,
        x1: x + 0.05,
        y0: 0,
        y1: h - 0.05,
        z0: z0 + 0.05,
        z1: z0 + 0.1,
        front: '#060d12',
      }),
    )
    .join('');
  const edge = qz(x0, x1, h - 0.012, h, z0);
  return `${legs}${top}${poly(edge, `fill="${accent}" opacity=".55"`)}`;
}

/** Monitor on a desk (front-facing), seen from behind the user or from the side. */
function monitor({ x, w = 0.62, z, base = 0.76, hgt = 0.38, inner, accent, glow = 0.45 }) {
  const stand = box({
    x0: x - 0.02,
    x1: x + 0.02,
    y0: base,
    y1: base + 0.12,
    z0: z + 0.02,
    z1: z + 0.06,
    front: '#071016',
  });
  return `${stand}${display({ x0: x - w / 2, x1: x + w / 2, y0: base + 0.1, y1: base + 0.1 + hgt, z, inner, accent, glow, reflect: false })}`;
}

/**
 * Human silhouette, backlit (no faces, no identity). `sit` draws head and
 * shoulders above a chair back for someone working at a desk.
 */
function person({ x, z, h = 1.74, sit = false, accent, lean = 0, blur = false }) {
  const s = F / z;
  const [bx, by] = P(x, 0, z);
  const u = (m) => m * s;
  const headR = u(0.105);
  let body;
  if (sit) {
    const seatY = by - u(0.78);
    const headY = seatY - u(0.62);
    body = `<path d="M ${n(bx - u(0.24))} ${n(seatY + u(0.06))}
      C ${n(bx - u(0.26))} ${n(seatY - u(0.32))}, ${n(bx - u(0.2))} ${n(seatY - u(0.44))}, ${n(bx - u(0.08))} ${n(seatY - u(0.46))}
      L ${n(bx + u(0.08))} ${n(seatY - u(0.46))}
      C ${n(bx + u(0.2))} ${n(seatY - u(0.44))}, ${n(bx + u(0.26))} ${n(seatY - u(0.32))}, ${n(bx + u(0.24))} ${n(seatY + u(0.06))} Z"/>
      <ellipse cx="${n(bx + u(lean))}" cy="${n(headY)}" rx="${n(headR * 0.92)}" ry="${n(headR * 1.08)}"/>
      <rect x="${n(bx - u(0.25))}" y="${n(seatY - u(0.08))}" width="${n(u(0.5))}" height="${n(u(0.38))}" rx="${n(u(0.08))}"/>
`;
  } else {
    const hip = by - u(h * 0.52);
    const sh = by - u(h * 0.81);
    const headY = by - u(h * 0.92);
    body = `<path d="M ${n(bx - u(0.09))} ${n(by)} L ${n(bx - u(0.12))} ${n(hip)} L ${n(bx - u(0.19))} ${n(sh + u(0.06))}
      C ${n(bx - u(0.2))} ${n(sh - u(0.02))}, ${n(bx - u(0.12))} ${n(sh - u(0.05))}, ${n(bx - u(0.05))} ${n(sh - u(0.06))}
      L ${n(bx + u(0.05))} ${n(sh - u(0.06))}
      C ${n(bx + u(0.12))} ${n(sh - u(0.05))}, ${n(bx + u(0.2))} ${n(sh - u(0.02))}, ${n(bx + u(0.19))} ${n(sh + u(0.06))}
      L ${n(bx + u(0.12))} ${n(hip)} L ${n(bx + u(0.09))} ${n(by)} L ${n(bx + u(0.02))} ${n(by)} L ${n(bx)} ${n(hip + u(0.1))} L ${n(bx - u(0.02))} ${n(by)} Z"/>
      <ellipse cx="${n(bx + u(lean))}" cy="${n(headY)}" rx="${n(headR * 0.9)}" ry="${n(headR * 1.06)}"/>`;
  }
  const halo = `<g fill="${accent}" opacity=".32" filter="url(#soft)" transform="translate(0 ${n(-u(0.01))})">${body}</g>`;
  const shadow = sit
    ? ''
    : `<ellipse cx="${n(bx)}" cy="${n(by)}" rx="${n(u(0.32))}" ry="${n(u(0.05))}" fill="#000" opacity=".55"/>`;
  return `<g${blur ? ' filter="url(#dof)"' : ''}>${shadow}${halo}<g fill="${C.void}">${body}</g></g>`;
}

/* ------------------------------------------------------------------------ */
/* UI vocabulary (local screen coordinates)                                   */
/* ------------------------------------------------------------------------ */

const font = `font-family="Helvetica, Arial, sans-serif"`;
const T = (x, y, s, size, fill = C.text, extra = '') =>
  `<text x="${x}" y="${y}" ${font} font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;

function chrome(w, h, title, accent) {
  return `<rect width="${w}" height="44" fill="#0b1b25"/>
  <circle cx="26" cy="22" r="7" fill="${accent}" opacity=".9"/>
  ${T(46, 29, title, 18, C.text, 'letter-spacing="3"')}
  <rect x="${w - 210}" y="12" width="180" height="20" rx="10" fill="#081520" stroke="${C.line}"/>`;
}

const pill = (x, y, w, color, o = 0.85) =>
  `<rect x="${x}" y="${y}" width="${w}" height="16" rx="8" fill="${color}" opacity="${o}"/>`;

function rows(x, y, w, count, accent, r, opts = {}) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const yy = y + i * (opts.gap ?? 48);
    s += `<rect x="${x}" y="${yy}" width="${w}" height="${(opts.gap ?? 48) - 10}" rx="6" fill="#10283a" opacity=".95"/>`;
    s += `<rect x="${x + 18}" y="${yy + 14}" width="${70 + r() * 90}" height="10" rx="5" fill="${C.text}" opacity=".8"/>`;
    s += `<rect x="${x + 220}" y="${yy + 14}" width="${60 + r() * 120}" height="10" rx="5" fill="${accent}" opacity=".45"/>`;
    const st = opts.status ? opts.status(i) : r() > 0.7 ? C.amber : accent;
    s += pill(x + w - 120, yy + 11, 96, st, 0.75);
  }
  return s;
}

function bars(x, y, w, h, values, accent) {
  const bw = w / values.length;
  return values
    .map((v, i) => {
      const bh = v * h;
      return `<rect x="${n(x + i * bw + bw * 0.18)}" y="${n(y + h - bh)}" width="${n(bw * 0.64)}" height="${n(bh)}" rx="4" fill="${accent}" opacity="${(0.35 + 0.55 * (i / values.length)).toFixed(2)}"/>`;
    })
    .join('');
}

function lineChart(x, y, w, h, values, color, area = true) {
  const step = w / (values.length - 1);
  const ptsL = values.map((v, i) => [x + i * step, y + h - v * h]);
  const d = ptsL.map((p, i) => `${i ? 'L' : 'M'} ${n(p[0])} ${n(p[1])}`).join(' ');
  const fill = area
    ? `<path d="${d} L ${x + w} ${y + h} L ${x} ${y + h} Z" fill="${color}" opacity=".12"/>`
    : '';
  return `${fill}<path d="${d}" fill="none" stroke="${color}" stroke-width="3"/>`;
}

function donut(cx, cy, r, parts, colors) {
  let a = -Math.PI / 2;
  return parts
    .map((p, i) => {
      const b = a + p * Math.PI * 2;
      const large = p > 0.5 ? 1 : 0;
      const d = `M ${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))} A ${r} ${r} 0 ${large} 1 ${n(cx + r * Math.cos(b - 0.04))} ${n(cy + r * Math.sin(b - 0.04))}`;
      a = b;
      return `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${r * 0.32}"/>`;
    })
    .join('');
}

function kpi(x, y, value, label, accent) {
  return `<rect x="${x}" y="${y}" width="200" height="96" rx="10" fill="#0c1d27"/>
  ${T(x + 18, y + 54, value, 38, C.text, 'font-weight="600"')}
  <rect x="${x + 18}" y="${y + 70}" width="90" height="8" rx="4" fill="${accent}" opacity=".6"/>
  ${T(x + 120, y + 78, label, 13, C.muted)}`;
}

/* ------------------------------------------------------------------------ */
/* Scenes                                                                     */
/* ------------------------------------------------------------------------ */

function frame(accent, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(accent)}<rect width="${W}" height="${H}" fill="${C.dark}"/>
  ${content}${finish(accent)}</svg>`;
}

/** SALES — order pipeline wall, delivery route, a sales desk. */
function sales() {
  const a = C.cyan;
  const r = rng(11);
  const cols = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
  let kanban = chrome(1000, 560, 'ORDERS', a);
  cols.forEach((c, i) => {
    const x = 24 + i * 150;
    kanban += T(x, 82, c, 14, C.muted, 'letter-spacing="2"');
    const count = [4, 3, 3, 2, 3][i];
    for (let k = 0; k < count; k++) {
      const y = 98 + k * 92;
      kanban += `<rect x="${x}" y="${y}" width="134" height="80" rx="8" fill="#0d212c" stroke="${i === 3 ? a : C.line}" stroke-opacity="${i === 3 ? 0.8 : 1}"/>`;
      kanban += T(
        x + 12,
        y + 26,
        `SO-24${(10 + i * 7 + k).toString().padStart(2, '0')}`,
        15,
        C.text,
      );
      kanban += `<rect x="${x + 12}" y="${y + 40}" width="${60 + r() * 50}" height="8" rx="4" fill="${C.muted}" opacity=".6"/>`;
      kanban += pill(x + 12, y + 56, 52 + r() * 40, i === 4 ? C.primary : a, 0.6);
    }
  });
  // Delivery route panel.
  let route = `${T(800, 82, 'DELIVERY', 14, C.muted, 'letter-spacing="2"')}
    <rect x="790" y="96" width="190" height="440" rx="10" fill="#0b1c26"/>
    <path d="M 820 500 C 860 420, 940 430, 930 350 S 840 260, 900 160" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="10 8"/>`;
  for (const [x, y] of [
    [820, 500],
    [930, 350],
    [900, 160],
  ])
    route += `<circle cx="${x}" cy="${y}" r="9" fill="${a}"/>`;
  route += `<rect x="884" y="142" width="34" height="22" rx="4" fill="${C.text}"/>`;
  const wall = display({
    x0: -3.9,
    x1: 3.9,
    y0: 0.85,
    y1: 3.05,
    z: 10.7,
    inner: kanban + route,
    accent: a,
  });
  const side = display({
    x0: 4.2,
    x1: 5.6,
    y0: 1.2,
    y1: 2.3,
    z: 9,
    w: 600,
    h: 470,
    inner: `${chrome(600, 470, 'CUSTOMER', a)}${rows(20, 70, 560, 7, a, r)}`,
    accent: a,
    glow: 0.35,
    reflect: false,
  });
  let orders = `${chrome(1000, 560, 'SALES ORDER', a)}${rows(24, 70, 952, 9, a, r)}`;
  const deskL = desk({ x0: -3.6, x1: -0.9, z0: 5.6, z1: 6.6, accent: a });
  const mon1 = monitor({ x: -2.8, z: 6.2, inner: orders, accent: a });
  const mon2 = monitor({
    x: -1.75,
    z: 6.2,
    inner: `${chrome(1000, 560, 'ORDER', a)}${bars(60, 160, 880, 340, [0.3, 0.45, 0.4, 0.62, 0.7, 0.66, 0.84, 0.9], a)}`,
    accent: a,
  });
  const seated = person({ x: -2.25, z: 5.35, sit: true, accent: a });
  const standing = person({ x: 1.5, z: 9.4, accent: a, lean: -0.02 });
  const standing2 = person({ x: 2.4, z: 10.2, h: 1.68, accent: a, blur: true });
  return frame(
    a,
    `${room({ accent: a })}${wall}${side}${standing2}${standing}${deskL}${mon1}${mon2}${seated}`,
  );
}

/** OPERATIONS — planning wall, kanban, a team at a standing table. */
function operations() {
  const a = C.teal;
  const r = rng(21);
  let gantt = chrome(1000, 560, 'WORK PLAN', a);
  for (let i = 0; i < 8; i++) {
    const y = 80 + i * 56;
    gantt += `<rect x="24" y="${y}" width="150" height="36" rx="6" fill="#0d212c"/>`;
    gantt += T(38, y + 24, `WO-${318 + i}`, 15, C.text);
    const start = 200 + r() * 360;
    const len = 120 + r() * 300;
    const late = i === 5;
    gantt += `<rect x="${n(start)}" y="${y + 4}" width="${n(len)}" height="28" rx="14" fill="${late ? C.amber : a}" opacity="${late ? 0.8 : 0.55}"/>`;
    gantt += `<rect x="${n(start)}" y="${y + 4}" width="${n(len * (0.3 + r() * 0.6))}" height="28" rx="14" fill="${late ? C.amber : C.glow}" opacity=".85"/>`;
  }
  gantt += `<line x1="640" y1="64" x2="640" y2="540" stroke="${C.soft}" stroke-width="2" stroke-dasharray="6 6"/>`;
  gantt += T(650, 74, 'TODAY', 13, C.soft, 'letter-spacing="2"');
  const wall = display({ x0: -4.0, x1: 1.3, y0: 0.85, y1: 3.0, z: 10.7, inner: gantt, accent: a });
  let board = chrome(700, 560, 'PROGRESS', a);
  [0.82, 0.56, 0.34].forEach((p, i) => {
    const cx = 120 + i * 230;
    board += `<circle cx="${cx}" cy="230" r="80" fill="none" stroke="${C.line}" stroke-width="18"/>`;
    board += donut(cx, 230, 80, [p], [i === 2 ? C.amber : C.glow]);
    board += T(cx - 30, 242, `${Math.round(p * 100)}%`, 30, C.text);
  });
  board += rows(30, 360, 640, 3, a, r);
  const wall2 = display({
    x0: 1.6,
    x1: 4.0,
    y0: 1.0,
    y1: 2.75,
    z: 10.7,
    w: 700,
    h: 560,
    inner: board,
    accent: a,
    glow: 0.55,
  });
  const table = box({
    x0: -1.0,
    x1: 1.1,
    y0: 0.95,
    y1: 1.02,
    z0: 7.2,
    z1: 8.4,
    top: '#14303a',
    front: '#0d1d26',
  });
  const tableBase = box({ x0: -0.2, x1: 0.3, y0: 0, y1: 0.95, z0: 7.6, z1: 8.0, front: '#070f15' });
  const tablet = poly(qy(-0.3, 0.35, 1.025, 7.5, 7.95), `fill="${a}" opacity=".55"`);
  const tabletGlow = poly(
    qy(-0.3, 0.35, 1.025, 7.5, 7.95),
    `fill="${a}" opacity=".6" filter="url(#bloom)"`,
  );
  const p1 = person({ x: -1.35, z: 8.0, accent: a, lean: 0.03 });
  const p2 = person({ x: 1.45, z: 8.3, h: 1.68, accent: a, lean: -0.03 });
  const p3 = person({ x: 0.2, z: 9.4, h: 1.7, accent: a, blur: true });
  const deskR = desk({ x0: 1.8, x1: 4.0, z0: 5.2, z1: 6.2, accent: a });
  const monR = monitor({
    x: 2.9,
    z: 5.9,
    inner: `${chrome(1000, 560, 'TASKS', a)}${rows(24, 70, 952, 9, a, r)}`,
    accent: a,
  });
  return frame(
    a,
    `${room({ accent: a })}${wall}${wall2}${p3}${tableGlow(tabletGlow)}${tableBase}${table}${tablet}${p1}${p2}${deskR}${monR}`,
  );
}
const tableGlow = (s) => s;

/** WAREHOUSE — racked aisle, lot labels, a receiving dock, a scan. */
function warehouse() {
  const a = C.primary;
  const r = rng(31);
  const near = 2.6;
  const far = 26;
  let s = '';
  // Shell: floor, ceiling, back dock wall.
  s += poly(qy(-4, 4, 0, 1.1, far), 'fill="url(#floor)"');
  s += poly(qy(-4, 4, 6.5, 1.1, far), 'fill="url(#ceil)"');
  s += poly(qz(-4, 4, 0, 6.5, far), 'fill="url(#wall)"');
  // Dock door light at the end of the aisle.
  s += poly(qz(-1.2, 1.2, 0, 3.0, far - 0.01), `fill="${C.soft}" opacity=".85"`);
  s += poly(qz(-1.6, 1.6, 0, 3.5, far - 0.01), `fill="${a}" opacity=".7" filter="url(#bloom)"`);
  // Floor guidance lanes.
  for (const x of [-0.85, 0.85]) {
    s += poly(qy(x - 0.03, x + 0.03, 0.002, near, far), `fill="${a}" opacity=".8"`);
    s += poly(
      qy(x - 0.05, x + 0.05, 0.002, near, far),
      `fill="${a}" opacity=".6" filter="url(#soft)"`,
    );
  }
  // Ceiling lights.
  for (let z = 4; z < far; z += 3) {
    s += poly(qy(-0.6, 0.6, 6.49, z, z + 0.5), `fill="${C.soft}" opacity=".7"`);
  }
  // Racks: two sides, posts, beams, boxes with lot label strips.
  const rack = (xIn, xOut) => {
    const inner = xIn;
    let g = '';
    const levels = [0.1, 1.45, 2.8, 4.15];
    // Back panel (constant x at outer side) for depth.
    g += poly(qx(xOut, 0, 5.3, near, far), 'fill="#050c11"');
    for (let z = near; z < far; z += 2.4) {
      // Boxes per bay and level.
      levels.forEach((ly, li) => {
        const filled = r() > 0.12;
        if (!filled) return;
        const bz0 = z + 0.15;
        const bz1 = z + 2.2;
        const by0 = ly + 0.08;
        const by1 = ly + 0.9 + r() * 0.3;
        g += poly(
          qx(inner, by0, by1, bz0, bz1),
          `fill="${li % 2 ? '#0d1c22' : '#102229'}" stroke="#1b3138" stroke-width=".8"`,
        );
        // Lot label strip on the box face.
        const lz0 = bz0 + 0.35;
        const lz1 = lz0 + 0.55;
        const ly0 = by0 + 0.25;
        g += poly(qx(inner, ly0, ly0 + 0.16, lz0, lz1), `fill="${C.soft}" opacity=".75"`);
        if (r() > 0.75)
          g += poly(
            qx(inner, ly0 + 0.22, ly0 + 0.3, lz0, lz0 + 0.3),
            `fill="${r() > 0.5 ? a : C.amber}" opacity=".9"`,
          );
      });
      // Upright post.
      g += poly(qx(inner, 0, 5.4, z, z + 0.08), `fill="${a}" opacity=".35"`);
    }
    // Beams at each level.
    levels.forEach((ly) => {
      g += poly(qx(inner, ly, ly + 0.07, near, far), `fill="${a}" opacity=".28"`);
    });
    return g;
  };
  s += rack(-1.9, -3.9) + rack(1.9, 3.9);
  // Worker with a scan beam mid-aisle.
  const wx = -0.6;
  const wz = 8.5;
  s += person({ x: wx, z: wz, accent: a, lean: -0.02 });
  const hand = P(wx - 0.22, 1.15, wz);
  const target = P(-1.9, 1.75, 9.6);
  s += `<path d="M ${n(hand[0])} ${n(hand[1])} L ${n(target[0])} ${n(target[1] - 10)} L ${n(target[0])} ${n(target[1] + 10)} Z" fill="${C.cyan}" opacity=".35"/>`;
  s += `<circle cx="${n(target[0])}" cy="${n(target[1])}" r="6" fill="${C.cyan}" filter="url(#soft)"/>`;
  // Holographic lot tag in the foreground (quantities and dates only — no price).
  const tag = `${chrome(560, 360, 'LOT', a)}
    ${T(28, 112, 'LOT 2410-A', 40, C.text, 'font-weight="600"')}
    ${T(28, 160, 'EXP 03 / 2027', 26, C.soft)}
    ${T(28, 204, 'QTY 240', 26, C.text)}
    <rect x="28" y="232" width="504" height="10" rx="5" fill="${C.line}"/>
    <rect x="28" y="232" width="360" height="10" rx="5" fill="${a}"/>
    ${T(28, 290, 'FEFO · 1', 22, a, 'letter-spacing="3"')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<rect x="${360 + i * 14}" y="270" width="${i % 3 ? 6 : 10}" height="44" fill="${C.text}" opacity=".7"/>`).join('')}`;
  s += display({
    x0: 1.05,
    x1: 2.25,
    y0: 1.25,
    y1: 2.02,
    z: 4.4,
    w: 560,
    h: 360,
    inner: tag,
    accent: a,
    glow: 0.4,
    reflect: false,
  });
  return frame(a, s);
}

/** PURCHASING — supplier network, approval chain, a procurement desk. */
function purchasing() {
  const a = C.teal;
  const r = rng(41);
  let net = chrome(1000, 560, 'SUPPLIERS', a);
  const hub = [500, 300];
  const nodes = Array.from({ length: 9 }, (_, i) => {
    const ang = (i / 9) * Math.PI * 2 + 0.3;
    return [500 + Math.cos(ang) * (300 + r() * 80), 300 + Math.sin(ang) * (170 + r() * 40)];
  });
  nodes.forEach(([x, y], i) => {
    net += `<line x1="${hub[0]}" y1="${hub[1]}" x2="${n(x)}" y2="${n(y)}" stroke="${a}" stroke-opacity=".45" stroke-width="2"/>`;
    net += `<circle cx="${n(x)}" cy="${n(y)}" r="${i === 3 ? 16 : 11}" fill="${i === 3 ? C.amber : '#0d212c'}" stroke="${i === 3 ? C.amber : a}" stroke-width="2"/>`;
  });
  net += `<circle cx="${hub[0]}" cy="${hub[1]}" r="46" fill="#0d2a2e" stroke="${C.glow}" stroke-width="3"/>`;
  net += T(hub[0] - 22, hub[1] + 7, 'PO', 22, C.glow, 'font-weight="600"');
  const wall = display({ x0: -4.1, x1: 0.7, y0: 0.9, y1: 3.0, z: 10.7, inner: net, accent: a });
  let chain = chrome(700, 560, 'APPROVAL', a);
  ['PR', 'APPROVE', 'PO', 'RECEIVE'].forEach((label, i) => {
    const y = 100 + i * 110;
    const done = i < 2;
    const now = i === 2;
    chain += `<circle cx="80" cy="${y}" r="26" fill="${done ? a : '#0d212c'}" stroke="${now ? C.glow : a}" stroke-width="3"/>`;
    if (done)
      chain += `<path d="M 68 ${y} L 78 ${y + 10} L 94 ${y - 10}" fill="none" stroke="#04110d" stroke-width="5"/>`;
    if (i < 3)
      chain += `<line x1="80" y1="${y + 28}" x2="80" y2="${y + 82}" stroke="${a}" stroke-opacity=".5" stroke-width="3"/>`;
    chain += T(130, y + 8, label, 24, done || now ? C.text : C.muted, 'letter-spacing="2"');
    chain += `<rect x="330" y="${y - 10}" width="${180 + r() * 120}" height="18" rx="9" fill="${C.line}"/>`;
  });
  const wall2 = display({
    x0: 1.1,
    x1: 4.0,
    y0: 0.95,
    y1: 2.85,
    z: 10.7,
    w: 700,
    h: 560,
    inner: chain,
    accent: a,
    glow: 0.55,
  });
  // Glass partition.
  const glass = poly(
    qx(-1.0, 0, 2.6, 6.5, 10.5),
    `fill="${C.cyan}" opacity=".035" stroke="${C.cyan}" stroke-opacity=".12"`,
  );
  const d = desk({ x0: 0.5, x1: 3.6, z0: 5.6, z1: 6.7, accent: a });
  let po = `${chrome(1000, 560, 'PURCHASE ORDER', a)}<rect x="40" y="80" width="560" height="440" rx="8" fill="#0c1d27"/>`;
  for (let i = 0; i < 9; i++)
    po += `<rect x="70" y="${110 + i * 42}" width="${200 + r() * 280}" height="10" rx="5" fill="${C.text}" opacity="${i ? 0.35 : 0.7}"/>`;
  po += `<rect x="640" y="80" width="320" height="200" rx="8" fill="#0c1d27"/>${T(668, 130, 'ETA', 18, C.muted, 'letter-spacing="3"')}${T(668, 186, '3 DAYS', 44, C.text, 'font-weight="600"')}`;
  po += `<rect x="640" y="300" width="320" height="220" rx="8" fill="#0c1d27"/>${bars(660, 330, 280, 160, [0.5, 0.7, 0.4, 0.8, 0.65], a)}`;
  const m = monitor({ x: 1.7, w: 0.75, z: 6.3, hgt: 0.44, inner: po, accent: a });
  const m2 = monitor({
    x: 2.8,
    w: 0.55,
    z: 6.4,
    inner: `${chrome(1000, 560, 'PR', a)}${rows(24, 70, 952, 9, a, r)}`,
    accent: a,
  });
  const seated = person({ x: 2.15, z: 5.4, sit: true, accent: a });
  const stand = person({ x: -2.2, z: 9.6, accent: a, blur: true });
  return frame(a, `${room({ accent: a })}${wall}${wall2}${stand}${glass}${d}${m}${m2}${seated}`);
}

/** ACCOUNTING — calm review desk, documents, verified payment list. */
function accounting() {
  const a = C.cyan;
  const r = rng(51);
  let ledger = chrome(1000, 560, 'VERIFICATION', a);
  for (let i = 0; i < 8; i++) {
    const y = 80 + i * 56;
    ledger += `<rect x="24" y="${y}" width="740" height="44" rx="6" fill="#0c1d27"/>`;
    ledger += `<rect x="44" y="${y + 17}" width="${120 + r() * 120}" height="10" rx="5" fill="${C.text}" opacity=".5"/>`;
    ledger += `<rect x="360" y="${y + 17}" width="${80 + r() * 80}" height="10" rx="5" fill="${C.muted}" opacity=".6"/>`;
    const ok = i !== 4;
    ledger += `<circle cx="720" cy="${y + 22}" r="12" fill="${ok ? C.primary : C.amber}" opacity=".85"/>`;
    if (ok)
      ledger += `<path d="M 714 ${y + 22} L 719 ${y + 27} L 727 ${y + 17}" fill="none" stroke="#04110d" stroke-width="3"/>`;
  }
  ledger += `<path d="M 880 120 L 950 150 L 950 240 C 950 300, 910 330, 880 350 C 850 330, 810 300, 810 240 L 810 150 Z" fill="#0d2430" stroke="${a}" stroke-width="3"/>`;
  ledger += `<path d="M 850 236 L 874 260 L 914 210" fill="none" stroke="${C.glow}" stroke-width="7"/>`;
  const wall = display({
    x0: -3.4,
    x1: 3.4,
    y0: 0.95,
    y1: 2.95,
    z: 10.7,
    inner: ledger,
    accent: a,
    glow: 0.6,
  });
  const d = desk({ x0: -2.8, x1: 1.8, z0: 5.4, z1: 6.6, accent: a });
  // Documents lying on the desk.
  let docs = '';
  [
    [-2.4, -1.7, 5.65, 6.15, 0],
    [-2.15, -1.45, 5.75, 6.25, 1],
    [0.1, 0.8, 5.6, 6.1, 2],
  ].forEach(([x0, x1, z0, z1, i]) => {
    docs += poly(
      qy(x0, x1, 0.765 + i * 0.002, z0, z1),
      `fill="#dfe9e6" opacity="${0.85 - i * 0.1}"`,
    );
    for (let k = 0; k < 4; k++)
      docs += poly(
        qy(
          x0 + 0.08,
          x0 + 0.08 + (x1 - x0) * (0.5 + r() * 0.3),
          0.768 + i * 0.002,
          z0 + 0.08 + k * 0.09,
          z0 + 0.1 + k * 0.09,
        ),
        `fill="#7b8d8a" opacity=".7"`,
      );
  });
  // Approved stamp mark.
  const stamp = P(0.55, 0.77, 5.82);
  docs += `<circle cx="${n(stamp[0])}" cy="${n(stamp[1])}" rx="1" r="16" fill="none" stroke="${C.primary}" stroke-width="3" transform="matrix(1 0 0 .35 0 ${n(stamp[1] * 0.65)})"/>`;
  let pay = `${chrome(1000, 560, 'PAYMENT REQUESTS', a)}${rows(24, 70, 952, 9, a, r, { status: (i) => (i === 3 ? C.amber : C.primary) })}`;
  const m = monitor({ x: -0.7, w: 0.8, z: 6.3, hgt: 0.46, inner: pay, accent: a });
  const seated = person({ x: -0.7, z: 5.15, sit: true, accent: a });
  const lamp = poly(qz(1.25, 1.45, 0.77, 1.25, 6.4), `fill="${C.soft}" opacity=".1"`);
  return frame(a, `${room({ accent: a })}${wall}${d}${docs}${lamp}${m}${seated}`);
}

/** REPORTS — panoramic insight wall, one observer. */
function reports() {
  const a = C.teal;
  const r = rng(61);
  const p1 = `${chrome(1000, 560, 'TRENDS', a)}${lineChart(50, 120, 900, 360, [0.3, 0.42, 0.38, 0.52, 0.5, 0.64, 0.6, 0.72, 0.7, 0.82], C.glow)}${lineChart(50, 120, 900, 360, [0.2, 0.26, 0.3, 0.28, 0.36, 0.4, 0.38, 0.46, 0.5, 0.52], C.cyan, false)}`;
  const p2 = `${chrome(700, 560, 'DEPARTMENTS', a)}${bars(40, 120, 620, 320, [0.6, 0.8, 0.5, 0.72, 0.9, 0.66], a)}${['S', 'O', 'W', 'P', 'A', 'R'].map((l, i) => T(80 + i * 103, 480, l, 20, C.muted)).join('')}`;
  const p3 = `${chrome(700, 560, 'OVERVIEW', a)}${donut(220, 300, 130, [0.42, 0.28, 0.18, 0.12], [C.glow, C.teal, C.cyan, C.deep])}${kpi(420, 120, '98%', 'ON TIME', a)}${kpi(420, 250, '12', 'OPEN', a)}${kpi(420, 380, '3', 'ALERTS', C.amber)}`;
  const wall = display({ x0: -1.75, x1: 1.75, y0: 0.9, y1: 3.0, z: 10.7, inner: p1, accent: a });
  const left = display({
    x0: -4.6,
    x1: -2.0,
    y0: 1.0,
    y1: 2.8,
    z: 10.7,
    w: 700,
    h: 560,
    inner: p2,
    accent: a,
    glow: 0.55,
  });
  const right = display({
    x0: 2.0,
    x1: 4.6,
    y0: 1.0,
    y1: 2.8,
    z: 10.7,
    w: 700,
    h: 560,
    inner: p3,
    accent: a,
    glow: 0.55,
  });
  // Floating data layer in mid-air (subtle).
  let holo = '';
  for (let i = 0; i < 18; i++) {
    const p = P(-2 + r() * 4, 0.6 + r() * 1.8, 7 + r() * 4);
    holo += `<rect x="${n(p[0])}" y="${n(p[1])}" width="${n(10 + r() * 30)}" height="2" fill="${C.soft}" opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`;
  }
  const obs = person({ x: -0.2, z: 7.6, accent: a });
  const obs2 = person({ x: 2.6, z: 9.8, h: 1.68, accent: a, blur: true });
  const bench = box({
    x0: -3.4,
    x1: -1.6,
    y0: 0,
    y1: 0.45,
    z0: 6.6,
    z1: 7.2,
    top: '#12262f',
    front: '#0a1820',
  });
  return frame(a, `${room({ accent: a })}${wall}${left}${right}${holo}${obs2}${bench}${obs}`);
}

/** EXECUTIVE — glass office at night, a department status wall. */
function executive() {
  const a = C.primary;
  const r = rng(71);
  let s = room({ accent: a, depth: 13 });
  // Window wall: night skyline behind glass.
  const win = qz(-6.2, 6.2, 0.5, 3.6, 12.98);
  s += poly(win, 'fill="url(#sky)"');
  let sky = '';
  for (let i = 0; i < 26; i++) {
    const x0 = -6 + i * 0.48;
    const hgt = 0.9 + r() * 2.2;
    sky += poly(qz(x0, x0 + 0.42, 0.5, 0.5 + hgt, 12.97), 'fill="#03090e"');
    for (let k = 0; k < 6; k++) {
      if (r() > 0.55) {
        const wy = 0.7 + r() * (hgt - 0.3);
        const wx = x0 + 0.06 + r() * 0.28;
        sky += poly(
          qz(wx, wx + 0.04, wy, wy + 0.04, 12.96),
          `fill="${r() > 0.85 ? C.amber : C.soft}" opacity="${(0.3 + r() * 0.5).toFixed(2)}"`,
        );
      }
    }
  }
  s += sky;
  for (let x = -6; x <= 6; x += 2)
    s += poly(qz(x - 0.03, x + 0.03, 0.5, 3.6, 12.95), `fill="${a}" opacity=".18"`);
  // Department status wall.
  let tiles = chrome(1000, 560, 'COMMAND VIEW', a);
  ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'REPORTS'].forEach((name, i) => {
    const x = 30 + (i % 3) * 320;
    const y = 80 + Math.floor(i / 3) * 236;
    const warn = i === 3;
    tiles += `<rect x="${x}" y="${y}" width="300" height="216" rx="10" fill="#0c1d27" stroke="${warn ? C.amber : C.line}"/>`;
    tiles += T(x + 22, y + 40, name, 18, C.text, 'letter-spacing="2"');
    tiles += `<circle cx="${x + 270}" cy="${y + 34}" r="9" fill="${warn ? C.amber : C.primary}"/>`;
    tiles += lineChart(
      x + 22,
      y + 80,
      256,
      100,
      Array.from({ length: 7 }, () => 0.3 + r() * 0.6),
      warn ? C.amber : C.glow,
    );
  });
  s += display({
    x0: -3.9,
    x1: -0.3,
    y0: 0.95,
    y1: 2.95,
    z: 9.5,
    inner: tiles,
    accent: a,
    glow: 0.45,
  });
  // Executive desk and chair facing the room.
  s += desk({ x0: 0.8, x1: 3.8, z0: 5.6, z1: 6.8, accent: a });
  s += monitor({
    x: 2.3,
    w: 0.7,
    z: 6.5,
    inner: `${chrome(1000, 560, 'EXCEPTIONS', a)}${rows(24, 70, 952, 9, a, r, { status: (i) => (i < 2 ? C.amber : C.primary) })}`,
    accent: a,
  });
  s += person({ x: 2.3, z: 5.35, sit: true, accent: a });
  s += person({ x: -1.4, z: 8.4, accent: a, blur: true });
  return frame(a, s);
}

const SCENES = { sales, operations, warehouse, purchasing, accounting, reports, executive };

await mkdir(outDir, { recursive: true });
await Promise.all(
  Object.entries(SCENES).map(async ([id, make]) => {
    const svg = Buffer.from(make());
    const img = sharp(svg, { density: 96 });
    await img
      .clone()
      .resize(960, 540)
      .webp({ quality: 74, effort: 6 })
      .toFile(join(outDir, `${id}.webp`));
    await img
      .clone()
      .resize(400, 225)
      .webp({ quality: 72, effort: 6 })
      .toFile(join(outDir, `${id}-sm.webp`));
    console.log('wrote', join(outDir, `${id}.webp`), '+ -sm');
  }),
);
