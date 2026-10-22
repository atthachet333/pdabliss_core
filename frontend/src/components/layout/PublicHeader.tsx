import { AnimatePresence, motion } from 'framer-motion';
import { Globe, LogIn, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { LinkButton } from '@/components/ui/Button';
import { PUBLIC_NAV } from '@/config/site';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';

function LanguagePill() {
  return (
    <span
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft px-3 text-caption font-semibold text-text-secondary"
      aria-label="ภาษา: ไทย (ภาษาอังกฤษจะเปิดให้บริการภายหลัง)"
      title="ภาษาอังกฤษจะเปิดให้บริการภายหลัง"
    >
      <Globe className="size-3.5" aria-hidden />
      TH
    </span>
  );
}

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Header background toggles via an IntersectionObserver sentinel — no scroll listener.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the mobile sheet on navigation.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-4 w-full" />
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500',
          scrolled || open
            ? 'border-b border-border-soft bg-[rgb(5_11_18/0.72)] shadow-[0_12px_40px_-24px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex h-18 max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="PDA BLISS CORE หน้าแรก" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group relative rounded-full px-3.5 py-2 text-label transition-colors duration-300',
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        {!isActive && (
                          <span
                            aria-hidden
                            className="absolute inset-x-5 -bottom-0.5 h-px origin-left scale-x-0 bg-border-strong transition-transform duration-300 ease-out group-hover:scale-x-100"
                          />
                        )}
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-brand-glow to-transparent"
                            transition={{ duration: DURATION.base, ease: EASE_CORE }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex">
              <LanguagePill />
            </span>
            <span className="hidden sm:inline-flex">
              <LinkButton to="/login" variant="secondary" className="h-10 px-4">
                <LogIn className="size-4" aria-hidden />
                เข้าสู่ระบบ
              </LinkButton>
            </span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft text-text-primary lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="เมนู"
            className="fixed inset-0 top-18 z-40 overflow-y-auto bg-surface-dark/97 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fast }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 right-[-30%] size-[32rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.2),transparent_70%)]"
            />
            <nav aria-label="เมนูหลัก (มือถือ)" className="relative px-6 pt-8 pb-12">
              <ul className="space-y-1">
                {PUBLIC_NAV.map((item, i) => (
                  <motion.li
                    key={item.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, duration: DURATION.base, ease: EASE_CORE }}
                  >
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between border-b border-border-soft py-4 text-h3',
                          isActive ? 'text-brand-glow' : 'text-text-primary',
                        )
                      }
                    >
                      {item.label}
                      <span aria-hidden className="text-caption text-text-muted">
                        0{i + 1}
                      </span>
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-3">
                <LinkButton to="/login" size="lg" className="flex-1">
                  <LogIn className="size-4" aria-hidden />
                  เข้าสู่ระบบ
                </LinkButton>
                <LanguagePill />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
