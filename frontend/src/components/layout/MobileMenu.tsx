import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, LogIn, MessageSquare, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { useBodyScrollLock, useFocusTrap } from '@/components/core/hooks';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { overlayChip, overlayLabel, overlayRow } from '@/components/ui/overlay';
import { activeGroup, MEGA_GROUPS, TOP_NAV, type MegaGroupId } from '@/config/navigation';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { basePath } from '@/lib/seo';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { LanguageSelector } from './LanguageSelector';
import { MegaItemMark } from './MegaVisuals';

const rowClass = 'flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left';

/**
 * Phone / tablet navigation (< nav breakpoint): a full-screen layer designed
 * for touch — not a shrunken mega menu. It carries its own top bar with the
 * close button so focus can stay trapped inside. Groups are large disclosure
 * rows; language, contact and sign-in stay within thumb reach at the bottom.
 */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, href, locale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<MegaGroupId | null>(null);
  // EP18.1: mark the section and the page you are on.
  const here = basePath(useLocation().pathname);
  const current = activeGroup(here);
  const isHere = (to: string) => !to.includes('#') && to.split('?')[0] === here;
  useBodyScrollLock(open);
  useFocusTrap(open, ref, closeRef);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t.header.menuDialog}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast }}
          className="fixed inset-0 z-70 flex flex-col overflow-hidden bg-[rgb(4_9_14/0.985)] backdrop-blur-xl nav:hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-[-35%] size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(25_195_154/0.14),transparent_70%)]"
          />
          <div className="relative flex h-18 shrink-0 items-center justify-between gap-4 border-b border-border-soft px-4 sm:px-6 lg:px-8">
            <Link to={href('/')} onClick={onClose} aria-label={t.shell.home}>
              <Logo compact />
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t.header.closeMenu}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft text-text-primary"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav
            aria-label={t.header.primaryNav}
            className="relative flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6 sm:px-8"
          >
            <ul className="mx-auto max-w-xl">
              {TOP_NAV.map((entry, i) => {
                const delay = { delay: 0.025 * i, duration: DURATION.base, ease: EASE_CORE };
                if (entry.kind === 'link') {
                  return (
                    <motion.li
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={delay}
                      className="border-b border-border-soft"
                    >
                      <Link to={href(entry.to)} onClick={onClose} className={rowClass}>
                        <span className="text-[1.25rem] font-semibold text-text-primary">
                          {t.nav[entry.id]}
                        </span>
                        <ArrowRight className="size-5 shrink-0 text-text-muted" aria-hidden />
                      </Link>
                    </motion.li>
                  );
                }
                const group = MEGA_GROUPS[entry.id];
                const copy = t.nav.groups[entry.id];
                const isOpen = expanded === entry.id;
                const isCurrent = current === entry.id;
                return (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={delay}
                    className="border-b border-border-soft"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`m-${entry.id}`}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className={cn(rowClass, 'group')}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2.5 text-[1.25rem] font-semibold text-text-primary">
                          {copy.label}
                          {/* EP18.1: the section you are in, as on desktop (a dot, not a bar). */}
                          {isCurrent && (
                            <span
                              aria-hidden
                              data-current-dot
                              className="size-1.5 rounded-full bg-brand-glow"
                            />
                          )}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block text-[0.6875rem] tracking-[0.16em] uppercase transition-colors duration-200',
                            isOpen ? 'text-brand-glow/80' : 'text-text-muted',
                          )}
                        >
                          {copy.eyebrow}
                        </span>
                      </span>
                      <DisclosureIcon open={isOpen} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`m-${entry.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: DURATION.base, ease: EASE_CORE }}
                          className="overflow-hidden"
                        >
                          {/* EP18.1: the open group hangs from an emerald rail, sections titled with a tick. */}
                          <div className="mb-4 ml-1 border-l border-border-brand/30 pl-3.5">
                            <p className="pb-3 text-caption text-text-secondary">{copy.intro}</p>
                            {/* EP18: the menu's sections — feature rows, then compact name links. */}
                            {group.sections.map((section) => (
                              <div
                                key={section.id}
                                data-mobile-section={section.id}
                                className="pb-3"
                              >
                                <p className={cn(overlayLabel, 'pb-1.5')}>
                                  {copy.sections[section.id]}
                                </p>
                                {section.kind === 'feature' ? (
                                  <ul className="grid gap-1 sm:grid-cols-2">
                                    {section.items.map((item) => {
                                      const text = copy.items[item.id]!;
                                      return (
                                        <li key={item.id}>
                                          <Link
                                            to={href(item.to)}
                                            onClick={onClose}
                                            aria-current={isHere(item.to) ? 'page' : undefined}
                                            className={overlayRow(
                                              isHere(item.to),
                                              'flex min-h-14 items-center gap-3 px-2.5 py-2.5',
                                            )}
                                          >
                                            <MegaItemMark item={item} />
                                            <span className="min-w-0">
                                              <span className="block text-label font-medium text-text-primary">
                                                {text.label}
                                              </span>
                                              {text.description && (
                                                <span className="block text-caption text-text-muted">
                                                  {text.description}
                                                </span>
                                              )}
                                            </span>
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <ul className="flex flex-wrap gap-1.5">
                                    {section.items.map((item) => (
                                      <li key={item.id}>
                                        <Link
                                          to={href(item.to)}
                                          onClick={onClose}
                                          aria-current={isHere(item.to) ? 'page' : undefined}
                                          className={overlayChip(
                                            isHere(item.to),
                                            'min-h-11 px-3.5',
                                          )}
                                        >
                                          {copy.items[item.id]!.label}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                            <Link
                              to={href(group.cta)}
                              onClick={onClose}
                              className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border-brand/40 bg-brand-primary/[0.08] px-4 text-label font-medium text-brand-glow transition-colors hover:bg-brand-primary/[0.14]"
                            >
                              {copy.highlight.cta}
                              <ArrowRight className="size-4 shrink-0" aria-hidden />
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
            <div className="mx-auto mt-6 max-w-xl">
              <p className="mb-2 text-caption font-semibold text-text-muted">{t.language.label}</p>
              <LanguageSelector variant="inline" />
              <p className="mt-2 text-caption text-text-muted">{t.language.note}</p>
            </div>
          </nav>

          <div className="relative border-t border-border-soft bg-surface-dark/80 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
            <div className="mx-auto flex max-w-xl gap-3">
              <Link
                to={href('/contact')}
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border-strong text-label text-text-primary"
              >
                <MessageSquare className="size-4" aria-hidden />
                {t.nav.contact}
              </Link>
              <Link
                to="/login"
                state={{ locale }}
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-primary text-label font-medium text-text-inverse"
              >
                <LogIn className="size-4" aria-hidden />
                {t.header.login}
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
