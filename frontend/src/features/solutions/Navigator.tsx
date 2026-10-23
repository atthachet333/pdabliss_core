import { ArrowRight, CheckCircle2, CircleDot } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Segmented } from '@/components/ui/Segmented';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { SOLUTIONS_COPY } from './copy';
import { getSolution, NAVIGATOR, SECTION } from './model';

type NavId = (typeof NAVIGATOR)[number];

/** “What is your organization facing?” — a deterministic guide, no form, no data collected. */
export function SolutionNavigator() {
  const c = useCopy(SOLUTIONS_COPY);
  const n = c.navigator;
  const { href } = useLocale();
  const departments = useDepartments();
  const [id, setId] = useState<NavId>('fallingThrough');
  const s = getSolution(id);
  const item = n.items[id]!;
  const story = c.stories[id];
  const primary = departments.find((d) => d.id === s.departments[0])!;
  return (
    <Section id={SECTION.navigator} labelledBy="navigator-title" className="scroll-mt-20">
      <SectionHead id="navigator-title" eyebrow={n.eyebrow} title={n.title} lead={n.lead} />
      <p id="navigator-options" className="mt-10 text-caption font-semibold text-text-muted">
        {n.options}
      </p>
      <Segmented<NavId>
        labelledBy="navigator-options"
        value={id}
        onChange={setId}
        options={NAVIGATOR.map((x) => ({ value: x, label: n.items[x]!.label }))}
        className="mt-2 grid w-full grid-cols-2 sm:grid-cols-4"
      />
      <div
        aria-live="polite"
        data-navigator={id}
        className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[1.75rem] border border-border-soft bg-border-soft lg:grid-cols-4"
      >
        <div className="bg-surface-base p-5">
          <p className="flex items-center gap-1.5 text-caption font-semibold text-warning">
            <CircleDot aria-hidden className="size-3.5" />
            {n.cause}
          </p>
          <p className="mt-2 text-label text-text-primary">{item.cause}</p>
        </div>
        <div className="bg-surface-base p-5">
          <p className="flex items-center gap-1.5 text-caption font-semibold text-brand-soft">
            <CheckCircle2 aria-hidden className="size-3.5" />
            {n.capability}
          </p>
          <ul className="mt-2 space-y-1">
            {story.response.slice(0, 3).map((r) => (
              <li key={r} className="text-label text-text-primary">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-surface-base p-5">
          <p className="text-caption font-semibold text-text-muted">{n.department}</p>
          <Link
            to={href(`/departments/${primary.id}`)}
            data-nav-dept={primary.id}
            className="mt-2 inline-flex min-h-11 items-center gap-2 text-label text-text-primary hover:text-brand-soft"
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: `var(--color-ws-${primary.id})` }}
            />
            {primary.name}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="bg-surface-base p-5">
          <p className="text-caption font-semibold text-text-muted">{n.chapter}</p>
          <Link
            to={href(`/how-core-works#${s.workflow}`)}
            data-nav-workflow={s.workflow}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
          >
            {c.common.workflow}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <a
            href={`#${s.anchor}`}
            data-nav-next={s.anchor}
            className="mt-1 flex min-h-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
          >
            {n.next}: {story.eyebrow.replace(/^\d+\s·\s/, '')}
          </a>
        </div>
      </div>
    </Section>
  );
}

export function SolutionsCta() {
  const c = useCopy(SOLUTIONS_COPY);
  const { href } = useLocale();
  return (
    <Section labelledBy="solutions-cta" className="pb-24 sm:pb-32">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-soft bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,rgb(25_195_154/0.14),transparent_70%)] px-6 py-12 text-center sm:px-12">
        <h2 id="solutions-cta" className="mx-auto max-w-2xl text-h2 text-text-primary">
          {c.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{c.cta.lead}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link to={href('/how-core-works')} className={buttonClasses('primary', 'lg')}>
            {c.cta.how}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to={href('/departments')} className={buttonClasses('secondary', 'lg')}>
            {c.cta.departments}
          </Link>
        </div>
        <Link
          to={href('/contact')}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
        >
          {c.cta.demo}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}
