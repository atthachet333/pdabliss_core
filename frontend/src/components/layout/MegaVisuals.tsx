import { getDepartment } from '@/config/departments';
import type { MegaGroupId, MegaItem } from '@/config/navigation';

/*
 * Visual support for the mega menus (EP05 revision; one visual per menu since EP18). Restrained, on-brand
 * illustrations — department scenes, tier steps, flow lines, architecture
 * layers — that help a visitor understand each menu at a glance. All of it
 * is decorative (aria-hidden); every item keeps its text label.
 */

/** The leading mark of a feature row: a quiet icon tile. Index rows carry none. */
export function MegaItemMark({ item }: { item: MegaItem }) {
  const Icon = item.icon;
  if (!Icon) return null;
  return (
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface-base/80 transition-colors duration-200 group-hover:border-border-brand">
      <Icon className="size-4 text-brand-soft" aria-hidden />
    </span>
  );
}

const G = 'var(--color-brand-glow)';
const T = 'var(--color-text-muted)';

function FlowRoute() {
  const stations = [
    [30, 30],
    [130, 18],
    [230, 34],
    [208, 92],
    [52, 90],
  ];
  return (
    <svg viewBox="0 0 260 110" className="w-full">
      {stations.map(([x, y], i) => (
        <path
          key={i}
          d={`M ${x} ${y} Q ${(x! + 130) / 2} ${(y! + 56) / 2 - 10} 130 56`}
          fill="none"
          stroke={G}
          strokeOpacity="0.35"
        />
      ))}
      <path
        d="M 30 30 Q 80 34 130 56 Q 180 40 230 34 Q 210 70 208 92 Q 130 80 52 90"
        fill="none"
        stroke={G}
        strokeWidth="2"
        strokeDasharray="6 160"
        className="animate-route"
      />
      <circle
        cx="130"
        cy="56"
        r="14"
        fill="var(--color-surface-raised)"
        stroke={G}
        strokeWidth="1.5"
      />
      <text x="130" y="59.5" textAnchor="middle" fontSize="8" letterSpacing="1.5" fill={G}>
        CORE
      </text>
      {stations.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="4.5"
          fill="var(--color-surface-base)"
          stroke={G}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function ProblemToControl() {
  return (
    <svg viewBox="0 0 260 110" className="w-full">
      {/* Before: scattered, tilted fragments. */}
      {[
        [10, 16, -8],
        [52, 40, 6],
        [16, 66, 4],
        [60, 82, -5],
      ].map(([x, y, r], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="36"
          height="16"
          rx="4"
          transform={`rotate(${r} ${x! + 18} ${y! + 8})`}
          fill="none"
          stroke={T}
          strokeOpacity="0.7"
          strokeDasharray="3 3"
        />
      ))}
      <path d="M 112 55 L 140 55" stroke={G} strokeWidth="1.5" />
      <path d="M 135 50 L 141 55 L 135 60" fill="none" stroke={G} strokeWidth="1.5" />
      {/* After: an ordered, checked sequence. */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x="158"
            y={14 + i * 22}
            width="90"
            height="16"
            rx="5"
            fill={G}
            fillOpacity="0.08"
            stroke={G}
            strokeOpacity="0.4"
          />
          <circle cx="170" cy={22 + i * 22} r="4" fill={G} />
          <rect
            x="182"
            y={20 + i * 22}
            width={44 - i * 6}
            height="4"
            rx="2"
            fill={G}
            fillOpacity="0.5"
          />
        </g>
      ))}
    </svg>
  );
}

function EditorialImage() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border-soft">
      <img
        src={getDepartment('executive').image.lg}
        alt=""
        width={960}
        height={540}
        decoding="async"
        className="aspect-[16/8] w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-raised/90 via-transparent to-transparent" />
    </div>
  );
}

/** EP16: a search line over an index of guides — the library, not a blog feed. */
function LibraryIndex() {
  return (
    <svg viewBox="0 0 260 120" className="w-full">
      <rect
        x="8"
        y="6"
        width="244"
        height="22"
        rx="11"
        fill="none"
        stroke={G}
        strokeOpacity="0.45"
      />
      <circle cx="24" cy="17" r="4.5" fill="none" stroke={G} strokeOpacity="0.8" />
      <line x1="27.5" y1="20.5" x2="31" y2="24" stroke={G} strokeOpacity="0.8" />
      <rect x="40" y="15" width="70" height="4" rx="2" fill={T} fillOpacity="0.45" />
      {[42, 66, 90].map((y, i) => (
        <g key={y}>
          <rect x="12" y={y} width="3" height="16" rx="1.5" fill={G} fillOpacity={0.9 - i * 0.2} />
          <rect
            x="24"
            y={y + 1}
            width={120 - i * 18}
            height="5"
            rx="2.5"
            fill={G}
            fillOpacity="0.5"
          />
          <rect
            x="24"
            y={y + 10}
            width={170 - i * 24}
            height="4"
            rx="2"
            fill={T}
            fillOpacity="0.3"
          />
          <path d={`M 240 ${y + 4} l 5 4 l -5 4`} fill="none" stroke={G} strokeOpacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

/** The illustration at the top of a mega menu's highlight panel. */
export function MegaVisual({ id }: { id: MegaGroupId }) {
  return (
    <div aria-hidden className="relative mb-4">
      {id === 'product' && <FlowRoute />}
      {id === 'solutions' && <ProblemToControl />}
      {id === 'resources' && <LibraryIndex />}
      {id === 'about' && <EditorialImage />}
    </div>
  );
}
