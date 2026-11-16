import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineDashedMaterial,
  Group,
  LineLoop,
} from 'three';
import type { FrameCallback } from './engine';
import { COLOR, INTRO } from './constants';
import { NODE_LAYOUT } from './constants';
import { damp, reveal, type SceneClock } from './sceneClock';
import type { WorldRuntime } from './runtime';

function circle(radius: number, segments = 160) {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return g;
}

const MEAN_RADIUS =
  Object.values(NODE_LAYOUT).reduce((s, n) => s + n.radius, 0) / Object.keys(NODE_LAYOUT).length;

/**
 * Orbit paths. The department orbit (dashed, in the ring plane) plus two
 * decorative orbits at other tilts, each turning at its own slow speed.
 * Rendered inside the tilted ring group, so the department orbit stays aligned
 * with the nodes. Lines are drawn in with the intro.
 */
export function createOrbitSystem(clock: SceneClock, runtime: WorldRuntime) {
  const mat = new LineDashedMaterial({
    color: COLOR.teal,
    dashSize: 0.07,
    gapSize: 0.11,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const loop = new LineLoop(circle(MEAN_RADIUS), mat);
  loop.computeLineDistances();

  const mk = (r: number) =>
    new LineLoop(
      circle(r),
      new LineBasicMaterial({
        color: COLOR.teal,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
  const deco = { a: mk(1.62), b: mk(3.55) };
  const inner = new Group();
  inner.rotation.set(0.55, 0, 0.32);
  inner.add(deco.a);
  const outer = new Group();
  outer.rotation.set(-0.28, 0, -0.18);
  outer.add(deco.b);

  const tick: FrameCallback = (_, dt) => {
    const m = clock.motion;
    const r = reveal(clock.time, INTRO.orbits, 0.7);
    const spread = runtime.mix.spread;
    // Department orbit widens with the nodes in story stage 2, then fades back.
    const s = 1 + spread * 0.18;
    loop.scale.setScalar(s);
    const deptTarget = r * (0.32 - runtime.mix.separate * 0.18);
    mat.opacity = damp(mat.opacity, deptTarget, 6, dt);
    (deco.a.material as LineBasicMaterial).opacity = r * 0.16;
    (deco.b.material as LineBasicMaterial).opacity = r * 0.08 * (1 - runtime.mix.recede * 0.5);
    inner.rotation.y = m * 0.021;
    outer.rotation.y = -m * 0.009;
  };
  return { objects: [loop, inner, outer], tick };
}
