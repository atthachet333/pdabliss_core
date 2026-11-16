import {
  LinearSRGBColorSpace,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  type Mesh,
  type Object3D,
} from 'three';

/*
 * EP47 bundle recovery: the CORE World renders through plain three.js. Until
 * EP46 it went through @react-three/fiber (≈ 160 KiB of reconciler and store
 * for one scene); this module does the part of it the scene used, with the
 * same settings:
 *   - renderer: flat (NoToneMapping), linear output, the stage's antialias /
 *     alpha / power preference / no stencil, pixel ratio clamped like R3F's `dpr`;
 *   - camera: perspective, aspect from the container, updated on resize;
 *   - frame loop: 'always' | 'demand' | 'never' with R3F's invalidate rules
 *     (a request from inside a frame asks for one more), frame callbacks in
 *     priority order then subscription order, delta from the moment the loop
 *     (re)started;
 *   - pointer events on the wrapper: hover (nearest hit with a hover handler,
 *     out before over) and click (nearest hit that was also under the press).
 * Nothing here knows the scene; CoreWorld.tsx builds it.
 */

export interface FrameState {
  camera: PerspectiveCamera;
  size: { width: number; height: number };
  dpr: number;
}
export type FrameCallback = (state: FrameState, dt: number) => void;
export type Frameloop = 'always' | 'demand' | 'never';

/** Pointer handlers on a hit mesh (the subset of R3F events the scene uses). */
export interface HitHandlers {
  over?: () => void;
  out?: () => void;
  click?: () => void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
  antialias: boolean;
  camera: { y: number; z: number; fov: number };
  onFail: () => void;
}

export const pixelRatio = (dpr: readonly [number, number]) =>
  Math.min(Math.max(window.devicePixelRatio || 1, dpr[0]), dpr[1]);

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly state: FrameState;
  private readonly subs: { cb: FrameCallback; priority: number }[] = [];
  private readonly hits = new Map<Object3D, HitHandlers>();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private frameloop: Frameloop = 'never';
  private frames = 0;
  private raf = 0;
  private running = false;
  private inFrame = false;
  private oldTime = 0;
  private hovered: Object3D | null = null;
  private pressed: Object3D[] = [];
  private failed = false;
  private readonly lost = (e: Event) => {
    e.preventDefault();
    this.fail();
  };

  constructor(private readonly opts: EngineOptions) {
    this.renderer = new WebGLRenderer({
      canvas: opts.canvas,
      antialias: opts.antialias,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    opts.canvas.addEventListener('webglcontextlost', this.lost);
    this.camera = new PerspectiveCamera(opts.camera.fov, 1, 0.1, 60);
    this.camera.position.set(0, opts.camera.y, opts.camera.z);
    this.camera.lookAt(0, 0, 0);
    this.state = { camera: this.camera, size: { width: 0, height: 0 }, dpr: 1 };
  }

  /** Register a per-frame callback; lower priority runs first, ties in order of registration. */
  onFrame(cb: FrameCallback, priority = 0) {
    this.subs.push({ cb, priority });
    this.subs.sort((a, b) => a.priority - b.priority);
  }

  setHit(object: Object3D, handlers: HitHandlers) {
    this.hits.set(object, handlers);
  }

  resize(width: number, height: number, dpr: number) {
    const s = this.state;
    if (s.size.width === width && s.size.height === height && s.dpr === dpr) return;
    s.size = { width, height };
    s.dpr = dpr;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, true);
    this.invalidate();
  }

  setFrameloop(frameloop: Frameloop) {
    if (frameloop === this.frameloop) return;
    this.frameloop = frameloop;
    this.oldTime = performance.now();
    if (frameloop === 'always') this.start();
    else if (frameloop === 'demand') this.invalidate();
  }

  /** Ask for a frame ('demand'); from inside a frame, for one more after it. */
  readonly invalidate = () => {
    if (this.frameloop === 'never' || this.failed || !this.state.size.width) return;
    this.frames = this.inFrame ? 2 : 1;
    this.start();
  };

  private start() {
    if (this.running || this.failed) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    let repeat = 0;
    if (
      this.state.size.width > 0 &&
      (this.frameloop === 'always' || (this.frameloop === 'demand' && this.frames > 0))
    ) {
      const now = performance.now();
      const dt = (now - this.oldTime) / 1000;
      this.oldTime = now;
      this.inFrame = true;
      try {
        for (const s of this.subs) s.cb(this.state, dt);
        this.renderer.render(this.scene, this.camera);
      } catch (e) {
        console.warn('CORE World: WebGL scene failed, using static fallback.', e);
        this.inFrame = false;
        this.fail();
        return;
      }
      this.inFrame = false;
      this.frames = Math.max(0, this.frames - 1);
      repeat = this.frameloop === 'always' ? 1 : this.frames;
    }
    if (repeat === 0) this.stop();
  };

  /** Stop drawing (the loop restarts on the next invalidate / 'always'). */
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
  }

  private fail() {
    if (this.failed) return;
    this.failed = true;
    this.stop();
    this.opts.onFail();
  }

  // ---------------------------------------------------------------- pointer events

  private intersect(e: PointerEvent | MouseEvent) {
    const { width, height } = this.state.size;
    if (!width || !height || !this.hits.size) return [];
    const r = this.opts.wrap.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / width) * 2 - 1,
      -((e.clientY - r.top) / height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects([...this.hits.keys()], false).map((i) => i.object);
  }

  private setHovered(next: Object3D | null) {
    if (next === this.hovered) return;
    const prev = this.hovered;
    this.hovered = next;
    if (prev) this.hits.get(prev)?.out?.();
    if (next) this.hits.get(next)?.over?.();
  }

  private readonly onMove = (e: PointerEvent) => {
    this.setHovered(this.intersect(e).find((o) => this.hits.get(o)?.over) ?? null);
  };
  private readonly onLeave = () => this.setHovered(null);
  private readonly onDown = (e: PointerEvent) => {
    this.pressed = this.intersect(e);
  };
  private readonly onClick = (e: MouseEvent) => {
    const hit = this.intersect(e).find((o) => this.pressed.includes(o) && this.hits.get(o)?.click);
    if (hit) this.hits.get(hit)!.click!();
  };

  connect() {
    const w = this.opts.wrap;
    w.addEventListener('pointermove', this.onMove);
    w.addEventListener('pointerleave', this.onLeave);
    w.addEventListener('pointercancel', this.onLeave);
    w.addEventListener('pointerdown', this.onDown);
    w.addEventListener('click', this.onClick);
  }

  disconnect() {
    const w = this.opts.wrap;
    w.removeEventListener('pointermove', this.onMove);
    w.removeEventListener('pointerleave', this.onLeave);
    w.removeEventListener('pointercancel', this.onLeave);
    w.removeEventListener('pointerdown', this.onDown);
    w.removeEventListener('click', this.onClick);
    this.setHovered(null);
  }

  /** Release every GPU resource and the context (the canvas is being removed). */
  dispose() {
    this.stop();
    this.disconnect();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.opts.canvas.removeEventListener('webglcontextlost', this.lost);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
