import { Notice } from '@/features/auth/AuthFrame';
import { useDateFormat, useLoad } from '@/features/company-center/model';
import { Loading, PageTitle } from '@/features/company-center/parts';
import { productionApi } from './productionApi';
import { BackLink, ItemCell, MoStatusPill, Table } from './prodParts';
import { useProd } from './productionCopy';

/*
 * /core/purchasing/production-shortages (EP36) — the Purchasing handoff, its
 * own small lazy chunk: materials that APPROVED / READY production orders lack
 * now (purchasing.production_shortages.view). Read-only: no value, no
 * supplier, no customer, and nothing is requested or ordered automatically.
 */

export default function ShortagesArea() {
  const { c, err } = useProd();
  const { date } = useDateFormat();
  const { state } = useLoad(productionApi.shortages);
  return (
    <div className="grid grid-cols-1 gap-6" data-production-shortages>
      <BackLink to="/core" />
      <PageTitle title={c.shortages.title} lead={c.shortages.lead} />
      {state.status === 'loading' ? (
        <Loading label={c.loading} />
      ) : state.status === 'error' ? (
        <Notice tone="error">{err(state.error)}</Notice>
      ) : state.data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {c.none}
        </p>
      ) : (
        <Table
          data="shortages"
          rows={state.data.items}
          rowKey={(r) => `${r.order.id}/${r.material.id}`}
          cols={[
            {
              head: c.f.material,
              cell: (r) => <ItemCell code={r.material.code} name={r.material.name} />,
            },
            {
              head: c.f.shortage,
              end: true,
              cell: (r) => (
                <span className="font-semibold whitespace-nowrap text-[#f3cf8a]">{`${r.shortage} ${r.unit.code}`}</span>
              ),
            },
            { head: c.f.requiredQty, end: true, cell: (r) => `${r.required} ${r.unit.code}` },
            { head: c.f.available, end: true, cell: (r) => `${r.available} ${r.unit.code}` },
            {
              head: c.f.required,
              cell: (r) => (r.order.requiredDate ? date(r.order.requiredDate) : '—'),
            },
            {
              head: c.f.orders,
              cell: (r) => (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{r.order.number}</span>
                  <MoStatusPill status={r.order.status} />
                </span>
              ),
            },
            { head: c.f.branch, minor: true, cell: (r) => r.branch.code },
          ]}
        />
      )}
      <p className="text-caption text-text-muted">{c.planningNote}</p>
    </div>
  );
}
