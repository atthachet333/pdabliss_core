import { ArrowUpRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/core';
import { WORKSPACES, workspacePath } from '../registry';
import { DEPARTMENT_SUMMARY } from './data';

/**
 * Department summaries — the Executive's way into each workspace. Each card
 * carries its own department accent (small icon only). Links exist for design
 * review; they do not imply future authorization.
 */
export function DepartmentGrid() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {DEPARTMENT_SUMMARY.map((d) => {
        const dept = WORKSPACES[d.id];
        const Icon = dept.icon;
        return (
          <li key={d.id} style={{ '--ws-accent': dept.accent } as CSSProperties}>
            <Link
              to={workspacePath(d.id)}
              className="group flex h-full flex-col rounded-panel border border-line bg-panel p-5 transition-colors hover:border-line-strong hover:bg-panel-raised"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5 text-label font-semibold text-fg-primary">
                  <Icon className="size-4 shrink-0 text-[var(--ws-accent)]" aria-hidden />
                  <span className="truncate">{dept.shortTh}</span>
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-fg-muted transition-colors group-hover:text-fg-primary"
                  aria-hidden
                />
              </span>
              <StatusBadge
                status={d.status}
                label={d.statusLabel}
                size="sm"
                className="mt-3 self-start"
              />
              <span className="mt-4 grid grid-cols-2 gap-3">
                {d.metrics.map(([label, value]) => (
                  <span key={label} className="min-w-0">
                    <span className="block truncate text-caption text-fg-muted">{label}</span>
                    <span className="block text-section text-fg-primary tabular">{value}</span>
                  </span>
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
