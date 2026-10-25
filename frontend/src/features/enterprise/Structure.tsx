import { Building2, Eye, Lock, Minus, Plus, Settings2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { Segmented } from '@/components/ui/Segmented';
import { useDepartments } from '@/config/departments';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { tabKeys } from '@/features/departments/tabs';
import { industryPath, type IndustryId } from '@/features/industries/model';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { ENTERPRISE } from './copy';
import {
  ACCESS_ROLES,
  CHAPTER,
  GROWTH_STAGES,
  INDUSTRIES,
  LEVELS,
  MONEY_FIELDS,
  MULTIPLIERS,
  ROLE_VISIBILITY,
  WORK_FIELDS,
  type AccessRole,
} from './model';
import { Head, Note } from './parts';

/* ------------------------------------------------------------------ */
/* 01 Growing complexity — a staircase of growth                        */
/* ------------------------------------------------------------------ */

/** EP11: each industry in the strip opens its industry page. */
const INDUSTRY_PAGE: Record<(typeof INDUSTRIES)[number], IndustryId> = {
  distribution: 'distribution',
  service: 'services',
  projects: 'projects',
  retail: 'retail',
  property: 'property',
  production: 'manufacturing',
};

export function ComplexityChapter() {
  const c = useCopy(ENTERPRISE).complexity;
  const { href } = useLocale();
  const [active, setActive] = useState(2);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = GROWTH_STAGES[active]!;
  return (
    <Chapter id={CHAPTER.complexity} labelledBy="complexity-title" plane="grid" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="complexity-title" title={c.title} lead={c.lead} />

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          {/* Staircase: each step is taller than the last */}
          <div>
            <div
              role="tablist"
              aria-label={c.tabs}
              onKeyDown={(e) => tabKeys(GROWTH_STAGES.length, active, setActive, refs)(e)}
              className="grid grid-cols-1 gap-2 sm:h-80 sm:grid-cols-5 sm:items-end sm:gap-3"
            >
              {GROWTH_STAGES.map((s, i) => {
                const on = i === active;
                const reached = i <= active;
                return (
                  <button
                    key={s}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`growth-tab-${s}`}
                    aria-selected={on}
                    aria-controls="growth-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setActive(i)}
                    data-growth={s}
                    style={{ ['--step' as string]: `${32 + i * 17}%` }}
                    className={cn(
                      'group relative flex min-h-12 w-[var(--step)] min-w-[60%] flex-col justify-end rounded-xl px-3.5 py-3 text-left transition-[background-color,box-shadow] duration-300 sm:h-[var(--step)] sm:w-full sm:min-w-0 sm:rounded-2xl',
                      on
                        ? 'bg-[linear-gradient(180deg,rgb(25_195_154/0.28),rgb(25_195_154/0.08))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                        : reached
                          ? 'bg-[linear-gradient(180deg,rgb(25_195_154/0.12),rgb(25_195_154/0.03))] hover:bg-[rgb(25_195_154/0.16)]'
                          : 'bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="text-caption text-text-muted tabular">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        'mt-1 text-label font-medium',
                        on ? 'text-text-primary' : 'text-text-secondary',
                      )}
                    >
                      {c.stages[s].name}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              id="growth-panel"
              role="tabpanel"
              aria-labelledby={`growth-tab-${stage}`}
              aria-live="polite"
              className="mt-6 border-t border-border-soft pt-5"
              data-growth-panel={stage}
            >
              <p className="text-body-lg text-text-primary">{c.stages[stage].body}</p>
            </div>
          </div>

          {/* What multiplies — lights up as the organization grows */}
          <div>
            <Kicker tone="muted">{c.multipliersTitle}</Kicker>
            <ul className="mt-5 divide-y divide-border-soft">
              {MULTIPLIERS.map((m) => {
                const on = m.from <= active;
                return (
                  <li
                    key={m.id}
                    data-multiplier={m.id}
                    data-on={on}
                    className={cn(
                      'flex min-h-11 items-center gap-3 text-label transition-colors duration-300',
                      on ? 'text-text-primary' : 'text-text-muted',
                    )}
                  >
                    {on ? (
                      <Plus aria-hidden className="size-4 shrink-0 text-brand-glow" />
                    ) : (
                      <Minus aria-hidden className="size-4 shrink-0 opacity-50" />
                    )}
                    {c.multipliers[m.id]}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p
          data-complexity-message
          className="mx-auto mt-20 max-w-4xl text-center text-[clamp(1.5rem,1rem+1.8vw,2.5rem)] leading-snug font-semibold text-balance text-text-primary"
        >
          “{c.message}”
        </p>
        <div className="mx-auto mt-10 max-w-4xl text-center">
          <p className="text-caption text-text-muted">{c.industriesTitle}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1 text-label text-text-secondary">
            {INDUSTRIES.map((x, i) => (
              <li key={x} data-industry={x} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-text-muted">
                    ·
                  </span>
                )}
                <Link
                  to={href(industryPath(INDUSTRY_PAGE[x]))}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:text-text-primary hover:underline"
                >
                  {c.industries[x]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 02 One organization — six workspaces around one shared state         */
/* ------------------------------------------------------------------ */

const HUB = { cx: 260, cy: 210, r: 150 };
const hubPoint = (i: number) => {
  const a = (-90 + i * 60) * (Math.PI / 180);
  return { x: HUB.cx + HUB.r * Math.cos(a), y: HUB.cy + HUB.r * Math.sin(a) };
};

export function OrganizationChapter() {
  const c = useCopy(ENTERPRISE).organization;
  const departments = useDepartments();
  const name = (id: string) => departments.find((d) => d.id === id)!.name;
  return (
    <Chapter id={CHAPTER.organization} labelledBy="organization-title" plane="navy">
      <Frame width="wide">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <Head eyebrow={c.eyebrow} id="organization-title" title={c.title} lead={c.lead} />
            <div data-one-company className="mt-10 flex gap-4 border-t border-border-soft pt-6">
              <Building2 aria-hidden className="mt-1 size-6 shrink-0 text-brand-glow" />
              <div>
                <p className="text-body-lg font-semibold text-text-primary">{c.oneCompany.title}</p>
                <p className="mt-2 text-label text-text-secondary">{c.oneCompany.body}</p>
              </div>
            </div>
          </div>

          <figure aria-label={c.core} data-hub>
            <svg aria-hidden viewBox="0 0 520 420" className="hidden w-full md:block">
              <circle
                cx={HUB.cx}
                cy={HUB.cy}
                r={HUB.r}
                fill="none"
                stroke="var(--color-border-soft)"
                strokeDasharray="2 6"
              />
              {DEPT_PAGES.map((d, i) => {
                const p = hubPoint(i);
                return (
                  <line
                    key={d}
                    x1={HUB.cx}
                    y1={HUB.cy}
                    x2={p.x}
                    y2={p.y}
                    stroke="var(--color-brand-glow)"
                    strokeOpacity="0.35"
                  />
                );
              })}
              <circle cx={HUB.cx} cy={HUB.cy} r="56" fill="rgb(25 195 154 / 0.1)" />
              <circle
                cx={HUB.cx}
                cy={HUB.cy}
                r="40"
                fill="var(--color-surface-raised)"
                stroke="var(--color-brand-glow)"
                strokeWidth="1.5"
              />
              <text
                x={HUB.cx}
                y={HUB.cy - 2}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="var(--color-text-primary)"
              >
                CORE
              </text>
              <text
                x={HUB.cx}
                y={HUB.cy + 15}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--color-brand-soft)"
              >
                {c.core}
              </text>
              {DEPT_PAGES.map((d, i) => {
                const p = hubPoint(i);
                const below = p.y > HUB.cy + 10;
                return (
                  <g key={d}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="20"
                      fill="var(--color-surface-base)"
                      stroke={`var(--color-ws-${d})`}
                      strokeWidth="2"
                    />
                    <circle cx={p.x} cy={p.y} r="5" fill={`var(--color-ws-${d})`} />
                    <text
                      x={p.x}
                      y={below ? p.y + 40 : p.y - 30}
                      textAnchor="middle"
                      fontSize="13"
                      fill="var(--color-text-secondary)"
                    >
                      {name(d)}
                    </text>
                  </g>
                );
              })}
            </svg>
            {/* Phones: the same structure as a list */}
            <div className="md:hidden">
              <p className="flex items-center gap-2 text-label font-semibold text-brand-soft">
                <span aria-hidden className="size-2.5 rounded-full bg-brand-glow" />
                CORE · {c.core}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-l border-brand-glow/40 pl-4">
                {DEPT_PAGES.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-label text-text-secondary">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-ws-${d})` }}
                    />
                    {name(d)}
                  </li>
                ))}
              </ul>
            </div>
          </figure>
        </div>

        {/* Responsibility scale — each level sees more breadth, less detail */}
        <div className="mt-20">
          <Kicker tone="muted">{c.levelsTitle}</Kicker>
          <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end md:gap-4">
            {LEVELS.map((l, i) => (
              <li
                key={l}
                data-level={l}
                style={{ ['--rise' as string]: `${5 + i * 2.5}rem` }}
                className={cn(
                  'flex flex-col justify-end rounded-2xl px-5 py-4 md:min-h-[var(--rise)]',
                  i === LEVELS.length - 1
                    ? 'bg-[linear-gradient(180deg,rgb(62_224_180/0.16),rgb(62_224_180/0.04))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.2)]'
                    : 'bg-white/[0.03]',
                )}
              >
                <span className="text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mt-1 text-body font-semibold text-text-primary">
                  {c.levels[l].name}
                </span>
                <span className="mt-1 text-label text-text-secondary">{c.levels[l].sees}</span>
              </li>
            ))}
          </ol>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 Access & role control — one object, role masks                    */
/* ------------------------------------------------------------------ */

export function AccessChapter() {
  const c = useCopy(ENTERPRISE).access;
  const [role, setRole] = useState<AccessRole>('warehouse');
  const visible = new Set(ROLE_VISIBILITY[role]);
  const count = WORK_FIELDS.filter((f) => visible.has(f)).length;
  return (
    <Chapter id={CHAPTER.access} labelledBy="access-title" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="access-title" title={c.title} lead={c.lead} />

        <Stage glow="clear" className="mt-14">
          <div className="border-b border-white/[0.06] p-4 sm:p-6">
            <Segmented
              label={c.eyebrow}
              options={ACCESS_ROLES.map((r) => ({ value: r, label: c.roles[r].name }))}
              value={role}
              onChange={setRole}
              className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)]">
            <div className="p-6 sm:p-8 lg:border-r lg:border-white/[0.06]" aria-live="polite">
              <p className="text-caption text-text-muted">{c.object}</p>
              <p className="mt-4 flex items-center gap-2 text-h3 font-semibold text-text-primary">
                {role === 'admin' ? (
                  <Settings2 aria-hidden className="size-5 text-ws-admin" />
                ) : (
                  <Eye aria-hidden className="size-5 text-brand-glow" />
                )}
                {c.roles[role].name}
              </p>
              <p className="mt-1 text-label text-text-secondary">{c.roles[role].focus}</p>
              <p className="mt-6 text-caption text-text-muted tabular" data-visible-count={count}>
                {c.sees} {count} / {WORK_FIELDS.length}
              </p>
            </div>
            <dl
              data-role-view={role}
              className="grid grid-cols-2 gap-px bg-white/[0.04] xl:grid-cols-3"
            >
              {WORK_FIELDS.map((f) => {
                const on = visible.has(f);
                return (
                  <div
                    key={f}
                    data-field={f}
                    data-visible={on}
                    data-money={MONEY_FIELDS.includes(f) || undefined}
                    className={cn(
                      'min-h-[4.5rem] px-3.5 py-3 sm:px-5 sm:py-3.5',
                      on
                        ? 'bg-[rgb(10_22_31)]'
                        : 'bg-[repeating-linear-gradient(135deg,rgb(6_13_20),rgb(6_13_20)_6px,rgb(9_18_26)_6px,rgb(9_18_26)_12px)]',
                    )}
                  >
                    <dt
                      // EP19: the hatched cell already marks 'not visible'; the label keeps AA contrast.
                      className="text-caption text-text-muted"
                    >
                      {c.fields[f].label}
                    </dt>
                    <dd className="mt-1 text-label">
                      {on ? (
                        <span className="text-text-primary">{c.fields[f].value}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-text-muted">
                          <Lock aria-hidden className="size-3.5" />
                          {c.masked}
                          <span className="sr-only"> — {c.hidden}</span>
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </Stage>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Note>
            <span data-warehouse-note>{c.warehouseNote}</span>
          </Note>
          <Note>{c.configNote}</Note>
        </div>

        {/* Executive ≠ System admin */}
        <div data-exec-vs-admin className="mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-h2 text-text-primary">{c.execVsAdmin.title}</h3>
            <p className="mt-3 text-body text-text-secondary">{c.execVsAdmin.lead}</p>
          </div>
          <div className="mt-12 grid grid-cols-1 items-stretch gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-8">
            {(['executive', 'admin'] as const).map((k, idx) => {
              const side = c.execVsAdmin[k];
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
                  <p
                    className={cn(
                      'flex items-center gap-2 text-h3 font-semibold',
                      k === 'executive' ? 'text-ws-executive' : 'text-ws-admin',
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                    {side.title}
                  </p>
                  <p className="mt-2 text-body text-text-primary">{side.body}</p>
                  <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-5">
                    {side.items.map((x) => (
                      <li
                        key={x}
                        className="flex items-start gap-2.5 text-label text-text-secondary"
                      >
                        <span
                          aria-hidden
                          className="mt-2 size-1 shrink-0 rounded-full bg-current"
                        />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              );
              return idx === 0
                ? [
                    card,
                    <div
                      key="neq"
                      aria-hidden
                      className="flex items-center justify-center text-[2.5rem] font-light text-text-muted"
                    >
                      ≠
                    </div>,
                  ]
                : card;
            })}
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}
