import { Link } from 'react-router';
import type { ActivityItem } from '@/features/auth/api';
import { formatDateTime } from '@/features/account/format';
import { cn } from '@/lib/cn';
import type { PlatformCopy } from './copy';
import { eventLabel } from './model';
import type { OpsCopy } from './opsCopy';

/*
 * One line per platform event (EP24.1.2): when, a human label (raw code kept
 * small for support), and who or which company it concerns. Company events
 * link to the Platform Inspection; demo companies carry their tag.
 */
export function ActivityList({
  items,
  p,
  o,
  lang,
}: {
  items: ActivityItem[];
  p: PlatformCopy;
  o: OpsCopy;
  lang: string;
}) {
  return (
    <ol className="divide-y divide-white/[0.05]" data-activity-list>
      {items.map((i) => (
        <li
          key={i.id}
          data-kind={i.kind}
          data-type={i.type}
          className="grid gap-x-5 gap-y-0.5 px-5 py-3 sm:px-6 md:grid-cols-[10.5rem_minmax(0,1.3fr)_minmax(0,1fr)] md:items-baseline"
        >
          <time dateTime={i.occurredAt} className="text-caption text-text-muted tabular-nums">
            {formatDateTime(i.occurredAt, lang)}
          </time>
          <span className="min-w-0 text-label text-text-primary">
            <span
              aria-hidden
              className={cn(
                'mr-2 inline-block size-1.5 rounded-full align-middle',
                i.kind === 'company' ? 'bg-brand-cool' : 'bg-brand-primary/80',
              )}
            />
            {eventLabel(p, i.type)}
            <code className="mt-0.5 block font-mono text-[0.6875rem] whitespace-nowrap text-text-muted">
              {i.type}
            </code>
          </span>
          <span className="min-w-0 truncate text-caption text-text-secondary">
            {i.company && (
              <Link
                to={`/platform/companies/${encodeURIComponent(i.company.id)}`}
                className="text-brand-soft underline decoration-brand-soft/40 underline-offset-2 hover:decoration-brand-soft"
              >
                {i.company.name}
              </Link>
            )}
            {i.company?.isDemo && (
              <span className="ml-1.5 rounded bg-brand-cool/[0.12] px-1 font-mono text-[0.625rem] text-[#a9cfff] uppercase">
                {o.overview.demoTag}
              </span>
            )}
            {i.company && i.email ? ' · ' : ''}
            {i.email && <span title={i.email}>{i.email}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
