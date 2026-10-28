import { motion } from 'framer-motion';
import { ArrowRight, Eye, FileCheck2, GitBranch, KeyRound, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Frame, Stage } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ENTERPRISE } from './copy';
import { StatusKey } from './parts';

/* ------------------------------------------------------------------ */
/* Layered organization — teams → processes → control → visibility      */
/* ------------------------------------------------------------------ */

type LayerId = 'executive' | 'control' | 'process' | 'teams';

/** One architectural slab; narrower as it rises, like a building's floors. */
function Slab({
  id,
  label,
  index,
  inset,
  lit = false,
  children,
}: {
  id: LayerId;
  label: string;
  index: number;
  inset: string;
  lit?: boolean;
  children: ReactNode;
}) {
  const reduce = usePrefersReducedMotion();
  // Rises from the base upward, once.
  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.25 + (3 - index) * 0.22, duration: 0.6, ease: EASE_CORE },
      };
  return (
    <motion.li data-layer={id} className={cn('relative', inset)} {...motionProps}>
      <div
        className={cn(
          'relative flex flex-col gap-3 rounded-2xl px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5 sm:px-5',
          lit
            ? 'bg-[linear-gradient(90deg,rgb(25_195_154/0.2),rgb(25_195_154/0.06))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28),0_18px_60px_-30px_rgb(62_240_192/0.6)]'
            : 'bg-white/[0.035] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]',
        )}
      >
        <p
          className={cn(
            'flex shrink-0 items-center gap-2 text-caption font-semibold sm:w-40',
            lit ? 'text-brand-soft' : 'text-text-secondary',
          )}
        >
          <span aria-hidden className="text-text-muted tabular">
            L{4 - index}
          </span>
          {label}
        </p>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </motion.li>
  );
}

function LayeredOrganization() {
  const c = useCopy(ENTERPRISE).hero;
  const departments = useDepartments();
  const names = DEPT_PAGES.map((d) => ({ id: d, name: departments.find((x) => x.id === d)!.name }));
  return (
    <figure aria-label={c.visual} data-hero-visual className="relative">
      <Stage glow="executive" className="px-3 py-6 sm:px-8 sm:py-10">
        {/* The spine that ties every floor together */}
        <div
          aria-hidden
          className="absolute top-10 bottom-10 left-1/2 w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.7),rgb(62_240_192/0.05))]"
        />
        <ol className="relative space-y-3 sm:space-y-4">
          <Slab id="executive" label={c.layers.executive} index={0} inset="sm:mx-[18%]" lit>
            <p className="flex items-center gap-2 text-label text-text-primary">
              <Eye aria-hidden className="size-4 text-brand-glow" />
              <span className="h-px flex-1 bg-brand-glow/30" />
            </p>
          </Slab>
          <Slab id="control" label={c.layers.control} index={1} inset="sm:mx-[11%]">
            <div className="flex items-center gap-3 text-text-secondary">
              <KeyRound aria-hidden className="size-4" />
              <span className="h-px flex-1 bg-border-strong" />
              <ShieldCheck aria-hidden className="size-4" />
              <span className="h-px flex-1 bg-border-strong" />
              <FileCheck2 aria-hidden className="size-4" />
            </div>
          </Slab>
          <Slab id="process" label={c.layers.process} index={2} inset="sm:mx-[5%]">
            <div aria-hidden className="flex items-center gap-1.5">
              {names.map((d, i) => (
                <span key={d.id} className="flex flex-1 items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: `var(--color-ws-${d.id})` }}
                  />
                  {i < names.length - 1 && (
                    <span className="h-px flex-1 bg-[linear-gradient(90deg,rgb(62_240_192/0.5),rgb(62_240_192/0.15))]" />
                  )}
                </span>
              ))}
              <GitBranch className="size-3.5 shrink-0 text-brand-glow" />
            </div>
          </Slab>
          <Slab id="teams" label={c.layers.teams} index={3} inset="">
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {names.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-1.5 text-caption text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: `var(--color-ws-${d.id})` }}
                  />
                  {d.name}
                </li>
              ))}
            </ul>
          </Slab>
        </ol>
      </Stage>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

export function EnterpriseHero() {
  const c = useCopy(ENTERPRISE);
  const { href } = useLocale();
  return (
    <section aria-labelledby="enterprise-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_75%_30%,rgb(62_224_180/0.1),transparent_70%),radial-gradient(ellipse_50%_50%_at_10%_90%,rgb(90_169_255/0.06),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-16 sm:pt-32 lg:pt-40 lg:pb-24">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)] lg:gap-14">
          <div>
            <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
              <span aria-hidden className="h-px w-6 bg-current opacity-70" />
              {c.hero.eyebrow}
            </p>
            <h1
              id="enterprise-title"
              className="mt-5 text-[clamp(1.875rem,1.05rem+2.9vw,3.5rem)] leading-[1.2] font-semibold tracking-tight text-text-primary"
            >
              {c.hero.title.split('\n').map((line) => (
                <span key={line} className="block">
                  {line.split('|').map((chunk) => (
                    <span key={chunk} className="inline-block">
                      {chunk}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="mt-7 max-w-xl border-l-2 border-brand-primary/50 pl-5 text-body-lg text-text-secondary">
              {c.hero.lead}
            </p>
            <ul className="mt-8 grid max-w-xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {c.hero.pillars.map((p, i) => (
                <li key={p} className="flex items-baseline gap-3 text-label text-text-primary">
                  <span aria-hidden className="text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                to={href('/consultation?topic=enterprise')}
                data-cta="quote"
                className={buttonClasses('primary', 'lg')}
              >
                {c.common.quote}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                to={href('/consultation?topic=consulting')}
                data-cta="talk"
                className={buttonClasses('secondary', 'lg')}
              >
                {c.common.talk}
              </Link>
            </div>
          </div>
          <LayeredOrganization />
        </div>
        <StatusKey className="mt-20 border-t border-border-soft pt-10 lg:mt-24" />
      </Frame>
    </section>
  );
}
