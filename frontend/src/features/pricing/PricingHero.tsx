import { ArrowDown, ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { CapabilityStack } from './CapabilityStack';
import { PRICING } from './copy';
import { PLANS, STARTING_PRICE } from './plans';
import { SECTION, scrollToSection, useMoney } from './state';

/** Editorial hero: the idea first, the starting price second, the plans as layers. */
export function PricingHero() {
  const c = useCopy(PRICING);
  const { href } = useLocale();
  const money = useMoney();
  return (
    <section
      aria-labelledby="pricing-title"
      className="relative isolate overflow-hidden pt-28 pb-12 sm:pt-36 sm:pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_78%_35%,rgb(25_195_154/0.14),transparent_72%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-50" />
      </div>
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1
              id="pricing-title"
              className="mt-4 text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] leading-[1.3] font-semibold text-balance whitespace-pre-line text-text-primary"
            >
              {c.hero.title}
            </h1>
            <div className="mt-6 space-y-1 text-body-lg text-text-secondary">
              {c.hero.lead.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-8 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-label text-text-muted">{c.hero.from}</span>
              <span className="text-[2.5rem] leading-none font-semibold text-text-primary tabular">
                {money(STARTING_PRICE)}
              </span>
              <span className="text-body text-text-secondary">{c.currency.perMonth}</span>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`#${SECTION.packages}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(SECTION.packages);
                }}
                className={buttonClasses('primary', 'lg')}
              >
                {c.hero.see}
                <ArrowDown className="size-4" aria-hidden />
              </a>
              <Link
                to={href('/consultation?topic=demo')}
                className={buttonClasses('secondary', 'lg')}
              >
                {c.hero.demo}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {c.hero.facts.map((f) => (
                <li
                  key={f}
                  className="inline-flex items-center gap-2 text-label text-text-secondary"
                >
                  <Check className="size-4 text-brand-glow" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <CapabilityStack level={3} label={c.hero.visual} className="mx-auto max-w-[30rem]" />
            {/* Layer legend: written facts, so nothing depends on the drawing. */}
            <ol className="mx-auto mt-4 grid max-w-[30rem] grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {PLANS.map((p) => (
                <li key={p.id} className="border-l border-border-brand/50 pl-3">
                  <span className="block text-caption text-text-muted">
                    {String(p.level + 1).padStart(2, '0')} · {c.layers[p.layer].name}
                  </span>
                  <span className="block text-label font-semibold text-text-primary">{p.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
