import { Check, ChevronDown, KeyRound, Minus, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import type { DepartmentCode } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import {
  controlApi,
  type Member,
  type MemberPermissions,
  type PermissionDefinition,
  type PermissionEffect,
  type PermissionNamespace,
  type PermissionProfiles,
  type PermissionState,
} from './api';
import { RequirePermission } from './CompanyShell';
import { CONTROL_COPY } from './copy';
import { errorText, useDepartmentName, useLoad } from './model';
import { PERMISSION_COPY } from './permissionCopy';
import { AreaLink, Loading, PageTitle, Pill, Section } from './parts';

/*
 * /company/permissions (EP27) — what roles and people may do.
 *
 *   Role profiles      the code-defined defaults per role, read only: a
 *                      compact matrix on wide screens, one card per role on
 *                      narrow ones
 *   Member exceptions  choose a person → their effective permissions grouped
 *                      by area and resource, with the source of each (role
 *                      default · exception · owner invariant) and why a
 *                      default is inactive; exceptions are edited as a batch
 *                      and saved in one request (denials confirmed first)
 *
 * The server decides every state shown here and checks every change again.
 */

const NAMESPACES: readonly PermissionNamespace[] = [
  'COMPANY_ADMIN',
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
];

export function PermissionsPage() {
  return (
    <RequirePermission permission="company.permissions.view">
      <Permissions />
    </RequirePermission>
  );
}

function Permissions() {
  const c = useCopy(CONTROL_COPY);
  const p = useCopy(PERMISSION_COPY);
  const [params] = useSearchParams();
  const view = params.get('view') === 'members' || params.get('member') ? 'members' : 'roles';
  const { state } = useLoad(controlApi.permissionProfiles);

  return (
    <div className="grid gap-6">
      <PageTitle title={p.page.title} lead={p.page.lead} />
      <nav aria-label={p.page.tabsLabel} className="flex gap-6 border-b border-white/[0.07]">
        {(
          [
            ['roles', '/company/permissions', p.page.tabs.profiles],
            ['members', '/company/permissions?view=members', p.page.tabs.members],
          ] as const
        ).map(([key, to, label]) => (
          <AreaLink
            key={key}
            to={to}
            aria-current={view === key ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center border-b-2 px-1 text-label transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none',
              view === key
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {label}
          </AreaLink>
        ))}
      </nav>
      {state.status === 'loading' ? (
        <Loading label={c.shell.loading} />
      ) : state.status === 'error' ? (
        <Notice tone="error">{errorText(state.error, c)}</Notice>
      ) : view === 'roles' ? (
        <RoleProfiles profiles={state.data} />
      ) : (
        <MemberExceptions profiles={state.data} memberId={params.get('member')} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ role profiles */

function useGroupName() {
  const p = useCopy(PERMISSION_COPY);
  const dept = useDepartmentName();
  return (ns: PermissionNamespace) => (ns === 'COMPANY_ADMIN' ? p.adminGroup : dept(ns));
}

function RoleProfiles({ profiles }: { profiles: PermissionProfiles }) {
  const p = useCopy(PERMISSION_COPY);
  const auth = useCopy(AUTH_COPY);
  const groupName = useGroupName();

  const groupNote = (ns: PermissionNamespace) =>
    ns === 'COMPANY_ADMIN'
      ? null
      : !profiles.enabledDepartments.includes(ns)
        ? p.profiles.notEnabled
        : ns === 'EXECUTIVE' && !profiles.executiveAllowed
          ? p.profiles.notInPackage
          : null;

  /** What a role holds in a group, in words. */
  const cell = (r: PermissionProfiles['roles'][number], ns: PermissionNamespace) => {
    if (ns === 'COMPANY_ADMIN') {
      return {
        main: r.admin.includes('company.permissions.manage')
          ? p.profiles.administer
          : r.admin.includes('company.members.view')
            ? p.profiles.readPeople
            : p.profiles.readOnly,
        sub: null,
      };
    }
    return {
      main: r.operational.tiers.map((t) => p.profiles.tiers[t]).join(' · '),
      sub: r.operational.requiresAssignment ? p.profiles.assignedOnly : p.profiles.everywhere,
    };
  };

  return (
    <Section id="role-profiles-title" title={p.page.tabs.profiles}>
      <p className="mb-5 flex items-start gap-2 text-caption text-text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-soft" />
        {p.profiles.lead}
      </p>

      {/* Wide screens: one compact matrix. */}
      <div className="max-xl:hidden" data-role-matrix>
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <caption className="sr-only">{p.page.tabs.profiles}</caption>
          <thead>
            <tr className="text-caption text-text-muted">
              <th scope="col" className="w-[17%] pb-3 font-medium">
                {p.profiles.group}
              </th>
              {profiles.roles.map((r) => (
                <th key={r.role} scope="col" className="pb-3 pl-3 font-medium">
                  {auth.roles[r.role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NAMESPACES.map((ns) => {
              const note = groupNote(ns);
              return (
                <tr key={ns} data-group={ns} className={cn(note && 'opacity-70')}>
                  <th
                    scope="row"
                    className="border-t border-white/[0.06] py-3 pr-3 align-top text-label font-semibold text-text-primary"
                  >
                    {groupName(ns)}
                    {note && (
                      <span className="block text-caption font-normal text-text-muted">{note}</span>
                    )}
                  </th>
                  {profiles.roles.map((r) => {
                    const v = cell(r, ns);
                    return (
                      <td
                        key={r.role}
                        className="border-t border-white/[0.06] py-3 pl-3 align-top text-caption"
                      >
                        <span className="block text-text-primary">{v.main}</span>
                        {v.sub && <span className="block text-text-muted">{v.sub}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Every width: what each role means (the only view below xl). */}
      <ul className="grid gap-3 md:grid-cols-2 xl:mt-8 xl:grid-cols-3" data-role-cards>
        {profiles.roles.map((r) => (
          <li
            key={r.role}
            data-role={r.role}
            className="rounded-xl bg-white/[0.02] p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
          >
            <h3 className="text-label font-semibold text-text-primary">{auth.roles[r.role]}</h3>
            <p className="mt-1 text-caption text-text-secondary">{p.profiles.roles[r.role]}</p>
            <dl className="mt-3 grid gap-1 text-caption xl:hidden">
              {(['COMPANY_ADMIN', 'SALES'] as const).map((ns) => {
                const v = cell(r, ns);
                return (
                  <div key={ns} className="flex flex-wrap gap-x-2">
                    <dt className="text-text-muted">
                      {ns === 'COMPANY_ADMIN' ? p.adminGroup : p.profiles.departments}:
                    </dt>
                    <dd className="text-text-primary">
                      {v.main}
                      {v.sub && <span className="text-text-muted"> — {v.sub}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------- member exceptions */

function MemberExceptions({
  profiles,
  memberId,
}: {
  profiles: PermissionProfiles;
  memberId: string | null;
}) {
  const p = useCopy(PERMISSION_COPY);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:gap-8">
      <MemberPicker selected={memberId} />
      {memberId ? (
        <MemberPanel key={memberId} memberId={memberId} catalog={profiles.catalog} />
      ) : (
        <p className="text-label text-text-secondary" data-pick-member>
          {p.members.pickFirst}
        </p>
      )}
    </div>
  );
}

function MemberPicker({ selected }: { selected: string | null }) {
  const p = useCopy(PERMISSION_COPY);
  const c = useCopy(CONTROL_COPY);
  const auth = useCopy(AUTH_COPY);
  const searchId = useId();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Member[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      controlApi
        .members({ q: q.trim(), status: 'ACTIVE', pageSize: 50 })
        .then((r) => live && (setList(r.members), setError(null)))
        .catch((e: unknown) => live && setError(e));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <section
      aria-labelledby={`${searchId}-title`}
      className="grid content-start gap-3"
      data-member-picker
    >
      <h2 id={`${searchId}-title`} className="text-body font-semibold text-text-primary">
        {p.members.choose}
      </h2>
      <label htmlFor={searchId} className="sr-only">
        {p.members.search}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
        />
        <input
          id={searchId}
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder={p.members.searchHint}
          className="min-h-11 w-full rounded-xl bg-white/[0.04] py-2 pr-3 pl-9 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>
      {error ? (
        <Notice tone="error">{errorText(error, c)}</Notice>
      ) : !list ? (
        <Loading label={c.shell.loading} />
      ) : list.length === 0 ? (
        <p className="text-caption text-text-muted">{p.members.noMatch}</p>
      ) : (
        <ul className="grid max-h-[28rem] gap-1 overflow-y-auto pr-1 max-xl:max-h-64">
          {list.map((m) => {
            const on = m.id === selected;
            return (
              <li key={m.id}>
                <AreaLink
                  to={`/company/permissions?view=members&member=${encodeURIComponent(m.id)}`}
                  aria-current={on ? 'true' : undefined}
                  data-pick={m.email}
                  className={cn(
                    'grid gap-0.5 rounded-lg px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none',
                    on
                      ? 'bg-brand-primary/[0.1] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                      : 'hover:bg-white/[0.04]',
                  )}
                >
                  <span className="truncate text-label text-text-primary">
                    {m.fullName ?? m.email}
                  </span>
                  <span className="truncate text-caption text-text-muted">
                    {auth.roles[m.role]}
                  </span>
                </AreaLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Choice = PermissionEffect | 'DEFAULT';

function MemberPanel({ memberId, catalog }: { memberId: string; catalog: PermissionDefinition[] }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const p = useCopy(PERMISSION_COPY);
  const auth = useCopy(AUTH_COPY);
  const dept = useDepartmentName();
  const groupName = useGroupName();
  const { state, set } = useLoad(() => controlApi.memberPermissions(memberId));
  const [pending, setPending] = useState<Record<string, Choice>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  // Keyboard focus follows the save bar: onto the confirmation, back to Save.
  const returnFocus = useRef(false);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      saveRef.current?.focus();
    }
  }, [confirming]);

  const byCode = useMemo(
    () => new Map(state.status === 'ready' ? state.data.permissions.map((s) => [s.code, s]) : []),
    [state],
  );

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const data: MemberPermissions = state.data;
  const m = data.member;
  const changes = Object.entries(pending).filter(
    ([code, choice]) => (byCode.get(code as never)?.override ?? 'DEFAULT') !== choice,
  );
  const losing = changes.filter(
    ([code, choice]) => choice === 'DENY' && byCode.get(code as never)?.effective,
  ).length;
  const allowedCount = data.permissions.filter((s) => s.effective).length;

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const next = await controlApi.setMemberPermissions(
        m.id,
        changes.map(([code, choice]) => ({
          permission: code as PermissionState['code'],
          effect: choice === 'DEFAULT' ? null : choice,
        })),
      );
      set(next);
      setPending({});
      setNotice({ tone: 'success', text: p.members.saved });
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e, c) });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section
      aria-labelledby="member-permissions-title"
      className="grid content-start gap-5"
      data-member-permissions={m.email}
    >
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2
            id="member-permissions-title"
            className="min-w-0 text-[1.375rem] font-semibold tracking-tight break-words text-text-primary"
          >
            {m.fullName ?? m.email}
          </h2>
          <Pill tone={m.isOwner ? 'teal' : 'neutral'}>{auth.roles[m.role]}</Pill>
          {m.status !== 'ACTIVE' && <Pill tone="warning">{a.people.statuses[m.status]}</Pill>}
        </div>
        <p className="text-caption text-text-secondary">
          {p.members.summary(allowedCount, data.permissions.length)} · {p.members.assigned}:{' '}
          {data.assignedDepartments.length
            ? data.assignedDepartments.map((d) => dept(d)).join(', ')
            : p.members.noneAssigned}
        </p>
      </div>
      {data.protection && (
        <Notice tone="info">
          <span data-protection={data.protection}>{a.member.protection[data.protection]}</span>
        </Notice>
      )}
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      <div className="grid gap-3">
        {NAMESPACES.map((ns) => {
          const defs = catalog.filter((d) => d.namespace === ns);
          const states = defs.map((d) => byCode.get(d.code)!).filter(Boolean);
          const allowed = states.filter((s) => s.effective).length;
          const disabled =
            ns !== 'COMPANY_ADMIN' && !data.enabledDepartments.includes(ns as DepartmentCode);
          const interesting = states.some((s) => s.effective || s.override);
          return (
            <details
              key={ns}
              open={interesting && ns !== 'COMPANY_ADMIN'}
              data-permission-group={ns}
              className="group rounded-xl bg-white/[0.02] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
                <span className="min-w-0 flex-1 text-label font-semibold text-text-primary">
                  {groupName(ns)}
                </span>
                {disabled && <Pill tone="muted">{p.profiles.notEnabled}</Pill>}
                <span className="shrink-0 font-mono text-caption text-text-muted tabular-nums">
                  {allowed}/{states.length}
                </span>
              </summary>
              <div className="grid gap-4 px-4 pt-1 pb-4">
                {ns === 'COMPANY_ADMIN' && (
                  <p className="text-caption text-text-muted">{p.members.adminFixed}</p>
                )}
                {[...new Set(defs.map((d) => d.resource))].map((resource) => (
                  <div key={resource} className="grid gap-1.5" data-resource={resource}>
                    <h3 className="text-caption font-semibold tracking-wide text-text-muted uppercase">
                      {p.resources[resource] ?? resource}
                    </h3>
                    <ul className="grid gap-1">
                      {defs
                        .filter((d) => d.resource === resource)
                        .map((d) => (
                          <PermissionRow
                            key={d.code}
                            def={d}
                            state={byCode.get(d.code)!}
                            editable={data.canManage && d.overridable}
                            choice={pending[d.code]}
                            onChoice={(choice) => setPending((x) => ({ ...x, [d.code]: choice }))}
                          />
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {changes.length > 0 && (
        <div
          className="sticky bottom-3 z-10 grid gap-3 rounded-xl bg-[rgb(8_20_24/0.96)] p-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3),0_12px_32px_rgb(0_0_0/0.4)]"
          data-pending={changes.length}
        >
          {confirming ? (
            <div role="group" aria-label={p.members.confirmTitle} className="grid gap-3">
              <p className="text-label font-semibold text-text-primary">{p.members.confirmTitle}</p>
              <p className="text-caption text-text-secondary">{p.members.confirmBody(losing)}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  ref={confirmRef}
                  onClick={() => void save()}
                  className={buttonClasses('primary', 'md')}
                  data-confirm-permissions
                >
                  {busy ? p.members.saving : p.members.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    returnFocus.current = true;
                    setConfirming(false);
                  }}
                  className={buttonClasses('ghost', 'md')}
                >
                  {p.members.back}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-label text-text-primary" role="status">
                {p.members.pending(changes.length)}
              </span>
              <span className="flex flex-1 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPending({})}
                  className={buttonClasses('ghost', 'md')}
                >
                  {p.members.discard}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  ref={saveRef}
                  onClick={() => (losing > 0 ? setConfirming(true) : void save())}
                  className={buttonClasses('primary', 'md')}
                  data-save-permissions
                >
                  <KeyRound aria-hidden className="size-4" />
                  {busy ? p.members.saving : p.members.save}
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PermissionRow({
  def,
  state,
  editable,
  choice,
  onChoice,
}: {
  def: PermissionDefinition;
  state: PermissionState;
  editable: boolean;
  choice: Choice | undefined;
  onChoice: (c: Choice) => void;
}) {
  const p = useCopy(PERMISSION_COPY);
  const id = useId();
  const current: Choice = state.override ?? 'DEFAULT';
  const value = choice ?? current;
  const label = `${p.resources[def.resource] ?? def.resource} — ${p.actions[def.action] ?? def.action}`;
  // An ALLOW the server would refuse (department disabled, not in the package, not assigned).
  const allowBlocked = state.blocked !== null && current !== 'ALLOW';
  return (
    <li
      data-permission={def.code}
      data-effective={state.effective}
      className="grid items-center gap-x-4 gap-y-1.5 rounded-lg px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_11rem]"
    >
      <span className="min-w-0">
        <span className="block text-label text-text-primary">
          {p.actions[def.action] ?? def.action}
        </span>
        <span className="block font-mono text-[0.6875rem] text-text-muted">
          <span className="sr-only">{p.members.code}: </span>
          {def.code}
        </span>
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption sm:max-lg:order-last sm:max-lg:col-span-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium',
            state.effective ? 'text-brand-soft' : 'text-text-muted',
          )}
        >
          {state.effective ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Minus aria-hidden className="size-3.5" />
          )}
          {state.effective ? p.members.allowed : p.members.notAllowed}
        </span>
        <span className="text-text-secondary">· {p.members.sources[state.source]}</span>
        {state.blocked && (
          <span className="text-warning">· {p.members.blocked[state.blocked]}</span>
        )}
      </span>
      {editable ? (
        <span>
          <label htmlFor={id} className="sr-only">
            {p.members.exception}: {label}
          </label>
          <select
            id={id}
            value={value}
            onChange={(e) => onChoice(e.target.value as Choice)}
            className={cn(
              'min-h-10 w-full rounded-lg bg-white/[0.04] px-2.5 text-caption text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              value !== current && 'shadow-[inset_0_0_0_1px_rgb(62_240_192/0.5)]',
            )}
            data-exception={def.code}
          >
            <option value="DEFAULT">{p.members.choice.DEFAULT}</option>
            <option value="ALLOW" disabled={allowBlocked}>
              {p.members.choice.ALLOW}
            </option>
            <option value="DENY">{p.members.choice.DENY}</option>
          </select>
        </span>
      ) : (
        <span aria-hidden className="max-sm:hidden" />
      )}
    </li>
  );
}
