/*
 * PDA BLISS CORE brand geometry (EP24.1.3) — the single vector source for the
 * marks and the wordmark. The React logo (Logo.tsx) and the asset build
 * (scripts/build-brand.mjs) both render from here, so the site chrome,
 * favicon and downloadable files never drift apart.
 *
 * Concept (approved reference: docs/assets/brand-reference/): a luminous
 * CORE held by an orbital system — a silver ring that passes in front of and
 * behind the core, a teal orbit on a second axis, and nodes for connected
 * departments.
 *
 * One concept, three optical sizes (not one drawing scaled):
 *   micro  16–48 px   favicon / tab — a round object: navy disc, big core, one ring, one node
 *   mark   24–96 px   header / brand — tapered ring band, woven crossings, rimmed core
 *   large  ≥ 96 px    app icon / showcase — adds a third orbit, halo and highlights
 *
 * Vectors only: gradients and masks, no filters, no images.
 * Plain TypeScript (erasable syntax only) so Node can import it directly.
 */

export const PALETTE = {
  /** The illuminated core and accents on dark ground. */
  coreTeal: '#00E5C2',
  /** Teal for text and fine lines on light ground (≥ 4.5:1 on white). */
  tealInk: '#00806F',
  coreDeep: '#04524A',
  coreLight: '#E9FFFA',
  /** Brand ground. */
  deepNavy: '#0A1620',
  darkSurface: '#050B12',
  silver: '#E2E8F0',
  silverShade: '#8396A0',
  graphite: '#3B4A54',
  offWhite: '#EEF6F3',
  white: '#FFFFFF',
  /** Platform Owner authority only (existing UI token). */
  authorityGold: '#F5B84B',
} as const;

export type MarkVariant = 'dark' | 'light' | 'mono-white' | 'mono-dark';
/** Optical size of the symbol (see the header comment). */
export type MarkSize = 'micro' | 'mark' | 'large';

const C = 32; // mark centre in a 64×64 box
const rad = (deg: number) => (deg * Math.PI) / 180;
const f = (n: number) => Number(n.toFixed(2));

/** A point on an ellipse centred on the mark, rotated by `rot` degrees; `t` in degrees. */
function onEllipse(rx: number, ry: number, rot: number, t: number) {
  const x = rx * Math.cos(rad(t));
  const y = ry * Math.sin(rad(t));
  const r = rad(rot);
  return {
    x: f(C + x * Math.cos(r) - y * Math.sin(r)),
    y: f(C + x * Math.sin(r) + y * Math.cos(r)),
  };
}

/** An elliptical arc from t1 to t2 (degrees, t2 > t1). 0–180 is the front (lower) half. */
function arc(rx: number, ry: number, rot: number, t1: number, t2: number) {
  const a = onEllipse(rx, ry, rot, t1);
  const b = onEllipse(rx, ry, rot, t2);
  return `M${a.x} ${a.y}A${rx} ${ry} ${rot} ${t2 - t1 > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** The front half of a ring as a filled band: thin at the sides, full weight at the front. */
function band(rx: number, ry: number, rot: number, thick: number, side: number) {
  const o = { rx: rx + side / 2, ry: ry + thick / 2 };
  const i = { rx: rx - side / 2, ry: ry - thick / 2 };
  const a = onEllipse(o.rx, o.ry, rot, 0);
  const b = onEllipse(o.rx, o.ry, rot, 180);
  const c = onEllipse(i.rx, i.ry, rot, 180);
  const d = onEllipse(i.rx, i.ry, rot, 0);
  return `M${a.x} ${a.y}A${o.rx} ${o.ry} ${rot} 0 1 ${b.x} ${b.y}L${c.x} ${c.y}A${i.rx} ${i.ry} ${rot} 0 0 ${d.x} ${d.y}Z`;
}

/* ------------------------------------------------- mark + large (≥ 24 px) */

const TILT = -30;
const RING = { rx: 25.5, ry: 14, thick: 4, side: 1.8, edge: 1.3 }; // front band; edge = outline stroke
const ORBIT = { rx: 29.5, ry: 9.5, rot: 14, w: 2.2 };
const CORE_R = 14.5;
const GAP = 1.4; // knockout between layers that cross

interface Paint {
  ring: string;
  ringBack: string;
  orbit: string;
  orbitBack: string;
  core: string;
  rim: string | null;
  nodeTeal: string;
  nodeSilver: string;
  nodeFar: string;
  backOpacity: number;
  halo: boolean;
  shine: boolean;
  defs: string;
}

function paints(id: string, v: MarkVariant): Paint {
  if (v === 'mono-white' || v === 'mono-dark') {
    const ink = v === 'mono-white' ? PALETTE.white : PALETTE.deepNavy;
    return {
      ring: ink,
      ringBack: ink,
      orbit: ink,
      orbitBack: ink,
      core: ink,
      rim: null,
      nodeTeal: ink,
      nodeSilver: ink,
      nodeFar: ink,
      backOpacity: 0.5,
      halo: false,
      shine: false,
      defs: '',
    };
  }
  const light = v === 'light';
  // Dark ground: silver stays below pure white; teal reads lit, not neon.
  const ringStops = light
    ? '<stop offset="0" stop-color="#55666F"/><stop offset=".38" stop-color="#9DADB5"/><stop offset=".68" stop-color="#3B4A54"/><stop offset="1" stop-color="#6F828C"/>'
    : '<stop offset="0" stop-color="#EEF2F5"/><stop offset=".36" stop-color="#C2CED5"/><stop offset=".64" stop-color="#7D919B"/><stop offset="1" stop-color="#DAE3E8"/>';
  const coreStops = light
    ? '<stop offset="0" stop-color="#E4FFF9"/><stop offset=".24" stop-color="#63ECD5"/><stop offset=".56" stop-color="#00C3A5"/><stop offset=".86" stop-color="#00806F"/><stop offset="1" stop-color="#04524A"/>'
    : '<stop offset="0" stop-color="#E9FFFA"/><stop offset=".22" stop-color="#7DF5DF"/><stop offset=".54" stop-color="#16D6B5"/><stop offset=".84" stop-color="#03967F"/><stop offset="1" stop-color="#035247"/>';
  return {
    ring: `url(#${id}r)`,
    ringBack: light ? '#A3B2BA' : '#6A7E88',
    orbit: light ? PALETTE.tealInk : '#22D9B9',
    orbitBack: light ? '#7DBDB2' : '#0F8C79',
    core: `url(#${id}c)`,
    rim: light ? PALETTE.coreDeep : '#023E37',
    nodeTeal: light ? PALETTE.tealInk : '#2DE2C3',
    nodeSilver: light ? PALETTE.graphite : '#D8E1E7',
    nodeFar: light ? '#A3B2BA' : '#7D919B',
    backOpacity: 1,
    halo: !light,
    shine: true,
    defs:
      `<linearGradient id="${id}r" x1="0" y1=".15" x2="1" y2=".85">${ringStops}</linearGradient>` +
      `<radialGradient id="${id}c" cx=".5" cy=".5" r=".5" fx=".34" fy=".28">${coreStops}</radialGradient>` +
      `<radialGradient id="${id}h"><stop offset=".45" stop-color="${PALETTE.coreTeal}" stop-opacity=".34"/><stop offset="1" stop-color="${PALETTE.coreTeal}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${id}w"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
  };
}

/**
 * The brand symbol, inner SVG markup for a 0 0 64 64 viewBox. `size` picks
 * the optical variant ('micro' delegates to microInner). `id` keeps gradient
 * and mask ids unique when several marks share a page.
 */
export function markInner(id: string, v: MarkVariant = 'dark', size: MarkSize = 'mark'): string {
  if (size === 'micro') return microInner(id);
  const large = size === 'large';
  const p = paints(id, v);
  const ringBand = band(RING.rx, RING.ry, TILT, RING.thick, RING.side);
  const orbitFront = arc(ORBIT.rx, ORBIT.ry, ORBIT.rot, 14, 152);
  const back = p.backOpacity < 1 ? ` opacity="${p.backOpacity}"` : '';
  // Knockouts: the ring band cuts what passes behind it; band + front orbit cut the core.
  const cut = (inner: string) =>
    `<rect x="-8" y="-8" width="80" height="80" fill="#fff"/><path d="${ringBand}" fill="#000" stroke="#000" stroke-width="${RING.edge + GAP * 2}" stroke-linejoin="round"/>${inner}`;
  const masks =
    `<mask id="${id}m1" maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80">${cut('')}</mask>` +
    `<mask id="${id}m2" maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80">${cut(`<path d="${orbitFront}" fill="none" stroke="#000" stroke-width="${ORBIT.w + GAP * 2}" stroke-linecap="round"/>`)}</mask>`;
  const n1 = onEllipse(RING.rx, RING.ry, TILT, 38); // teal, on the front of the ring
  const n2 = onEllipse(ORBIT.rx, ORBIT.ry, ORBIT.rot, 188); // silver, far left of the orbit
  const n3 = onEllipse(RING.rx, RING.ry, TILT, 236); // small, behind (upper left)
  const n4 = onEllipse(30, 4.6, -6, 330); // large only: third orbit
  const highlight = p.shine
    ? `<ellipse cx="26.8" cy="25.8" rx="6.2" ry="4" transform="rotate(-32 26.8 25.8)" fill="url(#${id}w)"/>` +
      (large ? `<circle cx="24.8" cy="24.6" r="1.2" fill="#fff" opacity=".85"/>` : '')
    : '';
  return (
    `<defs>${p.defs}${masks}</defs>` +
    // Far side: broken arcs (the breaks read as the ring passing behind the core).
    (large
      ? `<path d="${arc(30, 4.6, -6, 196, 300)}" fill="none" stroke="${p.ringBack}" stroke-width=".8" stroke-linecap="round" opacity=".55"/>`
      : '') +
    `<path d="${arc(RING.rx, RING.ry, TILT, 192, 348)}" fill="none" stroke="${p.ringBack}" stroke-width="2.1" stroke-linecap="round"${back}/>` +
    `<path d="${arc(ORBIT.rx, ORBIT.ry, ORBIT.rot, 200, 336)}" fill="none" stroke="${p.orbitBack}" stroke-width="1.3" stroke-linecap="round"${back}/>` +
    `<circle cx="${n3.x}" cy="${n3.y}" r="1.9" fill="${p.nodeFar}"/>` +
    // Core (with its halo), cut where the band and the front orbit pass over it.
    `<g mask="url(#${id}m2)">` +
    (p.halo
      ? `<circle cx="${C}" cy="${C}" r="${CORE_R + (large ? 11 : 7)}" fill="url(#${id}h)"/>`
      : '') +
    `<circle cx="${C}" cy="${C}" r="${CORE_R}" fill="${p.core}"${p.rim ? ` stroke="${p.rim}" stroke-width="1"` : ''}/>` +
    highlight +
    `</g>` +
    // Near side: front orbit (woven under the band), then the band.
    `<path d="${orbitFront}" fill="none" stroke="${p.orbit}" stroke-width="${ORBIT.w}" stroke-linecap="round" mask="url(#${id}m1)"/>` +
    `<path d="${ringBand}" fill="${p.ring}" stroke="${p.ring}" stroke-width="${RING.edge}" stroke-linejoin="round"/>` +
    (large
      ? `<path d="${arc(30, 4.6, -6, 6, 150)}" fill="none" stroke="${p.nodeSilver}" stroke-width=".8" stroke-linecap="round" opacity=".5" mask="url(#${id}m1)"/>` +
        `<circle cx="${n4.x}" cy="${n4.y}" r="1.5" fill="${p.nodeTeal}"/>`
      : '') +
    `<circle cx="${n1.x}" cy="${n1.y}" r="3.2" fill="${p.nodeTeal}"${p.rim ? ` stroke="${p.rim}" stroke-width=".9"` : ''}/>` +
    `<circle cx="${n2.x}" cy="${n2.y}" r="2.4" fill="${p.nodeSilver}"/>`
  );
}

/**
 * The app-icon field (large mark on a dark squircle with a soft core glow).
 * `rounded` false gives a full-bleed square for platforms that mask it themselves.
 */
export function appIconInner(id: string, pad: number, rounded = true): string {
  const s = 64 + pad * 2;
  return (
    `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#112432"/><stop offset="1" stop-color="${PALETTE.darkSurface}"/></linearGradient>` +
    `<radialGradient id="${id}g" cx="${C}" cy="${C}" r="${s * 0.5}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PALETTE.coreTeal}" stop-opacity=".16"/><stop offset="1" stop-color="${PALETTE.coreTeal}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect x="${-pad}" y="${-pad}" width="${s}" height="${s}"${rounded ? ` rx="${f(s * 0.225)}"` : ''} fill="url(#${id}f)"/>` +
    `<circle cx="${C}" cy="${C}" r="${s * 0.5}" fill="url(#${id}g)"/>` +
    markInner(id, 'dark', 'large')
  );
}

/* ------------------------------------------------- micro / favicon (16–48 px) */

/** Raster sizes the micro mark is tuned for (the SVG favicon uses the 16 px drawing). */
export type MicroSize = 16 | 32 | 48;

/**
 * The favicon mark: a round object, designed at 16 px first (4 units = 1 px).
 *   field  navy disc filling the box, 1 px teal rim (separates it from dark tabs)
 *   core   r 18 — 56 % of the diameter, the anchor; radial teal with a darker edge
 *   orbit  ONE silver ring, 1.5 px at 16 px, cut from the core by a navy gap
 *   node   ONE teal node on the front of the ring
 * Transparent outside the circle. No fine orbits, no small dots, nothing
 * translucent. 32 / 48 px add only what those sizes can hold: a metallic
 * ring gradient, a brighter rim and a core highlight.
 */
export function microInner(id: string, px: MicroSize = 16): string {
  const rich = px >= 32;
  const rot = -30;
  const rx = 24;
  const ry = 14;
  const ringW = rich ? 5 : 6;
  const node = onEllipse(rx, ry, rot, 22);
  const silver = rich ? `url(#${id}s)` : PALETTE.silver;
  return (
    `<defs>` +
    `<radialGradient id="${id}d" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#132C3D"/><stop offset="1" stop-color="${PALETTE.deepNavy}"/></radialGradient>` +
    `<radialGradient id="${id}u" cx=".5" cy=".5" r=".5" fx=".38" fy=".34"><stop offset="0" stop-color="#C8FFF4"/><stop offset=".36" stop-color="#43EFD2"/><stop offset=".8" stop-color="#00C3A4"/><stop offset="1" stop-color="#078F79"/></radialGradient>` +
    (rich
      ? `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F7F9"/><stop offset=".55" stop-color="#C9D4DA"/><stop offset="1" stop-color="#EEF2F5"/></linearGradient>`
      : '') +
    `</defs>` +
    `<circle cx="32" cy="32" r="32" fill="url(#${id}d)"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" stroke="${rich ? '#18B89B' : '#139A84'}" stroke-width="${rich ? 3 : 4}"/>` +
    `<path d="${arc(rx, ry, rot, 192, 348)}" fill="none" stroke="#8396A0" stroke-width="${ringW - 1}" stroke-linecap="round"/>` +
    `<circle cx="32" cy="32" r="18" fill="url(#${id}u)"/>` +
    (rich
      ? `<ellipse cx="26.5" cy="25" rx="5" ry="3.2" transform="rotate(-30 26.5 25)" fill="#fff" opacity=".45"/>`
      : '') +
    `<path d="${arc(rx, ry, rot, 0, 180)}" fill="none" stroke="${PALETTE.deepNavy}" stroke-width="${ringW + 4}" stroke-linecap="round"/>` +
    `<path d="${arc(rx, ry, rot, 0, 180)}" fill="none" stroke="${silver}" stroke-width="${ringW}" stroke-linecap="round"/>` +
    `<circle cx="${node.x}" cy="${node.y}" r="${rich ? 6.2 : 6.6}" fill="${PALETTE.deepNavy}"/>` +
    `<circle cx="${node.x}" cy="${node.y}" r="${rich ? 4.2 : 4.6}" fill="${PALETTE.coreTeal}"/>`
  );
}

/* ------------------------------------------------------------- wordmark */

/**
 * Geometric monoline glyphs (cap height 20, drawn for a 2.6 stroke, square
 * terminals) — the official wordmark letters. Widths are advance widths
 * before tracking. The logo strokes them slightly heavier (see WEIGHT).
 */
const GLYPHS: Record<string, { w: number; d: string }> = {
  P: { w: 15.5, d: 'M1.3 18.7V1.3H9.4a5.2 5.2 0 0 1 0 10.4H1.3' },
  D: { w: 18.5, d: 'M1.3 1.3H8.4a8.7 8.7 0 0 1 0 17.4H1.3Z' },
  A: { w: 19, d: 'M1.2 18.7 9.5 1.3l8.3 17.4M4.7 12.7h9.6' },
  B: { w: 16.5, d: 'M1.3 18.7V1.3H9.6a4.3 4.3 0 0 1 0 8.6H1.3m8.3 0h1a4.4 4.4 0 0 1 0 8.8H1.3' },
  L: { w: 14, d: 'M1.3 1.3v17.4H13' },
  I: { w: 2.6, d: 'M1.3 1.3v17.4' },
  S: {
    w: 17,
    d: 'M15.2 3.8C13.6 2 11.4 1.3 8.8 1.3 5.1 1.3 2.4 3 2.4 5.7c0 6.1 12.9 2.7 12.9 8.7 0 2.8-2.7 4.3-6.6 4.3-3 0-5.5-.9-7.1-2.8',
  },
  C: { w: 18.5, d: 'M16.9 4.4A8.7 8.7 0 1 0 16.9 15.6' },
  O: { w: 20, d: 'M10 1.3a8.7 8.7 0 1 1 0 17.4 8.7 8.7 0 0 1 0-17.4Z' },
  R: { w: 16.5, d: 'M1.3 18.7V1.3H9.4a5.2 5.2 0 0 1 0 10.4H1.3m7.4 0 6.6 7' },
  E: { w: 14.5, d: 'M14 1.3H1.3v17.4H14M1.3 10h10.2' },
};

/** Wordmark stroke weights in glyph units: a touch heavier than the drawing grid. */
const WEIGHT = { top: 3.05, core: 3.35 };

/** A word as stroked paths, plus its width. `tracking` is extra space between letters. */
export function wordPaths(text: string, x0: number, tracking: number) {
  let x = x0;
  const parts: string[] = [];
  for (const ch of text) {
    if (ch === ' ') {
      x += 9;
      continue;
    }
    const g = GLYPHS[ch];
    if (!g) throw new Error(`No glyph for "${ch}"`);
    parts.push(`<path transform="translate(${f(x)} 0)" d="${g.d}"/>`);
    x += g.w + tracking;
  }
  return { markup: parts.join(''), width: f(x - x0 - tracking) };
}

export type LogoVariant = MarkVariant;

/**
 * The primary logo (horizontal): mark + "PDA BLISS" over a teal "CORE".
 * Returns inner markup and the viewBox width (height 64). The header uses the
 * 'mark' optical size; large presentations (social card) may pass 'large'.
 */
export function logoInner(id: string, v: LogoVariant = 'dark', size: MarkSize = 'mark') {
  const top = wordPaths('PDA BLISS', 0, 4.4);
  const bottom = wordPaths('CORE', 0, 8.6);
  const textX = 79;
  const scaleTop = 1.05;
  const scaleBottom = 0.84;
  const widthTop = top.width * scaleTop;
  const widthBottom = bottom.width * scaleBottom;
  const bottomX = textX + (widthTop - widthBottom) / 2;
  const ink =
    v === 'dark'
      ? PALETTE.offWhite
      : v === 'light'
        ? PALETTE.deepNavy
        : v === 'mono-white'
          ? PALETTE.white
          : PALETTE.deepNavy;
  const accent = v === 'dark' ? '#19DDBC' : v === 'light' ? PALETTE.tealInk : ink;
  const ruleW = Math.max(0, (widthTop - widthBottom) / 2 - 6.5);
  const width = f(textX + widthTop + 2);
  const ruleY = f(38 + 10 * scaleBottom);
  return {
    width,
    markup:
      `<svg x="0" y="0" width="64" height="64" viewBox="0 0 64 64">${markInner(id, v, size)}</svg>` +
      `<g transform="translate(${textX} 9) scale(${scaleTop})" fill="none" stroke="${ink}" stroke-width="${WEIGHT.top}" stroke-linejoin="miter" stroke-linecap="butt">${top.markup}</g>` +
      `<g transform="translate(${f(bottomX)} 38) scale(${scaleBottom})" fill="none" stroke="${accent}" stroke-width="${WEIGHT.core}" stroke-linejoin="miter" stroke-linecap="butt">${bottom.markup}</g>` +
      (ruleW > 4
        ? `<path d="M${textX + 0.6} ${ruleY}h${f(ruleW)}M${f(bottomX + widthBottom + 6.5)} ${ruleY}h${f(ruleW)}" stroke="${accent}" stroke-width="1.4" opacity=".5"/>`
        : ''),
  };
}

/** A complete standalone SVG document (for files and favicons). */
export function svgDoc(
  viewBox: string,
  inner: string,
  title: string,
  size?: { w: number; h: number },
) {
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${dims} role="img" aria-label="${title}"><title>${title}</title>${inner}</svg>`;
}
