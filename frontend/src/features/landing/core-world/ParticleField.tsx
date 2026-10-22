import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { COLOR, INTRO } from './constants';
import { reveal, type SceneClock } from './sceneClock';

/*
 * Sparse, purposeful particles: a shell of slow motes around CORE (not a
 * starfield). Drift happens entirely in the vertex shader — one draw call, no
 * per-frame CPU work. Frozen under reduced motion.
 */

const vertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vAlpha;
  varying float vMix;
  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    p.x += sin(uTime * 0.045 + s) * 0.22;
    p.y += sin(uTime * 0.037 + s * 1.7) * 0.18;
    p.z += cos(uTime * 0.041 + s * 2.3) * 0.22;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPixelRatio * (0.55 + fract(aSeed * 13.7) * 0.9) * (9.0 / -mv.z);
    vAlpha = 0.22 + 0.5 * fract(aSeed * 7.3);
    vAlpha *= 0.75 + 0.25 * sin(uTime * 0.21 + s * 3.0);
    vMix = fract(aSeed * 3.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uReveal;
  uniform vec3 uA;
  uniform vec3 uB;
  varying float vAlpha;
  varying float vMix;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha * uReveal;
    gl_FragColor = vec4(mix(uA, uB, vMix) * a, a);
  }
`;

export function ParticleField({ count, clock }: { count: number; clock: SceneClock }) {
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    // Deterministic distribution: a thick shell, denser near the ring plane.
    let seed = 20261022;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2.2 + Math.pow(rand(), 0.7) * 5.5;
      const theta = rand() * Math.PI * 2;
      const y = (rand() - 0.5) * (1.2 + r * 0.45);
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r - 1.2;
      seeds[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: 2.4 },
          uA: { value: new Color(COLOR.teal) },
          uB: { value: new Color(COLOR.soft) },
        },
      }),
    [],
  );

  useFrame(() => {
    material.uniforms.uTime!.value = clock.motion;
    material.uniforms.uReveal!.value = reveal(clock.time, INTRO.core, 1.2);
    material.uniforms.uPixelRatio!.value = dpr;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
