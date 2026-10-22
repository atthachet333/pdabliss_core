import { CircleDashed, Download, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  FilterChip,
  OverflowMenu,
  PageHeader,
  Panel,
  PrototypeTag,
  SearchField,
  TableToolbar,
  type Column,
} from '@/components/core';
import { WORKSPACES, workspacePath, type WorkspaceId } from './registry';

/**
 * Generic module page, driven by the registry blueprint: header with the
 * module's primary action, the list's real toolbar and columns, and an
 * intentional empty state. No fake records — the structure is the demo.
 */
export default function ModulePage({ workspace, path }: { workspace: WorkspaceId; path: string }) {
  const ws = WORKSPACES[workspace];
  const item = ws.nav.find((n) => n.path === path);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ReadonlySet<string>>(new Set());
  if (!item) return null;

  const bp = item.blueprint;
  const filtering = query.trim() !== '' || filters.size > 0;
  const columns: Column<never>[] = (bp?.columns ?? []).map((c, i) => ({
    id: `c${i}`,
    header: c.header,
    priority: c.priority,
    align: c.align,
    cell: () => null,
  }));
  const toggleFilter = (f: string) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  const clear = () => {
    setQuery('');
    setFilters(new Set());
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: ws.shortTh, to: workspacePath(ws.id) }, { label: item.label }]}
        title={item.label}
        description={item.summary}
        status={item.placeholder ? <PrototypeTag>เร็ว ๆ นี้</PrototypeTag> : undefined}
        actions={
          <>
            <OverflowMenu
              items={[
                { label: 'ส่งออกเป็นไฟล์', icon: Download, disabled: true, hint: 'เร็ว ๆ นี้' },
                { label: 'พิมพ์', icon: Printer, disabled: true, hint: 'เร็ว ๆ นี้' },
              ]}
            />
            {bp?.action && (
              <Button variant="primary" icon={Plus} soon>
                {bp.action}
              </Button>
            )}
          </>
        }
      />

      {bp && (
        <Panel flush title="รายการทั้งหมด" description="0 รายการ · เชื่อมข้อมูลจริงในรอบพัฒนาถัดไป">
          <TableToolbar
            search={
              <SearchField value={query} onChange={setQuery} placeholder={`ค้นหาใน${item.label}`} />
            }
            filters={
              bp.filters &&
              bp.filters.map((f) => (
                <FilterChip
                  key={f}
                  label={f}
                  pressed={filters.has(f)}
                  onToggle={() => toggleFilter(f)}
                />
              ))
            }
            onClear={filtering ? clear : undefined}
          />
          <DataTable
            label={`รายการ${item.label}`}
            columns={columns}
            rows={[]}
            getRowId={() => ''}
            empty={
              <div className="border-t border-line">
                {filtering ? (
                  <EmptyState
                    kind="filtered"
                    title="ไม่พบรายการตามตัวกรอง"
                    description="ลองเปลี่ยนคำค้นหรือล้างตัวกรองเพื่อดูรายการทั้งหมด"
                    action={
                      <Button size="sm" onClick={clear}>
                        ล้างตัวกรอง
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={item.icon}
                    title={bp.empty.title}
                    description={bp.empty.description}
                  />
                )}
              </div>
            }
          />
          {/* Column preview: shows reviewers the final list structure while it is empty. */}
          <div className="border-t border-line px-5 py-3 sm:px-6">
            <p className="text-caption text-fg-muted">
              คอลัมน์ของรายการ:{' '}
              <span className="text-fg-secondary">
                {bp.columns.map((c) => c.header).join(' · ')}
              </span>
            </p>
          </div>
        </Panel>
      )}

      {item.planned && (
        <section aria-labelledby="module-planned" className="mt-8">
          <h2 id="module-planned" className="mb-3 text-caption font-medium text-fg-muted">
            สิ่งที่จะมีในโมดูลนี้
          </h2>
          <ul className="flex flex-wrap gap-2">
            {item.planned.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-caption text-fg-secondary"
              >
                <CircleDashed className="size-3.5 text-[var(--ws-accent)]" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
