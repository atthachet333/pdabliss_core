import { ArrowRight, Check, Info, Lock, Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import type { DeptKey } from '@/features/departments/catalog';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { BillingToggle, Segmented } from './controls';
import { fill, PRICING } from './copy';
import { PlanPrice } from './PlanPrice';
import {
  ADDON_AVAILABILITY,
  ADDON_IDS,
  addonFirstPlan,
  adjustDepartments,
  departmentMax,
  getPlan,
  includesAllDepartments,
  isDepartmentAllowed,
  PLANS,
  STANDARD_DEPARTMENTS,
  toggleDepartment,
  type AddonId,
  type PlanId,
} from './plans';
import { SECTION, usePricing } from './state';
import { storageText } from './text';

const MIN_USERS = 1;
const MAX_USERS = 9999;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className="border-t border-border-soft pt-6">
      <legend className="sr-only">{title}</legend>
      <p id={id} className="flex items-center gap-3 text-label font-semibold text-text-primary">
        <span className="flex size-7 items-center justify-center rounded-full border border-border-brand text-caption tabular">
          {n}
        </span>
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

/**
 * Frontend-only configurator: package → departments → users → add-ons →
 * billing, with a summary that shows the base package price and lists every
 * other choice as "needs assessment" — never an invented total.
 */
export function Configurator() {
  const c = useCopy(PRICING);
  const k = c.config;
  const { href } = useLocale();
  const { plan: planId, setPlan, billing } = usePricing();
  const plan = getPlan(planId);
  const departments = useDepartments();
  const deptName = (d: DeptKey) => departments.find((x) => x.id === d)!.name;

  // The visitor's own choices; what is shown is always adjusted to the plan.
  const [chosen, setChosen] = useState<readonly DeptKey[]>(['sales', 'warehouse']);
  const [users, setUsers] = useState(10);
  const [addons, setAddons] = useState<readonly AddonId[]>([]);
  const dept = adjustDepartments(plan, chosen);
  const max = departmentMax(plan);
  const lockedAll = includesAllDepartments(plan);
  const full = !lockedAll && dept.selected.length >= max;
  const usable = addons.filter((a) => ['addon', 'scope'].includes(ADDON_AVAILABILITY[a][plan.id]));
  const included = ADDON_IDS.filter((a) => ADDON_AVAILABILITY[a][plan.id] === 'included');
  const quote = plan.cta === 'quote';

  const setUserCount = (n: number) =>
    setUsers(
      Math.min(MAX_USERS, Math.max(MIN_USERS, Number.isFinite(n) ? Math.round(n) : MIN_USERS)),
    );

  return (
    <Section id={SECTION.configure} labelledBy="configure-title" className="scroll-mt-20">
      <SectionHead id="configure-title" eyebrow={k.eyebrow} title={k.title} lead={k.lead} />
      <p className="mt-5 inline-flex items-start gap-2 rounded-xl border border-border-soft bg-surface-base/70 px-3.5 py-2.5 text-caption text-text-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
        {k.presentation}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-12">
        <div className="space-y-8">
          <Step n={1} title={k.steps[0]!}>
            <Segmented<PlanId>
              label={k.steps[0]}
              value={planId}
              onChange={setPlan}
              options={PLANS.map((p) => ({ value: p.id, label: p.name }))}
              className="grid w-full grid-cols-2 sm:flex"
            />
          </Step>

          <Step n={2} title={k.steps[1]!}>
            <p className="text-label text-text-secondary" data-dept-count={dept.selected.length}>
              {lockedAll
                ? quote
                  ? k.dept.custom
                  : k.dept.all
                : fill(k.dept.count, { n: dept.selected.length, max })}
            </p>
            {dept.removed.length > 0 && (
              <p role="status" data-dept-adjusted className="mt-2 text-caption text-warning">
                {fill(k.dept.adjusted, {
                  plan: plan.name,
                  list: dept.removed.map(deptName).join(', '),
                })}
              </p>
            )}
            <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STANDARD_DEPARTMENTS.map((d) => {
                const info = departments.find((x) => x.id === d)!;
                const Icon = info.icon;
                const on = dept.selected.includes(d);
                const allowed = isDepartmentAllowed(plan, d);
                const disabled = lockedAll || !allowed || (!on && full);
                const state = !allowed
                  ? k.dept.unavailable
                  : on
                    ? k.dept.selected
                    : k.dept.notSelected;
                return (
                  <li key={d}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-disabled={disabled}
                      data-dept={d}
                      onClick={() =>
                        !disabled && setChosen(toggleDepartment(plan, dept.selected, d))
                      }
                      className={cn(
                        'group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-2xl border p-2 text-left transition-colors duration-200',
                        on
                          ? 'border-border-brand bg-surface-raised'
                          : 'border-border-soft bg-surface-base/60',
                        disabled && !on && 'cursor-not-allowed opacity-55',
                        !disabled && !on && 'hover:border-border-strong',
                      )}
                    >
                      <img
                        src={info.image.sm}
                        alt=""
                        loading="lazy"
                        className="size-11 shrink-0 rounded-xl object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-label font-medium text-text-primary">
                          <Icon className="size-3.5 shrink-0 text-brand-glow" aria-hidden />
                          <span className="truncate">{info.name}</span>
                        </span>
                        <span className="text-caption text-text-muted">{state}</span>
                      </span>
                      {on ? (
                        <Check className="size-4 shrink-0 text-brand-glow" aria-hidden />
                      ) : !allowed ? (
                        <Lock className="size-4 shrink-0 text-text-muted" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!plan.executiveAccess && (
              <p
                className="mt-3 flex items-start gap-2 text-caption text-text-secondary"
                data-executive-blocked
              >
                <Lock className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
                {k.dept.executiveBlocked}
              </p>
            )}
            {full && (
              <p className="mt-2 text-caption text-text-secondary">
                {plan.id === 'starter' ? k.dept.fullStarter : k.dept.full}
              </p>
            )}
          </Step>

          <Step n={3} title={k.steps[2]!}>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="config-users" className="sr-only">
                {k.users.label}
              </label>
              <div className="inline-flex items-center rounded-2xl border border-border-soft bg-surface-base/80 p-1">
                <button
                  type="button"
                  aria-label={k.users.decrease}
                  onClick={() => setUserCount(users - 1)}
                  disabled={users <= MIN_USERS}
                  className="flex size-11 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-raised disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <input
                  id="config-users"
                  type="number"
                  inputMode="numeric"
                  min={MIN_USERS}
                  max={MAX_USERS}
                  value={users}
                  onChange={(e) => setUserCount(e.target.valueAsNumber)}
                  className="h-11 w-20 [appearance:textfield] bg-transparent text-center text-body font-semibold text-text-primary tabular outline-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label={k.users.increase}
                  onClick={() => setUserCount(users + 1)}
                  disabled={users >= MAX_USERS}
                  className="flex size-11 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-raised disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              <span className="text-label text-text-secondary">{k.users.label}</span>
            </div>
            <p className="mt-3 text-caption text-text-muted">{k.users.hint}</p>
          </Step>

          <Step n={4} title={k.steps[3]!}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ADDON_IDS.map((a) => {
                const status = ADDON_AVAILABILITY[a][plan.id];
                const on = status === 'included' || usable.includes(a);
                const disabled = status === 'no' || status === 'included';
                const note =
                  status === 'no'
                    ? fill(k.addons.startFrom, { plan: addonFirstPlan(a).name })
                    : status === 'included'
                      ? k.addons.included
                      : status === 'scope'
                        ? k.addons.scope
                        : c.addons.assess;
                return (
                  <li key={a}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-disabled={disabled}
                      data-addon={a}
                      data-status={status}
                      onClick={() =>
                        !disabled &&
                        setAddons((list) =>
                          list.includes(a) ? list.filter((x) => x !== a) : [...list, a],
                        )
                      }
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-200',
                        on
                          ? 'border-border-brand bg-surface-raised'
                          : 'border-border-soft bg-surface-base/60',
                        status === 'no' && 'cursor-not-allowed opacity-55',
                        status === 'included' && 'cursor-default',
                        !disabled && !on && 'hover:border-border-strong',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border',
                          on
                            ? 'border-brand-glow bg-brand-primary text-text-inverse'
                            : 'border-border-strong',
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                        {status === 'no' && <Lock className="size-3 text-text-muted" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-label text-text-primary">
                          {c.addons.items[a].name}
                        </span>
                        <span className="block text-caption text-text-muted">{note}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step n={5} title={k.steps[4]!}>
            <BillingToggle />
          </Step>
        </div>

        {/* Summary */}
        <aside aria-labelledby="config-summary" className="lg:sticky lg:top-24 lg:self-start">
          <div
            data-config-summary
            data-mode={quote ? 'quote' : 'checkout'}
            className="rounded-[1.75rem] border border-border-brand/50 bg-surface-raised/70 p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="config-summary" className="text-body-lg font-semibold text-text-primary">
                {k.summary.title}
              </h3>
              <span className="rounded-full border border-border-soft px-2.5 py-0.5 text-caption text-text-muted">
                {k.summary.sample}
              </span>
            </div>
            <dl className="mt-5 space-y-4 text-label">
              <div>
                <dt className="text-caption text-text-muted">{k.summary.package}</dt>
                <dd className="mt-0.5 font-semibold text-text-primary">{plan.name}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-muted">{k.summary.base}</dt>
                <dd className="mt-1">
                  {quote ? (
                    <div>
                      <p className="font-semibold text-text-primary">{k.summary.quoteTitle}</p>
                      <p className="mt-1 text-caption text-text-secondary">{k.summary.quoteBody}</p>
                    </div>
                  ) : (
                    <PlanPrice plan={plan} billing={billing} size="sm" />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-muted">
                  {k.summary.departments}
                  {!lockedAll && ` · ${dept.selected.length}/${max}`}
                </dt>
                <dd className="mt-0.5 text-text-primary">
                  {lockedAll
                    ? quote
                      ? k.dept.custom
                      : k.dept.all
                    : dept.selected.length
                      ? dept.selected.map(deptName).join(', ')
                      : k.summary.none}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-muted">{k.summary.users}</dt>
                <dd className="mt-0.5 text-text-primary">
                  {fill(k.summary.usersValue, { n: users })}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-muted">{k.summary.storage}</dt>
                <dd className="mt-0.5 text-text-primary">{storageText(plan, c.values)}</dd>
              </div>
              <div>
                <dt className="text-caption text-text-muted">{k.summary.addons}</dt>
                <dd className="mt-1">
                  {usable.length === 0 && included.length === 0 ? (
                    <span className="text-text-secondary">{k.summary.none}</span>
                  ) : (
                    <ul className="space-y-1.5">
                      {usable.map((a) => (
                        <li key={a} data-summary-addon={a} className="flex justify-between gap-3">
                          <span className="text-text-primary">{c.addons.items[a].name}</span>
                          <span className="shrink-0 text-caption text-warning">
                            {ADDON_AVAILABILITY[a][plan.id] === 'scope'
                              ? c.values.availability.scope
                              : k.summary.assess}
                          </span>
                        </li>
                      ))}
                      {included.map((a) => (
                        <li key={a} className="flex justify-between gap-3">
                          <span className="text-text-secondary">{c.addons.items[a].name}</span>
                          <span className="shrink-0 text-caption text-brand-soft">
                            {k.summary.included}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
            {!quote && usable.length > 0 && (
              <p className="mt-4 text-caption text-text-secondary">{k.summary.assessNote}</p>
            )}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link to={href('/contact?interest=plans')} className={buttonClasses('primary', 'md')}>
                {quote ? c.enterprise.quote : k.summary.send}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link to={href('/contact')} className={buttonClasses('secondary', 'md')}>
                {quote ? c.enterprise.talk : c.explorer.demo}
              </Link>
            </div>
            <p className="mt-4 text-caption text-text-muted">{k.presentation}</p>
          </div>
        </aside>
      </div>

      {/* The future self-service purchase flow */}
      <div className="mt-14 rounded-[1.75rem] border border-border-soft bg-surface-base/70 p-5 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-body-lg font-semibold text-text-primary">{k.flow.title}</h3>
          <span className="rounded-full border border-border-soft px-3 py-1 text-caption text-text-secondary">
            {k.flow.status}
          </span>
        </div>
        <ol className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" data-purchase-flow>
          {k.flow.steps.map((s, i) => {
            const here = i < 5;
            return (
              <li
                key={s}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3',
                  here
                    ? 'border-border-brand/50 bg-surface-raised/60'
                    : 'border-dashed border-border-strong',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-caption tabular',
                    here
                      ? 'border-border-brand text-text-primary'
                      : 'border-border-strong text-text-muted',
                  )}
                >
                  {here ? i + 1 : <Lock className="size-3.5" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block text-label text-text-primary">{s}</span>
                  <span className="block text-caption text-text-muted">
                    {here ? k.flow.here : k.flow.soon}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-label text-text-secondary">{k.flow.now}</p>
      </div>
    </Section>
  );
}
