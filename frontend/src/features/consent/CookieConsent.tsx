import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useBodyScrollLock, useFocusTrap } from '@/components/core/hooks';
import { keepFocusInPage } from '@/components/layout/focus';
import { useLocale } from '@/i18n/useLocale';
import type { CookieCategoryId } from '@/i18n/types';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import {
  ALL_ACCEPTED,
  ESSENTIAL_ONLY,
  saveConsent,
  useConsent,
  type ConsentChoices,
} from './consent';
import { CookieSettingsContext } from './useCookieSettings';

/**
 * Whether the site currently sets cookies of each category. Keep this honest:
 * flip a category to true only in the same change that introduces a tool
 * using it (and gate that tool on the visitor's consent).
 */
const IN_USE: Record<CookieCategoryId, boolean> = {
  essential: true,
  analytics: false,
  preferences: false,
  marketing: false,
};

const OPTIONAL = ['analytics', 'preferences', 'marketing'] as const;

const btn =
  'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-center text-label font-medium leading-tight transition-colors duration-200';
// Accept and reject carry equal weight — no dark patterns.
const btnAccept = cn(btn, 'bg-brand-primary text-text-inverse hover:bg-brand-glow');
const btnReject = cn(
  btn,
  'border border-border-strong bg-surface-overlay/80 text-text-primary hover:border-border-brand',
);
const btnQuiet = cn(
  btn,
  'px-3 text-text-secondary underline-offset-4 hover:text-text-primary hover:underline',
);

/** Fine top edge light shared by the banner and the dialog. */
function EdgeLight() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/55 to-transparent"
    />
  );
}

function CookieBanner({
  onAcceptAll,
  onReject,
  onSettings,
}: {
  onAcceptAll: () => void;
  onReject: () => void;
  onSettings: () => void;
}) {
  const { t, href } = useLocale();
  const titleId = useId();
  return (
    <motion.section
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { delay: 0.5, duration: DURATION.base, ease: EASE_CORE },
      }}
      exit={{ opacity: 0, y: 12, transition: { duration: DURATION.fast, ease: EASE_CORE } }}
      // EP18: a compact notice — one sentence, the honesty note, two equal choices
      // and a quiet settings link; it no longer covers half a phone screen.
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-60 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-[25rem]"
      data-shell="cookie-banner"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border-soft bg-[rgb(7_14_21/0.94)] p-4 shadow-[0_20px_50px_-24px_rgb(0_0_0/0.85)] backdrop-blur-md">
        <EdgeLight />
        <h2 id={titleId} className="text-label font-semibold text-text-primary">
          {t.cookie.title}
        </h2>
        <p className="mt-1 text-caption leading-relaxed text-text-secondary">
          {t.cookie.body} <span className="text-text-muted">{t.cookie.note}</span>{' '}
          <Link
            to={href('/privacy')}
            className="text-brand-soft underline underline-offset-4 hover:text-brand-glow"
          >
            {t.cookie.privacyLink}
          </Link>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={btnAccept} onClick={onAcceptAll}>
            {t.cookie.acceptAll}
          </button>
          <button type="button" className={btnReject} onClick={onReject}>
            {t.cookie.rejectNonEssential}
          </button>
        </div>
        <button type="button" className={cn(btnQuiet, 'mt-1 -ml-3')} onClick={onSettings}>
          {t.cookie.settings}
        </button>
      </div>
    </motion.section>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  labelledBy: string;
  describedBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed',
        checked
          ? 'border-brand-primary/60 bg-brand-primary/80'
          : 'border-border-strong bg-surface-overlay',
        disabled && 'opacity-70',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 items-center justify-center rounded-full bg-text-primary shadow transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      >
        {checked && <Check className="size-3 text-brand-deep" strokeWidth={3} />}
      </span>
    </button>
  );
}

function PreferencesDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: ConsentChoices;
  onSave: (choices: ConsentChoices) => void;
  onClose: () => void;
}) {
  const { t, href } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const baseId = useId();
  const [draft, setDraft] = useState<ConsentChoices>(initial);
  useBodyScrollLock(true);
  useFocusTrap(true, ref, closeRef);

  const categories: CookieCategoryId[] = ['essential', ...OPTIONAL];

  return (
    <motion.div
      className="fixed inset-0 z-80 flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.fast }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[rgb(2_6_10/0.7)] backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: DURATION.base, ease: EASE_CORE }}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-border-soft bg-[rgb(7_14_21/0.97)] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] sm:rounded-[1.75rem]"
      >
        <EdgeLight />
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            <p className="text-caption font-semibold tracking-[0.18em] text-brand-glow/90 uppercase">
              Cookie Preferences
            </p>
            <h2 id={titleId} className="mt-1 text-h3 text-text-primary">
              {t.cookie.prefsTitle}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.cookie.close}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-4 sm:px-7">
          <p className="text-[0.875rem] leading-relaxed text-text-secondary">
            {t.cookie.prefsIntro}{' '}
            <Link
              to={href('/privacy')}
              onClick={onClose}
              className="text-brand-soft underline underline-offset-4 hover:text-brand-glow"
            >
              {t.cookie.privacyLink}
            </Link>
          </p>
          <ul className="mt-5 space-y-3">
            {categories.map((id) => {
              const c = t.cookie.categories[id];
              const essential = id === 'essential';
              const checked = essential ? true : draft[id];
              const titleFor = `${baseId}-${id}-title`;
              const descFor = `${baseId}-${id}-desc`;
              return (
                <li
                  key={id}
                  className="rounded-2xl border border-border-soft bg-surface-base/70 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p id={titleFor} className="text-label font-semibold text-text-primary">
                        {c.title}
                        <span className="ml-2 text-caption font-normal text-text-muted">
                          {c.subtitle}
                        </span>
                      </p>
                      <p
                        className={cn(
                          'mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[0.75rem]',
                          IN_USE[id]
                            ? 'border-brand-primary/30 text-brand-soft'
                            : 'border-border-soft text-text-muted',
                        )}
                      >
                        {essential
                          ? t.cookie.alwaysOn
                          : IN_USE[id]
                            ? t.cookie.inUse
                            : t.cookie.notInUse}
                      </p>
                    </div>
                    <Switch
                      checked={checked}
                      disabled={essential}
                      labelledBy={titleFor}
                      describedBy={descFor}
                      onChange={(next) => setDraft((d) => ({ ...d, [id]: next }))}
                    />
                  </div>
                  <p id={descFor} className="mt-2.5 text-caption text-text-secondary">
                    {c.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-2 border-t border-border-soft bg-surface-dark/60 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-7">
          <button type="button" className={btnReject} onClick={() => onSave(ESSENTIAL_ONLY)}>
            {t.cookie.rejectNonEssential}
          </button>
          <button type="button" className={btnReject} onClick={() => onSave(ALL_ACCEPTED)}>
            {t.cookie.acceptAll}
          </button>
          <button type="button" className={btnAccept} onClick={() => onSave(draft)}>
            {t.cookie.save}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Cookie consent for the public shell: a calm banner until the visitor
 * chooses, and a Cookie Preferences dialog that can be reopened at any time
 * (footer → การตั้งค่าคุกกี้) through useCookieSettings().
 */
export function CookieConsent({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const consent = useConsent();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const value = useMemo(() => ({ openPreferences: () => setPrefsOpen(true) }), []);

  const decide = (choices: ConsentChoices) => {
    saveConsent(choices);
    setPrefsOpen(false);
    setAnnouncement(t.cookie.saved);
    keepFocusInPage(document.querySelector('[data-shell="cookie-banner"]'));
  };

  return (
    <CookieSettingsContext value={value}>
      {children}
      <AnimatePresence>
        {consent === null && !prefsOpen && (
          <CookieBanner
            key="banner"
            onAcceptAll={() => decide(ALL_ACCEPTED)}
            onReject={() => decide(ESSENTIAL_ONLY)}
            onSettings={() => setPrefsOpen(true)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {prefsOpen && (
          <PreferencesDialog
            key="prefs"
            initial={consent ?? ESSENTIAL_ONLY}
            onSave={decide}
            onClose={() => {
              setPrefsOpen(false);
              keepFocusInPage();
            }}
          />
        )}
      </AnimatePresence>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </CookieSettingsContext>
  );
}
