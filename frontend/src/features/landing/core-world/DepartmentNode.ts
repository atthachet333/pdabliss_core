import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import type { Engine, FrameCallback } from './engine';
import { COLOR, INTRO } from './constants';
import { getHaloTexture } from './halo';
import { activeId, type WorldRuntime } from './runtime';
import { damp, reveal, type SceneClock } from './sceneClock';
import type { OrbitDepartmentId } from './types';

const WHITE = new Color('#e8fff7');
const EMERALD = new Color(COLOR.glow);

/**
 * One department in the orbit: a glass bead, a soft halo and a "workspace
 * ring" that appears when the department is in focus or when the story shows
 * departments as separate workspaces. A larger invisible sphere is the hit area.
 */
export function createDepartmentNode({
  id,
  index,
  clock,
  runtime,
  engine,
  onHover,
  onSelect,
  shouldIgnoreClick,
}: {
  id: OrbitDepartmentId;
  index: number;
  clock: SceneClock;
  runtime: WorldRuntime;
  engine: Engine;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId) => void;
  shouldIgnoreClick: () => boolean;
}) {
  const mats = {
    bead: new MeshBasicMaterial({ color: WHITE.clone(), transparent: true, opacity: 0 }),
    halo: new SpriteMaterial({
      map: getHaloTexture(),
      color: EMERALD,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    ring: new MeshBasicMaterial({
      color: COLOR.glow,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      depthWrite: false,
    }),
    hit: new MeshBasicMaterial({ visible: false }),
  };
  const group = new Group();
  const bead = new Mesh(new IcosahedronGeometry(0.075, 2), mats.bead);
  const halo = new Sprite(mats.halo);
  const ring = new Mesh(new RingGeometry(0.2, 0.212, 56), mats.ring);
  const hit = new Mesh(new SphereGeometry(0.34, 12, 8), mats.hit);
  group.add(bead, halo, ring, hit);

  engine.setHit(hit, {
    over: () => {
      document.body.style.cursor = 'pointer';
      onHover(id);
    },
    out: () => {
      document.body.style.cursor = '';
      onHover(null);
    },
    click: () => {
      if (!shouldIgnoreClick()) onSelect(id);
    },
  });

  const tick: FrameCallback = ({ camera }, dt) => {
    const rt = runtime;
    const focus = activeId(rt);
    const isActive = focus === id;
    const dim = focus !== null && !isActive;
    rt.emphasis[id] = damp(rt.emphasis[id], isActive ? 1 : 0, 9, dt);
    const e = rt.emphasis[id];

    // Position (incl. entrance drop and float) is computed once per frame by the scene root.
    const enter = reveal(clock.time, INTRO.nodes + index * 0.06, 0.55);
    group.position.copy(rt.nodes[id]);
    group.scale.setScalar((0.6 + 0.4 * enter) * (1 + e * 0.35));
    const base = dim ? 0.4 : 1;
    mats.bead.opacity = enter * base;
    mats.bead.color.copy(WHITE).lerp(EMERALD, 0.35 + e * 0.5);
    mats.halo.opacity = enter * (0.32 + e * 0.5) * base;
    halo.scale.setScalar(0.55 + e * 0.35);

    const ringTarget = Math.max(e, rt.mix.separate * 0.7) * enter * base;
    mats.ring.opacity = damp(mats.ring.opacity, ringTarget * 0.55, 8, dt);
    ring.quaternion.copy(camera.quaternion);
    // Separate-workspace stage: rings grow into small "workspace" frames.
    ring.scale.setScalar(1 + rt.mix.separate * 0.6 + e * 0.15);
  };
  return { object: group, tick };
}
