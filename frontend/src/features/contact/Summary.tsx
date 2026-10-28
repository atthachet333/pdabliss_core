import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { CONTACT_COPY } from './copy';
import type { Inquiry } from './model';
import { summaryRows, useDeptName } from './summaryText';

/** The inquiry summary as a definition list (live panel and review step). */
export function Summary({
  inquiry,
  includeContact = true,
  stacked = false,
  className,
}: {
  inquiry: Inquiry;
  includeContact?: boolean;
  /** Label above value — for the narrow context rail (EP24.1.4.4). */
  stacked?: boolean;
  className?: string;
}) {
  const c = useCopy(CONTACT_COPY);
  const deptName = useDeptName();
  const rows = summaryRows(inquiry, c, deptName, { includeContact });
  return (
    <dl data-summary className={cn('divide-y divide-border-soft', className)}>
      {rows.map((r) => (
        <div
          key={r.key}
          data-summary-row={r.key}
          className={cn(
            'grid',
            stacked ? 'gap-1 py-3' : 'grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5',
          )}
        >
          <dt className="text-caption text-text-muted">{r.label}</dt>
          <dd
            className={cn(
              'text-label break-words',
              r.value === c.summary.empty ? 'text-text-muted' : 'text-text-primary',
            )}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
