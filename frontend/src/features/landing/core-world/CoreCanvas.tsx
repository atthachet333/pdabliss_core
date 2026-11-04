import {
  createRoot,
  events,
  extend,
  type ReconcilerRoot,
  type RenderProps,
} from '@react-three/fiber';
import {
  Suspense,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Group,
  IcosahedronGeometry,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  RingGeometry,
  SphereGeometry,
  Sprite,
} from 'three';
import { WebGLBoundary } from './WebGLBoundary';

/*
 * EP36 bundle recovery: a minimal canvas for the CORE World. `<Canvas>` from
 * @react-three/fiber registers the ENTIRE three namespace (`extend(THREE)`),
 * which keeps every class of three in the chunk. This canvas registers only
 * the elements the scene renders (`<primitive>` needs no registration) and
 * otherwise does what `<Canvas>` does for this scene: one root per canvas,
 * sized from its container, pointer events on the wrapper, errors inside
 * the scene reported through `onFail` (the static fallback), disposal on
 * unmount. The scene reads no React context from outside the canvas, so no
 * context bridge is needed. Add an element here when the scene starts using
 * a new one (an unregistered element throws, which shows the fallback).
 */
extend({
  Group,
  IcosahedronGeometry,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  RingGeometry,
  SphereGeometry,
  Sprite,
});

type Config = Omit<RenderProps<HTMLCanvasElement>, 'size' | 'events'>;

export function CoreCanvas({
  config,
  onFail,
  children,
  style,
}: {
  config: Config;
  onFail: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
  const [size, setSize] = useState<{ width: number; height: number; top: number; left: number }>();

  useLayoutEffect(() => {
    const el = wrap.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) =>
        s && s.width === r.width && s.height === r.height && s.top === r.top && s.left === r.left
          ? s
          : { width: r.width, height: r.height, top: r.top, left: r.left },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !size || size.width <= 0 || size.height <= 0) return;
    root.current ??= createRoot(el);
    const r = root.current;
    r.configure({
      ...config,
      events,
      size,
      onCreated: (state) => {
        state.events.connect?.(wrap.current!);
        config.onCreated?.(state);
      },
    }).catch(onFail);
    r.render(
      <WebGLBoundary onFail={onFail}>
        <Suspense fallback={null}>{children}</Suspense>
      </WebGLBoundary>,
    );
  });

  // As in <Canvas>: insertion effects are not replayed by StrictMode, so the
  // root is released only on real removal.
  useInsertionEffect(
    () => () => {
      root.current?.unmount();
      root.current = null;
    },
    [],
  );

  return (
    <div
      ref={wrap}
      aria-hidden
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      <canvas ref={canvas} style={{ display: 'block' }} />
    </div>
  );
}
