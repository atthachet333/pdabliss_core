import { useId, useMemo } from 'react';
import { CORE_RADIUS, NODE_LAYOUT } from './constants';
import { cameraDistance, coreAnchor, nodeLocal, project, tilt } from './layout';
import { NodeLabel } from './NodeLabel';
import { ORBIT_LIST } from './orbitList';
import type { OrbitDepartmentId } from './types';

/*
 * Static CORE — no WebGL, no three.js. Used while the 3D chunk loads (so the
 * swap is a cross-fade, never a spinner), when WebGL is unavailable or fails,
 * and when quality is 'static'. It is laid out with the same projection as the
 * 3D scene, so departments sit where they will be once the scene takes over.
 */

const ASPECT = 1;

export function CoreWorldFallback({
  hovered,
  selected,
  onHover,
  onSelect,
  withLabels,
}: {
  hovered: OrbitDepartmentId | null;
  selected: OrbitDepartmentId | null;
  onHover: (id: OrbitDepartmentId | null) => void;
  onSelect: (id: OrbitDepartmentId) => void;
  withLabels: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const dist = cameraDistance(ASPECT, withLabels);
  const active = hovered ?? selected;

  const geo = useMemo(() => {
    const pt = (p: [number, number, number]) => project(tilt(p), ASPECT, dist);
    const centre = pt([0, 0, 0]);
    const edge = pt([CORE_RADIUS, 0, 0]);
    const r = Math.abs(edge.x - centre.x) * 1000;
    const nodes = ORBIT_LIST.map((id) => {
      const local = nodeLocal(id);
      const n = pt(local);
      const a = pt(coreAnchor(local));
      return { id, x: n.x * 1000, y: n.y * 1000, ax: a.x * 1000, ay: a.y * 1000, depth: n.depth };
    });
    // Department orbit as a projected polyline.
    const meanR = Object.values(NODE_LAYOUT).reduce((s, n) => s + n.radius, 0) / ORBIT_LIST.length;
    const orbit = Array.from({ length: 72 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2;
      const p = pt([Math.cos(a) * meanR, 0, Math.sin(a) * meanR]);
      return `${(p.x * 1000).toFixed(1)},${(p.y * 1000).toFixed(1)}`;
    }).join(' ');
    return { cx: centre.x * 1000, cy: centre.y * 1000, r, nodes, orbit };
  }, [dist]);

  const id = (n: string) => `${uid}-${n}`;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative aspect-square h-full max-h-full max-w-full">
        <svg
          viewBox="0 0 1000 1000"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <radialGradient id={id('core')} cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#123a3a" />
              <stop offset="55%" stopColor="#0a1620" />
              <stop offset="100%" stopColor="#050b12" />
            </radialGradient>
            <radialGradient id={id('halo')}>
              <stop offset="55%" stopColor="#19c39a" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#19c39a" stopOpacity="0" />
            </radialGradient>
            <clipPath id={id('clip')}>
              <circle cx={geo.cx} cy={geo.cy} r={geo.r} />
            </clipPath>
          </defs>
          <circle cx={geo.cx} cy={geo.cy} r={geo.r * 1.9} fill={`url(#${id('halo')})`} />
          <polyline
            points={geo.orbit}
            fill="none"
            stroke="#2bb5a8"
            strokeOpacity="0.32"
            strokeDasharray="5 8"
            strokeWidth="1.5"
          />
          {geo.nodes.map((n) => {
            const on = active === n.id;
            const mx = (n.x + n.ax) / 2;
            const my = (n.y + n.ay) / 2 - 24;
            return (
              <path
                key={n.id}
                d={`M ${n.x} ${n.y} Q ${mx} ${my} ${n.ax} ${n.ay}`}
                fill="none"
                stroke="#3ef0c0"
                strokeOpacity={active ? (on ? 0.85 : 0.12) : 0.3}
                strokeWidth={on ? 2 : 1.2}
                className="transition-[stroke-opacity] duration-300"
              />
            );
          })}
          <circle cx={geo.cx} cy={geo.cy} r={geo.r} fill={`url(#${id('core')})`} />
          <g clipPath={`url(#${id('clip')})`} stroke="#2bb5a8" strokeOpacity="0.28" fill="none">
            {[-0.6, -0.3, 0, 0.3, 0.6].map((t) => (
              <ellipse
                key={`lat${t}`}
                cx={geo.cx}
                cy={geo.cy + t * geo.r}
                rx={geo.r * Math.sqrt(1 - t * t)}
                ry={geo.r * 0.22 * Math.sqrt(1 - t * t)}
              />
            ))}
            {[0.25, 0.55, 0.85].map((t) => (
              <ellipse key={`lon${t}`} cx={geo.cx} cy={geo.cy} rx={geo.r * t} ry={geo.r} />
            ))}
          </g>
          <circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.r}
            fill="none"
            stroke="#3ef0c0"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          {geo.nodes.map((n) => (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={active === n.id ? 9 : 6}
              fill="#e8fff7"
              className="transition-[r] duration-300"
            />
          ))}
        </svg>
        {withLabels &&
          geo.nodes.map((n) => (
            <NodeLabel
              key={n.id}
              id={n.id}
              active={active === n.id}
              dimmed={active !== null}
              onHover={onHover}
              onSelect={onSelect}
              style={{
                left: `${n.x / 10}%`,
                top: `${n.y / 10}%`,
                translate: '-50% -50%',
                zIndex: Math.round(100 - n.depth * 10),
              }}
            />
          ))}
      </div>
    </div>
  );
}
