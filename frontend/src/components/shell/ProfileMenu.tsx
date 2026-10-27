import { FlaskConical, LogOut, SlidersHorizontal, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MenuItem, MenuSeparator, MenuSurface, useMenu } from '@/components/core';
import { authApi } from '@/features/auth/api';
import { clearIdentity, useIdentity } from '@/features/auth/session';
import type { WorkspaceDefinition } from '@/workspaces/registry';

export const DESIGN_LAB_PATH = '/app/prototype/ui';

/** Profile menu: who you are, which workspace, placeholders, sign-out. */
export function ProfileMenu({ ws }: { ws: WorkspaceDefinition }) {
  const identity = useIdentity();
  const navigate = useNavigate();
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
  const WsIcon = ws.icon;
  const email = identity.status === 'ready' ? identity.identity.user.email : '';
  const name = identity.status === 'ready' ? (identity.identity.user.fullName ?? email) : '';

  // Real sign-out (EP23): the server revokes the session, then back to /login.
  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    clearIdentity();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="เมนูผู้ใช้"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className="flex h-10 items-center gap-2.5 rounded-control px-1 transition-colors hover:bg-fill-hover xl:pr-3"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-panel-raised text-caption font-semibold text-fg-secondary uppercase">
          {name.slice(0, 2)}
        </span>
        <span className="hidden text-left leading-tight xl:block">
          <span className="block text-caption font-medium text-fg-primary">{name}</span>
          <span className="block text-[0.75rem] text-fg-muted">ผู้ตรวจหน้าจอต้นแบบ</span>
        </span>
      </button>
      <MenuSurface
        open={open}
        id={menuId}
        menuRef={menuRef}
        onKeyDown={onMenuKeyDown}
        label="เมนูผู้ใช้"
        align="end"
        className="w-64"
      >
        <div className="px-3 pt-2 pb-3">
          <p className="text-label font-medium text-fg-primary">{name}</p>
          <p className="truncate text-caption text-fg-muted">{email}</p>
          <p className="mt-3 flex items-center gap-2 rounded-control bg-fill-hover px-2.5 py-2 text-caption text-fg-secondary">
            <WsIcon className="size-4 text-[var(--ws-accent)]" aria-hidden />
            <span className="min-w-0 truncate">
              พื้นที่ทำงาน: <span className="text-fg-primary">{ws.shortTh}</span>
            </span>
          </p>
        </div>
        <MenuSeparator />
        <MenuItem
          item={{ label: 'โปรไฟล์', icon: UserRound, disabled: true, hint: 'เร็ว ๆ นี้' }}
          onDone={() => {}}
        />
        <MenuItem
          item={{
            label: 'การตั้งค่าส่วนตัว',
            icon: SlidersHorizontal,
            disabled: true,
            hint: 'เร็ว ๆ นี้',
          }}
          onDone={() => {}}
        />
        <MenuSeparator />
        <MenuItem
          item={{
            label: 'Design Lab',
            icon: FlaskConical,
            hint: 'ต้นแบบ',
            onSelect: () => navigate(DESIGN_LAB_PATH),
          }}
          onDone={() => close(false)}
        />
        <MenuSeparator />
        <MenuItem
          item={{ label: 'ออกจากระบบ', icon: LogOut, onSelect: () => void signOut() }}
          onDone={() => close(false)}
        />
      </MenuSurface>
    </div>
  );
}
