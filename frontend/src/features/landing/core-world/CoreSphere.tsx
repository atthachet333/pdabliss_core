import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  LineBasicMaterial,
  ShaderMaterial,
  Vector3,
  type Group,
  type LineSegments,
  type Mesh,
} from 'three';
import { COLOR, CORE_RADIUS, INTRO } from './constants';
import { reveal, type SceneClock } from './sceneClock';

/*
 * The CORE: an obsidian-glass sculpture, not a planet. One opaque sphere
 * carries everything in a single shader — dark smoked base, procedural
 * latitude/longitude network, data points travelling the lines, a fake
 * internal emerald energy volume, fresnel rim and a glass highlight that
 * follows the pointer. A back-face halo and a geodesic lattice add layered depth.
 */

const shellVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vObj;
  void main() {
    vObj = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const shellFragment = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uRim;
  uniform float uDetail;
  uniform float uFocus;
  uniform vec3 uLight;
  uniform vec3 uBase;
  uniform vec3 uEmerald;
  uniform vec3 uCyan;
  uniform vec3 uLine;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vObj;

  float hash1(float n) { return fract(sin(n) * 43758.5453); }
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
          mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
          mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vV);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.6);

    vec3 p = normalize(vObj);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);

    // Network: latitude / longitude lines, anti-aliased, thinned at the poles.
    vec2 g = vec2(lat / 3.14159 * 10.0, lon / 6.28318 * 20.0);
    vec2 gl = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
    float line = 1.0 - min(min(gl.x, gl.y), 1.0);
    line *= smoothstep(0.97, 0.55, abs(p.y));

    // Data points travelling along half of the longitude lines, each at its own pace.
    float cell = floor(g.y + 0.5);
    float carries = step(0.45, hash1(cell * 3.17));
    float speed = 0.035 + hash1(cell) * 0.05;
    float dotLat = (fract(uTime * speed + hash1(cell * 7.1)) * 2.0 - 1.0) * 1.25;
    float dLon = (g.y - cell) * (6.28318 / 20.0) * cos(lat);
    float dd = length(vec2(lat - dotLat, dLon));
    float dataPt = smoothstep(0.07, 0.0, dd) * carries;

    vec3 col = uBase;

    // Internal energy: slow emerald currents seen through the glass centre.
    if (uDetail > 0.5) {
      vec3 q = p * 2.1 + vec3(0.0, uTime * 0.035, uTime * 0.02);
      float e = noise(q);
      if (uDetail > 1.5) e = e * 0.65 + noise(q * 2.3 + 4.0) * 0.35;
      e = smoothstep(0.42, 0.95, e);
      col += uEmerald * e * (1.0 - fres) * (0.20 + uFocus * 0.08);
    }
    col += uEmerald * pow(ndv, 3.0) * 0.06;

    col += uLine * line * (0.07 + fres * 0.4);
    col += uCyan * dataPt * (0.9 + uFocus * 0.4);

    // Rim: emerald below, teal/cyan toward the top — architectural, not neon.
    vec3 rim = mix(uEmerald, uCyan, smoothstep(-0.2, 1.0, N.y));
    col += rim * fres * uRim;

    // Smoked-glass highlight that answers the pointer.
    vec3 L = normalize(uLight);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 56.0);
    col += vec3(0.85, 0.97, 1.0) * spec * 0.45;
    col += uEmerald * max(dot(N, L), 0.0) * 0.035;

    gl_FragColor = vec4(col, uReveal);
  }
`;

const haloVertex = shellVertex;
const haloFragment = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // Back faces: 0 at the halo silhouette, rising toward the CORE limb.
    float t = clamp(-dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float g = pow(smoothstep(0.0, 0.62, t), 1.7);
    gl_FragColor = vec4(uColor * g * uIntensity, g * uIntensity);
  }
`;

export function CoreSphere({
  clock,
  detail,
  segments,
  focus,
  light,
}: {
  clock: SceneClock;
  detail: number;
  segments: number;
  /** 0…1 — a department is hovered/selected (CORE answers with a pulse). */
  focus: React.RefObject<number>;
  /** View-space light direction, steered by the pointer. */
  light: React.RefObject<Vector3>;
}) {
  const shell = useRef<Mesh>(null);
  const lattice = useRef<LineSegments>(null);
  const group = useRef<Group>(null);

  const shellMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uRim: { value: 0 },
          uDetail: { value: detail },
          uFocus: { value: 0 },
          uLight: { value: new Vector3(0.6, 0.7, 0.9) },
          uBase: { value: new Color(COLOR.ink) },
          uEmerald: { value: new Color(COLOR.emerald) },
          uCyan: { value: new Color(COLOR.cyan) },
          uLine: { value: new Color(COLOR.teal) },
        },
      }),
    [detail],
  );

  const haloMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: haloVertex,
        fragmentShader: haloFragment,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uIntensity: { value: 0 }, uColor: { value: new Color(COLOR.emerald) } },
      }),
    [],
  );

  const latticeGeo = useMemo(
    () => new EdgesGeometry(new IcosahedronGeometry(CORE_RADIUS * 1.36, 1)),
    [],
  );
  const latticeMat = useMemo(
    () =>
      new LineBasicMaterial({
        color: COLOR.teal,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, dt) => {
    const t = clock.time;
    const r = reveal(t, INTRO.core, 0.6);
    const u = shellMat.uniforms;
    u.uTime!.value = clock.motion;
    u.uReveal!.value = r;
    const f = focus.current ?? 0;
    u.uFocus!.value += (f - u.uFocus!.value) * Math.min(1, dt * 4);
    // Rim breathes on a long, irregular cycle (two incommensurate sines).
    const breathe =
      0.92 + 0.05 * Math.sin(clock.motion * 0.31) + 0.03 * Math.sin(clock.motion * 0.173);
    u.uRim!.value = reveal(t, INTRO.rim, 0.6) * (0.95 + f * 0.35) * breathe;
    if (light.current) (u.uLight!.value as Vector3).lerp(light.current, Math.min(1, dt * 3));
    haloMat.uniforms.uIntensity!.value = reveal(t, INTRO.rim, 0.8) * (0.5 + f * 0.25) * breathe;
    latticeMat.opacity = reveal(t, INTRO.orbits, 0.8) * 0.13;

    if (group.current) group.current.scale.setScalar(0.86 + 0.14 * r);
    if (shell.current) shell.current.rotation.y = clock.motion * 0.028;
    if (lattice.current) {
      lattice.current.rotation.y = -clock.motion * 0.017;
      lattice.current.rotation.x = clock.motion * 0.006;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={shell} material={shellMat}>
        <sphereGeometry args={[CORE_RADIUS, segments, Math.round(segments * 0.66)]} />
      </mesh>
      <mesh material={haloMat} scale={1.24}>
        <sphereGeometry args={[CORE_RADIUS, 48, 32]} />
      </mesh>
      <lineSegments ref={lattice} geometry={latticeGeo} material={latticeMat} />
    </group>
  );
}
