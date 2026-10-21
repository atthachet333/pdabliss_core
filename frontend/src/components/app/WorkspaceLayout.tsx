import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, LogOut, UserRound } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LogoMark } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { prototypeSignOut, rememberWorkspace, usePrototypeSession } from '@/prototype/session';
import { WorkspaceSwitcher } from '@/prototype/WorkspaceSwitcher';
import { WORKSPACES, type WorkspaceId } from '@/workspaces/registry';

function navTo(workspace: WorkspaceId, path: string) {
  return path ? `/app/${workspace}/${path}` : `/app/${workspace}`;
}

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-36 animate-pulse rounded-card bg-surface-base" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-panel bg-surface-base" />
        ))}
      </div>
    </div>
  );
}

function UserMenu() {
  const session = usePrototypeSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = () => {
    prototypeSignOut();
    navigate('/login', { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="เมนูผู้ใช้"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-transparent px-1.5 transition-colors hover:border-border-soft sm:pr-3"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-surface-overlay">
          <UserRound className="size-4 text-text-secondary" aria-hidden />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-label text-text-primary">{session?.username}</span>
          <span className="block text-caption text-text-muted">ผู้ตรวจต้นแบบ</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="absolute top-full right-0 z-50 mt-2 w-60 rounded-2xl border border-border-strong bg-surface-overlay p-2 shadow-raised"
          >
            <div className="px-3 py-2.5">
              <p className="text-label text-text-primary">{session?.username}</p>
              <p className="mt-0.5 text-caption text-text-muted">
                บัญชีทดลองสำหรับตรวจ UX เท่านั้น
              </p>
            </div>
            <div className="my-1 h-px bg-border-soft" />
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-label text-text-secondary hover:bg-surface-highlight hover:text-text-primary"
            >
              <LogOut className="size-4" aria-hidden />
              ออกจากระบบ
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Shell every department workspace renders inside. Navigation comes from the
 * workspace registry and is UX only — never access control.
 */
export function WorkspaceLayout({ workspace }: { workspace: WorkspaceId }) {
  const ws = WORKSPACES[workspace];
  const WsIcon = ws.icon;
  const location = useLocation();

  useEffect(() => {
    document.title = `${ws.nameTh} | PDA BLISS CORE`;
    rememberWorkspace(workspace);
  }, [ws.nameTh, workspace]);

  return (
    <div
      className="min-h-dvh bg-surface-dark"
      style={{ '--ws-accent': ws.accent } as CSSProperties}
    >
      <a
        href="#workspace-main"
        className="sr-only z-[60] rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      {/* Prototype marker — always visible so the review build is never mistaken for production */}
      <div className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/[0.06] px-4 py-1.5 text-center text-caption text-warning">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">ต้นแบบ</strong> · โหมดตรวจ UX ด้วยข้อมูลตัวอย่าง —
          ไม่ใช่ระบบเข้าสู่ระบบจริง
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border-soft bg-surface-base/60 lg:flex">
          <Link
            to="/"
            className="flex items-center gap-3 px-6 pt-6 pb-5"
            aria-label="กลับสู่เว็บไซต์ PDA BLISS CORE"
          >
            <LogoMark className="size-8" />
            <span className="text-[0.8125rem] font-semibold tracking-[0.14em] text-text-primary">
              PDA BLISS <span className="text-brand-glow">CORE</span>
            </span>
          </Link>
          <div className="mx-4 rounded-2xl border border-border-soft bg-surface-raised/50 p-4">
            <div className="flex items-center gap-2.5">
              <WsIcon className="size-4.5 text-[var(--ws-accent)]" aria-hidden />
              <p className="truncate text-label font-semibold text-text-primary">{ws.shortTh}</p>
            </div>
            <p className="mt-1.5 text-caption text-text-muted">{ws.tagline}</p>
          </div>
          <nav aria-label={`เมนู${ws.nameTh}`} className="flex-1 overflow-y-auto px-4 py-5">
            <ul className="space-y-1">
              {ws.nav.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={navTo(workspace, item.path)}
                      end={item.path === ''}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-label transition-colors',
                          isActive
                            ? 'bg-surface-raised font-medium text-text-primary'
                            : 'text-text-secondary hover:bg-surface-raised/60 hover:text-text-primary',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              aria-hidden
                              className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-[var(--ws-accent)]"
                            />
                          )}
                          <Icon
                            className={cn(
                              'size-4.5 shrink-0',
                              isActive ? 'text-[var(--ws-accent)]' : 'text-text-muted',
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
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-border-soft bg-surface-dark/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
              <WorkspaceSwitcher current={workspace} />
              <UserMenu />
            </div>
          </header>

          <main
            id="workspace-main"
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-8 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
          >
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
      </div>

      {/* Mobile bottom navigation — this workspace's modules only */}
      <nav
        aria-label={`เมนูหลัก${ws.nameTh}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-surface-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${ws.nav.length}, minmax(0, 1fr))` }}
        >
          {ws.nav.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={navTo(workspace, item.path)}
                  end={item.path === ''}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.75rem]',
                      isActive ? 'text-[var(--ws-accent)]' : 'text-text-muted',
                    )
                  }
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="max-w-full truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
