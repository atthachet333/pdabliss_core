import { getDepartment, type DepartmentId } from '@/config/departments';
import type { MegaGroupId, MegaItem } from '@/config/navigation';
import { cn } from '@/lib/cn';

/*
 * Visual support for the mega menus (EP05 revision). Restrained, on-brand
 * illustrations — department scenes, tier steps, flow lines, architecture
 * layers — that help a visitor understand each menu at a glance. All of it
 * is decorative (aria-hidden); every item keeps its text label.
 */

const TIERS: Record<string, number> = { starter: 1, business: 2, professional: 3, enterprise: 4 };
const DEPARTMENT_ITEMS = new Set<string>([
  'executive',
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
]);

/** The leading mark of a mega-menu item: scene thumbnail, tier steps or icon. */
export function MegaItemMark({ group, item }: { group: MegaGroupId; item: MegaItem }) {
  if (group === 'departments' && DEPARTMENT_ITEMS.has(item.id)) {
    const d = getDepartment(item.id as DepartmentId);
    return (
      <span className="relative block h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border-soft bg-surface-dark transition-colors duration-200 group-hover:border-border-brand">
        <img
          src={d.image.sm}
          alt=""
          width={400}
          height={225}
          decoding="async"
          className="size-full object-cover brightness-110 transition-[filter] duration-300 group-hover:brightness-125"
        />
      </span>
    );
  }
  if (group === 'packages' && TIERS[item.id]) {
    const level = TIERS[item.id]!;
    return (
      <span className="flex h-9 w-9 shrink-0 items-end justify-center gap-[3px] rounded-xl border border-border-soft bg-surface-base/80 pb-2 transition-colors duration-200 group-hover:border-border-brand">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'w-[3px] rounded-full',
              i <= level ? 'bg-brand-glow' : 'bg-border-strong',
            )}
            style={{ height: `${6 + i * 4}px` }}
          />
        ))}
      </span>
    );
  }
  const Icon = item.icon;
  return (
    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-base/80 transition-colors duration-200 group-hover:border-border-brand">
      <Icon className="size-4 text-brand-soft" aria-hidden />
    </span>
  );
}

const G = 'var(--color-brand-glow)';
const T = 'var(--color-text-muted)';

function DepartmentsMosaic() {
  const ids: DepartmentId[] = [
    'sales',
    'operations',
    'warehouse',
    'purchasing',
    'accounting',
    'reports',
  ];
  return (
    <div className="grid grid-cols-3 gap-1">
      {ids.map((id, i) => (
        <img
          key={id}
          src={getDepartment(id).image.sm}
          alt=""
          width={400}
          height={225}
          decoding="async"
          className={cn(
            'aspect-[16/10] w-full rounded-md border border-border-soft object-cover',
            i === 2 ? 'brightness-125' : 'opacity-85 brightness-100',
          )}
        />
      ))}
    </div>
  );
}

function PackageSteps() {
  // Four rising layers: more departments, more control, more integration.
  return (
    <svg viewBox="0 0 260 110" className="w-full">
      {[0, 1, 2, 3].map((i) => {
        const x = 18 + i * 58;
        const h = 22 + i * 18;
        return (
          <g key={i}>
            <rect
              x={x}
              y={100 - h}
              width="46"
              height={h}
              rx="6"
              fill={G}
              fillOpacity={0.08 + i * 0.06}
              stroke={G}
              strokeOpacity={0.25 + i * 0.15}
            />
            {Array.from({ length: i + 1 }, (_, k) => (
              <rect
                key={k}
                x={x + 8}
                y={100 - h + 8 + k * 9}
                width="30"
                height="3"
                rx="1.5"
                fill={G}
                fillOpacity="0.55"
              />
            ))}
          </g>
        );
      })}
      <path
        d="M 20 30 C 90 24, 170 12, 246 6"
        fill="none"
        stroke={G}
        strokeOpacity="0.35"
        strokeDasharray="3 5"
      />
    </svg>
  );
}

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

function ArchitectureStack() {
  const slab = (y: number) => `M 130 ${y} L 210 ${y + 18} L 130 ${y + 36} L 50 ${y + 18} Z`;
  return (
    <svg viewBox="0 0 260 120" className="w-full">
      {[64, 44, 24, 4].map((y, i) => (
        <path
          key={y}
          d={slab(y)}
          fill={G}
          fillOpacity={0.05 + i * 0.04}
          stroke={G}
          strokeOpacity={0.25 + i * 0.12}
        />
      ))}
      {/* Integration points outside the stack. */}
      {[
        [18, 40],
        [242, 40],
        [242, 92],
        [18, 92],
      ].map(([x, y], i) => (
        <g key={i}>
          <line
            x1={x}
            y1={y}
            x2={x! < 130 ? 52 : 208}
            y2={y! < 60 ? 40 : 80}
            stroke={G}
            strokeOpacity="0.3"
            strokeDasharray="2 4"
          />
          <rect
            x={x! - 7}
            y={y! - 7}
            width="14"
            height="14"
            rx="3"
            fill="none"
            stroke={G}
            strokeOpacity="0.6"
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

/** The illustration at the top of a mega menu's highlight panel. */
export function MegaVisual({ id }: { id: MegaGroupId }) {
  return (
    <div aria-hidden className="relative mb-4">
      {id === 'departments' && <DepartmentsMosaic />}
      {id === 'packages' && <PackageSteps />}
      {id === 'howItWorks' && <FlowRoute />}
      {id === 'solutions' && <ProblemToControl />}
      {id === 'enterprise' && <ArchitectureStack />}
      {id === 'about' && <EditorialImage />}
    </div>
  );
}
