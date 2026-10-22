import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  SpriteMaterial,
  type Group,
  type Mesh,
  type Sprite,
} from 'three';
import { COLOR, INTRO } from './constants';
import { activeId, type WorldRuntime } from './runtime';
import { damp, reveal, type SceneClock } from './sceneClock';
import type { OrbitDepartmentId } from './types';

/** Shared soft radial sprite texture (64px) for node halos. */
let haloTexture: CanvasTexture | null = null;
function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  haloTexture = new CanvasTexture(c);
  return haloTexture;
}

const WHITE = new Color('#e8fff7');
const EMERALD = new Color(COLOR.glow);

/**
 * One department in the orbit: a glass bead, a soft halo and a "workspace
 * ring" that appears when the department is in focus or when the story shows
 * departments as separate workspaces. A larger invisible sphere is the hit area.
 */
export function DepartmentNode({
  id,
  index,
  clock,
  runtime,
  onHover,
  onSelect,
  shouldIgnoreClick,
}: {
  id: OrbitDepartmentId;
  index: number;
  clock: SceneClock;
  runtime: WorldRuntime;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId) => void;
  shouldIgnoreClick: () => boolean;
}) {
  const group = useRef<Group>(null);
  const bead = useRef<Mesh>(null);
  const halo = useRef<Sprite>(null);
  const ring = useRef<Mesh>(null);

  const mats = useMemo(
    () => ({
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
    }),
    [],
  );

  useFrame(({ camera }, dt) => {
    const rt = runtime;
    const focus = activeId(rt);
    const isActive = focus === id;
    const dim = focus !== null && !isActive;
    rt.emphasis[id] = damp(rt.emphasis[id], isActive ? 1 : 0, 9, dt);
    const e = rt.emphasis[id];

    // Position (incl. entrance drop and float) is computed once per frame by the scene root.
    const enter = reveal(clock.time, INTRO.nodes + index * 0.06, 0.55);
    if (group.current) {
      group.current.position.copy(rt.nodes[id]);
      group.current.scale.setScalar((0.6 + 0.4 * enter) * (1 + e * 0.35));
    }
    const base = dim ? 0.4 : 1;
    mats.bead.opacity = enter * base;
    mats.bead.color.copy(WHITE).lerp(EMERALD, 0.35 + e * 0.5);
    mats.halo.opacity = enter * (0.32 + e * 0.5) * base;
    if (halo.current) halo.current.scale.setScalar(0.55 + e * 0.35);

    const ringTarget = Math.max(e, rt.mix.separate * 0.7) * enter * base;
    mats.ring.opacity = damp(mats.ring.opacity, ringTarget * 0.55, 8, dt);
    if (ring.current) {
      ring.current.quaternion.copy(camera.quaternion);
      // Separate-workspace stage: rings grow into small "workspace" frames.
      ring.current.scale.setScalar(1 + rt.mix.separate * 0.6 + e * 0.15);
    }
  });

  const over = (ev: ThreeEvent<PointerEvent>) => {
    ev.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(id);
  };
  const out = () => {
    document.body.style.cursor = '';
    onHover(null);
  };
  const click = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    if (!shouldIgnoreClick()) onSelect(id);
  };

  return (
    <group ref={group}>
      <mesh ref={bead} material={mats.bead}>
        <icosahedronGeometry args={[0.075, 2]} />
      </mesh>
      <sprite ref={halo} material={mats.halo} />
      <mesh ref={ring} material={mats.ring}>
        <ringGeometry args={[0.2, 0.212, 56]} />
      </mesh>
      <mesh material={mats.hit} onPointerOver={over} onPointerOut={out} onClick={click}>
        <sphereGeometry args={[0.34, 12, 8]} />
      </mesh>
    </group>
  );
}
