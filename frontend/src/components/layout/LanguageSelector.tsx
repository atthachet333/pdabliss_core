import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useDismiss } from '@/components/core/hooks';
import { LOCALE_META, LOCALES, switchLocalePath, type Locale } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { overlayLabel, overlayRow, overlaySurface } from '@/components/ui/overlay';
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
  const { pathname, search, hash } = useLocation();
  // The same page in another locale, keeping its query (plan, interest, role) and hash.
  const target = (l: Locale) => `${switchLocalePath(pathname, '', l)}${search}${hash}`;
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
                  to={target(l)}
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
        // EP18.1: an outlined pill, so it reads as a control; emerald edge while open.
        className={cn(
          'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-label whitespace-nowrap transition-[border-color,background-color,color] duration-200 motion-reduce:transition-none',
          open
            ? 'border-border-brand/60 bg-white/[0.05] text-text-primary'
            : 'border-border-soft text-text-secondary hover:border-border-strong hover:text-text-primary',
        )}
      >
        <Globe className="size-4" aria-hidden />
        <span lang={current.htmlLang}>{current.short}</span>
        <ChevronDown
          className={cn(
            'size-3.5 opacity-60 transition-transform duration-300 motion-reduce:transition-none',
            open && 'rotate-180 opacity-90',
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
            className={cn(
              'absolute top-full right-0 mt-2.5 w-72 overflow-hidden rounded-[1.25rem] p-2',
              overlaySurface,
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/45 to-transparent"
            />
            <p className={cn(overlayLabel, 'px-3 pt-2 pb-2')}>{t.language.label}</p>
            <ul className="space-y-1">
              {LOCALES.map((l) => {
                const meta = LOCALE_META[l];
                const active = l === locale;
                return (
                  <li key={l}>
                    <Link
                      to={target(l)}
                      lang={meta.htmlLang}
                      hrefLang={meta.htmlLang}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setOpen(false)}
                      className={overlayRow(
                        active,
                        cn(
                          'flex min-h-12 items-center gap-3 px-2.5 text-label',
                          active
                            ? 'text-text-primary'
                            : 'text-text-secondary hover:text-text-primary',
                        ),
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-7 min-w-9 items-center justify-center rounded-lg px-1.5 text-caption font-semibold transition-colors duration-200',
                          active
                            ? 'bg-brand-primary/15 text-brand-glow'
                            : 'bg-white/[0.04] text-text-muted group-hover:text-text-secondary',
                        )}
                      >
                        {meta.short}
                      </span>
                      <span className="flex-1">{meta.nativeName}</span>
                      {active && <Check className="size-4 shrink-0 text-brand-glow" aria-hidden />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 border-t border-white/[0.06] px-3 pt-2.5 pb-1.5 text-caption leading-relaxed text-text-muted">
              {t.language.note}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
