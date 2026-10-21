/** Geometry for the CORE Universe, in a 1000×1000 SVG coordinate space. */
export const VIEW = 1000;
export const CENTER = VIEW / 2;
export const CORE_RADIUS = 118;
/** Radius on which department nodes sit (also expressed as % for the HTML overlay). */
export const NODE_RADIUS = 342;

export interface NodePoint {
  x: number;
  y: number;
  /** Position as percentage of the container, for HTML overlay placement. */
  left: string;
  top: string;
}

export function nodePoint(index: number, total: number): NodePoint {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const x = CENTER + NODE_RADIUS * Math.cos(angle);
  const y = CENTER + NODE_RADIUS * Math.sin(angle);
  return { x, y, left: `${(x / VIEW) * 100}%`, top: `${(y / VIEW) * 100}%` };
}

/**
 * A gently curved connection from a node to the core's edge. The curve bends
 * consistently clockwise so the system reads as one rotating field.
 */
export function connectionPath(p: NodePoint): string {
  const dx = CENTER - p.x;
  const dy = CENTER - p.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const start = { x: p.x + ux * 52, y: p.y + uy * 52 };
  const end = { x: CENTER - ux * (CORE_RADIUS + 8), y: CENTER - uy * (CORE_RADIUS + 8) };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const bend = 46;
  const control = { x: mid.x - uy * bend, y: mid.y + ux * bend };
  const f = (n: number) => n.toFixed(1);
  return `M ${f(start.x)} ${f(start.y)} Q ${f(control.x)} ${f(control.y)} ${f(end.x)} ${f(end.y)}`;
}

/** Deterministic pseudo-random generator so the starfield is stable between renders. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
