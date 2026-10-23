import { CORE_RADIUS, NODE_LAYOUT } from './constants';
import type { OrbitDepartmentId } from './types';

/*
 * Scene layout math with no three.js dependency, so the static fallback and
 * the WebGL scene place departments identically.
 *
 * Space: departments sit in a ring plane tilted toward the viewer (TILT
 * around X) so back nodes rise above CORE and front nodes drop below it — no
 * node is ever hidden behind the sphere at the default view.
 */

export const TILT = 0.42;
export const CAMERA = { y: 0.9, fov: 34 } as const;

export type Vec3 = [number, number, number];

/** Node position in the (un-tilted) ring plane. `spread` > 1 pushes nodes outward (story stage 2). */
export function nodeLocal(id: OrbitDepartmentId, spread = 1, yaw = 0): Vec3 {
  const { angle, radius, height } = NODE_LAYOUT[id];
  const t = (angle * Math.PI) / 180 + yaw;
  const r = radius * spread;
  return [r * Math.cos(t), height, -r * Math.sin(t)];
}

export function tilt([x, y, z]: Vec3): Vec3 {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return [x, y * c - z * s, y * s + z * c];
}

/**
 * Camera distance that keeps every node (plus label room) inside the frame
 * for a given aspect ratio. Used by the WebGL camera and the fallback alike.
 */
export function cameraDistance(aspect: number, withLabels: boolean): number {
  const halfH = Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);
  // World cards (EP05 revision) are wider and taller than the old name tags.
  const needW = withLabels ? 4.15 : 3.15;
  const needH = withLabels ? 2.7 : 2.45;
  return Math.max(needH / halfH, needW / (halfH * aspect), 7.2);
}

/** Perspective projection of a world point to 0…1 viewport coordinates (+ depth). */
export function project(p: Vec3, aspect: number, distance: number) {
  const cam: Vec3 = [0, CAMERA.y, distance];
  // Camera looks at the origin.
  const f = normalize([-cam[0], -cam[1], -cam[2]]);
  const r = normalize(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d: Vec3 = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
  const z = dot(d, f);
  const halfH = Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);
  const x = dot(d, r) / (z * halfH * aspect);
  const y = dot(d, u) / (z * halfH);
  return { x: 0.5 + x / 2, y: 0.5 - y / 2, depth: z };
}

/** Where a node's connection meets the CORE surface. */
export function coreAnchor(p: Vec3): Vec3 {
  const n = normalize(p);
  const k = CORE_RADIUS * 1.04;
  return [n[0] * k, n[1] * k, n[2] * k];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
