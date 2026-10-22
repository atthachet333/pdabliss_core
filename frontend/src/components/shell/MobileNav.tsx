import { Check, FlaskConical, LayoutGrid, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Sheet } from '@/components/core';
import { cn } from '@/lib/cn';
import { SWITCHER_NOTE } from '@/prototype/WorkspaceSwitcher';
import {
  WORKSPACE_ORDER,
  WORKSPACES,
  workspacePath,
  type WorkspaceDefinition,
} from '@/workspaces/registry';
import { DESIGN_LAB_PATH } from './ProfileMenu';

const itemClass = (active: boolean) =>
  cn(
    'relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.75rem] leading-tight transition-colors',
    active ? 'text-fg-primary' : 'text-fg-muted',
  );

function ActiveMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-0 h-0.5 w-8 rounded-b-full bg-[var(--ws-accent)] transition-opacity',
        on ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

/**
 * Phone navigation (< 768px): a bottom bar within thumb reach with up to four
 * primary destinations + "เพิ่มเติม" (the rest, in a bottom sheet). Warehouse
 * gets a centre scan button for future barcode / QR work on the floor.
 */
export function MobileNav({ ws, onScan }: { ws: WorkspaceDefinition; onScan: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  // Up to four primary destinations; Warehouse trades one for the centre scan button.
  const primary = ws.nav.filter((n) => n.mobile).slice(0, ws.scanAction ? 3 : 4);
  const left = ws.scanAction ? primary.slice(0, 2) : primary;
  const right = ws.scanAction ? primary.slice(2) : [];
  const rest = ws.nav.filter((n) => !primary.includes(n));
  const restActive = rest.some((n) => location.pathname === workspacePath(ws.id, n.path));

  const link = (item: (typeof primary)[number]) => {
    const Icon = item.icon;
    return (
      <li key={item.path} className="min-w-0">
        <NavLink
          to={workspacePath(ws.id, item.path)}
          end={item.path === ''}
          className={({ isActive }) => itemClass(isActive)}
        >
          {({ isActive }) => (
            <>
              <ActiveMark on={isActive} />
              <Icon className={cn('size-5', isActive && 'text-[var(--ws-accent)]')} aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      </li>
    );
  };

  const columns = left.length + right.length + (ws.scanAction ? 1 : 0) + 1;

  return (
    <>
      <nav
        aria-label={`เมนูหลัก${ws.nameTh}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {left.map(link)}
          {ws.scanAction && (
            <li className="flex items-center justify-center">
              <button
                type="button"
                onClick={onScan}
                aria-label="สแกนบาร์โค้ด / QR"
                className="-mt-5 flex size-14 items-center justify-center rounded-full border-4 border-canvas bg-[var(--ws-accent)] text-text-inverse shadow-overlay transition-transform active:scale-95"
              >
                <ScanBarcode className="size-6" aria-hidden />
              </button>
            </li>
          )}
          {right.map(link)}
          <li className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cn(itemClass(restActive), 'w-full')}
            >
              <ActiveMark on={restActive} />
              <LayoutGrid
                className={cn('size-5', restActive && 'text-[var(--ws-accent)]')}
                aria-hidden
              />
              <span>เพิ่มเติม</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="เมนูเพิ่มเติม">
        {rest.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 px-2 pb-4">
            {rest.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={workspacePath(ws.id, item.path)}
                    end={item.path === ''}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-14 items-center gap-3 rounded-control border px-3 py-2.5 text-label',
                        isActive
                          ? 'border-[color-mix(in_oklab,var(--ws-accent)_40%,transparent)] bg-fill-active text-fg-primary'
                          : 'border-line text-fg-secondary',
                      )
                    }
                  >
                    <Icon className="size-5 shrink-0 text-[var(--ws-accent)]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      {item.label}
                      {item.placeholder && (
                        <span className="block text-[0.75rem] text-fg-muted">เร็ว ๆ นี้</span>
                      )}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}

        <section
          aria-labelledby="mobile-switcher"
          className="mx-2 mb-2 rounded-panel border border-dashed border-warning/35 p-3"
        >
          <h3
            id="mobile-switcher"
            className="flex items-center gap-1.5 text-caption font-semibold text-warning"
          >
            <FlaskConical className="size-3.5" aria-hidden />
            สลับพื้นที่ทำงาน · ต้นแบบ
          </h3>
          <p className="mt-0.5 text-caption text-fg-muted">
            {SWITCHER_NOTE} — ระบบจริงเปิดพื้นที่ทำงานของแผนกให้อัตโนมัติ
          </p>
          <ul className="mt-2.5 space-y-0.5">
            {WORKSPACE_ORDER.map((id) => {
              const w = WORKSPACES[id];
              const WIcon = w.icon;
              const current = id === ws.id;
              return (
                <li key={id}>
                  <Link
                    to={workspacePath(id)}
                    onClick={() => setMoreOpen(false)}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-control px-2.5 text-label',
                      current ? 'bg-fill-active text-fg-primary' : 'text-fg-secondary',
                    )}
                  >
                    <WIcon className="size-4 shrink-0" style={{ color: w.accent }} aria-hidden />
                    <span className="flex-1">{w.shortTh}</span>
                    {current && <Check className="size-4 text-fg-secondary" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            to={DESIGN_LAB_PATH}
            onClick={() => setMoreOpen(false)}
            className="mt-2 flex min-h-11 items-center gap-3 rounded-control px-2.5 text-label text-fg-secondary"
          >
            <FlaskConical className="size-4 text-warning" aria-hidden />
            Design Lab
          </Link>
        </section>
      </Sheet>
    </>
  );
}
