import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { workspacePath, type WorkspaceDefinition } from '@/workspaces/registry';

export const SIDEBAR_ID = 'workspace-sidebar';

/**
 * Desktop / tablet workspace navigation (≥ 768px). Shows only this
 * department's modules. Full width (16rem) or an icon rail (4.5rem) — see the
 * `rail:` variant in styles/index.css.
 */
export function Sidebar({ ws }: { ws: WorkspaceDefinition }) {
  const WsIcon = ws.icon;
  return (
    <div className="hidden shrink-0 border-r border-line bg-nav md:block">
      <aside
        id={SIDEBAR_ID}
        aria-label={`พื้นที่ทำงาน${ws.shortTh}`}
        className="sticky top-16 flex max-h-[calc(100dvh-4rem)] w-64 flex-col overflow-x-hidden overflow-y-auto transition-[width] duration-200 rail:w-[4.5rem]"
      >
        {/* Workspace identity — accent appears here, subtly */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 rail:justify-center rail:px-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-[color-mix(in_oklab,var(--ws-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--ws-accent)_10%,transparent)]">
            <WsIcon className="size-[1.125rem] text-[var(--ws-accent)]" aria-hidden />
          </span>
          <div className="min-w-0 rail:sr-only">
            <p className="truncate text-label font-semibold text-fg-primary">{ws.shortTh}</p>
            <p className="truncate text-caption text-fg-muted">{ws.nameEn}</p>
          </div>
        </div>

        <nav aria-label={`เมนู${ws.nameTh}`} className="flex-1 px-3 pb-6">
          <ul className="space-y-0.5">
            {ws.nav.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={workspacePath(ws.id, item.path)}
                    end={item.path === ''}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-10 items-center gap-3 rounded-control px-3 text-label transition-colors rail:justify-center rail:px-0',
                        isActive
                          ? 'bg-fill-active font-medium text-fg-primary'
                          : 'text-fg-secondary hover:bg-fill-hover hover:text-fg-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-[var(--ws-accent)] transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <Icon
                          className={cn(
                            'size-[1.125rem] shrink-0',
                            isActive
                              ? 'text-[var(--ws-accent)]'
                              : 'text-fg-muted group-hover:text-fg-secondary',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate rail:sr-only">{item.label}</span>
                        {item.placeholder && (
                          <span className="rounded-md border border-dashed border-line-strong px-1.5 text-[0.6875rem] text-fg-muted rail:hidden">
                            เร็ว ๆ นี้
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <p className="px-5 pb-5 text-[0.75rem] leading-relaxed text-fg-muted rail:hidden">
          เมนูแสดงเฉพาะงานของแผนกนี้
        </p>
      </aside>
    </div>
  );
}
