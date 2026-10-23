import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useDismiss } from '@/components/core/hooks';
import { LOCALE_META, LOCALES, switchLocalePath } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';

/**
 * Language selector. Each option is a real link to the same page in that
 * locale (/, /en, /zh …), so switching is shareable and crawlable.
 *
 * `variant="menu"`: compact header button with a popover (desktop/tablet).
 * `variant="inline"`: a three-way segmented control (mobile navigation).
 */
export function LanguageSelector({ variant = 'menu' }: { variant?: 'menu' | 'inline' }) {
  const { locale, t } = useLocale();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useDismiss(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === 'escape') buttonRef.current?.focus();
  });

  const current = LOCALE_META[locale];

  if (variant === 'inline') {
    return (
      <nav aria-label={t.language.label}>
        <ul className="grid grid-cols-3 gap-1 rounded-2xl border border-border-soft bg-surface-base/60 p-1">
          {LOCALES.map((l) => {
            const meta = LOCALE_META[l];
            const active = l === locale;
            return (
              <li key={l}>
                <Link
                  to={switchLocalePath(pathname, hash, l)}
                  lang={meta.htmlLang}
                  hrefLang={meta.htmlLang}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 items-center justify-center rounded-xl px-2 text-label transition-colors',
                    active
                      ? 'bg-surface-highlight text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {meta.nativeName}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (open && next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t.language.current(current.nativeName)}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-label whitespace-nowrap transition-colors duration-200',
          open ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        )}
      >
        <Globe className="size-4" aria-hidden />
        <span lang={current.htmlLang}>{current.short}</span>
        <ChevronDown
          className={cn(
            'size-3.5 opacity-60 transition-transform duration-300',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className="absolute top-full right-0 mt-2 w-72 overflow-hidden rounded-[1.25rem] border border-border-soft bg-[rgb(6_13_20)] p-2 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9)] backdrop-blur-xl"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/45 to-transparent"
            />
            <p className="px-3 pt-2 pb-1.5 text-caption font-semibold text-text-muted">
              {t.language.label}
            </p>
            <ul>
              {LOCALES.map((l) => {
                const meta = LOCALE_META[l];
                const active = l === locale;
                return (
                  <li key={l}>
                    <Link
                      to={switchLocalePath(pathname, hash, l)}
                      lang={meta.htmlLang}
                      hrefLang={meta.htmlLang}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-label transition-colors',
                        active
                          ? 'bg-white/[0.04] text-text-primary'
                          : 'text-text-secondary hover:bg-white/[0.035] hover:text-text-primary',
                      )}
                    >
                      <span>{meta.nativeName}</span>
                      <span className="flex items-center gap-2 text-caption text-text-muted">
                        {meta.short}
                        {active && <Check className="size-4 text-brand-glow" aria-hidden />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 border-t border-border-soft px-3 pt-2.5 pb-2 text-caption text-text-muted">
              {t.language.note}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
