import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useMediaQuery } from '@/components/core/hooks';
import { cn } from '@/lib/cn';
import { createControls } from './controls';
import { CoreWorldFallback } from './CoreWorldFallback';
import { NodeLabel } from './NodeLabel';
import { ORBIT_LIST } from './orbitList';
import { detectQuality, lowerQuality } from './quality';
import type { OrbitDepartmentId, Quality, StoryStage } from './types';

// three.js + react-three-fiber live in this chunk only.
const CoreWorld = lazy(() => import('./CoreWorld'));

const DRAG_YAW = 0.0045;
const DRAG_PITCH = 0.0025;

/** True when the pointer is over the CORE and its orbit (the draggable object). */
function inCore(e: { clientX: number; clientY: number }, r: DOMRect) {
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  return Math.hypot(dx, dy) < Math.min(r.width, r.height) * 0.42;
}

/**
 * The CORE World viewport: decides quality, loads the WebGL scene lazily,
 * keeps the static CORE visible until the first frame is drawn (cross-fade,
 * no spinner), owns pointer/drag input and pauses rendering offscreen.
 */
export function CoreStage({
  hovered,
  selected,
  stage = 0,
  onHover,
  onSelect,
  className,
}: {
  hovered: OrbitDepartmentId | null;
  selected: OrbitDepartmentId | null;
  /** Scene story state; the homepage keeps Slide 01 at the overview (0). */
  stage?: StoryStage;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId | null) => void;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const controls = useRef(createControls());
  const labels = useRef<Partial<Record<OrbitDepartmentId, HTMLElement | null>>>({});
  const invalidate = useRef<(() => void) | null>(null);
  const drag = useRef({ x: 0, y: 0, t: 0, id: -1, axis: '' as '' | 'x' | 'y' });
  const [quality, setQuality] = useState<Quality | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const withLabels = useMediaQuery('(min-width: 640px)');
  const webgl = quality !== null && quality !== 'static';
  const active = hovered ?? selected;

  // Decide quality after first paint so the hero text is never blocked.
  useEffect(() => {
    const decide = () => setQuality(detectQuality());
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(decide, { timeout: 500 });
      return () =>
        (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(h);
    }
    const t = window.setTimeout(decide, 120);
    return () => window.clearTimeout(t);
  }, []);

  // Pause rendering when the stage leaves the viewport or the tab is hidden.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), {
      rootMargin: '80px',
    });
    io.observe(el);
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const c = controls.current;

  // Pointer cursor while a department is hovered (from the node, its label or a button).
  useEffect(() => {
    const el = root.current;
    if (!el || c.dragging) return;
    if (hovered) el.style.cursor = 'pointer';
    else if (el.style.cursor === 'pointer') el.style.cursor = '';
  }, [hovered, c]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      // Feeds only the light/rim response and a ≤ 0.012 rad depth tilt — never parallax.
      c.px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      c.py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      const d0 = drag.current;
      e.currentTarget.style.cursor =
        d0.id === e.pointerId && c.dragging
          ? 'grabbing'
          : hovered
            ? 'pointer'
            : inCore(e, r)
              ? 'grab'
              : '';
    }
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    // A mouse only rotates while its primary button is held; any stale drag
    // (button released outside the page, lost pointerup) ends here.
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      endDrag();
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // Touch: only horizontal drags rotate; vertical movement is left to page scroll.
    if (e.pointerType !== 'mouse' && !d.axis) {
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (d.axis === 'y') return;
    const dt = Math.max(1, e.timeStamp - d.t) / 1000;
    c.dragging = true;
    c.travel += Math.abs(dx) + Math.abs(dy);
    c.yaw += dx * DRAG_YAW;
    c.vYaw = (dx * DRAG_YAW) / dt;
    if (e.pointerType === 'mouse') {
      c.pitch += dy * DRAG_PITCH;
      c.vPitch = (dy * DRAG_PITCH) / dt;
    }
    c.lastInput = performance.now();
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = e.timeStamp;
    invalidate.current?.();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-stage-ui]')) return;
    // Rotation is deliberate: only a press on the CORE / orbit area starts a drag.
    if (!inCore(e, e.currentTarget.getBoundingClientRect())) return;
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, axis: '' };
    c.travel = 0;
    c.lastInput = performance.now();
  };

  function endDrag() {
    drag.current.id = -1;
    c.dragging = false;
    if (root.current) root.current.style.cursor = '';
    c.lastInput = performance.now();
    invalidate.current?.();
  }

  return (
    <div
      ref={root}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          c.px = 0;
          c.py = 0;
        }
        endDrag();
      }}
      className={cn('group/stage relative size-full touch-pan-y select-none', className)}
      data-quality={quality ?? 'pending'}
    >
      {/* Static CORE: first paint, loading state and permanent fallback. */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-700',
          webgl && ready ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
      >
        <CoreWorldFallback
          hovered={hovered}
          selected={selected}
          onHover={onHover}
          onSelect={onSelect}
          withLabels={withLabels && !(webgl && ready)}
        />
      </div>

      {webgl && (
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Suspense fallback={null}>
            <CoreWorld
              quality={quality}
              hovered={hovered}
              selected={selected}
              stage={stage}
              onHover={onHover}
              onSelect={onSelect}
              controls={controls}
              labels={labels}
              withLabels={withLabels}
              active={visible && pageVisible}
              invalidateRef={invalidate}
              onReady={() => setReady(true)}
              onSlow={() => setQuality((q) => (q ? lowerQuality(q) : q))}
              onFail={() => setQuality('static')}
            />
          </Suspense>
          {withLabels &&
            ORBIT_LIST.map((id) => (
              <NodeLabel
                key={id}
                id={id}
                active={active === id}
                dimmed={active !== null}
                onHover={onHover}
                // A drag that ends on a label is not a click.
                onSelect={(id) => c.travel <= 6 && onSelect(id)}
                className="opacity-0"
                ref={(el) => {
                  labels.current[id] = el;
                }}
              />
            ))}
        </div>
      )}

      {/* Keyboard path to the CORE overview (pointer users click the sphere). */}
      {selected && (
        <button
          type="button"
          data-stage-ui
          onClick={() => onSelect(null)}
          className="absolute top-1/2 left-1/2 z-[200] -translate-1/2 rounded-full bg-surface-overlay/90 px-4 py-2 text-caption text-text-primary opacity-0 focus-visible:opacity-100"
        >
          กลับสู่ภาพรวม CORE
        </button>
      )}

      {/* CORE identity sits on the sphere — DOM text, crisp and readable. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span className="text-[0.625rem] font-semibold tracking-[0.32em] text-brand-soft/80 sm:text-[0.6875rem]">
          PDA BLISS
        </span>
        <span className="mt-0.5 text-gradient-brand text-[1.5rem] leading-none font-semibold tracking-[0.18em] sm:text-[1.875rem]">
          CORE
        </span>
        <span className="mt-1.5 hidden text-[0.625rem] tracking-[0.2em] text-text-muted uppercase sm:block">
          One Source of Truth
        </span>
      </div>
    </div>
  );
}
