import { ArrowRight, CircleCheck, CircleDashed, CircleDot } from 'lucide-react';

import { buttonClasses } from '@/components/ui/buttonStyles';
import { AUTH_COPY } from '@/features/auth/copy';
import { DEPARTMENT_CODES, planId } from '@/features/company/api';
import { COMPANY_COPY } from '@/features/company/copy';
import { getPlan } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { can, type Attention } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { useDateFormat, useDepartmentName } from './model';
import { AreaLink, CompanyMark, Pill, Section } from './parts';

/*
 * /company — the Company Control Center home. It answers, from real rows
 * only: which company, what package, which departments, how many branches and
 * people, whether setup is unfinished, what needs attention, and how to enter
 * CORE. The price is not shown here (the subscription page is for those
 * allowed to see it).
 */
export function Overview() {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const s = useCopy(COMPANY_COPY).summary;
  const { overview: o } = useControl();
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const caps = o.me.capabilities;
  const admin = can(caps, 'members.manage');
  const max = o.plan
    ? o.plan.maxDepartments === 'CUSTOM'
      ? String(DEPARTMENT_CODES.length)
      : String(o.plan.maxDepartments)
    : '—';

  const glance = [
    {
      label: c.overview.departments,
      value: c.overview.departmentsOf(o.departments.enabled.length, max),
      to: '/company/departments',
    },
    {
      label: c.overview.branches,
      value: String(o.counts.branches.active),
      to: '/company/branches',
    },
    {
      label: c.overview.members,
      value: String(o.counts.members.active),
      to: can(caps, 'members.view') ? '/company/users' : null,
    },
    ...(can(caps, 'members.view')
      ? [
          {
            label: c.overview.invitations,
            value: String(o.counts.invitations.open),
            to: '/company/users',
          },
        ]
      : []),
  ];

  const attentionText = (item: Attention): { text: string; detail?: string; to: string } => {
    switch (item.code) {
      case 'PROFILE_INCOMPLETE':
        return {
          text: c.overview.items.PROFILE_INCOMPLETE,
          detail: item.fields.map((f) => c.overview.fields[f]).join(' · '),
          to: '/company/profile',
        };
      case 'ONLY_OWNER':
        return { text: c.overview.items.ONLY_OWNER, to: '/company/users' };
      case 'DEPARTMENTS_UNASSIGNED':
        return {
          text: c.overview.items.DEPARTMENTS_UNASSIGNED,
          detail: item.departments.map(deptName).join(' · '),
          to: '/company/users',
        };
      case 'INVITATIONS_PENDING':
        return {
          text: c.overview.items.INVITATIONS_PENDING(item.count),
          to: '/company/users/invitations',
        };
      case 'INVITATIONS_EXPIRED':
        return {
          text: c.overview.items.INVITATIONS_EXPIRED(item.count),
          to: '/company/users/invitations?state=EXPIRED',
        };
      case 'MEMBERS_WITHOUT_BRANCH':
        return { text: c.overview.items.MEMBERS_WITHOUT_BRANCH(item.count), to: '/company/users' };
      case 'BRANCHES_INACTIVE':
        return { text: c.overview.items.BRANCHES_INACTIVE(item.count), to: '/company/branches' };
      case 'PERIOD_ENDING':
        return {
          text: c.overview.items.PERIOD_ENDING(date(item.endsAt)),
          to: '/company/subscription',
        };
    }
  };

  const doneSteps = o.setup.steps.filter((x) => x.done).length;

  return (
    <div className="grid gap-8" data-company-overview>
      {/* Who and what: the company, its state, the package, the way in. */}
      <div className="grid gap-6 rounded-[1.5rem] bg-[radial-gradient(120%_140%_at_0%_0%,rgb(25_195_154/0.14),transparent_55%),linear-gradient(180deg,rgb(11_24_30/0.95),rgb(7_15_20/0.98))] p-5 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.14)] sm:p-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <CompanyMark name={o.company.displayName} logo={o.company.logo} size="lg" />
          <div className="min-w-0">
            <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-brand-soft uppercase">
              {c.overview.kicker}
            </p>
            <h1 className="mt-1 text-[clamp(1.5rem,1.15rem+1.4vw,2.5rem)] font-semibold tracking-tight break-words text-text-primary">
              {o.company.displayName}
            </h1>
            {o.company.legalName && (
              <p className="mt-1 text-label break-words text-text-secondary">
                {o.company.legalName}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="teal">{s.statuses[o.company.status]}</Pill>
              {o.plan && (
                <Pill tone="neutral">
                  {c.overview.package}: {getPlan(planId(o.plan.plan)).name}
                </Pill>
              )}
              <Pill tone="muted">{c.overview.you(a.roles[o.me.role])}</Pill>
              {o.company.isDemo && <Pill tone="warning">{c.shell.demo}</Pill>}
            </div>
          </div>
        </div>
        {o.access.canEnterCore && (
          <div className="grid gap-2 xl:justify-items-end">
            <AreaLink
              to="/core"
              className={buttonClasses('primary', 'lg')}
              data-enter-core="overview"
            >
              {c.overview.enterCore}
              <ArrowRight aria-hidden className="size-5" />
            </AreaLink>
            <p className="text-caption text-text-muted">{c.overview.enterHint}</p>
          </div>
        )}
      </div>

      {/* At a glance: one row of real counts, each leading to its page. */}
      <section aria-labelledby="glance-title">
        <h2 id="glance-title" className="sr-only">
          {c.overview.glance}
        </h2>
        <ul
          className={cn(
            'grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.06]',
            glance.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
          )}
        >
          {glance.map((g) => {
            const body = (
              <>
                <span className="block text-caption text-text-muted">{g.label}</span>
                <span className="mt-1 block text-[1.5rem] font-semibold text-text-primary tabular-nums">
                  {g.value}
                </span>
              </>
            );
            return (
              <li key={g.label} className="min-w-0 bg-surface-dark">
                {g.to ? (
                  <AreaLink
                    to={g.to}
                    className="block h-full bg-[rgb(9_20_26)] px-4 py-3.5 transition-colors hover:bg-[rgb(12_26_32)] motion-reduce:transition-none sm:px-5"
                  >
                    {body}
                  </AreaLink>
                ) : (
                  <div className="h-full bg-[rgb(9_20_26)] px-4 py-3.5 sm:px-5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {admin ? (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Section id="attention-title" title={c.overview.attention}>
            {o.attention.length === 0 ? (
              <p className="text-label text-text-secondary">{c.overview.attentionNone}</p>
            ) : (
              <ul className="grid gap-2" data-attention>
                {o.attention.map((item) => {
                  const it = attentionText(item);
                  return (
                    <li key={item.code}>
                      <AreaLink
                        to={it.to}
                        data-attention-item={item.code}
                        className="group flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] transition-colors hover:bg-white/[0.05] motion-reduce:transition-none"
                      >
                        <CircleDot aria-hidden className="size-4 shrink-0 text-warning" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-label text-text-primary">{it.text}</span>
                          {it.detail && (
                            <span className="block text-caption text-text-muted">{it.detail}</span>
                          )}
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="size-4 shrink-0 text-text-muted group-hover:text-text-primary"
                        />
                      </AreaLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            id="setup-title"
            title={c.overview.setup}
            aside={
              <span className="text-caption text-text-muted">
                {o.setup.complete
                  ? c.overview.setupDone
                  : c.overview.setupProgress(doneSteps, o.setup.steps.length)}
              </span>
            }
          >
            <ol className="grid gap-2" data-setup={o.setup.complete ? 'complete' : 'open'}>
              {o.setup.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-3 text-label" data-step={step.id}>
                  {step.done ? (
                    <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
                  ) : (
                    <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-text-muted" />
                  )}
                  <span className={step.done ? 'text-text-secondary' : 'text-text-primary'}>
                    {c.overview.steps[step.id]}
                    {step.optional && (
                      <span className="text-text-muted"> ({c.overview.optional})</span>
                    )}
                    <span className="sr-only">
                      {' — '}
                      {step.done ? c.overview.stepDone : c.overview.stepOpen}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      ) : (
        <Section id="mine-title" title={c.overview.yourDepartments}>
          {o.me.departments.length ? (
            <ul className="flex flex-wrap gap-2">
              {o.me.departments.map((d) => (
                <li key={d}>
                  <Pill tone="teal">{deptName(d)}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-label text-text-secondary">{c.overview.yourDepartmentsNone}</p>
          )}
        </Section>
      )}

      <Section
        id="departments-title"
        title={c.overview.departments}
        aside={
          <AreaLink
            to="/company/departments"
            className="inline-flex min-h-6 items-center text-caption text-brand-soft underline underline-offset-4"
          >
            {c.overview.open}
          </AreaLink>
        }
      >
        <ul
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
          data-overview-departments
        >
          {DEPARTMENT_CODES.map((code) => {
            const on = o.departments.enabled.includes(code);
            return (
              <li
                key={code}
                data-department={code}
                data-enabled={on}
                className={cn(
                  'rounded-xl px-3.5 py-3 text-label',
                  on
                    ? 'bg-brand-primary/[0.07] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.2)]'
                    : 'text-text-muted shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
                )}
              >
                <span className="block truncate">{deptName(code)}</span>
                <span className="block text-caption text-text-muted">
                  {on ? c.common.active : c.common.inactive}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
