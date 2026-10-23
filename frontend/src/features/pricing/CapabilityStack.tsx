import { cn } from '@/lib/cn';

/*
 * Plans as layers of organizational capability (EP07). Four isometric plates
 * — Foundation, Connected, Controlled, Tailored — stacked on the CORE spine.
 * Plates up to `level` are lit and carry what that layer adds: departments,
 * cross-department links and the executive node, controls and API ports,
 * custom nodes and outward integrations. Decorative: the same facts are
 * always written in text beside it. Changes are CSS transitions, which the
 * global reduced-motion rule turns into an instant switch.
 */

const CX = 240;
const W = 360;
const H = 140;
const T = 9;
const PLATE_Y = [318, 238, 158, 78] as const;

/** Point on a plate: u, v in [-1, 1] across the rhombus. */
function at(u: number, v: number, y: number): [number, number] {
  return [CX + ((u - v) * W) / 4, y + ((u + v) * H) / 4];
}

function rhombus(y: number) {
  return `M ${CX - W / 2} ${y} L ${CX} ${y - H / 2} L ${CX + W / 2} ${y} L ${CX} ${y + H / 2} Z`;
}

function sides(y: number) {
  const l = `M ${CX - W / 2} ${y} L ${CX} ${y + H / 2} L ${CX} ${y + H / 2 + T} L ${CX - W / 2} ${y + T} Z`;
  const r = `M ${CX + W / 2} ${y} L ${CX} ${y + H / 2} L ${CX} ${y + H / 2 + T} L ${CX + W / 2} ${y + T} Z`;
  return [l, r];
}

const ring = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = offset + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });

function Node({ p, r = 6, strong = false }: { p: [number, number]; r?: number; strong?: boolean }) {
  return (
    <g>
      <ellipse cx={p[0]} cy={p[1] + 2.5} rx={r + 2} ry={(r + 2) * 0.45} fill="rgb(0 0 0 / 0.35)" />
      <circle
        cx={p[0]}
        cy={p[1]}
        r={r}
        fill={strong ? 'var(--color-brand-glow)' : 'var(--color-surface-raised)'}
        stroke="var(--color-brand-glow)"
        strokeWidth="1.4"
      />
    </g>
  );
}

function Line({
  a,
  b,
  dashed = false,
  opacity = 0.6,
}: {
  a: [number, number];
  b: [number, number];
  dashed?: boolean;
  opacity?: number;
}) {
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke="var(--color-brand-glow)"
      strokeOpacity={opacity}
      strokeWidth="1.2"
      strokeDasharray={dashed ? '3 4' : undefined}
    />
  );
}

function Foundation({ y }: { y: number }) {
  const a = at(-0.45, -0.05, y);
  const b = at(0.45, 0.05, y);
  return (
    <g>
      <Line a={a} b={b} />
      <Node p={a} />
      <Node p={b} />
      {[-0.25, 0, 0.25].map((u) => {
        const p = at(u, 0.55, y);
        return (
          <rect
            key={u}
            x={p[0] - 9}
            y={p[1] - 2}
            width="18"
            height="4"
            rx="2"
            fill="var(--color-brand-glow)"
            fillOpacity="0.35"
          />
        );
      })}
    </g>
  );
}

function Connected({ y }: { y: number }) {
  const pts = ring(4, 0.6, Math.PI / 4).map(([u, v]) => at(u, v, y));
  const center = at(0, 0, y);
  return (
    <g>
      {pts.map((p, i) => (
        <Line key={i} a={p} b={pts[(i + 1) % pts.length]!} />
      ))}
      {pts.map((p, i) => (
        <Line key={`s${i}`} a={p} b={center} opacity={0.35} />
      ))}
      {pts.map((p, i) => (
        <Node key={`n${i}`} p={p} />
      ))}
      {/* Executive: the organization-wide view */}
      <circle
        cx={center[0]}
        cy={center[1]}
        r="13"
        fill="none"
        stroke="var(--color-brand-glow)"
        strokeOpacity="0.5"
      />
      <Node p={center} r={7} strong />
    </g>
  );
}

function Controlled({ y }: { y: number }) {
  const pts = ring(6, 0.66).map(([u, v]) => at(u, v, y));
  const shield = (p: [number, number]) =>
    `M ${p[0]} ${p[1] - 9} l 7 3 v 4 c 0 4 -3 6.5 -7 8 c -4 -1.5 -7 -4 -7 -8 v -4 Z`;
  const port1 = at(1, -0.25, y);
  const port2 = at(1, 0.25, y);
  return (
    <g>
      {pts.map((p, i) => (
        <Line key={i} a={p} b={pts[(i + 1) % pts.length]!} />
      ))}
      {pts.map((p, i) => (
        <Node key={`n${i}`} p={p} r={5.5} />
      ))}
      {/* Controls: permissions and audit */}
      <path
        d={shield(at(-0.15, -0.15, y))}
        fill="var(--color-surface-base)"
        stroke="var(--color-brand-glow)"
        strokeWidth="1.3"
      />
      <path
        d={shield(at(0.2, 0.2, y))}
        fill="var(--color-surface-base)"
        stroke="var(--color-brand-glow)"
        strokeWidth="1.3"
      />
      {/* API ports on the edge */}
      {[port1, port2].map((p, i) => (
        <rect
          key={i}
          x={p[0] - 5}
          y={p[1] - 5}
          width="10"
          height="10"
          rx="2"
          fill="var(--color-surface-base)"
          stroke="var(--color-brand-glow)"
          strokeWidth="1.3"
        />
      ))}
    </g>
  );
}

function Tailored({ y }: { y: number }) {
  const inner = ring(3, 0.5, -Math.PI / 2).map(([u, v]) => at(u, v, y));
  const external: [number, number][] = [
    [CX + W / 2 + 34, y - 30],
    [CX + W / 2 + 40, y + 18],
    [CX - W / 2 - 34, y - 12],
  ];
  const edges: [number, number][] = [at(0.85, -0.6, y), at(0.95, 0.45, y), at(-0.75, 0.6, y)];
  return (
    <g>
      {inner.map((p, i) => (
        <Line key={i} a={p} b={inner[(i + 1) % inner.length]!} dashed />
      ))}
      {inner.map((p, i) => (
        <circle
          key={`n${i}`}
          cx={p[0]}
          cy={p[1]}
          r="7"
          fill="none"
          stroke="var(--color-brand-glow)"
          strokeWidth="1.3"
          strokeDasharray="3 3"
        />
      ))}
      {/* Integrations reaching outside the organization */}
      {external.map((p, i) => (
        <g key={`e${i}`}>
          <Line a={edges[i]!} b={p} dashed opacity={0.55} />
          <rect
            x={p[0] - 7}
            y={p[1] - 7}
            width="14"
            height="14"
            rx="3"
            fill="var(--color-surface-base)"
            stroke="var(--color-brand-glow)"
            strokeOpacity="0.7"
          />
        </g>
      ))}
    </g>
  );
}

const CONTENT = [Foundation, Connected, Controlled, Tailored] as const;

export function CapabilityStack({
  level,
  label,
  className,
}: {
  level: 0 | 1 | 2 | 3;
  label: string;
  className?: string;
}) {
  return (
    <figure aria-label={label} className={cn('relative w-full', className)}>
      <svg aria-hidden viewBox="0 0 480 400" className="w-full overflow-visible">
        <defs>
          <linearGradient id="cap-plate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-brand-glow)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--color-brand-primary)" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {/* CORE spine */}
        <line
          x1={CX}
          y1={PLATE_Y[0] + H / 2}
          x2={CX}
          y2={PLATE_Y[3]}
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="2 5"
        />
        {PLATE_Y.map((y, i) => {
          const on = i <= level;
          const top = i === level;
          const [l, r] = sides(y);
          const Content = CONTENT[i]!;
          return (
            <g
              key={i}
              data-layer={i}
              data-active={on}
              className="transition-[opacity,transform] duration-500 ease-out"
              style={{ opacity: on ? 1 : 0.22, transform: on ? 'none' : 'translateY(-6px)' }}
            >
              <path
                d={l}
                fill="var(--color-surface-base)"
                stroke="var(--color-border-strong)"
                strokeOpacity="0.6"
              />
              <path
                d={r}
                fill="var(--color-surface-raised)"
                stroke="var(--color-border-strong)"
                strokeOpacity="0.6"
              />
              <path
                d={rhombus(y)}
                fill={on ? 'url(#cap-plate)' : 'transparent'}
                stroke={on ? 'var(--color-brand-glow)' : 'var(--color-border-strong)'}
                strokeOpacity={top ? 0.85 : on ? 0.45 : 0.6}
                strokeWidth={top ? 1.6 : 1}
                strokeDasharray={on ? undefined : '4 5'}
              />
              <g className="transition-opacity duration-500" style={{ opacity: on ? 1 : 0 }}>
                <Content y={y} />
              </g>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
