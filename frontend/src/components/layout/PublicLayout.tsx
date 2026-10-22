import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';

/**
 * Scrolls to `#hash` targets after client-side navigation (e.g. a mega-menu
 * link to `/#connected-flow` from another page). Retries briefly because the
 * homepage chapters may still be mounting.
 */
function useHashScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    let frame = 0;
    const attempt = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView?.({ block: 'start' });
      else if (tries++ < 30) frame = requestAnimationFrame(attempt);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
}

export function PublicLayout() {
  useHashScroll();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
