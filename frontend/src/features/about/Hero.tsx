import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { useMediaQuery } from '@/components/core/hooks';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { companyName } from '@/config/company';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ABOUT } from './copy';
import { ABOUT_LINKS } from './model';
import { usePlayOnce, useSceneScroll } from './motion';
import { ABOUT_SCENES } from './scenes/copy';
import { HeroScene, HeroStages } from './scenes/HeroScene';

/*
 * /about hero (EP13): the approved statement over a full-width scene in which
 * real work becomes one CORE state. Desktop: the scene follows native scroll
 * through a pinned viewport (never intercepted). Phones: it plays once when
 * seen. Reduced motion: the final, calm composition.
 */

function Statement({ className }: { className?: string }) {
  const c = useCopy(ABOUT).hero;
  const { href, locale } = useLocale();
  return (
    <div className={className}>
      <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
        <span aria-hidden className="h-px w-6 bg-current opacity-70" />
        <span lang={locale === 'th' ? 'th' : undefined}>{companyName(locale)}</span>
      </p>
      <h1
        id="about-title"
        // Sized by width and height, so the pinned statement fits short viewports (1280×720).
        className="mt-6 text-[clamp(1.75rem,min(1.05rem+3vw,0.6rem+5.6vh),4rem)] leading-[1.18] font-semibold tracking-tight [@media(max-height:50rem)]:mt-3"
      >
        <span className="block text-text-muted">
          <Lines text={c.titleA} />
        </span>
        <span className="mt-4 block text-text-primary sm:mt-5 [@media(max-height:50rem)]:mt-2">
          <Lines text={c.titleB} />
        </span>
      </h1>
      <p className="mt-8 max-w-xl border-l-2 border-brand-primary/50 pl-5 text-body-lg text-text-secondary [@media(max-height:50rem)]:mt-4 [@media(max-height:50rem)]:text-body">
        {c.lead}
      </p>
      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center [@media(max-height:50rem)]:mt-5">
        <Link
          to={href(ABOUT_LINKS.consult)}
          data-cta="talk"
          className={buttonClasses('primary', 'lg')}
        >
          {c.talk}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          to={href(ABOUT_LINKS.whyCore)}
          data-cta="why"
          className={buttonClasses('secondary', 'lg')}
        >
          {c.why}
        </Link>
      </div>
    </div>
  );
}

/** Faint distant system lines — the depth layer behind everything. */
function DistantLines() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 -z-10 size-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {[18, 32, 46, 60, 74].map((y) => (
        <line
          key={y}
          x1="0"
          x2="100"
          y1={y}
          y2={y}
          stroke="#3ef0c0"
          strokeOpacity="0.05"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {[52, 72, 92].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="0"
          y2="100"
          stroke="#a3b8b2"
          strokeOpacity="0.035"
          strokeDasharray="2 6"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export function AboutHero() {
  const s = useCopy(ABOUT_SCENES).hero;
  const wide = useMediaQuery('(min-width: 64rem)');
  const reduce = usePrefersReducedMotion();
  const pinRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const scrolled = useSceneScroll(pinRef, ['start start', 'end end'], wide);
  const played = usePlayOnce(compactRef, 5.5, !wide);
  const progress = wide ? scrolled : played;

  const backdrop = (
    <div
      aria-hidden
      className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_55%_50%_at_78%_45%,rgb(62_224_180/0.08),transparent_70%),radial-gradient(ellipse_45%_45%_at_5%_90%,rgb(245_184_75/0.05),transparent_70%)]"
    />
  );

  if (wide) {
    const stage = (
      <div className="relative isolate h-full overflow-hidden">
        {backdrop}
        <DistantLines />
        <figure aria-label={s.visual} className="absolute inset-0 m-0">
          <HeroScene progress={progress} layout="wide" className="absolute inset-0" />
        </figure>
        {/* Keeps the statement legible over loose fragments behind it */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[58%] bg-[linear-gradient(90deg,#050b12_0%,rgb(5_11_18/0.88)_55%,transparent)]"
        />
        <Frame
          width="wide"
          className="pointer-events-none relative flex h-full flex-col justify-center-safe pt-20 pb-28"
        >
          <Statement className="pointer-events-auto max-w-[min(46vw,44rem)]" />
        </Frame>
        <Frame width="wide" className="absolute inset-x-0 bottom-8">
          <HeroStages progress={progress} className="ml-auto max-w-3xl" />
        </Frame>
      </div>
    );
    return (
      <section aria-labelledby="about-title" data-hero="wide" className="relative">
        {reduce ? (
          <div className="h-svh min-h-[46rem]">{stage}</div>
        ) : (
          // Native scroll only: the pin is a tall section with a sticky viewport.
          <div ref={pinRef} className="relative h-[240vh]">
            <div className="sticky top-0 h-svh min-h-[40rem]">{stage}</div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="about-title"
      data-hero="compact"
      className="relative isolate overflow-hidden"
    >
      {backdrop}
      <Frame width="wide" className="pt-28 pb-20 sm:pt-32">
        <Statement />
        <figure aria-label={s.visual} className="relative m-0 mt-14">
          <div ref={compactRef} className="relative">
            <DistantLines />
            <HeroScene progress={progress} layout="compact" className="relative h-[30rem] w-full" />
          </div>
        </figure>
        <HeroStages progress={progress} className="mt-6" />
      </Frame>
    </section>
  );
}
