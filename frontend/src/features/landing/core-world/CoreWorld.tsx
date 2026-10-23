import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector3, type Group, type PerspectiveCamera } from 'three';
import { Atmosphere } from './Atmosphere';
import { INTRO, QUALITY_SETTINGS } from './constants';
import { CoreSphere } from './CoreSphere';
import { DataConnections } from './DataConnections';
import { DepartmentNode } from './DepartmentNode';
import { WebGLBoundary } from './WebGLBoundary';
import { cameraDistance, CAMERA, nodeLocal, TILT } from './layout';
import { OrbitSystem } from './OrbitSystem';
import { ParticleField } from './ParticleField';
import type { ControlState } from './controls';
import { activeId, createRuntime, ORBIT_IDS, type WorldRuntime } from './runtime';
import { createClock, damp, reveal } from './sceneClock';
import type { OrbitDepartmentId, Quality, StoryStage } from './types';

/*
 * CORE World — the WebGL scene (lazy chunk: three + @react-three/fiber load
 * only when this module is imported). The DOM around it (labels, branding,
 * department controls, fallback) lives in CoreStage so that text stays crisp,
 * selectable and accessible.
 */

export interface CoreWorldProps {
  quality: Exclude<Quality, 'static'>;
  hovered: OrbitDepartmentId | null;
  selected: OrbitDepartmentId | null;
  stage: StoryStage;
  onHover: (id: OrbitDepartmentId | null) => void;
  /** Department to focus, or null for the CORE overview (clicking CORE itself). */
  onSelect: (id: OrbitDepartmentId | null) => void;
  controls: RefObject<ControlState>;
  /** DOM label elements, positioned every frame from the 3D node positions. */
  labels: RefObject<Partial<Record<OrbitDepartmentId, HTMLElement | null>>>;
  withLabels: boolean;
  /** false when the stage is offscreen or the tab hidden — rendering pauses. */
  active: boolean;
  onReady: () => void;
  onSlow: () => void;
  onFail: () => void;
  /** Lets DOM input request a frame when rendering on demand (reduced motion). */
  invalidateRef: RefObject<(() => void) | null>;
}

/** Drag clamps — the composition can be turned, never thrown into an ugly angle. */
const MAX_YAW = 0.6;
const MAX_PITCH = 0.15;

function Scene(props: CoreWorldProps) {
  const settings = QUALITY_SETTINGS[props.quality];
  const reduced = props.quality === 'reduced';
  const clock = useMemo(() => createClock(reduced), [reduced]);
  const runtime = useMemo<WorldRuntime>(() => createRuntime(), []);
  const rig = useRef<Group>(null);
  const yawGroup = useRef<Group>(null);
  const focus = useRef(0);
  const light = useRef(new Vector3(0.6, 0.7, 0.9));
  const state = useRef({ frames: 0, ready: false, slowFrames: 0, sampled: 0 });
  const { camera, size, invalidate } = useThree();

  // React props → per-frame runtime (no scene re-render on hover).
  useLayoutEffect(() => {
    runtime.hovered = props.hovered;
    runtime.selected = props.selected;
    runtime.stage = props.stage;
    invalidate();
  }, [runtime, props.hovered, props.selected, props.stage, invalidate]);
  const { invalidateRef } = props;
  useEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate, invalidateRef]);

  const tmp = useMemo(() => new Vector3(), []);

  // Runs first each frame: clock, story blends, node positions, rig, camera, labels.
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const c = props.controls.current;
    const now = performance.now();
    let moving = false;

    clock.time += dt;
    if (settings.animate) clock.motion += dt;
    if (clock.time < INTRO.done + 1) moving = true;

    // Story stage blends.
    const s = runtime.stage;
    const m = runtime.mix;
    const k = reduced ? 30 : 3.2;
    const targets = {
      spread: s === 2 ? 1 : 0,
      separate: s === 2 ? 1 : 0,
      process: s === 3 ? 1 : 0,
      recede: s === 4 ? 1 : 0,
    };
    (Object.keys(targets) as (keyof typeof targets)[]).forEach((key) => {
      const next = damp(m[key], targets[key], k, dt);
      if (Math.abs(next - targets[key]) > 1e-3) moving = true;
      m[key] = next;
    });

    // Node positions (shared by nodes, links and labels).
    ORBIT_IDS.forEach((id, i) => {
      const [x, y, z] = nodeLocal(id, 1 + m.spread * 0.18);
      const enter = reveal(clock.time, INTRO.nodes + i * 0.06, 0.55);
      const bob = Math.sin(clock.motion * 0.5 + i * 1.7) * 0.035;
      runtime.nodes[id].set(x, y + bob - (1 - enter) * 0.25, z);
    });

    // Drag inertia and the slow return toward the composed view once idle.
    if (c && !c.dragging) {
      c.yaw += c.vYaw * dt;
      c.pitch += c.vPitch * dt;
      // Restrained inertia: settles in well under a second.
      c.vYaw = damp(c.vYaw, 0, 6, dt);
      c.vPitch = damp(c.vPitch, 0, 6, dt);
      if (now - c.lastInput > 2600) {
        c.yaw = damp(c.yaw, 0, 0.45, dt);
        c.pitch = damp(c.pitch, 0, 0.8, dt);
      }
      if (Math.abs(c.vYaw) + Math.abs(c.yaw) + Math.abs(c.pitch) > 1e-3) moving = true;
    }
    if (c) {
      c.yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, c.yaw));
      c.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, c.pitch));
      if (c.dragging) moving = true;
    }

    // The composition is design-locked: no camera move or ring turn on selection,
    // and only a whisper of idle drift (±0.025 rad, ≈ 3 px at the nodes) so the
    // world feels alive without travelling. Only a deliberate drag rotates it.
    const st = state.current;
    const idle = settings.animate
      ? Math.sin(clock.motion * 0.071) * 0.016 + Math.sin(clock.motion * 0.029) * 0.009
      : 0;
    if (yawGroup.current) yawGroup.current.rotation.y = idle + (c?.yaw ?? 0);

    // Drag pitch on the outer rig + a tiny depth response to the pointer
    // (≤ 0.012 rad, ≈ 2–4 px). The pointer mostly moves the light, not the scene.
    if (rig.current && c) {
      const tx = c.pitch + (reduced ? 0 : c.py * 0.008);
      const ty = reduced ? 0 : c.px * 0.012;
      rig.current.rotation.x = damp(rig.current.rotation.x, tx, 4, dt);
      rig.current.rotation.y = damp(rig.current.rotation.y, ty, 4, dt);
      const recede = 1 - m.recede * 0.12;
      rig.current.scale.setScalar(recede);
      light.current.set(0.35 + c.px * 0.6, 0.65 - c.py * 0.45, 0.85).normalize();
    }

    // Camera: framed for the stage's aspect, fixed during interaction.
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const dist = cameraDistance(aspect, props.withLabels);
    cam.position.z = damp(cam.position.z, dist, 5, dt);
    cam.position.y = CAMERA.y;
    cam.lookAt(0, 0, 0);
    if (Math.abs(cam.position.z - dist) > 1e-3) moving = true;

    focus.current = activeId(runtime) ? 1 : 0;

    // DOM labels follow their 3D nodes.
    const labels = props.labels.current;
    if (labels && yawGroup.current) {
      const focusId = activeId(runtime);
      ORBIT_IDS.forEach((id, i) => {
        const el = labels[id];
        if (!el) return;
        tmp.copy(runtime.nodes[id]);
        yawGroup.current!.localToWorld(tmp);
        const depth = tmp.z;
        tmp.project(cam);
        const x = (tmp.x * 0.5 + 0.5) * size.width;
        const y = (-tmp.y * 0.5 + 0.5) * size.height;
        const enter = reveal(clock.time, INTRO.nodes + 0.15 + i * 0.06, 0.5);
        const back = Math.max(0, Math.min(1, (-depth - 0.3) / 2));
        const dimmed = focusId !== null && focusId !== id;
        // World cards sit on their node; nearer departments read slightly larger.
        const scale = 1.04 - back * 0.16;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        el.style.opacity = String(enter * (dimmed ? 0.45 : 1) * (1 - back * 0.12));
        el.style.zIndex = String(Math.round(100 + depth * 10));
      });
    }

    // Ready after the first frames; runtime guard steps quality down on sustained slow frames.
    st.frames++;
    if (!st.ready && st.frames > 2) {
      st.ready = true;
      props.onReady();
    }
    if (settings.animate && st.frames > 30 && rawDt < 0.5) {
      st.sampled++;
      if (rawDt > 1 / 32) st.slowFrames++;
      if (st.sampled >= 150) {
        if (st.slowFrames > 100) props.onSlow();
        st.sampled = 0;
        st.slowFrames = 0;
      }
    }

    // On-demand rendering (reduced motion): keep frames coming only while something eases.
    if (!settings.animate && moving) invalidate();
  }, -1);

  const ignoreClick = () => (props.controls.current?.travel ?? 0) > 6;

  return (
    <>
      <Atmosphere clock={clock} />
      <group ref={rig}>
        <CoreSphere
          clock={clock}
          detail={settings.shaderDetail}
          segments={settings.sphereDetail}
          focus={focus}
          light={light}
        />
        {/* Clicking CORE itself returns to the overview (clears department focus). */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            if (!ignoreClick()) props.onSelect(null);
          }}
        >
          <sphereGeometry args={[1.05, 24, 16]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <group rotation={[TILT, 0, 0]}>
          <group ref={yawGroup}>
            <OrbitSystem clock={clock} runtime={runtime} />
            <DataConnections
              clock={clock}
              runtime={runtime}
              pulsesPerLink={settings.pulsesPerLink}
            />
            {ORBIT_IDS.map((id, i) => (
              <DepartmentNode
                key={id}
                id={id}
                index={i}
                clock={clock}
                runtime={runtime}
                onHover={props.onHover}
                onSelect={props.onSelect}
                shouldIgnoreClick={ignoreClick}
              />
            ))}
          </group>
        </group>
        <ParticleField count={settings.particles} clock={clock} />
      </group>
    </>
  );
}

export default function CoreWorld(props: CoreWorldProps) {
  const settings = QUALITY_SETTINGS[props.quality];
  const frameloop = !props.active ? 'never' : settings.animate ? 'always' : 'demand';
  return (
    <WebGLBoundary onFail={props.onFail}>
      <Canvas
        flat
        linear
        dpr={settings.dpr}
        frameloop={frameloop}
        camera={{ position: [0, CAMERA.y, 11], fov: CAMERA.fov, near: 0.1, far: 60 }}
        gl={{
          antialias: settings.antialias,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            props.onFail();
          });
        }}
        aria-hidden
        style={{ touchAction: 'pan-y' }}
      >
        <Scene {...props} />
      </Canvas>
    </WebGLBoundary>
  );
}
