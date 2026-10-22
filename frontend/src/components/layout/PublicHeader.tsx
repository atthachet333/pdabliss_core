import { LogIn, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { useMediaQuery } from '@/components/core/hooks';
import { NAV_DESKTOP_QUERY } from '@/config/navigation';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { DesktopNav } from './DesktopNav';
import { LanguageSelector } from './LanguageSelector';
import { MobileMenu } from './MobileMenu';

/**
 * Public header (EP05). Near-transparent over the page top; after scrolling
 * (or while a menu is open) it becomes smoked glass with a hairline border.
 * Desktop (≥ nav breakpoint): the Thai IA with mega menus. Below: a
 * dedicated full-screen navigation layer.
 */
export function PublicHeader() {
  const { t, href } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const desktop = useMediaQuery(NAV_DESKTOP_QUERY);

  // Glass state via an IntersectionObserver sentinel — no scroll listener.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the mobile layer on navigation, and when the viewport grows into
  // the desktop layout (otherwise its scroll lock would outlive it).
  const [lastPath, setLastPath] = useState(location.pathname + location.hash);
  if (lastPath !== location.pathname + location.hash) {
    setLastPath(location.pathname + location.hash);
    setMobileOpen(false);
  }
  if (desktop && mobileOpen) setMobileOpen(false);

  const glass = scrolled || megaOpen;

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-4 w-full" />
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500',
          glass
            ? 'border-b border-border-soft bg-[rgb(5_11_18/0.74)] shadow-[0_12px_40px_-26px_rgb(0_0_0/0.8)] backdrop-blur-lg backdrop-saturate-150'
            : 'border-b border-transparent bg-gradient-to-b from-[rgb(5_11_18/0.35)] to-transparent',
        )}
      >
        <div className="mx-auto flex h-18 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 2xl:max-w-[1440px]">
          <Link to={href('/')} aria-label={t.shell.home} className="shrink-0">
            {/* Subtitle only where the full navigation has generous room. */}
            <span className="min-[1680px]:hidden">
              <Logo compact />
            </span>
            <span className="hidden min-[1680px]:block">
              <Logo />
            </span>
          </Link>

          <DesktopNav onOpenChange={setMegaOpen} />

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <span className="hidden sm:inline-flex">
              <LanguageSelector />
            </span>
            <Link
              to="/login"
              className="hidden h-10 items-center gap-2 rounded-full border border-border-strong bg-surface-raised/50 px-4 text-label whitespace-nowrap text-text-primary transition-colors hover:border-border-brand sm:inline-flex"
            >
              <LogIn className="size-4" aria-hidden />
              {t.header.login}
            </Link>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft text-text-primary nav:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={t.header.openMenu}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
