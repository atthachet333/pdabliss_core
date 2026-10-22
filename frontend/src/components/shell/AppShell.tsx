import { motion } from 'framer-motion';
import { Bell, FlaskConical, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { LogoMark } from '@/components/brand/Logo';
import { IconButton, PageSkeleton, useHotkey, useMediaQuery } from '@/components/core';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { rememberWorkspace } from '@/prototype/session';
import { WorkspaceSwitcher } from '@/prototype/WorkspaceSwitcher';
import { WORKSPACES, workspacePath, type WorkspaceId } from '@/workspaces/registry';
import { MobileNav } from './MobileNav';
import { setNavPreference, useNavPreference } from './navPreference';
import { NotificationCenter } from './NotificationCenter';
import { SAMPLE_NOTIFICATIONS } from './notifications';
import { ProfileMenu } from './ProfileMenu';
import { ScanDialog } from './ScanDialog';
import { SearchDialog } from './SearchDialog';
import { SIDEBAR_ID, Sidebar } from './Sidebar';

/** Always visible so the review build is never mistaken for production. */
function PrototypeBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/15 bg-warning/[0.05] px-4 py-1 text-center text-[0.75rem] text-warning">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">ต้นแบบ</strong> ·{' '}
        <span className="max-sm:hidden">โหมดตรวจ UX ด้วยข้อมูลตัวอย่าง — </span>
        ไม่ใช่ระบบเข้าสู่ระบบจริง
      </span>
    </div>
  );
}

/**
 * The one internal application shell.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ top bar: identity · workspace · search · …   │
 *   ├────────────┬─────────────────────────────────┤
 *   │ workspace  │ page                            │
 *   │ nav        │                                 │
 *   └────────────┴─────────────────────────────────┘
 *
 * ≥ 1280px full sidebar · 768–1279px icon rail (expandable) · < 768px bottom
 * bar + "เพิ่มเติม" sheet. Navigation shapes the UI only — it is never access
 * control; the backend authorizes every request.
 */
export function AppShell({ workspace }: { workspace: WorkspaceId }) {
  const ws = WORKSPACES[workspace];
  const WsIcon = ws.icon;
  const location = useLocation();
  const navPref = useNavPreference();
  const wide = useMediaQuery('(min-width: 80rem)');
  const expanded = navPref === 'auto' ? wide : navPref === 'expanded';

  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [unread, setUnread] = useState<ReadonlySet<string>>(
    () => new Set(SAMPLE_NOTIFICATIONS.slice(0, 2).map((n) => n.id)),
  );

  useEffect(() => {
    document.title = `${ws.nameTh} | PDA BLISS CORE`;
    rememberWorkspace(workspace);
  }, [ws.nameTh, workspace]);

  // Drawers, sheets and dialogs portal to <body>, outside this shell — give
  // them the workspace accent too.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ws-accent', ws.accent);
    return () => {
      root.style.removeProperty('--ws-accent');
    };
  }, [ws.accent]);

  useHotkey(
    (e) => ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || e.key === '/',
    () => setSearchOpen(true),
  );

  return (
    <div
      data-nav={navPref}
      className="min-h-dvh bg-canvas text-fg-primary"
      style={{ '--ws-accent': ws.accent } as CSSProperties}
    >
      <a
        href="#workspace-main"
        className="sr-only z-[80] rounded-control bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <PrototypeBanner />

      <header
        aria-label="แถบเครื่องมือ PDA BLISS CORE"
        className="sticky top-0 z-30 border-b border-line bg-nav/90 backdrop-blur-xl"
      >
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4 md:h-16 md:gap-3">
          <IconButton
            icon={expanded ? PanelLeftClose : PanelLeftOpen}
            label={expanded ? 'ย่อเมนูด้านข้าง' : 'ขยายเมนูด้านข้าง'}
            aria-expanded={expanded}
            aria-controls={SIDEBAR_ID}
            onClick={() => setNavPreference(expanded ? 'collapsed' : 'expanded')}
            className="max-md:hidden"
          />
          <Link
            to={workspacePath(workspace)}
            aria-label={`PDA BLISS CORE — หน้าแรกของ${ws.nameTh}`}
            className="flex shrink-0 items-center gap-2.5 rounded-control px-1 py-1"
          >
            <LogoMark className="size-7" />
            <span className="hidden text-[0.8125rem] font-semibold tracking-[0.12em] whitespace-nowrap text-fg-primary lg:block">
              PDA BLISS <span className="text-brand-glow">CORE</span>
            </span>
          </Link>
          <span aria-hidden className="hidden h-5 w-px bg-line-strong sm:block" />
          <p className="flex min-w-0 items-center gap-2 text-label font-medium text-fg-primary">
            <WsIcon
              className="hidden size-4 shrink-0 text-[var(--ws-accent)] sm:block"
              aria-hidden
            />
            <span className="truncate">{ws.shortTh}</span>
          </p>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              aria-label="ค้นหา (Ctrl+K)"
              aria-haspopup="dialog"
              onClick={() => setSearchOpen(true)}
              className="flex size-10 items-center justify-center gap-2.5 rounded-control text-fg-secondary transition-colors hover:bg-fill-hover hover:text-fg-primary md:h-10 md:w-52 md:justify-start md:border md:border-line-strong md:bg-panel md:px-3 lg:w-64"
            >
              <Search className="size-[1.125rem] shrink-0 md:size-4" aria-hidden />
              <span className="hidden flex-1 text-left text-caption text-fg-muted md:block">
                ค้นหา…
              </span>
              <kbd className="hidden rounded border border-line-strong px-1.5 text-[0.6875rem] text-fg-muted lg:block">
                Ctrl K
              </kbd>
            </button>
            <WorkspaceSwitcher current={workspace} />
            <IconButton
              icon={Bell}
              label={
                unread.size ? `การแจ้งเตือน (ยังไม่อ่าน ${unread.size} รายการ)` : 'การแจ้งเตือน'
              }
              aria-haspopup="dialog"
              onClick={() => setNotificationsOpen(true)}
              className="relative"
              indicator={
                unread.size > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 size-2 rounded-full bg-[var(--ws-accent)] ring-2 ring-nav"
                  />
                )
              }
            />
            <ProfileMenu ws={ws} />
          </div>
        </div>
      </header>

      <div className="md:flex">
        <Sidebar ws={ws} />
        <main id="workspace-main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-28 sm:px-6 md:px-8 md:pt-8 md:pb-16 xl:px-10">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </div>
        </main>
      </div>

      <MobileNav ws={ws} onScan={() => setScanOpen(true)} />

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} ws={ws} />
      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        unread={unread}
        onMarkRead={(id) =>
          setUnread((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          })
        }
        onMarkAllRead={() => setUnread(new Set())}
      />
      {ws.scanAction && <ScanDialog open={scanOpen} onClose={() => setScanOpen(false)} />}
    </div>
  );
}
