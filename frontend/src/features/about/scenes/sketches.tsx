import { useCopy } from '@/i18n/useCopy';
import { ABOUT } from '../copy';
import type { MethodStep } from '../model';

/*
 * The four artifacts of the methodology, drawn more structured each time:
 * notes from the floor → responsibility map → workflow → CORE screen.
 * `focus` is the step being inspected on the design table; each sketch
 * brightens the part of itself that step works on. Decorative (aria-hidden
 * by the caller) — every step is also described in text.
 */

const INK = {
  sketch: '#c9b98f',
  warn: '#f5b84b',
  line: '#a3b8b2',
  lit: '#3ef0c0',
  deep: '#0c1822',
};

type Focus = { focus?: MethodStep };

export function NotesSketch({ focus }: Focus) {
  const c = useCopy(ABOUT).approach.sketch;
  const observing = focus === 'observe';
  return (
    <g>
      <g transform="rotate(-5 90 80)">
        <rect
          x="24"
          y="22"
          width="128"
          height="112"
          rx="4"
          fill="#1a1813"
          stroke={INK.sketch}
          strokeOpacity="0.35"
        />
        {[46, 62, 78, 94, 110].map((y, i) => (
          <path
            key={y}
            d={`M 38 ${y} q 18 -4 36 0 t 36 0 ${i % 2 ? 't 18 -2' : ''}`}
            fill="none"
            stroke={INK.sketch}
            strokeOpacity="0.5"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}
        <circle
          cx="132"
          cy="108"
          r="12"
          fill="none"
          stroke={INK.warn}
          strokeOpacity="0.7"
          strokeDasharray="3 3"
        />
      </g>
      <g transform="rotate(6 205 70)">
        <rect
          x="160"
          y="30"
          width="98"
          height="78"
          rx="3"
          fill="#2a2516"
          stroke={INK.warn}
          strokeOpacity="0.4"
        />
        {c.notes.map((n, i) => (
          <text key={n} x="170" y={54 + i * 20} fill="#f3e3b8" fontSize="12.5">
            {n}
          </text>
        ))}
      </g>
      <path
        d="M 150 140 q 30 14 60 -4"
        fill="none"
        stroke={INK.sketch}
        strokeOpacity="0.45"
        strokeDasharray="4 4"
      />
      {/* Observe: a lens over the floor notes */}
      <g opacity={observing ? 1 : 0} style={{ transition: 'opacity 400ms' }}>
        <circle cx="96" cy="74" r="30" fill="none" stroke={INK.lit} strokeWidth="2" />
        <line
          x1="118"
          y1="96"
          x2="138"
          y2="116"
          stroke={INK.lit}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

export function MapSketch({ focus }: Focus) {
  const c = useCopy(ABOUT).approach.sketch;
  const nodes = [
    { x: 60, y: 52, ws: 'sales' },
    { x: 214, y: 52, ws: 'warehouse' },
    { x: 137, y: 132, ws: 'accounting' },
  ];
  const owners = focus === 'responsibility';
  const paths = focus === 'process';
  const risk = focus === 'failure';
  return (
    <g>
      <line
        x1="60"
        y1="52"
        x2="214"
        y2="52"
        stroke={paths ? INK.lit : INK.line}
        strokeOpacity={paths ? 0.9 : 0.45}
        strokeWidth={paths ? 2 : 1.2}
      />
      <line
        x1="214"
        y1="52"
        x2="137"
        y2="132"
        stroke={INK.warn}
        strokeOpacity="0.75"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <line
        x1="60"
        y1="52"
        x2="137"
        y2="132"
        stroke={paths ? INK.lit : INK.line}
        strokeOpacity={paths ? 0.9 : 0.45}
        strokeWidth={paths ? 2 : 1.2}
      />
      {risk && (
        <circle
          cx="176"
          cy="92"
          r="17"
          fill="none"
          stroke={INK.warn}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      )}
      <circle
        cx="176"
        cy="92"
        r="9"
        fill={INK.deep}
        stroke={INK.warn}
        strokeOpacity={risk ? 1 : 0.8}
        strokeWidth={risk ? 2 : 1}
      />
      <text x="176" y="96.5" textAnchor="middle" fill={INK.warn} fontSize="12" fontWeight="600">
        !
      </text>
      {nodes.map((n, i) => (
        <g key={n.ws}>
          <circle
            cx={n.x}
            cy={n.y}
            r={owners ? 20 : 17}
            fill={INK.deep}
            stroke={`var(--color-ws-${n.ws})`}
            strokeOpacity={owners ? 1 : 0.8}
            strokeWidth={owners ? 2.5 : 1.5}
          />
          <circle cx={n.x} cy={n.y} r="5" fill={`var(--color-ws-${n.ws})`} />
          <text
            x={n.x}
            y={i === 2 ? n.y + 34 : n.y - 26}
            textAnchor="middle"
            fill="#eef6f3"
            fontSize="12.5"
          >
            {c.roles[i]}
          </text>
        </g>
      ))}
    </g>
  );
}

export function WorkflowSketch({ focus }: Focus) {
  const xs = [30, 92, 178, 240];
  const on = focus === 'workflow';
  return (
    <g>
      <line
        x1="30"
        y1="86"
        x2="240"
        y2="86"
        stroke={INK.lit}
        strokeOpacity={on ? 0.8 : 0.5}
        strokeWidth="1.5"
      />
      {xs.map((x, i) => (
        <g key={x}>
          <rect
            x={x - 20}
            y="70"
            width="40"
            height="32"
            rx="8"
            fill={INK.deep}
            stroke={INK.lit}
            strokeOpacity={i < 2 || on ? 0.8 : 0.4}
          />
          <rect
            x={x - 11}
            y="83"
            width="22"
            height="6"
            rx="3"
            fill={INK.lit}
            fillOpacity={i < 2 ? 0.7 : 0.2}
          />
        </g>
      ))}
      {/* An approval gate between the second and third states */}
      <rect
        x="125"
        y="76"
        width="20"
        height="20"
        rx="3"
        transform="rotate(45 135 86)"
        fill={INK.deep}
        stroke={INK.lit}
        strokeWidth={on ? 2.5 : 1.5}
      />
      <path
        d="M 129 86 l 4 4 l 7 -8"
        fill="none"
        stroke={INK.lit}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 92 102 q 0 30 43 30 t 43 -30"
        fill="none"
        stroke={INK.line}
        strokeOpacity="0.35"
        strokeDasharray="3 4"
      />
    </g>
  );
}

export function InterfaceSketch({ focus }: Focus) {
  const c = useCopy(ABOUT).approach.sketch;
  const next = focus === 'interface' || focus === undefined;
  const built = focus === 'build';
  const tested = focus === 'test';
  const improving = focus === 'improve';
  return (
    <g>
      <rect
        x="18"
        y="16"
        width="244"
        height="138"
        rx="10"
        fill="#08121b"
        stroke={INK.lit}
        strokeOpacity={built ? 0.9 : 0.45}
        strokeWidth={built ? 2 : 1}
      />
      <rect x="18" y="16" width="56" height="138" rx="10" fill="#0c1822" />
      {[38, 56, 74, 92].map((y, i) => (
        <rect
          key={y}
          x="30"
          y={y}
          width={i === 0 ? 32 : 26}
          height="6"
          rx="3"
          fill={i === 0 ? INK.lit : INK.line}
          fillOpacity={i === 0 ? 0.8 : 0.25}
        />
      ))}
      <rect x="88" y="30" width="80" height="8" rx="4" fill={INK.line} fillOpacity="0.3" />
      <rect
        x="86"
        y="50"
        width="164"
        height="34"
        rx="8"
        fill="rgb(25 195 154 / 0.16)"
        stroke={INK.lit}
        strokeOpacity={next ? 0.9 : 0.5}
        strokeWidth={next ? 1.8 : 1}
      />
      <text x="98" y="71.5" fill="#eef6f3" fontSize="12.5" fontWeight="600">
        {c.next}
      </text>
      <path
        d="M 228 61 l 7 6 l -7 6"
        fill="none"
        stroke={INK.lit}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {[96, 114, 132].map((y) => (
        <rect
          key={y}
          x="88"
          y={y}
          width="150"
          height="8"
          rx="4"
          fill={INK.line}
          fillOpacity="0.14"
        />
      ))}
      {tested && (
        <g>
          <circle cx="238" cy="130" r="13" fill={INK.deep} stroke={INK.lit} strokeWidth="1.8" />
          <path
            d="M 232 130 l 4 4 l 8 -8"
            fill="none"
            stroke={INK.lit}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {improving && (
        <path
          d="M 252 40 a 14 14 0 1 1 -10 -4 m 0 0 l 6 -5 m -6 5 l 6 4"
          fill="none"
          stroke={INK.warn}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
