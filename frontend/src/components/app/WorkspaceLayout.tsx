import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronLeft, LayoutGrid, LogOut, Search, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { WORKSPACES, type WorkspaceId } from '@/workspaces/registry';
import { ApiStatus } from './ApiStatus';

function navTo(workspace: WorkspaceId, path: string) {
  return path ? `/app/${workspace}/${path}` : `/app/${workspace}`;
}

function SidebarNav({
  workspace,
  onNavigate,
}: {
  workspace: WorkspaceId;
  onNavigate?: () => void;
}) {
  const ws = WORKSPACES[workspace];
  return (
    <ul className="space-y-0.5">
      {ws.nav.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.path}>
            <NavLink
              to={navTo(workspace, item.path)}
              end={item.path === ''}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-label transition-colors',
                  isActive
                    ? 'bg-brand-primary/12 font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brand-glow"
                    />
                  )}
                  <Icon
                    className={cn(
                      'size-4.5 shrink-0',
                      isActive ? 'text-brand-glow' : 'text-text-muted',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-raised" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-panel bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}

/**
 * The shell every department workspace renders inside. Navigation comes from
 * the workspace registry; it is a UX boundary only — the backend authorizes.
 */
export function WorkspaceLayout({ workspace }: { workspace: WorkspaceId }) {
  const ws = WORKSPACES[workspace];
  const WsIcon = ws.icon;
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setDrawer(false);
  }

  useEffect(() => {
    document.title = `${ws.nameTh} | PDA BLISS CORE`;
  }, [ws.nameTh]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  // Mobile bottom bar shows the first four modules; the rest live in the drawer.
  const primary = ws.nav.slice(0, 4);

  return (
    <div className="min-h-dvh bg-surface-dark lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#workspace-main"
        className="sr-only z-[60] rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border-soft bg-surface-base lg:flex">
        <div className="flex items-center gap-3 border-b border-border-soft px-5 py-4">
          <Link to="/" aria-label="กลับสู่เว็บไซต์ PDA BLISS CORE">
            <LogoMark className="size-8" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-label font-semibold text-text-primary">{ws.nameTh}</p>
            <p className="truncate text-caption text-text-muted">{ws.nameEn}</p>
          </div>
        </div>
        <nav aria-label={`เมนู${ws.nameTh}`} className="flex-1 overflow-y-auto p-3">
          <SidebarNav workspace={workspace} />
        </nav>
        <div className="border-t border-border-soft p-4">
          <div className="rounded-xl border border-border-soft bg-surface-raised/60 p-3">
            <p className="text-caption text-text-muted">บริษัทในพื้นที่ทำงานนี้</p>
            <p className="mt-0.5 truncate text-label text-text-primary">
              บริษัท ตัวอย่างอุตสาหกรรม จำกัด
            </p>
          </div>
          <Link
            to="/login"
            className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-caption text-text-muted hover:text-text-primary"
          >
            <LogOut className="size-3.5" aria-hidden />
            ออกจากเดโม
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border-soft bg-surface-dark/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Link
              to="/login"
              className="flex size-10 items-center justify-center rounded-xl border border-border-soft lg:hidden"
              aria-label="กลับไปหน้าเลือกเดโม"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <WsIcon className="size-5 shrink-0 text-brand-glow" aria-hidden />
              <span className="truncate text-label font-semibold">{ws.nameTh}</span>
            </div>
            <div className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-border-soft bg-surface-raised/60 px-3 py-2 text-text-muted lg:flex">
              <Search className="size-4" aria-hidden />
              <span className="text-label">ค้นหาเอกสาร สินค้า หรือเลขที่อ้างอิง</span>
              <kbd className="ml-auto rounded border border-border-strong px-1.5 text-caption">
                /
              </kbd>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-caption font-medium text-warning sm:inline">
                ข้อมูลเดโม
              </span>
              <ApiStatus />
              <button
                type="button"
                className="relative flex size-10 items-center justify-center rounded-xl border border-border-soft text-text-secondary hover:text-text-primary"
                aria-label="การแจ้งเตือน 3 รายการ"
              >
                <Bell className="size-4.5" aria-hidden />
                <span
                  aria-hidden
                  className="absolute top-2 right-2 size-2 rounded-full bg-brand-glow"
                />
              </button>
              <div className="hidden items-center gap-2.5 md:flex">
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-brand-primary/20 text-label font-semibold text-brand-soft"
                >
                  {ws.persona.name.replace('คุณ', '').slice(0, 1)}
                </span>
                <span className="leading-tight">
                  <span className="block text-label text-text-primary">{ws.persona.name}</span>
                  <span className="block text-caption text-text-muted">{ws.persona.role}</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <main id="workspace-main" className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_CORE }}
            >
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={`เมนูหลัก${ws.nameTh}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-surface-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={navTo(workspace, item.path)}
                  end={item.path === ''}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.75rem]',
                      isActive ? 'text-brand-glow' : 'text-text-muted',
                    )
                  }
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="max-w-full truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-expanded={drawer}
              aria-controls="workspace-drawer"
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[0.75rem] text-text-muted"
            >
              <LayoutGrid className="size-5" aria-hidden />
              เมนูทั้งหมด
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-surface-dark/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              aria-hidden
            />
            <motion.div
              id="workspace-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`เมนู${ws.nameTh}`}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-border-strong bg-surface-base p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: DURATION.base, ease: EASE_CORE }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-label font-semibold">{ws.nameTh}</p>
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  className="flex size-10 items-center justify-center rounded-xl border border-border-soft"
                  aria-label="ปิดเมนู"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <SidebarNav workspace={workspace} onNavigate={() => setDrawer(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
