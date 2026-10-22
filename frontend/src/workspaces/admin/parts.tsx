import { KeyRound } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/core';
import { WORKSPACE_ORDER, WORKSPACES } from '../registry';
import { ROLES } from './data';

/*
 * Admin shows configuration concepts only. There are no stored users yet — the
 * prototype reviewer account is not a user record. Departments come from the
 * product's canonical list; roles are the planned standard set.
 */

export function DepartmentList() {
  return (
    <ul className="divide-y divide-line">
      {WORKSPACE_ORDER.map((id) => {
        const w = WORKSPACES[id];
        const Icon = w.icon;
        return (
          <li key={id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
            <Icon className="size-4 shrink-0" style={{ color: w.accent }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-label text-fg-primary">{w.shortTh}</span>
            <StatusBadge status="completed" label="เปิดใช้" size="sm" className="max-sm:hidden" />
            <code className="rounded-md bg-fill-muted px-2 py-0.5 text-caption text-fg-secondary">
              {id}
            </code>
          </li>
        );
      })}
    </ul>
  );
}

export function RoleGrid() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {ROLES.map((r) => (
        <li key={r.code} className="rounded-panel border border-line bg-panel p-5">
          <KeyRound className="size-4 text-[var(--ws-accent)]" aria-hidden />
          <p className="mt-3 text-label font-semibold text-fg-primary">{r.name}</p>
          <Badge className="mt-1.5">{r.code}</Badge>
          <p className="mt-3 text-caption text-fg-muted">{r.note}</p>
        </li>
      ))}
    </ul>
  );
}
