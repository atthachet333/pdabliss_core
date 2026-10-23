import type { ReactElement } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import type { WorldId } from './worlds';
import { useCopy, type Localized } from '@/i18n/useCopy';

/*
 * Six procedural environments, one per operational world. Each has its own
 * visual grammar (routes, timelines, grids, networks, ledgers, horizon) at low
 * contrast behind the real UI preview. Strokes use `currentColor`, tinted by
 * the world's accent. Loops are CSS (stopped under reduced motion).
 */

const W = 1200;
const H = 720;

const ART_TEXT: Localized<{ route: string[]; approval: string[] }> = {
  th: { route: ['PO', 'SO', 'พร้อมส่ง', 'จัดส่ง', 'ส่งครบ'], approval: ['PR', 'อนุมัติ', 'PO'] },
  en: { route: ['PO', 'SO', 'Ready', 'Shipping', 'Delivered'], approval: ['PR', 'Approve', 'PO'] },
  'zh-CN': { route: ['PO', 'SO', '待发货', '运输中', '已送达'], approval: ['PR', '审批', 'PO'] },
};

function Sales() {
  const art = useCopy(ART_TEXT);
  // Demand flows in from the left and leaves as delivery routes on the right.
  const routes = [
    'M -20 180 C 300 120, 420 360, 640 330 S 980 160, 1220 220',
    'M -20 360 C 260 420, 460 300, 640 360 S 940 520, 1220 480',
    'M -20 560 C 300 600, 420 420, 640 400 S 1000 640, 1220 620',
  ];
  return (
    <g fill="none" stroke="currentColor">
      {routes.map((d, i) => (
        <g key={i}>
          <path d={d} strokeOpacity="0.18" strokeWidth="1.2" />
          <path
            d={d}
            strokeOpacity="0.55"
            strokeWidth="2"
            strokeDasharray="6 140"
            className="animate-route"
            style={{ animationDelay: `${i * -2.6}s` }}
          />
        </g>
      ))}
      {[220, 440, 660, 880, 1060].map((x, i) => (
        <g key={x} opacity="0.35">
          <line x1={x} y1={90} x2={x} y2={110} />
          <text
            x={x}
            y={80}
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="13"
            opacity="0.8"
          >
            {art.route[i]}
          </text>
        </g>
      ))}
    </g>
  );
}

function Operations() {
  // Capacity timeline: lanes of work, a moving "now" line.
  const lanes = [
    [80, 380],
    [300, 220],
    [560, 340],
    [140, 260],
    [440, 420],
    [60, 200],
    [300, 300],
    [640, 260],
    [200, 360],
    [600, 300],
  ];
  return (
    <g>
      {Array.from({ length: 6 }, (_, r) => (
        <line
          key={r}
          x1={0}
          x2={W}
          y1={150 + r * 90}
          y2={150 + r * 90}
          stroke="currentColor"
          strokeOpacity="0.08"
        />
      ))}
      {lanes.map(([x, w], i) => {
        const row = Math.floor(i / 2) % 5;
        return (
          <rect
            key={i}
            x={x! + (i % 2) * 40}
            y={168 + row * 90}
            width={w}
            height={22}
            rx={11}
            fill="currentColor"
            fillOpacity={0.08 + (i % 3) * 0.05}
          />
        );
      })}
      <g className="animate-now">
        <line x1={0} x2={0} y1={110} y2={640} stroke="currentColor" strokeOpacity="0.55" />
        <circle cx={0} cy={110} r={4} fill="currentColor" />
      </g>
    </g>
  );
}

function Warehouse() {
  // Precise rack grid with lot cells; a scan line sweeps the aisles.
  const cols = 14;
  const rows = 7;
  const lit = new Set([3, 17, 22, 38, 41, 57, 66, 74, 85]);
  return (
    <g>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const i = r * cols + c;
          return (
            <rect
              key={i}
              x={90 + c * 76}
              y={110 + r * 74}
              width={62}
              height={56}
              rx={6}
              fill="currentColor"
              fillOpacity={lit.has(i) ? 0.22 : 0.04}
              stroke="currentColor"
              strokeOpacity={lit.has(i) ? 0.5 : 0.12}
            />
          );
        }),
      )}
      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l, r) => (
        <text key={l} x={60} y={144 + r * 74} fill="currentColor" fontSize="13" opacity="0.4">
          {l}
        </text>
      ))}
      <rect
        x={80}
        y={100}
        width={1080}
        height={2}
        fill="currentColor"
        opacity="0.6"
        className="animate-scan"
      />
    </g>
  );
}

function Purchasing({ still }: { still: boolean }) {
  const art = useCopy(ART_TEXT);
  // Supplier network converging on purchasing, then an approval path out.
  const suppliers = [140, 250, 360, 470, 580];
  return (
    <g fill="none" stroke="currentColor">
      {suppliers.map((y, i) => (
        <g key={y}>
          <path d={`M 150 ${y} C 380 ${y}, 420 360, 600 360`} strokeOpacity="0.22" />
          <circle
            cx={150}
            cy={y}
            r={10}
            strokeOpacity="0.55"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <text
            x={124}
            y={y + 4}
            textAnchor="end"
            fill="currentColor"
            stroke="none"
            fontSize="12"
            opacity="0.45"
          >
            S{i + 1}
          </text>
        </g>
      ))}
      <circle cx={600} cy={360} r={22} strokeOpacity="0.7" fill="currentColor" fillOpacity="0.1" />
      <path d="M 622 360 L 1180 360" strokeOpacity="0.25" strokeDasharray="4 8" />
      {[760, 900, 1040].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 14}
            y={346}
            width={28}
            height={28}
            rx={6}
            transform={`rotate(45 ${x} 360)`}
            strokeOpacity="0.6"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <text
            x={x}
            y={404}
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="12"
            opacity="0.45"
          >
            {art.approval[i]}
          </text>
        </g>
      ))}
      {/* SMIL motion stays in SVG user units at any scale (CSS offset-path does not). */}
      {!still && (
        <circle r={5} fill="currentColor" stroke="none" opacity="0">
          <animateMotion
            dur="7s"
            repeatCount="indefinite"
            path="M 150 250 C 380 250, 420 360, 600 360 L 1180 360"
          />
          <animate
            attributeName="opacity"
            dur="7s"
            repeatCount="indefinite"
            values="0;1;1;0"
            keyTimes="0;0.1;0.85;1"
          />
        </circle>
      )}
    </g>
  );
}

function Accounting() {
  // Ledger lines and a verification sequence: every document checked before payment.
  return (
    <g>
      {Array.from({ length: 9 }, (_, r) => (
        <g key={r}>
          <line
            x1={140}
            x2={1060}
            y1={140 + r * 56}
            y2={140 + r * 56}
            stroke="currentColor"
            strokeOpacity="0.1"
          />
          <rect
            x={160}
            y={124 + r * 56}
            width={180 + ((r * 53) % 220)}
            height={10}
            rx={5}
            fill="currentColor"
            fillOpacity="0.1"
          />
          <rect
            x={820}
            y={124 + r * 56}
            width={90}
            height={10}
            rx={5}
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path
            d={`M 980 ${130 + r * 56} l 8 8 l 16 -16`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.6"
            className="animate-verify"
            style={{ animationDelay: `${r * 0.45}s` }}
          />
        </g>
      ))}
      <line
        x1={960}
        x2={960}
        y1={110}
        y2={630}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeDasharray="3 6"
      />
    </g>
  );
}

function Executive() {
  // Observation deck: a horizon of the organization, signals rising from every department.
  return (
    <g fill="none" stroke="currentColor">
      {[260, 380, 500, 620].map((r, i) => (
        <path
          key={r}
          d={`M ${600 - r * 1.6} 720 A ${r * 1.6} ${r} 0 0 1 ${600 + r * 1.6} 720`}
          strokeOpacity={0.08 + i * 0.05}
        />
      ))}
      {[-60, -36, -12, 12, 36, 60].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const x = 600 + Math.cos(a) * 560;
        const y = 720 + Math.sin(a) * 350;
        return (
          <g key={deg}>
            <line x1={600} y1={720} x2={x} y2={y} strokeOpacity="0.12" />
            <circle cx={x} cy={y} r={7} fill="currentColor" fillOpacity="0.5" stroke="none" />
          </g>
        );
      })}
      <circle
        cx={600}
        cy={720}
        r={120}
        strokeOpacity="0.4"
        className="animate-horizon"
        style={{ transformOrigin: '600px 720px' }}
      />
    </g>
  );
}

const ART: Record<WorldId, (props: { still: boolean }) => ReactElement> = {
  sales: Sales,
  operations: Operations,
  warehouse: Warehouse,
  purchasing: Purchasing,
  accounting: Accounting,
  executive: Executive,
};

export function WorldArt({ id, className }: { id: WorldId; className?: string }) {
  const Art = ART[id];
  const still = usePrefersReducedMotion();
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <Art still={still} />
    </svg>
  );
}
