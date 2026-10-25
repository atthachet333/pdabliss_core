import { AlertTriangle, Ban, CheckCircle2, Circle, Clock, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { isDeptKey } from '@/features/departments/catalog';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { WORKFLOW } from './copy';
import { LANES, RECORDS, type Lane, type RouteStep, type Status, type StepId } from './model';
import { laneColor, useLaneName } from './state';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';

/* ------------------------------------------------------------------ */
/* Status — icon + words, never colour alone                            */
/* ------------------------------------------------------------------ */

const STATUS_ICON: Record<Status, LucideIcon> = {
  normal: Circle,
  attention: AlertTriangle,
  blocked: Ban,
  waiting: Clock,
  complete: CheckCircle2,
};

const STATUS_TEXT: Record<Status, string> = {
  normal: 'text-text-secondary',
  attention: 'text-warning',
  blocked: 'text-danger',
  waiting: 'text-info',
  complete: 'text-success',
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const c = useCopy(WORKFLOW).common;
  const Icon = STATUS_ICON[status];
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1 text-caption font-medium whitespace-nowrap',
        STATUS_TEXT[status],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {c.status[status]}
    </span>
  );
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {(['normal', 'attention', 'blocked', 'waiting', 'complete'] as const).map((s) => (
        <li key={s}>
          <StatusBadge status={s} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Department chip (links to the EP06 page, keeping the locale)         */
/* ------------------------------------------------------------------ */

export function LaneChip({
  lane,
  link = true,
  className,
}: {
  lane: Lane;
  link?: boolean;
  className?: string;
}) {
  const name = useLaneName()(lane);
  const { href } = useLocale();
  const body = (
    <>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: laneColor(lane) }}
      />
      {name}
    </>
  );
  const cls = cn(
    'inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft px-3 text-label text-text-secondary',
    className,
  );
  return link && isDeptKey(lane) ? (
    <Link
      to={href(`/departments/${lane}`)}
      data-lane-link={lane}
      className={cn(cls, 'hover:border-border-strong hover:text-text-primary')}
    >
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/* ------------------------------------------------------------------ */
/* Route map — lanes as rails, the work weaving between them            */
/* ------------------------------------------------------------------ */

const W = 1000;
const LABEL_W = 150;
const ROW = 48;
const TOP = 18;
const laneY = (lane: Lane) => TOP + LANES.indexOf(lane) * ROW + ROW / 2;

interface RouteViewProps {
  steps: readonly RouteStep[];
  /** Replay position: steps after it are still ahead. */
  current?: number;
  /** Steps to emphasise; the rest recede. */
  emphasis?: readonly StepId[];
  /** One step lifted out of the calm route (exceptions). */
  raised?: { step: StepId; status: Status } | null;
  label: string;
  /** Phones: show only the focused steps until the visitor asks for all of them. */
  collapse?: boolean;
  className?: string;
}

function nodeShape(status: Status, x: number, y: number, color: string, active: boolean) {
  const r = active ? 10 : 8;
  switch (status) {
    case 'complete':
      return (
        <g>
          <circle cx={x} cy={y} r={r} fill="var(--color-success)" />
          <path
            d={`M ${x - 4} ${y} l 3 3 l 5 -6`}
            fill="none"
            stroke="var(--color-surface-base)"
            strokeWidth="2"
          />
        </g>
      );
    case 'attention':
      return (
        <g>
          <path
            d={`M ${x} ${y - r - 2} L ${x + r + 2} ${y + r - 1} L ${x - r - 2} ${y + r - 1} Z`}
            fill="var(--color-surface-base)"
            stroke="var(--color-warning)"
            strokeWidth="2"
          />
          <path
            d={`M ${x} ${y - 3} v 4`}
            stroke="var(--color-warning)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'blocked':
      return (
        <g>
          <rect
            x={x - r}
            y={y - r}
            width={r * 2}
            height={r * 2}
            rx="3"
            fill="var(--color-surface-base)"
            stroke="var(--color-danger)"
            strokeWidth="2"
          />
          <path
            d={`M ${x - 4} ${y} h 8`}
            stroke="var(--color-danger)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case 'waiting':
      return (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="var(--color-surface-base)"
          stroke="var(--color-info)"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
      );
    default:
      return (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="var(--color-surface-raised)"
          stroke={color}
          strokeWidth="2.2"
        />
      );
  }
}

/** Desktop: the work as a glowing line across department rails. */
export function RouteMap({ steps, current, emphasis, raised, label, className }: RouteViewProps) {
  const c = useCopy(WORKFLOW).common;
  const laneName = useLaneName();
  const n = steps.length;
  const gap = n > 1 ? (W - LABEL_W - 56) / (n - 1) : 0;
  const pts = steps.map((s, i) => ({ x: LABEL_W + 28 + i * gap, y: laneY(s.actor) }));
  const H = TOP * 2 + LANES.length * ROW;
  const upto = current ?? n - 1;
  const seg = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p, i, arr) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = arr[i - 1]!;
        const mx = (prev.x + p.x) / 2;
        return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(' ');
  const involved = new Set(steps.map((s) => s.actor));
  const token = pts[Math.min(Math.max(upto, 0), n - 1)];

  return (
    <figure aria-label={label} className={cn('relative', className)} data-route-map>
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <defs>
          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {/* Lanes: one band per department, the executive band on top */}
        {LANES.map((lane, li) => {
          const y = laneY(lane);
          const on = lane === 'executive' || involved.has(lane as RouteStep['actor']);
          return (
            <g key={lane} opacity={on ? 1 : 0.35} data-lane={lane}>
              <rect
                x={0}
                y={y - ROW / 2 + 2}
                width={W}
                height={ROW - 4}
                rx="10"
                fill={
                  lane === 'executive' ? 'var(--color-ws-executive)' : 'var(--color-text-primary)'
                }
                fillOpacity={lane === 'executive' ? 0.05 : li % 2 ? 0.02 : 0.035}
              />
              <rect x={10} y={y - 7} width="3" height="14" rx="1.5" fill={laneColor(lane)} />
              <text
                x={22}
                y={y + 5}
                fontSize="15"
                fontWeight="500"
                fill={
                  lane === 'executive' ? 'var(--color-ws-executive)' : 'var(--color-text-secondary)'
                }
              >
                {laneName(lane)}
              </text>
              <line
                x1={LABEL_W}
                y1={y}
                x2={W - 8}
                y2={y}
                stroke={
                  lane === 'executive' ? 'var(--color-ws-executive)' : 'var(--color-border-soft)'
                }
                strokeOpacity={lane === 'executive' ? 0.35 : 0.9}
                strokeDasharray={lane === 'executive' || lane === 'supplier' ? '2 6' : undefined}
              />
            </g>
          );
        })}
        {/* Executive observes: markers above anything that needs attention */}
        {steps.map((s, i) =>
          s.status === 'attention' || s.status === 'blocked' || s.status === 'waiting' ? (
            <g key={`obs-${s.id}`} opacity={i <= upto ? 1 : 0.3}>
              <line
                x1={pts[i]!.x}
                y1={laneY('executive') + 6}
                x2={pts[i]!.x}
                y2={pts[i]!.y - 12}
                stroke="var(--color-ws-executive)"
                strokeOpacity="0.25"
                strokeDasharray="2 4"
              />
              <circle
                cx={pts[i]!.x}
                cy={laneY('executive')}
                r="4"
                fill="var(--color-ws-executive)"
                fillOpacity="0.8"
              />
            </g>
          ) : null,
        )}
        {/* Route: travelled part glows; what is ahead stays quiet */}
        <path
          d={seg(0, n - 1)}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        {upto > 0 && (
          <>
            <path
              d={seg(0, upto)}
              fill="none"
              stroke="var(--color-brand-glow)"
              strokeOpacity="0.35"
              strokeWidth="7"
              filter="url(#route-glow)"
            />
            <path d={seg(0, upto)} fill="none" stroke="var(--color-brand-glow)" strokeWidth="2.4" />
          </>
        )}
        {/* Steps */}
        {steps.map((s, i) => {
          const p = pts[i]!;
          const ahead = i > upto;
          const dim = (emphasis && !emphasis.includes(s.id)) || ahead;
          const isRaised = raised?.step === s.id;
          const status = isRaised
            ? raised.status
            : ahead && current !== undefined
              ? 'waiting'
              : s.status;
          return (
            <g
              key={s.id}
              data-step={s.id}
              className="transition-[opacity,transform] duration-500"
              style={{
                opacity: dim && !isRaised ? 0.32 : 1,
                transform: isRaised ? 'translateY(-10px)' : 'none',
              }}
            >
              {nodeShape(status, p.x, p.y, laneColor(s.actor), i === upto && current !== undefined)}
              {emphasis?.includes(s.id) && !isRaised && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="17"
                  fill="var(--color-brand-glow)"
                  fillOpacity="0.12"
                  stroke="var(--color-brand-glow)"
                  strokeOpacity="0.5"
                />
              )}
              <text
                x={p.x}
                y={p.y + 25}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {i + 1}
              </text>
              {isRaised && (
                <text
                  x={p.x}
                  y={p.y - 20}
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight="600"
                  fill="var(--color-text-primary)"
                >
                  {c.steps[s.id].title}
                </text>
              )}
            </g>
          );
        })}
        {/* The work itself */}
        {current !== undefined && token && (
          <g
            className="transition-transform duration-700 ease-out"
            style={{ transform: `translate(${token.x}px, ${token.y}px)` }}
          >
            <circle r="16" fill="var(--color-brand-glow)" fillOpacity="0.18" />
            <circle r="5" fill="var(--color-brand-glow)" />
          </g>
        )}
      </svg>
      {/* The same route, in words — a numbered legend for the map */}
      <ol
        className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-caption xl:grid-cols-4"
        data-route-legend
      >
        {steps.map((s, i) => {
          const ahead = current !== undefined && i > upto;
          const status = raised?.step === s.id ? raised.status : ahead ? 'waiting' : s.status;
          return (
            <li
              key={s.id}
              data-step={s.id}
              aria-current={current !== undefined && i === upto ? 'step' : undefined}
              className={cn(
                'flex items-baseline gap-2',
                current !== undefined && i === upto ? 'text-text-primary' : 'text-text-muted',
                ahead && 'opacity-60',
              )}
            >
              <span className="w-5 shrink-0 text-right tabular">{i + 1}</span>
              <span className="min-w-0 truncate">
                {c.steps[s.id].title}
                <span className="sr-only">
                  {' '}
                  — {laneName(s.actor)} — {c.status[status]}
                </span>
              </span>
              {status !== 'normal' && <StatusBadge status={status} className="ml-auto" />}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** Phones: a vertical route — one step per row, department and status in words. */
export function RouteStack({
  steps,
  current,
  emphasis,
  raised,
  collapse,
  className,
}: RouteViewProps) {
  const c = useCopy(WORKFLOW).common;
  const laneName = useLaneName();
  const upto = current ?? steps.length - 1;
  const [showAll, setShowAll] = useState(false);
  const focusIds = new Set<StepId>([...(emphasis ?? []), ...(raised ? [raised.step] : [])]);
  steps.forEach((s, i) => {
    if (current !== undefined && Math.abs(i - upto) <= 1) focusIds.add(s.id);
  });
  if (!focusIds.size) steps.slice(0, 3).forEach((s) => focusIds.add(s.id));
  const collapsed = collapse && !showAll && focusIds.size < steps.length;
  return (
    <div className={className}>
      <ol className="relative space-y-1.5" data-route-stack data-collapsed={collapsed || undefined}>
        <span aria-hidden className="absolute top-3 bottom-3 left-[0.9rem] w-px bg-border-soft" />
        {steps.map((s, i) => {
          if (collapsed && !focusIds.has(s.id)) return null;
          const ahead = current !== undefined && i > upto;
          const isRaised = raised?.step === s.id;
          const status = isRaised ? raised.status : ahead ? 'waiting' : s.status;
          const focus =
            isRaised ||
            (current !== undefined && i === upto) ||
            (emphasis?.includes(s.id) ?? false);
          const dim = (emphasis && !emphasis.includes(s.id) && !isRaised) || ahead;
          const record = s.record ? RECORDS[s.record] : null;
          return (
            <li
              key={s.id}
              data-step={s.id}
              aria-current={current !== undefined && i === upto ? 'step' : undefined}
              className={cn(
                'relative flex gap-3 rounded-xl py-2 pr-2 pl-0 transition-opacity duration-300',
                focus && 'bg-surface-raised/70',
                dim && 'opacity-45',
              )}
            >
              <span
                aria-hidden
                className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular"
                style={{ borderColor: laneColor(s.actor), background: 'var(--color-surface-base)' }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-label font-medium text-text-primary">
                  {c.steps[s.id].title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-text-muted">
                  <span>{laneName(s.actor)}</span>
                  {record && <span className="tabular">· {record}</span>}
                </span>
              </span>
              <StatusBadge status={status} className="mt-0.5 shrink-0" />
            </li>
          );
        })}
      </ol>
      {collapse && focusIds.size < steps.length && (
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setShowAll((v) => !v)}
          className="group mt-2 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-border-soft py-1 pr-1.5 pl-4 text-label text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {collapsed ? c.showAll.replace('{n}', String(steps.length)) : c.showFocus}
          <DisclosureIcon open={!collapsed} size="sm" />
        </button>
      )}
    </div>
  );
}

/** Map on large screens, stack on smaller ones — the same steps either way. */
export function RouteView(props: RouteViewProps) {
  const wide = useMediaQuery('(min-width: 64rem)');
  return wide ? <RouteMap {...props} /> : <RouteStack {...props} />;
}
