import { Notice } from '@/features/auth/AuthFrame';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useLoad } from '@/features/company-center/model';
import { AreaLink, Loading, PageTitle } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { whApi } from './whApi';
import { WH_COPY, whError } from './whCopy';
import { WarehouseNav } from './whParts';
import { WH } from './whModel';

/*
 * /core/warehouse — the Warehouse workspace (EP31): real counts from the API
 * (pending receive, draft receipts, stock lines, lots expiring soon / expired;
 * EP32: draft transfers, adjustments to approve, counts in progress) for the
 * selected branch, each a way into its screen. No made-up figures.
 */
export default function WarehouseHome() {
  const c = useCopy(WH_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(whApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{whError(state.error, c, cc)}</Notice>;
  const ctx = state.data;
  const tiles = [
    [ctx.counts.pendingReceive, c.tiles.pending, `${WH}/pending-receive`],
    [ctx.counts.draftReceipts, c.tiles.drafts, `${WH}/receipts?status=DRAFT`],
    [ctx.counts.stockRows, c.tiles.stock, `${WH}/inventory`],
    [ctx.counts.expiring, c.tiles.expiring, `${WH}/lots?expiry=EXPIRING_SOON`],
    [ctx.counts.expired, c.tiles.expired, `${WH}/lots?expiry=EXPIRED`],
    [ctx.counts.draftTransfers, c.tiles.draftTransfers, `${WH}/transfers?status=DRAFT`],
    [
      ctx.counts.submittedAdjustments,
      c.tiles.submittedAdjustments,
      `${WH}/adjustments?status=SUBMITTED`,
    ],
    [ctx.counts.activeCounts, c.tiles.activeCounts, `${WH}/counts?status=COUNTING`],
  ].filter((t): t is [number, string, string] => t[0] !== null);
  return (
    <div className="grid grid-cols-1 gap-6" data-warehouse-home>
      <AreaLink
        to="/core"
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← CORE
      </AreaLink>
      <PageTitle title={c.workspace} lead={c.workspaceLead} />
      <WarehouseNav ctx={ctx} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tiles>
        {tiles.map(([n, label, to]) => (
          <li key={to}>
            <AreaLink
              to={to}
              className="grid min-h-24 content-between gap-2 rounded-xl bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-tile={to}
            >
              <span className="text-label text-text-secondary">{label}</span>
              <span className="text-[1.75rem] leading-none font-semibold text-text-primary tabular-nums">
                {n.toLocaleString()}
              </span>
            </AreaLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
