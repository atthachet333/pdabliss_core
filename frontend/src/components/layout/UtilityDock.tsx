import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  CalendarCheck,
  Mail,
  MessageCircle,
  MessageCircleMore,
  Phone,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useDismiss } from '@/components/core/hooks';
import { CONTACT, mailtoHref, telHref } from '@/config/contact';
import { useConsent } from '@/features/consent/consent';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { stripLocale } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { overlaySurface } from '@/components/ui/overlay';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';

/** Back-to-top appears after roughly one screen of scrolling. */
const pastTop = () => window.scrollY > Math.max(560, window.innerHeight * 0.9);
/**
 * On the homepage the dock waits until the CORE World section — the scene,
 * its world cards and the department selector — has mostly left the screen.
 */
const pastHero = () => {
  const hero = document.getElementById('core-world');
  return hero ? hero.getBoundingClientRect().bottom < window.innerHeight * 0.55 : true;
};

function useScrolledPast(test: () => boolean) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const update = () => setPast(test());
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [test]);
  return past;
}

const dockButton =
  'relative inline-flex items-center justify-center rounded-full border border-border-soft bg-[rgb(7_14_21/0.82)] text-text-primary shadow-[0_0_0_1px_rgb(25_195_154/0.18),0_14px_36px_-14px_rgb(0_0_0/0.85)] backdrop-blur-xl transition-[border-color,box-shadow,color] duration-300 hover:border-border-brand hover:shadow-[0_0_0_1px_rgb(62_240_192/0.35),0_0_22px_-6px_rgb(62_240_192/0.45)]';

const itemMotion = {
  hidden: { opacity: 0, y: 10 },
  // Reveal upward: the item nearest the trigger first.
  visible: (fromBottom: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: fromBottom * 0.045, duration: DURATION.base, ease: EASE_CORE },
  }),
  exit: { opacity: 0, y: 6, transition: { duration: DURATION.instant } },
};

function ActionBody({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-primary/20 bg-[linear-gradient(160deg,rgb(11_94_79/0.45),rgb(8_18_27/0.9))]">
        <Icon className="size-[1.125rem] text-brand-soft" aria-hidden />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-label font-medium text-text-primary">{title}</span>
        <span className="block truncate text-caption text-text-muted">{detail}</span>
      </span>
    </>
  );
}

const actionClass =
  'group flex min-h-16 w-full items-center gap-3.5 rounded-2xl border border-border-soft bg-[rgb(9_19_27/0.94)] px-3.5 py-3 transition-[border-color,background-color] duration-200 hover:border-border-brand hover:bg-[rgb(12_28_36/0.96)]';

/**
 * Floating public utilities (EP05): back-to-top and a contact control that
 * expands into a stack of contact actions. Subtle until the visitor uses it;
 * hidden on small screens while the cookie banner asks for a decision.
 */
export function UtilityDock() {
  const { t, href } = useLocale();
  const consent = useConsent();
  const reduced = usePrefersReducedMotion();
  const scrolled = useScrolledPast(pastTop);
  const heroGone = useScrolledPast(pastHero);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();
  const location = useLocation();
  const onHome = stripLocale(location.pathname) === '/';

  // Close on navigation (e.g. after choosing "ขอรับคำปรึกษา").
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  useDismiss(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === 'escape') triggerRef.current?.focus();
  });

  // Move focus into the stack when it opens.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    // The button hides near the top — keep focus in the page, at its start.
    document.getElementById('main')?.focus({ preventScroll: true });
  };

  const actions: {
    key: string;
    icon: LucideIcon;
    title: string;
    detail: string;
    render: (body: ReactNode) => ReactNode;
  }[] = [
    {
      key: 'call',
      icon: Phone,
      title: t.utility.call,
      detail: `${CONTACT.phone.display} (${t.contact.phoneLabel})`,
      render: (body) => (
        <a href={telHref()} className={actionClass}>
          {body}
        </a>
      ),
    },
    {
      key: 'line',
      icon: MessageCircle,
      title: t.utility.line,
      detail: CONTACT.lineId,
      render: (body) => (
        <a href={CONTACT.lineUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
          {body}
          <span className="sr-only">{t.contact.opensInNewTab}</span>
        </a>
      ),
    },
    {
      key: 'email',
      icon: Mail,
      title: t.utility.email,
      detail: CONTACT.email,
      render: (body) => (
        <a href={mailtoHref()} className={actionClass}>
          {body}
        </a>
      ),
    },
    {
      key: 'consult',
      icon: CalendarCheck,
      title: t.utility.consult,
      detail: t.utility.consultDetail,
      render: (body) => (
        <Link to={href('/contact')} className={actionClass} onClick={() => setOpen(false)}>
          {body}
        </Link>
      ),
    },
  ];

  const bannerPending = consent === null;
  const overHero = onHome && !heroGone && !open;

  return (
    // EP19: a labelled complementary landmark, so nothing on the page sits outside landmarks.
    <aside
      ref={rootRef}
      aria-label={t.utility.label}
      data-shell="utility-dock"
      onBlur={(e) => {
        // Tabbing out of the dock closes the stack (pointer clicks are handled by useDismiss).
        const next = e.relatedTarget as Node | null;
        if (open && next && !e.currentTarget.contains(next)) setOpen(false);
      }}
      className={cn(
        'fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 print:hidden',
        // On phones the cookie banner spans the width: the dock waits for the decision.
        bannerPending && 'max-md:hidden',
        // Never sits on top of the homepage CORE stage controls.
        overHero && 'pointer-events-none invisible opacity-0',
        'transition-[opacity,visibility] duration-300',
      )}
      aria-hidden={overHero || undefined}
    >
      <AnimatePresence>
        {open && (
          <>
            {/* Phones: dim the page so the stack reads as one focused layer. */}
            <motion.div
              key="scrim"
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 -z-10 bg-[rgb(2_6_10/0.55)] sm:hidden"
            />
            <motion.div
              key="panel"
              ref={panelRef}
              id={panelId}
              role="region"
              aria-labelledby={titleId}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-full sm:mb-3 sm:w-[21rem]"
            >
              {/* EP18.1: the shared overlay surface, as in the header menus. */}
              <div
                className={cn('relative overflow-hidden rounded-[1.5rem] p-2.5', overlaySurface)}
              >
                {/* Quiet CORE geometry behind the stack. */}
                <svg
                  aria-hidden
                  viewBox="0 0 200 200"
                  className="pointer-events-none absolute -top-16 -right-16 size-56 opacity-[0.14]"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="var(--color-brand-glow)"
                    strokeWidth="0.6"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="44"
                    fill="none"
                    stroke="var(--color-brand-glow)"
                    strokeWidth="0.6"
                  />
                  <circle cx="100" cy="30" r="2.5" fill="var(--color-brand-glow)" />
                  <circle cx="160.6" cy="135" r="2.5" fill="var(--color-brand-glow)" />
                  <circle cx="39.4" cy="135" r="2.5" fill="var(--color-brand-glow)" />
                </svg>
                <motion.div
                  variants={itemMotion}
                  custom={actions.length}
                  className="relative px-2.5 pt-1.5 pb-2.5"
                >
                  <p id={titleId} className="text-label font-semibold text-text-primary">
                    {t.utility.panelTitle}
                  </p>
                  <p className="text-caption text-text-muted">{t.utility.panelIntro}</p>
                </motion.div>
                <ul className="relative space-y-1.5">
                  {actions.map((a, index) => (
                    <motion.li
                      key={a.key}
                      variants={itemMotion}
                      custom={actions.length - 1 - index}
                    >
                      {a.render(<ActionBody icon={a.icon} title={a.title} detail={a.detail} />)}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scrolled && !open && (
          <motion.button
            key="top"
            type="button"
            onClick={backToTop}
            aria-label={t.utility.backToTop}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: DURATION.fast, ease: EASE_CORE }}
            className={cn(dockButton, 'size-11')}
          >
            <ArrowUp className="size-[1.125rem]" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t.utility.closeContact : t.utility.openContact}
        onClick={() => setOpen((v) => !v)}
        className={cn(dockButton, 'size-12', open && 'border-border-brand')}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? 'close' : 'open'}
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: DURATION.instant }}
            className="flex"
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <MessageCircleMore className="size-5 text-brand-soft" aria-hidden />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </aside>
  );
}
