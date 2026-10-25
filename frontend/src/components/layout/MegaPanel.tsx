import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { MEGA_GROUPS, type MegaGroupId } from '@/config/navigation';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { DURATION, EASE_CORE } from '@/motion/tokens';
import { MegaItemMark, MegaVisual } from './MegaVisuals';

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
 * Content of one desktop mega menu (EP18): an editorial intro, the menu's
 * sections — feature rows (icon, label, one line) side by side, then compact
 * index rows of names (departments, industries, reference guides) — and one
 * featured destination. Hierarchy and whitespace instead of a link wall.
 */
export function MegaPanel({ id, onNavigate }: { id: MegaGroupId; onNavigate: () => void }) {
  const { t, href } = useLocale();
  const group = MEGA_GROUPS[id];
  const copy = t.nav.groups[id];
  const features = group.sections.filter((s) => s.kind === 'feature');
  const indexes = group.sections.filter((s) => s.kind === 'index');

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: EASE_CORE }}
      className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,14.5rem)_minmax(0,1fr)_minmax(0,17.5rem)] gap-10 px-8 pt-8 pb-9 2xl:max-w-[1440px] 2xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,19rem)] 2xl:gap-12"
    >
      <div className="pt-1">
        <p className="text-caption font-semibold tracking-[0.18em] text-brand-glow/85 uppercase">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-[1.25rem] leading-[1.45] font-semibold whitespace-pre-line text-text-primary">
          {copy.heading}
        </h2>
        <p className="mt-3 text-[0.875rem] leading-relaxed text-text-secondary">{copy.intro}</p>
      </div>

      <div className="min-w-0 self-start">
        <div
          className={cn(
            'grid gap-x-8 gap-y-6',
            features.length >= 3
              ? 'grid-cols-3'
              : features.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-1',
          )}
        >
          {features.map((section) => (
            <div key={section.id} data-mega-section={section.id} className="min-w-0">
              <p className="px-3 text-caption font-medium text-text-muted">
                {copy.sections[section.id]}
              </p>
              {/* A lone section spreads its rows across the width instead of one narrow column. */}
              <ul
                className={cn(
                  'mt-2',
                  features.length === 1 ? 'grid grid-cols-3 gap-x-4 gap-y-0.5' : 'space-y-0.5',
                )}
              >
                {section.items.map((item) => {
                  const text = copy.items[item.id]!;
                  return (
                    <li key={item.id}>
                      <Link
                        to={href(item.to)}
                        onClick={onNavigate}
                        className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-white/[0.035] focus-visible:bg-white/[0.035]"
                      >
                        <MegaItemMark item={item} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-label font-medium text-text-primary">
                            {text.label}
                            <ArrowRight
                              className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70 group-focus-visible:translate-x-0 group-focus-visible:opacity-70 motion-reduce:transition-none"
                              aria-hidden
                            />
                          </span>
                          {text.description && (
                            <span className="mt-0.5 block text-caption leading-snug text-text-muted">
                              {text.description}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {indexes.map((section) => (
          <div
            key={section.id}
            data-mega-section={section.id}
            className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft px-3 pt-4"
          >
            <p className="text-caption font-medium text-text-muted">{copy.sections[section.id]}</p>
            <ul className="-ml-2.5 flex flex-wrap gap-x-0.5 gap-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={href(item.to)}
                    onClick={onNavigate}
                    className="inline-flex min-h-9 items-center rounded-full px-2.5 text-label text-text-secondary transition-colors duration-200 hover:bg-white/[0.04] hover:text-text-primary focus-visible:text-text-primary"
                  >
                    {copy.items[item.id]!.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative self-start overflow-hidden rounded-card border border-border-soft bg-[linear-gradient(180deg,rgb(12_24_34/0.85),rgb(7_15_22/0.7))] p-5">
        <OrbitLines className="pointer-events-none absolute -right-14 -bottom-16 size-52 opacity-[0.16]" />
        <MegaVisual id={id} />
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
        <Link
          to={href(group.cta)}
          onClick={onNavigate}
          data-mega-cta
          className="group relative mt-5 inline-flex min-h-10 items-center gap-1.5 text-label font-medium text-brand-glow"
        >
          {copy.highlight.cta}
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </Link>
      </div>
    </motion.div>
  );
}
