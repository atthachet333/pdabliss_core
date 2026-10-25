import { motion } from 'framer-motion';
import { ArrowRight, CircleCheck, CircleMinus, Settings2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Head, Note } from '@/features/enterprise/parts';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { GuideLink } from '@/features/resources/GuideLink';
import { DeptDot, QuietLink } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { EASE_CORE } from '@/motion/tokens';
import { SECURITY_COPY } from './copy';
import {
  CHAPTER,
  FIELDS,
  MONEY_FIELDS,
  SECURITY_LINKS,
  SECURITY_ROLES,
  sees,
  VISIBILITY,
  WINDOW_SIDE,
  type Field,
  type SecurityRole,
} from './model';

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

export function SecurityHero() {
  const c = useCopy(SECURITY_COPY).hero;
  const { href } = useLocale();
  return (
    <section aria-labelledby="security-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(ellipse_55%_60%_at_80%_0%,rgb(62_224_180/0.09),transparent_70%)]"
      />
      <Frame width="wide" className="pt-32 pb-16 sm:pt-40 lg:pb-20">
        <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Kicker tone="clear">{c.eyebrow}</Kicker>
            <h1
              id="security-title"
              className="mt-5 text-[clamp(2.375rem,1.4rem+3.6vw,4.75rem)] leading-[1.12] font-semibold tracking-tight text-balance text-text-primary"
            >
              {c.title}
            </h1>
            <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">{c.lead}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to={href(SECURITY_LINKS.consult)}
                data-cta="consult"
                className={buttonClasses('primary', 'lg', 'whitespace-normal')}
              >
                {c.primary}
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
              <Link
                to={href(SECURITY_LINKS.enterprise)}
                data-cta="enterprise"
                className={buttonClasses('secondary', 'lg')}
              >
                {c.secondary}
              </Link>
            </div>
            <QuietLink to={SECURITY_LINKS.demo} data="demo" className="mt-4">
              {c.demo}
            </QuietLink>
          </div>

          {/* What security also means — a typographic visual, not a padlock. */}
          <figure data-concept className="border-l border-brand-primary/30 pl-6 sm:pl-8">
            <blockquote className="text-[clamp(1.25rem,1rem+0.9vw,1.75rem)] leading-[1.45] font-medium whitespace-pre-line text-text-primary">
              {c.concept}
            </blockquote>
            <dl className="mt-8 space-y-4">
              <div>
                <dt className="text-caption text-text-muted">{c.notOnly}</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {c.notOnlyItems.map((x) => (
                    <span
                      key={x}
                      className="rounded-full border border-border-soft px-3 py-1 text-caption text-text-muted"
                    >
                      {x}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-brand-soft">{c.also}</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {c.pillars.map((x) => (
                    <span
                      key={x}
                      className="rounded-full bg-brand-primary/12 px-3 py-1 text-caption font-medium text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
                    >
                      {x}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </figure>
        </div>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One work item, six visibility windows                                */
/* ------------------------------------------------------------------ */

type Line = { f: Field; on: boolean; d: string; ex: number; ey: number };

/** Field lines from the work item to the selected window (desktop only, decorative). */
function useLines(role: SecurityRole) {
  const box = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ w: number; h: number; lines: Line[] } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      if (!window.matchMedia?.('(min-width: 1024px)').matches) return setGeo(null);
      const b = el.getBoundingClientRect();
      const win = el.querySelector(`[data-window="${role}"]`)?.getBoundingClientRect();
      const card = el.querySelector('[data-work-item]')?.getBoundingClientRect();
      if (!win || !card || b.width === 0) return setGeo(null);
      const left = WINDOW_SIDE[role] === 'left';
      const dir = left ? -1 : 1;
      const sx = (left ? card.left : card.right) - b.left;
      const edge = (left ? win.right : win.left) - b.left;
      const top = win.top - b.top + 28;
      const span = Math.max(win.height - 56, 40);
      const lines = FIELDS.map((f, i): Line => {
        const row = el.querySelector(`[data-row="${f}"]`)?.getBoundingClientRect();
        const sy = row ? row.top + row.height / 2 - b.top : top;
        const on = sees(role, f);
        const ey = top + (span * i) / (FIELDS.length - 1);
        // Not permitted: the line stops short of the window's edge.
        const ex = on ? edge : edge - dir * 30;
        const k = Math.abs(ex - sx) * 0.55;
        return {
          f,
          on,
          ex,
          ey,
          d: `M${sx},${sy} C${sx + dir * k},${sy} ${ex - dir * k},${ey} ${ex},${ey}`,
        };
      });
      setGeo({ w: b.width, h: b.height, lines });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [role]);

  return { box, geo };
}

function RoleWindow({
  role,
  selected,
  onSelect,
}: {
  role: SecurityRole;
  selected: boolean;
  onSelect: (r: SecurityRole) => void;
}) {
  const c = useCopy(SECURITY_COPY).windows;
  const visible = VISIBILITY[role];
  return (
    <button
      type="button"
      data-window={role}
      aria-pressed={selected}
      onClick={() => onSelect(role)}
      className={cn(
        'group min-h-11 w-full rounded-2xl p-3.5 text-left transition-[background-color,box-shadow] duration-300 sm:p-4',
        selected
          ? 'bg-[linear-gradient(160deg,rgb(62_224_180/0.16),rgb(62_224_180/0.03))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4),0_24px_70px_-40px_rgb(62_240_192/0.7)]'
          : 'bg-white/[0.03] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] hover:bg-white/[0.05]',
      )}
    >
      {/* Name and count share a line only where there is room (lg). */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {role === 'admin' ? (
          <Settings2 aria-hidden className="size-3.5 shrink-0 text-ws-admin" />
        ) : (
          <DeptDot id={role} />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 text-label font-semibold',
            selected ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {c.roles[role].name}
        </span>
        <span
          className="basis-full text-caption text-text-muted tabular xl:basis-auto"
          data-count={visible.length}
        >
          {fill(c.count, { n: visible.length, total: FIELDS.length })}
        </span>
      </span>
      <span className="mt-1 hidden text-caption text-text-muted sm:block">
        {c.roles[role].focus}
      </span>
      {selected && (
        <ul
          data-window-fields
          className="mt-3 hidden space-y-1.5 border-t border-white/[0.07] pt-3 lg:block"
        >
          {visible.map((f) => (
            <li key={f} className="flex items-baseline justify-between gap-3 text-caption">
              <span className="text-text-muted">{c.fields[f].label}</span>
              <span className="truncate text-right text-text-primary">{c.fields[f].value}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function VisibilityChapter() {
  const c = useCopy(SECURITY_COPY).windows;
  const reduce = usePrefersReducedMotion();
  const [role, setRole] = useState<SecurityRole>('warehouse');
  const { box, geo } = useLines(role);
  const side = (s: 'left' | 'right') => SECURITY_ROLES.filter((r) => WINDOW_SIDE[r] === s);
  const windows = (s: 'left' | 'right') => (
    <div className="contents lg:flex lg:flex-col lg:justify-center lg:gap-4">
      {side(s).map((r) => (
        <RoleWindow key={r} role={r} selected={r === role} onSelect={setRole} />
      ))}
    </div>
  );

  return (
    <Chapter id={CHAPTER.windows} labelledBy="visibility-title" space="sm" className="!pt-4">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="visibility-title" title={c.title} lead={c.lead} />
        <Stage glow="clear" className="mt-12 p-3 sm:p-6 lg:p-10">
          <div
            ref={box}
            role="group"
            aria-label={c.group}
            data-visibility={role}
            className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,23rem)_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-0 xl:gap-x-24 2xl:gap-x-36"
          >
            {windows('left')}

            {/* The shared work state — every field exists once, here. */}
            <div
              data-work-item
              className="order-last col-span-full mt-3 rounded-2xl bg-[rgb(7_16_24/0.9)] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] sm:p-5 lg:order-none lg:col-span-1 lg:mt-0"
            >
              <p className="text-caption text-text-muted">{c.object}</p>
              <p className="mt-1 text-label font-semibold text-text-primary">{c.objectId}</p>
              <p className="mt-3 text-caption text-brand-soft" aria-live="polite">
                {c.selected}: {c.roles[role].name} ·{' '}
                {fill(c.count, { n: VISIBILITY[role].length, total: FIELDS.length })}
              </p>
              <ul className="mt-4 divide-y divide-white/[0.05]">
                {FIELDS.map((f) => {
                  const on = sees(role, f);
                  return (
                    <li
                      key={f}
                      data-row={f}
                      data-visible={on}
                      data-money={MONEY_FIELDS.includes(f) || undefined}
                      className="flex min-h-9 items-center gap-3 py-1.5 text-caption"
                    >
                      {on ? (
                        <CircleCheck aria-hidden className="size-3.5 shrink-0 text-brand-glow" />
                      ) : (
                        <CircleMinus aria-hidden className="size-3.5 shrink-0 text-warning/80" />
                      )}
                      <span
                        className={cn(
                          'min-w-0 flex-1',
                          on ? 'text-text-primary' : 'text-text-muted',
                        )}
                      >
                        {c.fields[f].label}
                        <span className="sr-only"> — {on ? c.reaches : c.stops}</span>
                      </span>
                      <span
                        className={cn(
                          'max-w-[55%] min-w-0 text-right break-words tabular',
                          on ? 'text-text-secondary' : 'text-text-muted/60',
                        )}
                      >
                        {c.fields[f].value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {windows('right')}

            {geo && (
              <svg
                aria-hidden
                data-lines
                width={geo.w}
                height={geo.h}
                className="pointer-events-none absolute inset-0 hidden overflow-visible lg:block"
              >
                {geo.lines.map((l, i) => (
                  <g key={`${role}-${l.f}`} data-line={l.f} data-on={l.on}>
                    <motion.path
                      d={l.d}
                      fill="none"
                      stroke={l.on ? 'rgb(62 240 192 / 0.55)' : 'rgb(245 184 75 / 0.32)'}
                      strokeWidth={l.on ? 1.2 : 1}
                      strokeDasharray={l.on ? undefined : '3 4'}
                      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.7, delay: i * 0.025, ease: EASE_CORE }}
                    />
                    {!l.on && (
                      <motion.line
                        x1={l.ex}
                        x2={l.ex}
                        y1={l.ey - 5}
                        y2={l.ey + 5}
                        stroke="rgb(245 184 75 / 0.85)"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.55 + i * 0.025 }}
                      />
                    )}
                    {l.on && <circle cx={l.ex} cy={l.ey} r={2} fill="rgb(62 240 192 / 0.9)" />}
                  </g>
                ))}
              </svg>
            )}
          </div>
        </Stage>
        <Note className="mt-8 max-w-3xl">{c.note}</Note>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* Warehouse — the flagship boundary                                    */
/* ------------------------------------------------------------------ */

/** Interleaved so the boundary visibly separates what passes from what stops. */
const LANES: readonly Field[] = [
  'item',
  'price',
  'quantity',
  'cost',
  'location',
  'margin',
  'lot',
  'payment',
  'expiry',
  'terms',
  'receiving',
  'picking',
];

export function WarehouseChapter() {
  const c = useCopy(SECURITY_COPY);
  const w = c.warehouse;
  const f = c.windows.fields;
  const reduce = usePrefersReducedMotion();
  const passes = LANES.filter((x) => sees('warehouse', x));
  const stops = LANES.filter((x) => !sees('warehouse', x));
  const grow = (i: number) =>
    reduce
      ? {}
      : {
          initial: { scaleX: 0 },
          whileInView: { scaleX: 1 },
          viewport: { once: true, margin: '-10%' },
          transition: { duration: 0.6, delay: 0.1 + i * 0.05, ease: EASE_CORE },
        };

  return (
    <Chapter id={CHAPTER.warehouse} labelledBy="warehouse-title" plane="navy" space="lg">
      <Frame width="wide">
        <Head eyebrow={w.eyebrow} id="warehouse-title" title={w.title} lead={w.lead} />

        <Stage glow="warm" className="mt-14 px-4 py-6 sm:px-8 sm:py-10">
          <figure data-warehouse-boundary aria-label={w.boundary}>
            {/* Lanes: shared item → boundary → warehouse view (sm and up) */}
            <div className="relative hidden sm:block">
              {/* The warehouse view is a window; its left edge is the boundary. */}
              <div
                aria-hidden
                className="absolute -top-3 -right-3 -bottom-3 left-1/2 rounded-r-[1.5rem] border-l-2 border-warning/60 bg-[linear-gradient(90deg,rgb(79_208_143/0.09),rgb(79_208_143/0.02))]"
              />
              <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,12rem)] items-end gap-x-0 pb-4 text-caption">
                <span className="text-text-muted">{w.source}</span>
                <span />
                <span className="-ml-px pl-3 text-warning">{w.boundary}</span>
                <span className="text-right font-semibold text-ws-warehouse">{w.view}</span>
              </div>
              <ul className="space-y-2">
                {LANES.map((x, i) => {
                  const on = sees('warehouse', x);
                  return (
                    <li
                      key={x}
                      data-lane={x}
                      data-passes={on}
                      className="grid min-h-9 grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,12rem)] items-center"
                    >
                      <span
                        className={cn(
                          'truncate rounded-full px-3 py-1 text-caption shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
                          on ? 'text-text-primary' : 'text-text-secondary',
                        )}
                      >
                        {f[x].label}
                      </span>
                      <span className="flex items-center pl-2">
                        <motion.span
                          aria-hidden
                          className={cn(
                            'h-px flex-1 origin-left',
                            on ? 'bg-brand-glow/50' : 'bg-warning/40',
                          )}
                          {...grow(i)}
                        />
                        {!on && (
                          <span aria-hidden className="ml-0.5 h-3 w-0.5 rounded-full bg-warning" />
                        )}
                      </span>
                      <span className="flex items-center pr-2">
                        {on && (
                          <motion.span
                            aria-hidden
                            className="h-px flex-1 origin-left bg-brand-glow/50"
                            {...grow(i + 4)}
                          />
                        )}
                      </span>
                      {on ? (
                        <span className="flex items-center justify-end gap-1.5 text-caption text-text-primary">
                          <CircleCheck aria-hidden className="size-3.5 text-ws-warehouse" />
                          {f[x].label}
                          <span className="sr-only"> — {w.passes}</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1.5 text-caption text-warning/80">
                          <CircleMinus aria-hidden className="size-3.5" />
                          {w.stopped}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Phones: two plain lists */}
            <div className="grid grid-cols-1 gap-6 sm:hidden">
              <div>
                <p className="text-caption font-semibold text-ws-warehouse">{w.passes}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {passes.map((x) => (
                    <li
                      key={x}
                      data-mobile-pass={x}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-caption text-text-primary"
                    >
                      <CircleCheck aria-hidden className="size-3.5 text-ws-warehouse" />
                      {f[x].label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-warning/30 pt-5">
                <p className="text-caption font-semibold text-warning">
                  {w.boundary} · {w.stopped}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {stops.map((x) => (
                    <li
                      key={x}
                      data-mobile-stop={x}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption text-text-secondary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.3)]"
                    >
                      <CircleMinus aria-hidden className="size-3.5 text-warning" />
                      {f[x].label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </figure>
        </Stage>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr]">
          <div data-sees>
            <h3 className="flex items-center gap-2 text-label font-semibold text-text-primary">
              <CircleCheck aria-hidden className="size-4 text-ws-warehouse" />
              {w.seesTitle}
            </h3>
            <ul className="mt-4 space-y-2">
              {passes.map((x) => (
                <li key={x} className="text-label text-text-secondary">
                  {f[x].label}
                </li>
              ))}
            </ul>
          </div>
          <div data-not-sees>
            <h3 className="flex items-center gap-2 text-label font-semibold text-text-primary">
              <CircleMinus aria-hidden className="size-4 text-warning" />
              {w.notTitle}
            </h3>
            <ul className="mt-4 space-y-2">
              {w.not.map((x) => (
                <li key={x} className="text-label text-text-secondary">
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Note>
              <span data-warehouse-fact>{w.fact}</span>
            </Note>
            <QuietLink to={SECURITY_LINKS.warehouseDemo} data="warehouse-demo" className="mt-5">
              {w.demo}
            </QuietLink>
            {/* EP17: the written explanation of the same boundary. */}
            <GuideLink id="warehousePrivacy" className="mt-1" />
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}
