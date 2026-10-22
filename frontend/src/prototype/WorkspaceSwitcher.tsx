import { Check, ChevronDown, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MenuSurface, useMenu } from '@/components/core';
import { cn } from '@/lib/cn';
import {
  WORKSPACE_ORDER,
  WORKSPACES,
  type WorkspaceDefinition,
  type WorkspaceId,
} from '@/workspaces/registry';

const GROUPS: { id: WorkspaceDefinition['group']; label: string }[] = [
  { id: 'control', label: 'ศูนย์ควบคุม' },
  { id: 'department', label: 'แผนก' },
  { id: 'system', label: 'ระบบ' },
];

export const SWITCHER_NOTE = 'ใช้สำหรับตรวจแบบเท่านั้น';

/**
 * PROTOTYPE-ONLY. Lets the owner move between department workspaces during
 * design review. In production there is no switcher: sign-in opens the
 * user's assigned workspace directly. Styled as a dashed "prototype" chip so
 * it is never mistaken for product navigation.
 */
export function WorkspaceSwitcher({ current }: { current: WorkspaceId }) {
  const {
    open,
    close,
    toggle,
    rootRef,
    triggerRef,
    menuRef,
    menuId,
    onTriggerKeyDown,
    onMenuKeyDown,
  } = useMenu();
  const navigate = useNavigate();

  const choose = (id: WorkspaceId) => {
    close(true);
    if (id !== current) navigate(`/app/${id}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        title={`สลับพื้นที่ทำงาน · ต้นแบบ — ${SWITCHER_NOTE}`}
        className="flex h-10 items-center gap-2 rounded-control border border-dashed border-warning/40 px-2.5 text-caption text-warning transition-colors hover:bg-warning/[0.06] lg:px-3"
      >
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span className="sr-only lg:not-sr-only">สลับพื้นที่ทำงาน · ต้นแบบ</span>
        <ChevronDown
          className={cn('hidden size-3.5 transition-transform lg:block', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <MenuSurface
        open={open}
        id={menuId}
        menuRef={menuRef}
        onKeyDown={onMenuKeyDown}
        label="สลับพื้นที่ทำงาน (เฉพาะต้นแบบ)"
        align="end"
        className="w-[min(21rem,calc(100vw-2rem))]"
      >
        <div className="mb-1 rounded-control border border-dashed border-warning/30 bg-warning/[0.05] px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-caption font-semibold text-warning">
            <FlaskConical className="size-3.5" aria-hidden />
            ต้นแบบ — {SWITCHER_NOTE}
          </p>
          <p className="mt-1 text-caption text-fg-muted">
            ในระบบจริง ผู้ใช้เข้าสู่พื้นที่ทำงานของแผนกตนเองโดยอัตโนมัติ
          </p>
        </div>
        {GROUPS.map((g) => {
          const ids = WORKSPACE_ORDER.filter((id) => WORKSPACES[id].group === g.id);
          return (
            <div key={g.id} role="group" aria-label={g.label} className="pt-1.5">
              <p aria-hidden className="px-3 pt-1 pb-1 text-[0.75rem] text-fg-muted">
                {g.label}
              </p>
              {ids.map((id) => {
                const w = WORKSPACES[id];
                const WIcon = w.icon;
                const selected = id === current;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    tabIndex={-1}
                    onClick={() => choose(id)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-left outline-none',
                      selected
                        ? 'bg-fill-active'
                        : 'hover:bg-fill-hover focus-visible:bg-fill-active',
                    )}
                  >
                    <WIcon className="size-4 shrink-0" style={{ color: w.accent }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label text-fg-primary">{w.shortTh}</span>
                      <span className="block truncate text-caption text-fg-muted">{w.nameEn}</span>
                    </span>
                    {selected && <Check className="size-4 text-fg-secondary" aria-hidden />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </MenuSurface>
    </div>
  );
}
