import { useEffect, useInsertionEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { createAtmosphere } from './Atmosphere';
import { INTRO, QUALITY_SETTINGS } from './constants';
import { createCoreSphere } from './CoreSphere';
import { createDataConnections } from './DataConnections';
import { createDepartmentNode } from './DepartmentNode';
import { Engine, pixelRatio, type FrameCallback, type Frameloop } from './engine';
import { releaseSharedResources } from './halo';
import { WebGLBoundary } from './WebGLBoundary';
import { cameraDistance, CAMERA, nodeLocal, TILT } from './layout';
import { createOrbitSystem } from './OrbitSystem';
import { createParticleField } from './ParticleField';
import type { ControlState } from './controls';
import { activeId, createRuntime, ORBIT_IDS } from './runtime';
import { createClock, damp, reveal } from './sceneClock';
import type { OrbitDepartmentId, Quality, StoryStage } from './types';

/*
 * CORE World — the WebGL scene (lazy chunk: three.js loads only when this
 * module is imported). The DOM around it (labels, branding, department
 * controls, fallback) lives in CoreStage so that text stays crisp, selectable
 * and accessible.
 *
 * EP47: built directly on three.js through ./engine (no @react-three/fiber).
 * The scene graph, the per-frame order (the rig first, then atmosphere, CORE,
 * orbits, connections, departments, particles), the renderer settings and the
 * pointer behaviour are those of the EP36 R3F scene.
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

type Props = RefObject<CoreWorldProps>;

/** Build the renderer and the scene for one canvas. Throws when WebGL cannot start. */
function buildWorld(canvas: HTMLCanvasElement, wrap: HTMLElement, props: Props) {
  const p0 = props.current;
  let settings = QUALITY_SETTINGS[p0.quality];
  const engine = new Engine({
    canvas,
    wrap,
    antialias: settings.antialias,
    camera: { y: CAMERA.y, z: 11, fov: CAMERA.fov },
    onFail: () => props.current.onFail(),
  });
  const reduced = p0.quality === 'reduced';
  const clock = createClock(reduced);
  const runtime = createRuntime();
  runtime.hovered = p0.hovered;
  runtime.selected = p0.selected;
  runtime.stage = p0.stage;
  const focus = { current: 0 };
  const light = { current: new Vector3(0.6, 0.7, 0.9) };
  const state = { frames: 0, ready: false, slowFrames: 0, sampled: 0 };
  const tmp = new Vector3();
  const ignoreClick = () => (props.current.controls.current?.travel ?? 0) > 6;

  // ---- graph (EP36 order): atmosphere, then the rig with CORE, its hit area,
  // the tilted ring (orbits, connections, departments) and the particles.
  const atmosphere = createAtmosphere(clock);
  const rig = new Group();
  const core = createCoreSphere({
    clock,
    detail: settings.shaderDetail,
    segments: settings.sphereDetail,
    focus,
    light,
  });
  // Clicking CORE itself returns to the overview (clears department focus).
  const coreHit = new Mesh(
    new SphereGeometry(1.05, 24, 16),
    new MeshBasicMaterial({ visible: false }),
  );
  engine.setHit(coreHit, {
    click: () => {
      if (!ignoreClick()) props.current.onSelect(null);
    },
  });
  const tilt = new Group();
  tilt.rotation.set(TILT, 0, 0);
  const yawGroup = new Group();
  const orbits = createOrbitSystem(clock, runtime);
  const links = createDataConnections(clock, runtime, settings.pulsesPerLink);
  const nodes = ORBIT_IDS.map((id, index) =>
    createDepartmentNode({
      id,
      index,
      clock,
      runtime,
      engine,
      onHover: (d) => props.current.onHover(d),
      onSelect: (d) => props.current.onSelect(d),
      shouldIgnoreClick: ignoreClick,
    }),
  );
  const particles = createParticleField(settings.particles, clock);
  const add = (parent: Object3D, ...objects: Object3D[]) => parent.add(...objects);
  add(yawGroup, ...orbits.objects, ...links.objects, ...nodes.map((n) => n.object));
  add(tilt, yawGroup);
  add(rig, core.object, coreHit, tilt, particles.object);
  add(engine.scene, ...atmosphere.objects, rig);

  // ---- the rig: clock, story blends, node positions, drag, camera, labels — first each frame.
  const rigFrame: FrameCallback = ({ camera: cam, size }, rawDt) => {
    const props_ = props.current;
    const dt = Math.min(rawDt, 1 / 20);
    const c = props_.controls.current;
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
    const idle = settings.animate
      ? Math.sin(clock.motion * 0.071) * 0.016 + Math.sin(clock.motion * 0.029) * 0.009
      : 0;
    yawGroup.rotation.y = idle + (c?.yaw ?? 0);

    // Drag pitch on the outer rig + a tiny depth response to the pointer
    // (≤ 0.012 rad, ≈ 2–4 px). The pointer mostly moves the light, not the scene.
    if (c) {
      const tx = c.pitch + (reduced ? 0 : c.py * 0.008);
      const ty = reduced ? 0 : c.px * 0.012;
      rig.rotation.x = damp(rig.rotation.x, tx, 4, dt);
      rig.rotation.y = damp(rig.rotation.y, ty, 4, dt);
      const recede = 1 - m.recede * 0.12;
      rig.scale.setScalar(recede);
      light.current.set(0.35 + c.px * 0.6, 0.65 - c.py * 0.45, 0.85).normalize();
    }

    // Camera: framed for the stage's aspect, fixed during interaction.
    const aspect = size.width / Math.max(1, size.height);
    const dist = cameraDistance(aspect, props_.withLabels);
    cam.position.z = damp(cam.position.z, dist, 5, dt);
    cam.position.y = CAMERA.y;
    cam.lookAt(0, 0, 0);
    if (Math.abs(cam.position.z - dist) > 1e-3) moving = true;

    focus.current = activeId(runtime) ? 1 : 0;

    // DOM labels follow their 3D nodes.
    const labels = props_.labels.current;
    if (labels) {
      const focusId = activeId(runtime);
      ORBIT_IDS.forEach((id, i) => {
        const el = labels[id];
        if (!el) return;
        tmp.copy(runtime.nodes[id]);
        yawGroup.localToWorld(tmp);
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
    state.frames++;
    if (!state.ready && state.frames > 2) {
      state.ready = true;
      props_.onReady();
    }
    if (settings.animate && state.frames > 30 && rawDt < 0.5) {
      state.sampled++;
      if (rawDt > 1 / 32) state.slowFrames++;
      if (state.sampled >= 150) {
        if (state.slowFrames > 100) props_.onSlow();
        state.sampled = 0;
        state.slowFrames = 0;
      }
    }

    // On-demand rendering (reduced motion): keep frames coming only while something eases.
    if (!settings.animate && moving) engine.invalidate();
  };

  engine.onFrame(rigFrame, -1);
  for (const part of [atmosphere, core, orbits, links, ...nodes, particles])
    engine.onFrame(part.tick);

  const measure = () => {
    const r = wrap.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) engine.resize(r.width, r.height, pixelRatio(settings.dpr));
  };

  return {
    engine,
    runtime,
    measure,
    /** A runtime quality step (never to or from 'reduced', so the clock stays). */
    setQuality(quality: Exclude<Quality, 'static'>) {
      const next = QUALITY_SETTINGS[quality];
      if (next === settings) return;
      settings = next;
      core.setDetail(next.shaderDetail, next.sphereDetail);
      particles.setCount(next.particles);
      links.setPulses(next.pulsesPerLink);
      measure();
      engine.invalidate();
    },
    frameloop(active: boolean): Frameloop {
      return !active ? 'never' : settings.animate ? 'always' : 'demand';
    },
    dispose() {
      engine.dispose();
    },
  };
}

type World = ReturnType<typeof buildWorld>;

function Stage(props: CoreWorldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const world = useRef<World | null>(null);

  useLayoutEffect(() => {
    latest.current = props;
  });

  // One renderer per canvas. StrictMode replays layout effects, not insertion
  // effects, so the context is released only on real removal (as in R3F's <Canvas>).
  useLayoutEffect(() => {
    if (!world.current) {
      try {
        world.current = buildWorld(canvas.current!, wrap.current!, latest);
      } catch (e) {
        console.warn('CORE World: WebGL scene failed, using static fallback.', e);
        latest.current.onFail();
        return;
      }
    }
    const w = world.current;
    const ro = new ResizeObserver(w.measure);
    ro.observe(wrap.current!);
    w.measure();
    w.engine.connect();
    w.engine.setFrameloop(w.frameloop(latest.current.active));
    return () => {
      ro.disconnect();
      w.engine.disconnect();
      w.engine.setFrameloop('never');
    };
  }, []);
  // EP21: shared GPU resources must not keep this renderer alive (see halo.ts).
  useEffect(() => releaseSharedResources, []);
  useInsertionEffect(
    () => () => {
      world.current?.dispose();
      world.current = null;
    },
    [],
  );

  const { quality, active, hovered, selected, stage, invalidateRef } = props;
  useLayoutEffect(() => {
    const w = world.current;
    if (!w) return;
    w.setQuality(quality);
    w.engine.setFrameloop(w.frameloop(active));
  }, [quality, active]);

  // React props → per-frame runtime (no scene rebuild on hover).
  useLayoutEffect(() => {
    const w = world.current;
    if (!w) return;
    w.runtime.hovered = hovered;
    w.runtime.selected = selected;
    w.runtime.stage = stage;
    w.engine.invalidate();
  }, [hovered, selected, stage]);

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    invalidateRef.current = w.engine.invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidateRef]);

  return (
    <div
      ref={wrap}
      aria-hidden
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'pan-y',
      }}
    >
      <canvas ref={canvas} style={{ display: 'block' }} />
    </div>
  );
}

export default function CoreWorld(props: CoreWorldProps) {
  return (
    <WebGLBoundary onFail={props.onFail}>
      <Stage {...props} />
    </WebGLBoundary>
  );
}
