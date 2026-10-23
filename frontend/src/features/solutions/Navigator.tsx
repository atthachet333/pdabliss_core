import { ArrowRight, Check, CircleDot } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { SOLUTIONS_COPY } from './copy';
import { getSolution, NAVIGATOR, SECTION } from './model';
import { Chapter, ChapterTitle, Frame, Kicker, Stage } from './parts';

type NavId = (typeof NAVIGATOR)[number];

/**
 * “What is your organization facing?” — a calm list of symptoms on the left,
 * one focused response on the right. Deterministic; nothing is collected.
 */
export function SolutionNavigator() {
  const c = useCopy(SOLUTIONS_COPY);
  const n = c.navigator;
  const { href } = useLocale();
  const departments = useDepartments();
  const [id, setId] = useState<NavId>('fallingThrough');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = getSolution(id);
  const item = n.items[id]!;
  const story = c.stories[id];
  const primary = departments.find((d) => d.id === s.departments[0])!;
  const index = NAVIGATOR.indexOf(id);

  const onKey = (e: KeyboardEvent) => {
    const move = (i: number) => {
      const next = (i + NAVIGATOR.length) % NAVIGATOR.length;
      setId(NAVIGATOR[next]!);
      refs.current[next]?.focus();
    };
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(index + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(NAVIGATOR.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <Chapter id={SECTION.navigator} labelledBy="navigator-title" space="lg">
      <Frame width="base">
        <div className="max-w-2xl">
          <Kicker tone="clear">{n.eyebrow}</Kicker>
          <ChapterTitle id="navigator-title" className="mt-4">
            {n.title}
          </ChapterTitle>
          <p className="mt-4 text-body text-text-secondary">{n.lead}</p>
        </div>
        <Stage glow="clear" grid={false} className="mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="bg-white/[0.015] p-5 sm:p-8 lg:p-10">
              <p id="navigator-options" className="text-caption font-semibold text-text-muted">
                {n.options}
              </p>
              <div
                role="radiogroup"
                aria-labelledby="navigator-options"
                onKeyDown={onKey}
                className="mt-4 space-y-1"
              >
                {NAVIGATOR.map((x, i) => {
                  const on = x === id;
                  return (
                    <button
                      key={x}
                      ref={(el) => {
                        refs.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setId(x)}
                      className={cn(
                        'relative flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-body transition-[background-color,color] duration-200',
                        on
                          ? 'bg-[linear-gradient(90deg,rgb(25_195_154/0.16),rgb(25_195_154/0.03))] text-text-primary'
                          : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute top-2 bottom-2 left-0 w-0.5 rounded-full transition-colors',
                          on ? 'bg-brand-glow shadow-[0_0_12px_rgb(62_240_192)]' : 'bg-transparent',
                        )}
                      />
                      <span className="text-caption text-text-muted tabular">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1">{n.items[x]!.label}</span>
                      {on && <Check aria-hidden className="size-4 text-brand-glow" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              aria-live="polite"
              data-navigator={id}
              className="flex flex-col p-6 sm:p-10 lg:p-12"
            >
              <p className="flex items-center gap-1.5 text-caption font-semibold text-warning">
                <CircleDot aria-hidden className="size-3.5" />
                {n.cause}
              </p>
              <p className="mt-3 text-[clamp(1.375rem,1.1rem+1vw,2rem)] leading-snug font-semibold text-text-primary">
                {item.cause}
              </p>
              <div className="mt-10 grid grid-cols-1 gap-8 border-t border-white/[0.06] pt-8 sm:grid-cols-2">
                <div>
                  <Kicker tone="clear">{n.capability}</Kicker>
                  <ul className="mt-4 space-y-2">
                    {story.response.slice(0, 3).map((r) => (
                      <li key={r} className="flex items-start gap-2.5 text-label text-text-primary">
                        <span
                          aria-hidden
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-primary/15"
                        >
                          <Check className="size-3 text-brand-glow" />
                        </span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <Kicker tone="muted">{n.department}</Kicker>
                  <Link
                    to={href(`/departments/${primary.id}`)}
                    data-nav-dept={primary.id}
                    className="flex min-h-11 items-center gap-2 text-label text-text-primary hover:text-brand-soft"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-ws-${primary.id})` }}
                    />
                    {primary.name}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <Kicker tone="muted" className="pt-3">
                    {n.chapter}
                  </Kicker>
                  <Link
                    to={href(`/how-core-works#${s.workflow}`)}
                    data-nav-workflow={s.workflow}
                    className="flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
                  >
                    {c.common.workflow}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </div>
              <a
                href={`#${s.anchor}`}
                data-nav-next={s.anchor}
                className="group mt-auto inline-flex min-h-12 items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-5 pt-0 text-label text-text-primary hover:bg-white/[0.06] lg:mt-10"
              >
                <span>
                  <span className="text-text-muted">{n.next} · </span>
                  {story.eyebrow.replace(/^\d+\s·\s/, '')}
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 text-brand-glow transition-transform group-hover:translate-x-0.5"
                />
              </a>
            </div>
          </div>
        </Stage>
      </Frame>
    </Chapter>
  );
}

/** A quiet, spacious ending — How CORE works first, departments second, a demo last. */
export function SolutionsCta() {
  const c = useCopy(SOLUTIONS_COPY);
  const { href } = useLocale();
  return (
    <Chapter labelledBy="solutions-cta" plane="clear" space="lg" className="pb-32 sm:pb-40">
      <Frame width="narrow" className="text-center">
        <h2 id="solutions-cta" className="text-h2 text-balance text-text-primary">
          {c.cta.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-body text-text-secondary">{c.cta.lead}</p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
        >
          {c.cta.demo}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Frame>
    </Chapter>
  );
}
