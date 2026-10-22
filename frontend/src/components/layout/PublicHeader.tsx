import { Globe, LogIn, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';
import { DesktopNav } from './DesktopNav';
import { MobileMenu } from './MobileMenu';

function LanguagePill() {
  return (
    <span
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-caption font-semibold text-text-secondary"
      aria-label="ภาษา: ไทย (ภาษาอังกฤษจะเปิดให้บริการภายหลัง)"
      title="ภาษาอังกฤษจะเปิดให้บริการภายหลัง"
    >
      <Globe className="size-3.5" aria-hidden />
      TH
    </span>
  );
}

/**
 * Public header (EP04). Minimal and transparent over the CORE Universe; after
 * scrolling (or while a menu is open) it becomes smoked glass with a hairline
 * border. Desktop ≥ 1280px: seven mega-menu groups. Below: a full-screen
 * navigation layer. Pricing is reached through Product, not the top bar.
 */
export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Glass state via an IntersectionObserver sentinel — no scroll listener.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the mobile layer on navigation.
  const [lastPath, setLastPath] = useState(location.pathname + location.hash);
  if (lastPath !== location.pathname + location.hash) {
    setLastPath(location.pathname + location.hash);
    setMobileOpen(false);
  }

  const glass = scrolled || mobileOpen || megaOpen;

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-4 w-full" />
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500',
          glass
            ? 'border-b border-border-soft bg-[rgb(5_11_18/0.72)] shadow-[0_12px_40px_-24px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-18 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:max-w-[1440px]">
          <Link to="/" aria-label="PDA BLISS CORE หน้าแรก" className="shrink-0">
            {/* Subtitle only where the full navigation has room for it. */}
            <span className="2xl:hidden">
              <Logo compact />
            </span>
            <span className="hidden 2xl:block">
              <Logo />
            </span>
          </Link>

          <DesktopNav onOpenChange={setMegaOpen} />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline-flex">
              <LanguagePill />
            </span>
            <Link
              to="/contact"
              className="hidden h-10 items-center rounded-full px-3.5 text-label whitespace-nowrap text-text-secondary transition-colors hover:text-text-primary md:inline-flex"
            >
              ติดต่อเรา
            </Link>
            <Link
              to="/login"
              className="hidden h-10 items-center gap-2 rounded-full border border-border-strong bg-surface-raised/50 px-4 text-label whitespace-nowrap text-text-primary transition-colors hover:border-border-brand sm:inline-flex"
            >
              <LogIn className="size-4" aria-hidden />
              เข้าสู่ระบบ
            </Link>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft text-text-primary xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
