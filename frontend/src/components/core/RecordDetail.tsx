import type { LucideIcon } from 'lucide-react';
import { FileText, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { panelSurface } from './styles';

/*
 * Building blocks of the standard document layout (PO, SO, GR, payment…):
 *
 *   RecordHeader      PO-000123  [Status]        [actions]
 *   Tabs              รายละเอียด · รายการ · การรับสินค้า · การจ่ายเงิน · ประวัติ
 *   main column       SummaryList / line items / WorkflowTimeline
 *   side column       RelatedDocuments · ActivityFeed
 *
 * The same blocks render inside a Drawer (quick view, single column) and on a
 * full page (two columns from 1024px). No business logic lives here.
 */

export function RecordHeader({
  docType,
  number,
  status,
  meta,
  actions,
  headingLevel = 1,
}: {
  docType: string;
  number: string;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** 1 on a full page; 2 when the record sits under another page title. */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-caption text-fg-muted">{docType}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Heading className="text-page font-semibold text-fg-primary tabular">{number}</Heading>
          {status}
        </div>
        {meta && <div className="mt-1.5 text-caption text-fg-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Label/value pairs. Two columns from 640px unless `columns={1}` (drawers). */
export function SummaryList({
  items,
  columns = 2,
}: {
  items: readonly { label: string; value: ReactNode }[];
  columns?: 1 | 2;
}) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-4', columns === 2 && 'sm:grid-cols-2')}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0 border-b border-line pb-3">
          <dt className="text-caption text-fg-muted">{it.label}</dt>
          <dd className="mt-0.5 text-label text-fg-primary">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface RelatedDoc {
  type: string;
  number: string;
  status?: ReactNode;
  icon?: LucideIcon;
}

export function RelatedDocuments({ docs }: { docs: readonly RelatedDoc[] }) {
  return (
    <ul className="space-y-2">
      {docs.map((d) => {
        const Icon = d.icon ?? FileText;
        return (
          <li
            key={`${d.type}-${d.number}`}
            className="flex items-center gap-3 rounded-control border border-line px-3.5 py-3"
          >
            <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-fg-muted">{d.type}</p>
              <p className="truncate text-label text-fg-primary tabular">{d.number}</p>
            </div>
            {d.status}
            <Link2 className="size-3.5 shrink-0 text-fg-muted" aria-label="เอกสารที่เชื่อมโยง" />
          </li>
        );
      })}
    </ul>
  );
}

export interface ActivityEntry {
  who: string;
  what: string;
  when: string;
}

/** Chronological audit-style feed. Newest first. */
export function ActivityFeed({ entries }: { entries: readonly ActivityEntry[] }) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-1 before:bottom-1 before:left-[0.3125rem] before:w-px before:bg-line-strong">
      {entries.map((e, i) => (
        <li key={i} className="relative pl-6">
          <span
            aria-hidden
            className="absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-panel bg-fg-muted"
          />
          <p className="text-label text-fg-secondary">
            <span className="font-medium text-fg-primary">{e.who}</span> {e.what}
          </p>
          <p className="text-caption text-fg-muted">{e.when}</p>
        </li>
      ))}
    </ol>
  );
}

/** Two-column document page: main content + side context; stacks below 1024px. */
export function RecordLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="min-w-0 space-y-6">{side}</aside>
    </div>
  );
}

/** Titled block inside a record (lighter than a Panel). */
export function RecordSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(panelSurface, 'p-5 sm:p-6', className)}>
      <h2 className="mb-4 text-section text-fg-primary">{title}</h2>
      {children}
    </section>
  );
}
