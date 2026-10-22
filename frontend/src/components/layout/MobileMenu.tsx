import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogIn, MessageSquare } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useBodyScrollLock, useFocusTrap } from '@/components/core/hooks';
import { NAV_GROUPS } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';

/**
 * Phone / tablet navigation (< 1280px): a full-screen layer — not a shrunken
 * mega menu. Groups are large disclosure rows; contact and sign-in stay
 * pinned at the bottom within thumb reach. Escape and the close button
 * dismiss it; focus is trapped while open.
 */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>('product');
  useBodyScrollLock(open);
  useFocusTrap(open, ref);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="เมนู"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast }}
          className="fixed inset-0 top-18 z-40 flex flex-col overflow-hidden bg-[rgb(4_9_14/0.98)] backdrop-blur-xl xl:hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-[-35%] size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.16),transparent_70%)]"
          />
          <nav
            aria-label="เมนูหลัก (มือถือ)"
            className="relative flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-6 sm:px-8"
          >
            <ul className="mx-auto max-w-xl">
              {NAV_GROUPS.map((g, gi) => {
                const isOpen = expanded === g.id;
                return (
                  <motion.li
                    key={g.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * gi, duration: DURATION.base, ease: EASE_CORE }}
                    className="border-b border-border-soft"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`m-${g.id}`}
                      onClick={() => setExpanded(isOpen ? null : g.id)}
                      className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left"
                    >
                      <span>
                        <span className="block text-h3 text-text-primary">{g.label}</span>
                        <span className="mt-0.5 block text-caption text-text-muted">
                          {g.summary}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-5 shrink-0 text-text-muted transition-transform duration-300',
                          isOpen && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`m-${g.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: DURATION.base, ease: EASE_CORE }}
                          className="overflow-hidden"
                        >
                          <ul className="grid gap-1 pb-4 sm:grid-cols-2">
                            {g.links.map((l) => {
                              const Icon = l.icon;
                              return (
                                <li key={l.label}>
                                  <Link
                                    to={l.to}
                                    onClick={onClose}
                                    className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                                  >
                                    <Icon className="size-5 shrink-0 text-brand-soft" aria-hidden />
                                    <span className="min-w-0">
                                      <span className="block text-label font-medium text-text-primary">
                                        {l.label}
                                      </span>
                                      <span className="block text-caption text-text-muted">
                                        {l.description}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                          {g.notes && (
                            <p className="pb-4 text-caption text-text-muted">
                              {g.notes.title}: {g.notes.items.join(' · ')}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </nav>
          <div className="relative border-t border-border-soft bg-surface-dark/80 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
            <div className="mx-auto flex max-w-xl gap-3">
              <Link
                to="/contact"
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border-strong text-label text-text-primary"
              >
                <MessageSquare className="size-4" aria-hidden />
                ติดต่อเรา
              </Link>
              <Link
                to="/login"
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-primary text-label font-medium text-text-inverse"
              >
                <LogIn className="size-4" aria-hidden />
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
