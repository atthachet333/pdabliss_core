import { motion } from 'framer-motion';
import { ArrowRight, Circle, Eye, MonitorSmartphone, Server, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Segmented } from '@/components/ui/Segmented';
import { Head, Note, StatusKey, StatusTag } from '@/features/enterprise/parts';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { QuietLink } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { SECURITY_COPY } from './copy';
import {
  CHAPTER,
  CONTROLS,
  FAQ,
  GO_LIVE,
  MATRIX,
  PRINCIPLES,
  SECURITY_LINKS,
  TRACE_EVENTS,
  TRACE_PARTS,
  type TraceEvent,
} from './model';

/* ------------------------------------------------------------------ */
/* Executive ≠ System admin                                             */
/* ------------------------------------------------------------------ */

export function RolesChapter() {
  const c = useCopy(SECURITY_COPY).roles;
  return (
    <Chapter id={CHAPTER.roles} labelledBy="roles-title" space="lg">
      <Frame width="base">
        <Head eyebrow={c.eyebrow} id="roles-title" title={c.title} lead={c.lead} center />
        <div className="mt-14 grid grid-cols-1 items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-8">
          {(['executive', 'admin'] as const).map((k, idx) => {
            const side = c[k];
            const Icon = k === 'executive' ? Eye : Settings2;
            const card = (
              <div
                key={k}
                data-side={k}
                className={cn(
                  'rounded-[2rem] p-6 sm:p-8',
                  k === 'executive'
                    ? 'bg-[linear-gradient(160deg,rgb(62_224_180/0.14),rgb(62_224_180/0.02))]'
                    : 'bg-[linear-gradient(160deg,rgb(163_173_184/0.12),rgb(163_173_184/0.02))]',
                )}
              >
                <h3
                  className={cn(
                    'flex items-center gap-2 text-h3 font-semibold',
                    k === 'executive' ? 'text-ws-executive' : 'text-ws-admin',
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {side.title}
                </h3>
                <p className="mt-2 text-body text-text-primary">{side.body}</p>
                <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5">
                  {side.items.map((x) => (
                    <li key={x} className="flex items-start gap-2.5 text-label text-text-secondary">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-current" />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-caption text-text-muted">{side.without}</p>
              </div>
            );
            return idx === 0
              ? [
                  card,
                  <p
                    key="neq"
                    className="flex flex-col items-center justify-center gap-1 py-2 text-center"
                  >
                    <span
                      aria-hidden
                      className="text-[2.5rem] leading-none font-light text-text-muted"
                    >
                      ≠
                    </span>
                    <span className="text-caption text-text-muted">{c.neq}</span>
                  </p>,
                ]
              : card;
          })}
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* UI visibility ≠ security boundary                                    */
/* ------------------------------------------------------------------ */

export function EnforcementChapter() {
  const c = useCopy(SECURITY_COPY).enforcement;
  const stages = [
    { id: 'now', status: 'prototype' },
    { id: 'foundation', status: 'ready' },
    { id: 'later', status: 'planned' },
  ] as const;
  return (
    <Chapter id={CHAPTER.enforcement} labelledBy="enforcement-title" plane="deep" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
          <Head eyebrow={c.eyebrow} id="enforcement-title" title={c.title} lead={c.lead} />

          {/* Two layers: what the screen shows sits on what the server sends. */}
          <figure data-layers aria-label={c.neq} className="flex flex-col gap-3">
            <div
              data-layer="ui"
              className="rounded-[1.75rem] border border-dashed border-border-strong p-5 sm:p-7"
            >
              <p className="flex items-center gap-2 text-label font-semibold text-text-secondary">
                <MonitorSmartphone aria-hidden className="size-4" />
                {c.ui.title}
              </p>
              <p className="mt-2 text-label text-text-muted">{c.ui.body}</p>
            </div>
            <p
              data-neq
              className="mx-auto rounded-full bg-warning/10 px-4 py-1.5 text-caption font-semibold text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]"
            >
              {c.neq}
            </p>
            <div
              data-layer="server"
              className="rounded-[1.75rem] bg-[linear-gradient(160deg,rgb(62_224_180/0.14),rgb(62_224_180/0.03))] p-5 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)] sm:p-7"
            >
              <p className="flex items-center gap-2 text-label font-semibold text-brand-soft">
                <Server aria-hidden className="size-4" />
                {c.server.title}
              </p>
              <p className="mt-2 text-label text-text-secondary">{c.server.body}</p>
            </div>
          </figure>
        </div>

        <ol
          data-stages
          className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-[1.75rem] bg-white/[0.05] md:grid-cols-3"
        >
          {stages.map((s, i) => (
            <li key={s.id} data-stage={s.id} className="bg-surface-dark p-6 sm:p-7">
              <p className="flex items-center gap-3 text-caption text-text-muted">
                <span className="tabular">0{i + 1}</span>
                <span className="h-px flex-1 bg-border-soft" />
              </p>
              <h3 className="mt-4 text-label font-semibold text-text-primary">
                {c.stages[s.id].label}
              </h3>
              <StatusTag status={s.status} className="mt-2" />
              <p className="mt-3 text-label text-text-secondary">{c.stages[s.id].body}</p>
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Traceability — an interactive provenance line                        */
/* ------------------------------------------------------------------ */

export function TraceChapter() {
  const c = useCopy(SECURITY_COPY).trace;
  const reduce = usePrefersReducedMotion();
  const [event, setEvent] = useState<TraceEvent>('receive');
  const values = c.events[event].values;
  return (
    <Chapter id={CHAPTER.trace} labelledBy="trace-title" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="trace-title" title={c.title} lead={c.lead}>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <StatusTag status="ready" />
            <span className="inline-flex items-center gap-2 text-caption text-text-muted">
              <StatusTag status="prototype" />· {c.demoStatus}
            </span>
          </div>
        </Head>

        <Stage glow="clear" className="mt-12 p-4 sm:p-8">
          <Segmented
            label={c.group}
            options={TRACE_EVENTS.map((e) => ({ value: e, label: c.events[e].label }))}
            value={event}
            onChange={setEvent}
            className="grid w-full grid-cols-1 sm:grid-cols-3"
          />
          <ol
            data-trace={event}
            aria-live="polite"
            className="relative mt-8 grid grid-cols-1 gap-y-4 pl-6 lg:grid-cols-8 lg:gap-x-3 lg:pt-6 lg:pl-0"
          >
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[0.3rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.6),rgb(62_240_192/0.1))] lg:top-[0.3rem] lg:right-4 lg:bottom-auto lg:left-4 lg:h-px lg:w-auto lg:bg-[linear-gradient(90deg,rgb(62_240_192/0.6),rgb(62_240_192/0.15))]"
            />
            {TRACE_PARTS.map((p, i) => (
              <motion.li
                key={`${event}-${p}`}
                data-part={p}
                className="relative min-w-0"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: EASE_CORE }}
              >
                <span
                  aria-hidden
                  className="absolute top-[0.35rem] -left-6 size-2.5 -translate-x-[0.03rem] rounded-full bg-brand-glow shadow-[0_0_0_4px_rgb(5_11_18)] lg:static lg:mb-4 lg:block lg:translate-x-0"
                />
                <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-text-muted uppercase">
                  {p}
                </p>
                <p className="mt-0.5 text-caption text-text-secondary">{c.parts[p]}</p>
                <p className="mt-1.5 text-label font-medium break-words text-text-primary">
                  {values[p]}
                </p>
              </motion.li>
            ))}
          </ol>
        </Stage>
        <Note className="mt-8 max-w-3xl">{c.note}</Note>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Approval / control                                                   */
/* ------------------------------------------------------------------ */

export function ControlChapter() {
  const c = useCopy(SECURITY_COPY).control;
  return (
    <Chapter id={CHAPTER.control} labelledBy="control-title" plane="navy" space="md">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="control-title" title={c.title} lead={c.lead} />
        <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-[1.75rem] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4">
          {CONTROLS.map((x) => (
            <li key={x.id} data-control={x.id} className="bg-surface-dark p-6">
              <h3 className="text-label font-semibold text-text-primary">{c.items[x.id].title}</h3>
              <StatusTag status={x.status} className="mt-2" />
              <p className="mt-3 text-label text-text-secondary">{c.items[x.id].body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Note>{c.example}</Note>
          <div className="flex flex-wrap gap-x-6">
            <QuietLink to={SECURITY_LINKS.approval} data="approval">
              {c.approval}
            </QuietLink>
            <QuietLink to={SECURITY_LINKS.control} data="enterprise-control">
              {c.enterprise}
            </QuietLink>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Data principles + what a live deployment needs                       */
/* ------------------------------------------------------------------ */

export function DataChapter() {
  const c = useCopy(SECURITY_COPY).data;
  return (
    <Chapter id={CHAPTER.data} labelledBy="data-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Head eyebrow={c.eyebrow} id="data-title" title={c.title} lead={c.lead} />
            <ol className="mt-10 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <li key={p} data-principle={p} className="border-t border-border-soft py-5">
                  <p className="flex items-baseline gap-3">
                    <span className="text-caption text-text-muted tabular">0{i + 1}</span>
                    <span className="text-label font-semibold text-text-primary">
                      {c.principles[p].title}
                    </span>
                  </p>
                  <p className="mt-1.5 pl-8 text-label text-text-secondary">
                    {c.principles[p].body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <aside
            data-go-live
            aria-labelledby="go-live-title"
            className="self-start rounded-[2rem] bg-surface-base/60 bg-[radial-gradient(ellipse_90%_80%_at_20%_0%,rgb(245_184_75/0.07),transparent_70%)] p-6 sm:p-8 lg:mt-16"
          >
            <h3 id="go-live-title" className="text-h3 text-text-primary">
              {c.goLive.title}
            </h3>
            <p className="mt-2 text-label text-text-secondary">{c.goLive.lead}</p>
            <ul className="mt-6 space-y-3">
              {GO_LIVE.map((g) => (
                <li key={g} data-go-live-item={g} className="flex items-start gap-3">
                  <Circle aria-hidden className="mt-1 size-3.5 shrink-0 text-warning/80" />
                  <span>
                    <span className="block text-label text-text-primary">{c.goLive.items[g]}</span>
                    <span className="text-caption text-text-muted">{c.goLive.pending}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-white/[0.06] pt-5 text-caption text-text-muted">
              {c.goLive.note}
            </p>
          </aside>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Readiness matrix                                                     */
/* ------------------------------------------------------------------ */

export function ReadinessChapter() {
  const c = useCopy(SECURITY_COPY).readiness;
  return (
    <Chapter id={CHAPTER.readiness} labelledBy="readiness-title" plane="navy" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="readiness-title" title={c.title} lead={c.lead} />
        <StatusKey className="mt-10" />

        <table data-matrix className="mt-12 w-full border-collapse text-left">
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              <th scope="col" className="pb-3 font-medium">
                {c.layer}
              </th>
              <th scope="col" className="pb-3 font-medium">
                {c.status}
              </th>
              <th scope="col" className="pb-3 font-medium">
                {c.now}
              </th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((m) => (
              <tr
                key={m.id}
                data-row={m.id}
                data-status={m.status}
                className="border-t border-border-soft max-md:block max-md:py-4"
              >
                <th
                  scope="row"
                  className="py-4 pr-6 align-top font-normal max-md:block max-md:py-0 md:w-[15rem]"
                >
                  <span className="block font-mono text-[0.6875rem] tracking-[0.14em] text-text-muted uppercase">
                    {m.id === 'backup'
                      ? 'backup / recovery'
                      : m.id === 'workflow'
                        ? 'workflow control'
                        : m.id}
                  </span>
                  <span className="mt-0.5 block text-label font-semibold text-text-primary">
                    {c.rows[m.id].name}
                  </span>
                </th>
                <td className="py-4 pr-6 align-top max-md:block max-md:py-1.5 md:w-[13rem]">
                  <StatusTag status={m.status} />
                </td>
                <td className="py-4 align-top text-label text-text-secondary max-md:block max-md:py-0">
                  {c.rows[m.id].now}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          data-not-claim
          className="mt-16 rounded-[2rem] p-6 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)] sm:p-8"
        >
          <Kicker tone="warm">{c.notClaim.title}</Kicker>
          <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
            {c.notClaim.items.map((x) => (
              <li key={x} className="flex items-start gap-2.5 text-label text-text-secondary">
                <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-warning/70" />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-caption text-text-muted">{c.notClaim.close}</p>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */

export function FaqChapter() {
  const c = useCopy(SECURITY_COPY).faq;
  return (
    <Chapter id={CHAPTER.faq} labelledBy="faq-title" space="lg">
      <Frame width="narrow">
        <Kicker tone="clear">{c.eyebrow}</Kicker>
        <h2 id="faq-title" className="mt-4 text-h2 text-text-primary">
          {c.title}
        </h2>
        <div className="mt-10 divide-y divide-border-soft border-y border-border-soft">
          {FAQ.map((id) => (
            <details key={id} data-faq={id} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-label font-medium text-text-primary marker:hidden [&::-webkit-details-marker]:hidden">
                {c.items[id].q}
                <span
                  aria-hidden
                  className="text-h3 leading-none text-text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="pb-5 text-label text-text-secondary">{c.items[id].a}</p>
            </details>
          ))}
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Consultation                                                         */
/* ------------------------------------------------------------------ */

export function ConsultChapter() {
  const c = useCopy(SECURITY_COPY).consult;
  const { href } = useLocale();
  return (
    <Chapter id={CHAPTER.consult} labelledBy="consult-title" plane="clear" space="lg">
      <Frame width="narrow" className="text-center">
        <h2
          id="consult-title"
          className="text-[clamp(1.75rem,1.2rem+1.9vw,2.85rem)] leading-[1.25] font-semibold tracking-tight text-balance whitespace-pre-line text-text-primary"
        >
          {c.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-body text-text-secondary">{c.lead}</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={href(SECURITY_LINKS.consult)}
            data-cta="consult-close"
            className={buttonClasses('primary', 'lg', 'whitespace-normal')}
          >
            {c.primary}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
          <Link to={href(SECURITY_LINKS.enterprise)} className={buttonClasses('secondary', 'lg')}>
            {c.secondary}
          </Link>
        </div>
        <QuietLink to={SECURITY_LINKS.demo} data="demo-close" className="mt-5">
          {c.demo}
        </QuietLink>
      </Frame>
    </Chapter>
  );
}
