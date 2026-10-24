import { motion } from 'framer-motion';
import { ArrowRight, Ban, Check, CircleDot, Eye, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { GUARDS } from '@/features/about/model';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { DeptDot, Lines, QuietLink, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { Reveal } from '@/motion/Reveal';
import { WHY_CORE } from './copy';
import {
  EXCESS,
  MODULES,
  NOT_NEEDED,
  SIGNALS,
  VIEWERS,
  WHY_CHAPTER,
  WHY_LINKS,
  type Module,
  type Viewer,
} from './model';

function useDeptName() {
  const departments = useDepartments();
  return (id: string) => departments.find((d) => d.id === id)!.name;
}

/* ------------------------------------------------------------------ */
/* 02 ONE LARGE SYSTEM → CORE — view the same organization as anyone    */
/* ------------------------------------------------------------------ */

/** Which department a module belongs to (pricing and settings belong to no one's daily work). */
const MODULE_OWNER: Partial<Record<Module, Viewer>> = {
  sales: 'sales',
  warehouse: 'warehouse',
  operations: 'operations',
  purchasing: 'purchasing',
  accounting: 'accounting',
  executive: 'executive',
};

function OneLargeSystem({ viewer }: { viewer: Viewer }) {
  const c = useCopy(WHY_CORE).shift;
  const name = useDeptName();
  return (
    <div data-panel="before" className="flex h-full flex-col">
      <p className="text-caption font-semibold tracking-[0.22em] text-text-muted">
        {c.before.label}
      </p>
      <p className="mt-2 text-h3 text-text-primary">{c.before.title}</p>
      <div className="mt-6 flex-1 rounded-2xl bg-[#0a131b] p-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border-soft pb-3">
          <span className="flex items-center gap-2 text-caption text-text-secondary">
            <User aria-hidden className="size-3.5" />
            {name(viewer)}
          </span>
          <span className="text-caption text-text-muted tabular">
            {c.moduleCount(MODULES.length)}
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {MODULES.map((m) => {
            const excess = EXCESS[viewer] === m;
            const own = MODULE_OWNER[m] === viewer;
            return (
              <li
                key={m}
                data-module={m}
                data-excess={excess || undefined}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-caption transition-[background-color,box-shadow] duration-300',
                  excess
                    ? 'bg-warning/10 text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.5)]'
                    : own
                      ? 'bg-white/[0.05] text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.18)]'
                      : 'bg-white/[0.03] text-text-muted',
                )}
              >
                <span className="block truncate">{c.modules[m]}</span>
                <span
                  aria-hidden
                  className="mt-1.5 block h-1 w-3/4 rounded-full bg-current opacity-20"
                />
                {excess && <span className="mt-1.5 block text-[0.6875rem]">{c.excess}</span>}
                {own && (
                  <span className="mt-1.5 block text-[0.6875rem] text-text-secondary">{c.own}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-4 text-label text-text-secondary" data-caption="before">
        {c.beforeCaption(name(viewer))}
      </p>
    </div>
  );
}

function CoreWorkspaces({ viewer }: { viewer: Viewer }) {
  const c = useCopy(WHY_CORE).shift;
  const name = useDeptName();
  const reduce = usePrefersReducedMotion();
  return (
    <div data-panel="after" className="flex h-full flex-col">
      <p className="text-caption font-semibold tracking-[0.22em] text-brand-glow">
        {c.after.label}
      </p>
      <p className="mt-2 text-h3 text-text-primary">{c.after.title}</p>
      <div className="mt-6 flex flex-1 flex-col gap-3">
        <motion.div
          key={viewer}
          data-workspace={viewer}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_CORE }}
          className="rounded-2xl bg-[linear-gradient(180deg,rgb(25_195_154/0.14),rgb(25_195_154/0.04))] p-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]"
        >
          <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
            <DeptDot id={viewer} />
            {name(viewer)}
          </p>
          <ul className="mt-3 space-y-1.5">
            {c.needs[viewer].map((n) => (
              <li key={n} className="flex items-center gap-2 text-caption text-text-primary">
                <Check aria-hidden className="size-3.5 text-brand-glow" />
                {n}
              </li>
            ))}
          </ul>
        </motion.div>
        <ul className="grid grid-cols-5 gap-1.5">
          {VIEWERS.filter((v) => v !== viewer).map((v) => (
            <li
              key={v}
              className="flex flex-col items-center gap-1 rounded-lg bg-white/[0.03] px-1 py-2 text-center text-[0.6875rem] leading-tight text-text-muted"
            >
              <DeptDot id={v} className="size-1.5" />
              <span className="line-clamp-2 w-full break-words">{name(v)}</span>
            </li>
          ))}
        </ul>
        {/* Every workspace reads from — and writes to — the same state */}
        <svg
          aria-hidden
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="block min-h-10 w-full flex-1"
        >
          {[10, 30, 50, 70, 90].map((x) => (
            <path
              key={x}
              d={`M ${x} 0 C ${x} 22, 50 18, 50 40`}
              fill="none"
              stroke="#3ef0c0"
              strokeOpacity="0.35"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-white/[0.04] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.22)]">
          <span className="text-caption text-text-muted">{c.shared}</span>
          <span className="flex items-center gap-2 text-caption font-semibold text-brand-soft tabular">
            <CircleDot aria-hidden className="size-3.5" />
            {c.sharedValue}
          </span>
        </div>
      </div>
      <p className="mt-4 text-label text-text-secondary" data-caption="after">
        {c.afterCaption(name(viewer))}
      </p>
    </div>
  );
}

export function ShiftChapter() {
  const c = useCopy(WHY_CORE).shift;
  const name = useDeptName();
  const [viewer, setViewer] = useState<Viewer>('warehouse');
  return (
    <Chapter id={WHY_CHAPTER.shift} labelledBy="one-system-title" plane="deep" space="lg">
      <Frame width="wide">
        <div className="max-w-4xl">
          <Kicker tone="clear">
            <span className="text-text-muted tabular" aria-hidden>
              02
            </span>
            {c.kicker}
          </Kicker>
          <Reveal>
            <h2
              id="one-system-title"
              className="mt-5 text-[clamp(1.75rem,1.2rem+2.1vw,3.1rem)] leading-[1.22] font-semibold tracking-tight"
            >
              <span className="block text-text-muted">
                <Lines text={c.title} />
              </span>
              <span className="mt-3 block text-gradient-brand">
                <Lines text={c.titleB} />
              </span>
            </h2>
          </Reveal>
          <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.lead}</p>
        </div>

        <div className="mt-12">
          <p id="view-as-label" className="text-caption font-semibold text-text-muted">
            {c.viewAs}
          </p>
          <div
            role="group"
            aria-labelledby="view-as-label"
            data-viewer-select
            className="mt-3 flex flex-wrap gap-2"
          >
            {VIEWERS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={viewer === v}
                data-viewer={v}
                onClick={() => setViewer(v)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label transition-colors',
                  viewer === v
                    ? 'bg-brand-primary/18 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]'
                    : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.07] hover:text-text-primary',
                )}
              >
                <DeptDot id={v} />
                {name(v)}
              </button>
            ))}
          </div>
        </div>

        <Stage glow="executive" className="mt-8 p-4 sm:p-8 lg:p-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8">
            <OneLargeSystem viewer={viewer} />
            <div aria-hidden className="flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-dark shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]">
                <ArrowRight className="size-4 rotate-90 text-brand-glow lg:rotate-0" />
              </span>
            </div>
            <CoreWorkspaces viewer={viewer} />
          </div>
          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-border-soft pt-8 sm:grid-cols-2">
            <ul data-points="before" className="space-y-2">
              {c.before.points.map((p) => (
                <li key={p} className="flex items-baseline gap-2.5 text-label text-text-secondary">
                  <span
                    aria-hidden
                    className="size-1 shrink-0 translate-y-[-0.2em] rounded-full bg-text-muted"
                  />
                  {p}
                </li>
              ))}
            </ul>
            <ul data-points="after" className="space-y-2">
              {c.after.points.map((p) => (
                <li key={p} className="flex items-baseline gap-2.5 text-label text-text-primary">
                  <span
                    aria-hidden
                    className="size-1 shrink-0 translate-y-[-0.2em] rounded-full bg-brand-glow"
                  />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Stage>
        <p className="mt-6 max-w-3xl text-label text-text-muted">{c.note}</p>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Department-centric — different duties, different screens          */
/* ------------------------------------------------------------------ */

export function DepartmentsChapter() {
  const c = useCopy(WHY_CORE).departments;
  return (
    <Chapter id={WHY_CHAPTER.departments} labelledBy="departments-title" space="lg">
      <Frame width="wide">
        <StoryHead index="03" kicker={c.kicker} id="departments-title" title={c.title} />
        <ul
          data-not-needed
          className="mt-16 divide-y divide-border-soft border-y border-border-soft"
        >
          {NOT_NEEDED.map((d) => (
            <li
              key={d}
              data-line={d}
              className="grid grid-cols-1 gap-1 py-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-baseline sm:gap-8 sm:py-8"
            >
              <span className="flex items-center gap-3 text-[clamp(1.25rem,1.05rem+0.9vw,1.875rem)] font-semibold text-text-primary">
                <DeptDot id={d} className="size-2.5" />
                {c.lines[d].who}
              </span>
              <span className="text-[clamp(1.125rem,1rem+0.7vw,1.625rem)] leading-[1.45] text-text-secondary">
                {c.lines[d].rest}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <p className="text-[clamp(1.25rem,1.05rem+0.9vw,1.875rem)] leading-[1.4] font-semibold text-brand-soft">
            {c.conclusion}
          </p>
          <div>
            <p
              data-warehouse-privacy
              className="flex gap-3 border-l-2 border-ws-warehouse/60 pl-4 text-label text-text-secondary"
            >
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ws-warehouse" />
              {c.privacy}
            </p>
            <QuietLink to={WHY_LINKS.departments} data="departments" className="mt-5">
              {c.link}
            </QuietLink>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 Connected, not isolated — six views, one state                    */
/* ------------------------------------------------------------------ */

export function ConnectedChapter() {
  const c = useCopy(WHY_CORE).connected;
  const name = useDeptName();
  return (
    <Chapter id={WHY_CHAPTER.connected} labelledBy="connected-title" plane="navy" space="lg">
      <Frame width="full">
        <StoryHead
          index="04"
          kicker={c.kicker}
          id="connected-title"
          title={c.title}
          lead={c.lead}
          className="mx-auto max-w-[1240px] lg:px-0"
        />
        <figure aria-label={c.visual} className="mt-16">
          <ul data-views className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4">
            {VIEWERS.map((v) => (
              <li key={v} data-view={v} className="relative">
                <div className="h-full rounded-2xl bg-[#0a131b] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.09)]">
                  <p className="flex items-center gap-2 text-caption font-semibold text-text-primary">
                    <DeptDot id={v} />
                    {name(v)}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-text-muted">{c.workspace}</p>
                  <p className="mt-4 text-caption text-text-muted tabular">{c.doc}</p>
                  <p className="mt-1 text-label text-text-primary">{c.views[v]}</p>
                </div>
                <span
                  aria-hidden
                  className="absolute top-full left-1/2 hidden h-8 w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.2),rgb(62_240_192/0.7))] xl:block"
                />
              </li>
            ))}
          </ul>
          <div
            data-shared-state
            className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,rgb(25_195_154/0.08),rgb(25_195_154/0.22),rgb(25_195_154/0.08))] px-5 py-4 text-center shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)] sm:flex-row sm:gap-4 xl:mt-8"
          >
            <span className="text-caption font-semibold text-brand-glow">{c.state}</span>
            <span className="text-label font-semibold text-text-primary tabular">
              {c.doc} · {c.stateValue}
            </span>
          </div>
        </figure>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 05 Human Error — prevent bad states, don't just record them          */
/* ------------------------------------------------------------------ */

function StateGuard() {
  const c = useCopy(WHY_CORE).humanError;
  return (
    <figure aria-label={c.visual} data-state-guard>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
        {c.track.map((t, i) => (
          <li key={t} className="relative flex-1">
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-3 text-label',
                i <= 2
                  ? 'bg-white/[0.05] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]'
                  : 'bg-brand-primary/14 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)]',
              )}
            >
              <Check aria-hidden className="size-3.5 shrink-0 text-brand-glow" />
              {t}
            </div>
            {i === 1 && (
              <div className="mt-3 space-y-2 sm:absolute sm:top-full sm:right-[-4rem] sm:left-0 sm:mt-4">
                <p
                  data-blocked
                  className="flex items-start gap-2 rounded-xl border border-dashed border-warning/50 px-3.5 py-2.5 text-caption text-warning"
                >
                  <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <span className="block font-semibold">{c.blockedLabel}</span>
                    <span className="line-through decoration-warning/60">{c.blocked}</span>
                  </span>
                </p>
                <p className="flex items-center gap-2 px-1 text-caption text-brand-soft">
                  <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                  {c.guide}
                </p>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div aria-hidden className="hidden h-36 sm:block" />
    </figure>
  );
}

export function HumanErrorChapter() {
  const c = useCopy(WHY_CORE).humanError;
  return (
    <Chapter id={WHY_CHAPTER.humanError} labelledBy="human-error-title" plane="grid" space="lg">
      <Frame width="wide">
        <StoryHead
          index="05"
          kicker={c.kicker}
          id="human-error-title"
          title={c.title}
          lead={c.lead}
          size="statement"
          className="max-w-4xl"
        />

        <div
          data-record-prevent
          className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border-soft sm:grid-cols-2"
        >
          <div className="bg-surface-dark px-6 py-6 sm:px-8">
            <p className="text-caption font-semibold text-text-muted">{c.record.title}</p>
            <p className="mt-2 text-body-lg text-text-secondary">{c.record.body}</p>
          </div>
          <div className="bg-[linear-gradient(135deg,rgb(25_195_154/0.12),rgb(5_11_18))] px-6 py-6 sm:px-8">
            <p className="text-caption font-semibold text-brand-glow">{c.prevent.title}</p>
            <p className="mt-2 text-body-lg text-text-primary">{c.prevent.body}</p>
          </div>
        </div>
        <Reveal>
          <p className="mt-12 max-w-3xl text-[clamp(1.25rem,1.05rem+0.9vw,1.875rem)] leading-[1.45] font-semibold text-text-primary">
            {c.statement}
          </p>
        </Reveal>

        <div className="mt-14">
          <Stage glow="clear" className="px-5 py-8 sm:px-10 sm:py-10">
            <StateGuard />
          </Stage>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
          <div>
            <Kicker tone="clear">{c.guardsTitle}</Kicker>
            <p className="mt-4 text-label text-text-muted">{c.note}</p>
            <div className="mt-6 flex flex-col items-start">
              <QuietLink to={WHY_LINKS.solutions} data="solutions">
                {c.solutions}
              </QuietLink>
              <QuietLink to={WHY_LINKS.humanErrorChapter} data="how-core-works">
                {c.how}
              </QuietLink>
            </div>
          </div>
          <dl data-guards className="divide-y divide-border-soft border-y border-border-soft">
            {GUARDS.map((g) => (
              <div
                key={g.id}
                data-guard={g.id}
                className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt>
                  <span className="block text-h3 text-text-primary">{c.guards[g.id].verb}</span>
                  <span className="text-caption font-semibold tracking-[0.22em] text-brand-glow">
                    {g.principle}
                  </span>
                </dt>
                <dd className="text-label text-text-secondary sm:pt-1.5">
                  {c.guards[g.id].example}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 06 Executive — signals, not noise                                    */
/* ------------------------------------------------------------------ */

/** A deterministic field of the day's work: most dots are routine. */
const NOISE = Array.from({ length: 144 }, (_, i) => {
  const col = i % 16;
  const row = Math.floor(i / 16);
  const flag = (i * 37) % 23 === 0 ? 'signal' : (i * 13) % 29 === 0 ? 'risk' : 'routine';
  return { x: 10 + col * 15 + (row % 2) * 4, y: 10 + row * 15, flag };
});

export function ExecutiveChapter() {
  const c = useCopy(WHY_CORE).executive;
  return (
    <Chapter id={WHY_CHAPTER.executive} labelledBy="executive-title" space="lg">
      <Frame width="wide">
        <StoryHead
          index="06"
          kicker={c.kicker}
          id="executive-title"
          title={c.title}
          lead={c.lead}
        />
        <figure
          aria-label={c.visual}
          className="mt-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-10"
        >
          <div>
            <p className="text-caption font-semibold text-text-muted">{c.noise}</p>
            <svg viewBox="0 0 250 145" className="mt-4 block w-full max-w-md" aria-hidden>
              {NOISE.map((d, i) => (
                <circle
                  key={i}
                  cx={d.x}
                  cy={d.y}
                  r={d.flag === 'routine' ? 2 : 3}
                  fill={d.flag === 'signal' ? '#3ef0c0' : d.flag === 'risk' ? '#f5b84b' : '#a3b8b2'}
                  fillOpacity={d.flag === 'routine' ? 0.22 : 0.9}
                />
              ))}
            </svg>
          </div>
          <div aria-hidden className="flex justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-dark shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4),0_0_40px_rgb(62_240_192/0.25)]">
              <Eye className="size-5 text-brand-glow" />
            </span>
          </div>
          <div>
            <p className="text-caption font-semibold text-brand-soft">{c.signalsLabel}</p>
            <ul
              data-signals
              className="mt-4 divide-y divide-border-soft border-y border-border-soft"
            >
              {SIGNALS.map((s) => (
                <li
                  key={s}
                  data-signal={s}
                  className="flex items-baseline justify-between gap-4 py-3.5"
                >
                  <span className="text-label font-semibold text-text-primary">
                    {c.signals[s].title}
                  </span>
                  <span className="text-right text-caption text-text-secondary">
                    {c.signals[s].body}
                  </span>
                </li>
              ))}
            </ul>
            <QuietLink to={WHY_LINKS.executive} data="executive" className="mt-5">
              {c.link}
            </QuietLink>
          </div>
        </figure>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 07 Good software should disappear — quiet                            */
/* ------------------------------------------------------------------ */

export function NextActionChapter() {
  const c = useCopy(WHY_CORE).nextAction;
  return (
    <Chapter id={WHY_CHAPTER.nextAction} labelledBy="next-action-title" space="lg">
      <Frame width="base">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker tone="muted" className="justify-center">
            <span className="tabular" aria-hidden>
              07
            </span>
            {c.kicker}
          </Kicker>
          <Reveal>
            <h2
              id="next-action-title"
              className="mt-6 text-[clamp(1.875rem,1.2rem+2.6vw,3.5rem)] leading-[1.22] font-semibold tracking-tight text-text-primary"
            >
              <Lines text={c.title} />
            </h2>
          </Reveal>
          <p className="mx-auto mt-6 max-w-xl text-body-lg text-text-secondary">{c.body}</p>
          <div
            aria-hidden
            data-next-action
            className="mx-auto mt-14 flex max-w-sm items-center gap-4 rounded-2xl bg-white/[0.035] px-5 py-4 text-left shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
          >
            <DeptDot id="warehouse" className="size-2.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-caption text-text-muted">{c.label}</span>
              <span className="block text-label font-semibold text-text-primary">{c.task}</span>
              <span className="block text-caption text-text-secondary">{c.meta}</span>
            </span>
            <ArrowRight className="size-4 text-brand-glow" />
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* See it work                                                          */
/* ------------------------------------------------------------------ */

export function SeeChapter() {
  const c = useCopy(WHY_CORE).see;
  const { href } = useLocale();
  return (
    <Chapter id={WHY_CHAPTER.see} labelledBy="see-it-work-title" plane="clear" space="lg">
      <Frame width="base" className="text-center">
        <Reveal>
          <h2
            id="see-it-work-title"
            className="mx-auto max-w-4xl text-[clamp(1.75rem,1.15rem+2.2vw,3.25rem)] leading-[1.25] font-semibold tracking-tight text-text-primary"
          >
            <Lines text={c.title} />
          </h2>
        </Reveal>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={href(WHY_LINKS.howCoreWorks)}
            data-cta="how"
            className={buttonClasses('primary', 'lg')}
          >
            {c.primary}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to={href(WHY_LINKS.departments)}
            data-cta="departments"
            className={buttonClasses('secondary', 'lg')}
          >
            {c.secondary}
          </Link>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-x-8 sm:flex-row">
          <QuietLink to={WHY_LINKS.demo} data="demo">
            {c.demo}
          </QuietLink>
          <QuietLink to={WHY_LINKS.about} data="about">
            {c.about}
          </QuietLink>
        </div>
      </Frame>
    </Chapter>
  );
}
