import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';
import { COLOR, INTRO, PROCESS_FLOW } from './constants';
import { coreAnchor } from './layout';
import { activeId, ORBIT_IDS, type WorldRuntime } from './runtime';
import { damp, reveal, type SceneClock } from './sceneClock';
import type { OrbitDepartmentId } from './types';

const SEG = 36;

/*
 * Connections and data pulses.
 *  - Spokes: every department → CORE (data flows inward to the one source of truth)
 *  - Process arcs: Sales → Operations → Warehouse → Purchasing → Accounting → Reports,
 *    shown in story stage 3
 * Curves are recomputed each frame (tiny: 11 × 37 points) so they follow nodes
 * as the story spreads them. All pulses share one Points draw call.
 */

const pulseVertex = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (9.0 / -mv.z);
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * mv;
  }
`;
const pulseFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCore;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 c = mix(uColor, uCore, smoothstep(0.25, 0.0, d));
    gl_FragColor = vec4(c * a * vAlpha, a * vAlpha);
  }
`;

interface Link {
  line: Line;
  mat: LineBasicMaterial;
  pos: Float32Array;
  from: OrbitDepartmentId;
  to: OrbitDepartmentId | 'core';
}

function makeLine(color: string): Omit<Link, 'from' | 'to'> {
  const pos = new Float32Array((SEG + 1) * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
  const line = new Line(geo, mat);
  line.frustumCulled = false;
  return { line, mat, pos };
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();

function bezier(out: Vector3, a: Vector3, c: Vector3, b: Vector3, t: number) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

/** Control points: spokes bow upward, process arcs bow outward around CORE. */
function controlFor(link: Link, a: Vector3, b: Vector3, out: Vector3) {
  out.copy(a).add(b).multiplyScalar(0.5);
  if (link.to === 'core')
    return out.addScaledVector(out.clone().normalize(), 0.32).add(tmpC.set(0, 0.22, 0));
  return out.multiplyScalar(1.32).add(tmpC.set(0, 0.18, 0));
}

export function DataConnections({
  clock,
  runtime,
  pulsesPerLink,
}: {
  clock: SceneClock;
  runtime: WorldRuntime;
  pulsesPerLink: number;
}) {
  const dpr = useThree((s) => s.viewport.dpr);

  const links = useMemo<Link[]>(() => {
    const spokes = ORBIT_IDS.map((id) => ({
      ...makeLine(COLOR.glow),
      from: id,
      to: 'core' as const,
    }));
    const process = PROCESS_FLOW.slice(0, -1).map((id, i) => ({
      ...makeLine(COLOR.cyan),
      from: id,
      to: PROCESS_FLOW[i + 1]!,
    }));
    return [...spokes, ...process];
  }, []);

  const pulses = useMemo(() => {
    const perSpoke = pulsesPerLink;
    const perArc = pulsesPerLink > 0 ? 1 : 0;
    const items: { link: number; offset: number }[] = [];
    links.forEach((l, i) => {
      const n = l.to === 'core' ? perSpoke : perArc;
      for (let k = 0; k < n; k++) items.push({ link: i, offset: k / Math.max(1, n) + i * 0.137 });
    });
    const count = Math.max(items.length, 1);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1));
    const mat = new ShaderMaterial({
      vertexShader: pulseVertex,
      fragmentShader: pulseFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: 1 },
        uColor: { value: new Color(COLOR.glow) },
        uCore: { value: new Color('#f0fffa') },
      },
    });
    return { items, geo, mat, phase: items.map(() => 0) };
  }, [links, pulsesPerLink]);

  useFrame((_, dt) => {
    const rt = runtime;
    const focus = activeId(rt);
    const drawn = reveal(clock.time, INTRO.links, 0.7);
    const { separate, process, recede } = rt.mix;

    links.forEach((l) => {
      const a = rt.nodes[l.from];
      if (l.to === 'core') {
        tmpB.set(...coreAnchor([a.x, a.y, a.z]));
      } else {
        tmpB.copy(rt.nodes[l.to]);
      }
      const c = controlFor(l, a, tmpB, tmpA);
      for (let i = 0; i <= SEG; i++) {
        const p = bezier(tmpC, a, c, tmpB, i / SEG);
        l.pos[i * 3] = p.x;
        l.pos[i * 3 + 1] = p.y;
        l.pos[i * 3 + 2] = p.z;
      }
      const attr = l.line.geometry.getAttribute('position') as BufferAttribute;
      attr.needsUpdate = true;

      let target: number;
      if (l.to === 'core') {
        const on = focus === l.from;
        const base = 0.22 * (1 - separate * 0.7) * (1 - process * 0.35);
        target = focus ? (on ? 0.8 : base * 0.4) : base;
        l.line.geometry.setDrawRange(0, Math.ceil((SEG + 1) * drawn));
      } else {
        const on = focus === l.from || focus === l.to;
        target = process * (on ? 0.85 : 0.5);
        l.line.geometry.setDrawRange(0, SEG + 1);
      }
      l.mat.opacity = damp(l.mat.opacity, target * (1 - recede * 0.6), 7, dt);
    });

    // Pulses: data travelling node → CORE (and along the process in stage 3).
    const posAttr = pulses.geo.getAttribute('position') as BufferAttribute;
    const alphaAttr = pulses.geo.getAttribute('aAlpha') as BufferAttribute;
    const sizeAttr = pulses.geo.getAttribute('aSize') as BufferAttribute;
    pulses.items.forEach((p, i) => {
      const l = links[p.link]!;
      const spoke = l.to === 'core';
      const on = focus !== null && (focus === l.from || focus === l.to);
      const speed = spoke ? (on ? 0.55 : 0.2) : 0.28;
      pulses.phase[i] = (pulses.phase[i]! + dt * speed) % 1;
      const u = (pulses.phase[i]! + p.offset) % 1;
      const n = Math.min(SEG, Math.floor(u * SEG));
      const f = u * SEG - n;
      for (let k = 0; k < 3; k++) {
        posAttr.array[i * 3 + k] =
          l.pos[n * 3 + k]! + (l.pos[(n + 1) * 3 + k]! - l.pos[n * 3 + k]!) * f;
      }
      const vis = spoke
        ? (drawn > 0.99 ? 1 : 0) * (focus && !on ? 0.25 : 1) * (1 - separate * 0.8)
        : process;
      alphaAttr.array[i] = Math.sin(Math.PI * u) * vis * (on ? 1 : 0.7) * (1 - recede * 0.6);
      sizeAttr.array[i] = on ? 3.4 : 2.4;
    });
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    pulses.mat.uniforms.uPixelRatio!.value = dpr;
  });

  return (
    <>
      {links.map((l, i) => (
        <primitive key={i} object={l.line} />
      ))}
      {pulses.items.length > 0 && (
        <points geometry={pulses.geo} material={pulses.mat} frustumCulled={false} />
      )}
    </>
  );
}
