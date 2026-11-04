import { useId, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import { useDateFormat } from '@/features/company-center/model';
import { Loading, PageTitle, Pill } from '@/features/company-center/parts';
import { usePaged } from '@/features/warehouse/whModel';
import { useExec } from './execCopy';
import { productionApi } from './productionApi';
import { BackLink, ItemCell } from './prodParts';

/*
 * /core/warehouse/material-issues (EP37, its own tiny lazy chunk) — the
 * Warehouse handoff: production material issues of the member's branches,
 * what leaves and from where (location, lot, quantity), DRAFT (to hand over)
 * and POSTED (handed over). Read only (warehouse.material_issues.view); no
 * production order, cost, price or customer.
 */

export default function MaterialIssueHandoff() {
  const { x, c, err } = useExec();
  const { date, dateTime } = useDateFormat();
  const base = useId();
  const [status, setStatus] = useState('');
  const { data, error, more, showMore } = usePaged(
    (page) => productionApi.handoff({ status: status || undefined, page, pageSize: 25 }),
    [status],
  );
  return (
    <div className="grid grid-cols-1 gap-6" data-material-handoff>
      <BackLink to="/core/warehouse" />
      <PageTitle title={x.handoff.title} lead={x.handoff.lead} />
      <SelectField
        id={`${base}-s`}
        label={x.f.status}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="max-w-xs"
      >
        <option value="">{x.f.any}</option>
        <option value="DRAFT">{c.issueStatuses.DRAFT}</option>
        <option value="POSTED">{c.issueStatuses.POSTED}</option>
      </SelectField>
      {error && !data ? (
        <Notice tone="error">{err(error)}</Notice>
      ) : !data ? (
        <Loading label={x.loading} />
      ) : data.items.length === 0 ? (
        <p className="py-6 text-label text-text-secondary" data-empty>
          {x.none}
        </p>
      ) : (
        <ol className="grid gap-3">
          {data.items.map((i) => (
            <li
              key={i.id}
              className="grid gap-2 rounded-xl bg-white/[0.02] p-4"
              data-handoff={i.number}
            >
              <p className="flex flex-wrap items-center gap-2 text-label">
                <span className="font-mono font-semibold">{i.number}</span>
                <Pill tone={i.status === 'POSTED' ? 'teal' : 'neutral'}>
                  {c.issueStatuses[i.status]}
                </Pill>
                <span className="text-caption text-text-muted">
                  {`${x.f.order} ${i.order.number} · ${i.postedAt ? dateTime(i.postedAt) : dateTime(i.createdAt)}`}
                </span>
              </p>
              <ul className="grid gap-1 text-label">
                {i.lines.map((l, n) => (
                  <li key={n} className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <ItemCell code={l.item.code} name={l.item.name} />
                    <span className="text-caption text-text-secondary tabular-nums">
                      {`${x.f.location} ${l.location.code}`}
                      {l.lot && ` · ${x.f.lot} ${l.lot.lotNumber}`}
                      {l.lot?.expiryDate && ` · ${date(l.lot.expiryDate)}`}
                      {` · ${l.quantity} ${l.unit.code}`}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={showMore}
          className={buttonClasses('secondary', 'md', 'w-fit')}
        >
          {more ? x.loading : x.showMore}
        </button>
      )}
    </div>
  );
}
