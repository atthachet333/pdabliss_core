import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT } from './copy';
import { ABOUT_CHAPTER, METHOD_STEPS, STAGES, STEP_ZONE, type MethodStep } from './model';
import { ABOUT_SCENES } from './scenes/copy';
import { InterfaceSketch, MapSketch, NotesSketch, WorkflowSketch } from './scenes/sketches';

/*
 * 05 From process to product — signature scene 2, the design table. Three
 * zones on one table: workshop notes → responsibility / process map → a
 * clean CORE screen. Choosing a step shows where it sits on the table, what
 * PDA BLISS asks at that step and what the step produces; zones behind it
 * are done, zones ahead are still ghosted. All ten steps stay listed in text.
 */

const ZONES = ['notes', 'map', 'screen'] as const;
type Zone = (typeof ZONES)[number];
type ZoneState = 'done' | 'active' | 'ahead';

const STATE_ICON: Record<ZoneState, LucideIcon> = { done: Check, active: CircleDot, ahead: Circle };

const num = (i: number) => String(i).padStart(2, '0');

function ZonePanel({
  zone,
  state,
  children,
}: {
  zone: Zone;
  state: ZoneState;
  children: React.ReactNode;
}) {
  const t = useCopy(ABOUT_SCENES).table;
  const Icon = STATE_ICON[state];
  return (
    <div data-zone={zone} data-zone-state={state} className="flex min-w-0 flex-col">
      <p className="flex items-center justify-between gap-3 text-caption">
        <span
          className={cn(
            'font-semibold',
            state === 'active' ? 'text-brand-soft' : 'text-text-muted',
          )}
        >
          {t.zones[zone]}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            state === 'active'
              ? 'text-brand-glow'
              : state === 'done'
                ? 'text-text-secondary'
                : 'text-text-muted',
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {t.zoneState[state]}
        </span>
      </p>
      <div
        aria-hidden
        className={cn(
          'relative mt-3 flex-1 overflow-hidden rounded-2xl transition-[opacity,filter,box-shadow] duration-500',
          state === 'active'
            ? 'bg-[linear-gradient(180deg,rgb(13_25_36/0.95),rgb(6_13_20/0.95))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4),0_30px_80px_-40px_rgb(62_240_192/0.55)]'
            : 'bg-white/[0.025] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
          state === 'ahead' && 'opacity-30 grayscale',
          state === 'done' && 'opacity-75',
        )}
      >
        <svg viewBox="0 0 280 170" className="block w-full">
          {children}
        </svg>
      </div>
    </div>
  );
}

function Connector({ lit }: { lit: boolean }) {
  return (
    <div aria-hidden className="flex items-center justify-center py-2 lg:px-1 lg:pt-8">
      <ChevronRight
        className={cn(
          'size-5 rotate-90 transition-colors duration-500 lg:rotate-0',
          lit ? 'text-brand-glow' : 'text-text-muted/40',
        )}
      />
    </div>
  );
}

function DesignTable({ step }: { step: MethodStep }) {
  const c = useCopy(ABOUT).approach;
  const zoneIndex = ZONES.indexOf(STEP_ZONE[step]);
  const stateOf = (z: Zone): ZoneState => {
    const i = ZONES.indexOf(z);
    return i < zoneIndex ? 'done' : i === zoneIndex ? 'active' : 'ahead';
  };
  // The map becomes a workflow at the workflow step, and stays one after it.
  const workflow = step === 'workflow' || zoneIndex > 1;
  return (
    <figure
      aria-label={c.visual}
      data-design-table
      className="relative m-0 rounded-[2rem] bg-[linear-gradient(180deg,rgb(10_20_28/0.9),rgb(5_11_18/0.9))] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] sm:p-6 lg:p-8"
    >
      {/* Drafting-table grid */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[2rem] bg-grid [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)] opacity-40"
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)]">
        <ZonePanel zone="notes" state={stateOf('notes')}>
          <NotesSketch focus={step} />
        </ZonePanel>
        <Connector lit={zoneIndex > 0} />
        <ZonePanel zone="map" state={stateOf('map')}>
          <motion.g animate={{ opacity: workflow ? 0 : 1 }} transition={{ duration: 0.5 }}>
            <MapSketch focus={step} />
          </motion.g>
          <motion.g
            initial={false}
            animate={{ opacity: workflow ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          >
            <WorkflowSketch focus={step} />
          </motion.g>
        </ZonePanel>
        <Connector lit={zoneIndex > 1} />
        <ZonePanel zone="screen" state={stateOf('screen')}>
          <InterfaceSketch focus={step} />
        </ZonePanel>
      </div>
    </figure>
  );
}

function Inspector({ step, onStep }: { step: MethodStep; onStep: (s: MethodStep) => void }) {
  const c = useCopy(ABOUT).approach;
  const t = useCopy(ABOUT_SCENES).table;
  const i = METHOD_STEPS.indexOf(step);
  const go = (d: number) =>
    onStep(METHOD_STEPS[(i + d + METHOD_STEPS.length) % METHOD_STEPS.length]!);
  return (
    <div
      data-inspector
      className="mt-6 grid grid-cols-1 gap-6 border-y border-border-soft py-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-10"
    >
      <div aria-live="polite">
        <p className="text-caption text-text-muted tabular">{t.of(i + 1, METHOD_STEPS.length)}</p>
        <p className="mt-1 text-h3 text-text-primary">{c.steps[step].title}</p>
      </div>
      <motion.div
        key={`q-${step}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_CORE }}
      >
        <p className="text-caption font-semibold text-brand-soft">{t.ask}</p>
        <p
          data-question
          className="mt-1 text-[clamp(1.125rem,1rem+0.6vw,1.5rem)] leading-snug font-semibold text-text-primary"
        >
          “{t.questions[step]}”
        </p>
      </motion.div>
      <div>
        <p className="text-caption font-semibold text-text-muted">{t.output}</p>
        <p data-output className="mt-1 text-label text-text-secondary">
          {t.outputs[step]}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="inline-flex size-11 items-center justify-center rounded-full bg-white/[0.05] text-text-primary transition-colors hover:bg-white/[0.1]"
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="sr-only">{t.prev}</span>
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="inline-flex size-11 items-center justify-center rounded-full bg-brand-primary/15 text-brand-glow shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)] transition-colors hover:bg-brand-primary/25"
        >
          <ArrowRight aria-hidden className="size-4" />
          <span className="sr-only">{t.next}</span>
        </button>
      </div>
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  notes: 'text-warning/80',
  map: 'text-text-secondary',
  workflow: 'text-brand-soft',
  interface: 'text-brand-glow',
};

export function ApproachChapter() {
  const c = useCopy(ABOUT).approach;
  const s = useCopy(ABOUT_SCENES);
  const [step, setStep] = useState<MethodStep>('realWork');
  return (
    <Chapter id={ABOUT_CHAPTER.approach} labelledBy="approach-title" plane="glow" space="lg">
      <Frame width="full">
        <StoryHead
          index="05"
          ghost
          notation={s.notation.approach}
          kicker={c.kicker}
          id="approach-title"
          title={c.title}
          lead={c.lead}
          className="max-w-4xl"
        />

        <div className="mt-14 lg:mt-20">
          <DesignTable step={step} />
          <Inspector step={step} onStep={setStep} />
        </div>

        {/* Every step, in order — also the selector for the table */}
        <div role="group" aria-label={s.table.select} className="mt-12">
          <ol
            data-method
            className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
          >
            {STAGES.map((stage, si) => (
              <li key={stage.id} data-stage={stage.id}>
                <p className={cn('text-caption font-semibold uppercase', STAGE_TONE[stage.id])}>
                  {num(si + 1)} · {c.stages[stage.id].title}
                </p>
                <p className="mt-2 text-label text-text-secondary">{c.stages[stage.id].body}</p>
                <ol className="mt-5 space-y-2 border-t border-border-soft pt-4">
                  {stage.steps.map((st) => {
                    const on = st === step;
                    return (
                      <li key={st} data-step={st}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setStep(st)}
                          className={cn(
                            'grid min-h-11 w-full grid-cols-[2rem_minmax(0,1fr)] gap-x-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                            on
                              ? 'bg-brand-primary/12 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                              : 'hover:bg-white/[0.04]',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'pt-0.5 text-caption tabular',
                              on ? 'text-brand-glow' : 'text-text-muted',
                            )}
                          >
                            {num(METHOD_STEPS.indexOf(st))}
                          </span>
                          <span>
                            <span className="block text-label font-semibold text-text-primary">
                              {c.steps[st].title}
                            </span>
                            <span className="mt-0.5 block text-caption text-text-secondary">
                              {c.steps[st].body}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </div>
        <p
          data-loop
          className="mt-10 flex items-center gap-2.5 text-label text-brand-soft lg:justify-end"
        >
          <RotateCcw aria-hidden className="size-4" />
          {c.loop}
        </p>
      </Frame>
    </Chapter>
  );
}
