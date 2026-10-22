import type { OrbitDepartmentId, Quality } from './types';

/*
 * CORE World constants. Colours mirror the brand tokens in styles/index.css
 * (three.js needs raw values). Keep the palette to navy/black, emerald, teal
 * and a little soft cyan — no per-department rainbow in the hero.
 */

export const COLOR = {
  emerald: '#19c39a',
  glow: '#3ef0c0',
  teal: '#2bb5a8',
  cyan: '#7fd6ff',
  soft: '#b9f5e4',
  obsidian: '#050b12',
  ink: '#0a1620',
} as const;

/** Radius of the CORE shell in world units. The camera frames ~±4.2 units. */
export const CORE_RADIUS = 1;

/**
 * Department placement around CORE. Not one flat circle: each node has its own
 * radius and height so the composition has depth, while staying readable from
 * the default camera. Angle in degrees around Y (0 = toward camera's right).
 */
export const NODE_LAYOUT: Record<
  OrbitDepartmentId,
  { angle: number; radius: number; height: number }
> = {
  sales: { angle: 90, radius: 2.55, height: 0.62 },
  operations: { angle: 30, radius: 2.85, height: 0.18 },
  warehouse: { angle: -30, radius: 2.7, height: -0.46 },
  purchasing: { angle: -90, radius: 2.5, height: -0.7 },
  accounting: { angle: -150, radius: 2.8, height: -0.2 },
  reports: { angle: 150, radius: 2.65, height: 0.4 },
};

/** Order of the connected process shown in story stage 3. */
export const PROCESS_FLOW: readonly OrbitDepartmentId[] = [
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
  'reports',
];

/** Short module lists shown in department detail (hover/focus/select). */
export const DEPARTMENT_HIGHLIGHTS: Record<OrbitDepartmentId, readonly string[]> = {
  sales: ['Customer PO', 'Sales Order', 'การส่งมอบ'],
  operations: ['Work Order', 'แผนงาน', 'ความคืบหน้า'],
  warehouse: ['รับสินค้า', 'Stock', 'Lot / Batch', 'วันหมดอายุ'],
  purchasing: ['ใบขอซื้อ', 'ใบสั่งซื้อ', 'ติดตามการรับ'],
  accounting: ['คำขอจ่าย', 'การจ่ายเงิน', 'ยอดค้าง'],
  reports: ['รายงานแผนก', 'ตัวชี้วัดข้ามแผนก', 'ประวัติการทำงาน'],
};

export interface QualitySettings {
  dpr: [number, number];
  particles: number;
  /** Segments for spheres; lower = cheaper. */
  sphereDetail: number;
  /** Inner energy / network shader detail (0 cheap … 2 full). */
  shaderDetail: 0 | 1 | 2;
  pulsesPerLink: number;
  antialias: boolean;
  /** Continuous animation; false = render on demand only. */
  animate: boolean;
}

export const QUALITY_SETTINGS: Record<Exclude<Quality, 'static'>, QualitySettings> = {
  high: {
    dpr: [1, 1.5],
    particles: 420,
    sphereDetail: 96,
    shaderDetail: 2,
    pulsesPerLink: 2,
    antialias: true,
    animate: true,
  },
  medium: {
    dpr: [1, 1.25],
    particles: 240,
    sphereDetail: 72,
    shaderDetail: 1,
    pulsesPerLink: 2,
    antialias: true,
    animate: true,
  },
  low: {
    dpr: [1, 1],
    particles: 110,
    sphereDetail: 48,
    shaderDetail: 0,
    pulsesPerLink: 1,
    antialias: false,
    animate: true,
  },
  reduced: {
    dpr: [1, 1.25],
    particles: 140,
    sphereDetail: 64,
    shaderDetail: 1,
    pulsesPerLink: 0,
    antialias: true,
    animate: false,
  },
};

/** Intro choreography (seconds from scene start). Fast enough to interact immediately. */
export const INTRO = {
  core: 0.1,
  rim: 0.3,
  orbits: 0.45,
  links: 0.6,
  nodes: 0.7,
  done: 1.3,
} as const;
