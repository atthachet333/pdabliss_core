import {
  AdditiveBlending,
  Color,
  EdgesGeometry,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import type { FrameCallback } from './engine';
import { COLOR, INTRO } from './constants';
import { reveal, type SceneClock } from './sceneClock';

/*
 * In-scene atmosphere. The deep navy gradient, grain and radial structure live
 * in CSS behind the transparent canvas (cheap, and identical in the fallback).
 * Here: one soft volumetric-like glow behind CORE and a distant, barely visible
 * network geometry that turns very slowly — depth without a starfield.
 */

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const glowFragment = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform vec3 uCool;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = pow(max(1.0 - d, 0.0), 2.4);
    vec3 c = mix(uCool, uColor, smoothstep(0.0, 0.7, 1.0 - d));
    gl_FragColor = vec4(c * g * uIntensity, g * uIntensity);
  }
`;

export function createAtmosphere(clock: SceneClock) {
  const glowMat = new ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uIntensity: { value: 0 },
      uColor: { value: new Color(COLOR.emerald) },
      uCool: { value: new Color('#0d3b4a') },
    },
  });
  const netGeo = new EdgesGeometry(new IcosahedronGeometry(8.5, 1));
  const netMat = new LineBasicMaterial({
    color: COLOR.teal,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const glow = new Mesh(new PlaneGeometry(11, 11), glowMat);
  glow.position.set(0, 0, -2.4);
  glow.renderOrder = -2;
  const net = new LineSegments(netGeo, netMat);
  net.position.set(0, 0, -3);

  const tick: FrameCallback = () => {
    const m = clock.motion;
    const breathe = 0.9 + 0.06 * Math.sin(m * 0.23) + 0.04 * Math.sin(m * 0.097);
    glowMat.uniforms.uIntensity!.value = reveal(clock.time, 0.05, 1.0) * 0.32 * breathe;
    netMat.opacity = reveal(clock.time, INTRO.orbits, 1.4) * 0.045;
    net.rotation.y = m * 0.006;
    net.rotation.z = m * 0.003;
  };
  return { objects: [glow, net], tick };
}
