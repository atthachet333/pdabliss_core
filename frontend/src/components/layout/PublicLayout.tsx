import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { CookieConsent } from '@/features/consent/CookieConsent';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/locales';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { useLocale } from '@/i18n/useLocale';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { UtilityDock } from './UtilityDock';

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

function Shell() {
  const { t, locale } = useLocale();
  useHashScroll();
  return (
    <CookieConsent>
      <div className="relative flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.shell.skipToContent}
        </a>
        <PublicHeader />
        {/* Page bodies are Thai in every locale until the localization episode. */}
        <main
          id="main"
          tabIndex={-1}
          lang={locale === DEFAULT_LOCALE ? undefined : 'th'}
          className="flex-1 outline-none"
        >
          <Outlet />
        </main>
        <PublicFooter />
        <UtilityDock />
      </div>
    </CookieConsent>
  );
}

/**
 * The shared public shell (EP05): header + mega menus, footer, cookie consent
 * and floating utilities. Every public page renders inside it — pages never
 * build their own navigation or footer. `locale` comes from the route prefix.
 */
export function PublicLayout({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <Shell />
    </LocaleProvider>
  );
}
