import { motion } from 'framer-motion';
import { ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router';
import { MEGA_GROUPS, type MegaGroupId } from '@/config/navigation';
import { useLocale } from '@/i18n/useLocale';
import { DURATION, EASE_CORE } from '@/motion/tokens';

/** Faint orbit geometry for highlight panels — CORE's mark, at whisper level. */
export function OrbitLines({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 240 240" className={className}>
      <g fill="none" stroke="var(--color-brand-glow)" strokeWidth="0.6">
        <circle cx="120" cy="120" r="96" strokeOpacity="0.5" />
        <circle cx="120" cy="120" r="62" strokeOpacity="0.35" />
        <path d="M24 120h192M120 24v192" strokeOpacity="0.18" strokeDasharray="2 6" />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={120 + 96 * Math.cos(a)}
            cy={120 + 96 * Math.sin(a)}
            r="2.4"
            fill="var(--color-brand-glow)"
            fillOpacity="0.7"
          />
        );
      })}
    </svg>
  );
}

/**
 * Content of one desktop mega menu: an editorial intro, the group's items with
 * descriptions, and a highlight statement panel. Items without a destination
 * render as information (never a dead link).
 */
export function MegaPanel({ id, onNavigate }: { id: MegaGroupId; onNavigate: () => void }) {
  const { t, href } = useLocale();
  const group = MEGA_GROUPS[id];
  const copy = t.nav.groups[id];

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: EASE_CORE }}
      className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)_minmax(0,18rem)] gap-8 px-8 pt-7 pb-8 2xl:max-w-[1440px] 2xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,20rem)] 2xl:gap-10"
    >
      <div className="pt-1">
        <p className="text-caption font-semibold tracking-[0.18em] text-brand-glow/85 uppercase">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-[1.3125rem] leading-[1.45] font-semibold whitespace-pre-line text-text-primary">
          {copy.heading}
        </h2>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-text-secondary">{copy.intro}</p>
        {copy.note && (
          <p className="mt-4 flex items-start gap-2 text-caption text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {copy.note}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-2 content-start gap-1.5 self-start">
        {group.items.map((item) => {
          const Icon = item.icon;
          const text = copy.items[item.id]!;
          const body = (
            <>
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-base/80 transition-colors duration-200 group-hover:border-border-brand">
                <Icon className="size-4 text-brand-soft" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-label font-medium text-text-primary">
                  {text.label}
                  {item.to ? (
                    <ArrowRight
                      className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70 group-focus-visible:translate-x-0 group-focus-visible:opacity-70"
                      aria-hidden
                    />
                  ) : (
                    <span className="rounded-full border border-border-strong px-2 py-px text-[0.6875rem] font-normal text-text-muted">
                      {t.nav.plannedTag}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-caption text-text-muted">
                  {text.description}
                </span>
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {item.to ? (
                <Link
                  to={href(item.to)}
                  onClick={onNavigate}
                  className="group flex items-start gap-3.5 rounded-2xl p-3 transition-colors duration-200 hover:bg-white/[0.035] focus-visible:bg-white/[0.035]"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-start gap-3.5 rounded-2xl p-3 opacity-90">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="relative overflow-hidden rounded-card border border-border-soft bg-[radial-gradient(ellipse_at_85%_0%,rgb(25_195_154/0.14),transparent_62%),linear-gradient(180deg,rgb(12_24_34/0.85),rgb(7_15_22/0.7))] p-6">
        <OrbitLines className="pointer-events-none absolute -right-14 -bottom-16 size-52 opacity-[0.22]" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/40 to-transparent"
        />
        <p className="relative text-[0.75rem] font-semibold tracking-[0.18em] text-brand-glow uppercase">
          {copy.highlight.eyebrow}
        </p>
        <p className="relative mt-3 text-[1.0625rem] leading-[1.6] font-medium whitespace-pre-line text-text-primary">
          {copy.highlight.statement}
        </p>
        {copy.highlight.body && (
          <p className="relative mt-2.5 text-[0.875rem] leading-relaxed text-text-secondary">
            {copy.highlight.body}
          </p>
        )}
        {group.cta && copy.highlight.cta && (
          <Link
            to={href(group.cta)}
            onClick={onNavigate}
            className="group relative mt-5 inline-flex min-h-10 items-center gap-1.5 text-label font-medium text-brand-glow"
          >
            {copy.highlight.cta}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        )}
      </div>
    </motion.div>
  );
}
