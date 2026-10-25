import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { MEGA_GROUPS, type MegaGroupId } from '@/config/navigation';
import { useLocale } from '@/i18n/useLocale';
import { overlayChip, overlayLabel, overlayRow } from '@/components/ui/overlay';
import { cn } from '@/lib/cn';
import { basePath } from '@/lib/seo';
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

/** Department chips carry their workspace colour (a dot, beside the words). */
const DEPT_DOT: Record<string, string> = {
  executive: 'var(--color-ws-executive)',
  sales: 'var(--color-ws-sales)',
  operations: 'var(--color-ws-operations)',
  warehouse: 'var(--color-ws-warehouse)',
  purchasing: 'var(--color-ws-purchasing)',
  accounting: 'var(--color-ws-accounting)',
};

/** The page a menu link points at, without its hash or query. */
const pathOf = (to: string) => to.split('#')[0]!.split('?')[0]!;

/**
 * Content of one desktop mega menu (EP18; finish refined in EP18.1): an
 * editorial intro, the menu's sections — feature rows in quiet trays, then a
 * compact index of chips (departments, industries, reference guides) — and
 * one featured destination. The page you are on is marked as current.
 */
export function MegaPanel({ id, onNavigate }: { id: MegaGroupId; onNavigate: () => void }) {
  const { t, href } = useLocale();
  const here = basePath(useLocation().pathname);
  const group = MEGA_GROUPS[id];
  const copy = t.nav.groups[id];
  const features = group.sections.filter((s) => s.kind === 'feature');
  const indexes = group.sections.filter((s) => s.kind === 'index');
  const isHere = (to: string) => !to.includes('#') && pathOf(to) === here;

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.fast, ease: EASE_CORE }}
      className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,17.5rem)] gap-9 px-8 pt-7 pb-8 2xl:max-w-[1440px] 2xl:grid-cols-[minmax(0,15.5rem)_minmax(0,1fr)_minmax(0,19rem)] 2xl:gap-11"
    >
      <div className="pt-2">
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
            'grid gap-3',
            features.length >= 3
              ? 'grid-cols-3'
              : features.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-1',
          )}
        >
          {features.map((section) => (
            <div
              key={section.id}
              data-mega-section={section.id}
              className="min-w-0 rounded-2xl bg-white/[0.018] p-2 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)]"
            >
              <p className={cn(overlayLabel, 'px-3 pt-2 pb-1.5')}>{copy.sections[section.id]}</p>
              {/* A lone section spreads its rows across the width instead of one narrow column. */}
              <ul className={cn(features.length === 1 ? 'grid grid-cols-3 gap-1' : 'space-y-1')}>
                {section.items.map((item) => {
                  const text = copy.items[item.id]!;
                  const current = isHere(item.to);
                  return (
                    <li key={item.id}>
                      <Link
                        to={href(item.to)}
                        onClick={onNavigate}
                        aria-current={current ? 'page' : undefined}
                        className={overlayRow(current, 'flex items-start gap-3 px-3 py-2.5')}
                      >
                        <MegaItemMark item={item} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-label font-medium text-text-primary">
                            {text.label}
                            <ArrowRight
                              className="size-3.5 -translate-x-1 text-brand-soft opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-80 group-focus-visible:translate-x-0 group-focus-visible:opacity-80 motion-reduce:transition-none"
                              aria-hidden
                            />
                          </span>
                          {text.description && (
                            <span className="mt-0.5 block text-caption leading-snug text-text-muted transition-colors duration-200 group-hover:text-text-secondary">
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
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)]"
          >
            <p className={cn(overlayLabel, 'shrink-0')}>{copy.sections[section.id]}</p>
            <ul className="flex flex-wrap gap-1.5">
              {section.items.map((item) => {
                const current = isHere(item.to);
                return (
                  <li key={item.id}>
                    <Link
                      to={href(item.to)}
                      onClick={onNavigate}
                      aria-current={current ? 'page' : undefined}
                      className={overlayChip(current)}
                    >
                      {DEPT_DOT[item.id] && (
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: DEPT_DOT[item.id] }}
                        />
                      )}
                      {copy.items[item.id]!.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative self-start overflow-hidden rounded-card border border-border-brand/25 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgb(25_195_154/0.1),transparent_70%),linear-gradient(180deg,rgb(13_26_36),rgb(7_15_22))] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-glow/50 to-transparent"
        />
        <OrbitLines className="pointer-events-none absolute -right-14 -bottom-16 size-52 opacity-[0.14]" />
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
          className="group relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-border-brand/50 bg-brand-primary/10 px-4 text-label font-medium text-brand-glow transition-colors duration-200 hover:border-brand-glow/70 hover:bg-brand-primary/20 motion-reduce:transition-none"
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
