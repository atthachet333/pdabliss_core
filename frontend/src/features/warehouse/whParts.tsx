import { buttonClasses } from '@/components/ui/buttonStyles';
import { AreaNavLink, Pill } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import type { ExpiryState, GrStatus, Tracking, WarehouseContext } from './whApi';
import { WH } from './whModel';
import { WH_COPY } from './whCopy';

/*
 * Pieces shared by the EP31 Warehouse screens (kept apart from the receipt
 * editor so the inventory and movement chunks stay small). Status is text plus
 * a subtle tone, never colour alone.
 */

/** The Warehouse section links this person may open (presentation only; the server decides). */
export function WarehouseNav({ ctx }: { ctx: WarehouseContext }) {
  const c = useCopy(WH_COPY);
  const links: [string, string][] = [];
  if (ctx.receiving.view) {
    links.push([`${WH}/pending-receive`, c.nav.pending], [`${WH}/receipts`, c.nav.receipts]);
  }
  if (ctx.inventory.view) {
    links.push(
      [`${WH}/inventory`, c.nav.inventory],
      [`${WH}/lots`, c.nav.lots],
      [`${WH}/movements`, c.nav.movements],
      // EP32: read with warehouse.inventory.view; acting needs the document's own codes.
      [`${WH}/transfers`, c.nav.transfers],
      [`${WH}/adjustments`, c.nav.adjustments],
      [`${WH}/counts`, c.nav.counts],
      // EP34: confirmed sales demand with stock reserved (read-only until EP35 picking).
      [`${WH}/pending-pick`, c.nav.pendingPick],
    );
  }
  return (
    <nav
      aria-label={c.workspace}
      className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-white/[0.07]"
      data-warehouse-nav
    >
      {links.map(([to, label]) => (
        <AreaNavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              isActive
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )
          }
        >
          {label}
        </AreaNavLink>
      ))}
    </nav>
  );
}

const GR_TONE: Record<GrStatus, 'neutral' | 'teal' | 'muted'> = {
  DRAFT: 'neutral',
  POSTED: 'teal',
  CANCELLED: 'muted',
};

export function GrStatusPill({ status }: { status: GrStatus }) {
  const c = useCopy(WH_COPY);
  return (
    <Pill
      tone={GR_TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-gr-status={status}
    >
      {c.statuses[status]}
    </Pill>
  );
}

export function ExpiryPill({ state, days }: { state: ExpiryState; days?: number | null }) {
  const c = useCopy(WH_COPY);
  const tone = state === 'EXPIRED' || state === 'EXPIRING_SOON' ? 'warning' : 'muted';
  return (
    <Pill tone={tone} data-expiry-state={state}>
      {c.expiry[state]}
      {days !== null && days !== undefined && state !== 'NO_EXPIRY' && ` · ${c.daysLeft(days)}`}
    </Pill>
  );
}

/** "Lot: Required · Expiry: Optional" — the item's tracking rules. */
export function TrackingNote({ lot, expiry }: { lot: Tracking; expiry: Tracking }) {
  const c = useCopy(WH_COPY);
  return (
    <span className="text-caption text-text-muted" data-tracking={`${lot}/${expiry}`}>
      {c.f.lotRule}: {c.tracking[lot]} · {c.f.expiryRule}: {c.tracking[expiry]}
    </span>
  );
}

export function ShowMore({
  visible,
  busy,
  onClick,
}: {
  visible: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const c = useCopy(WH_COPY);
  if (!visible) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={buttonClasses('secondary', 'md', 'w-fit')}
    >
      {busy ? c.loading : c.showMore}
    </button>
  );
}
