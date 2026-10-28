import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import type { CompanyRole } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { SelectField, TextField } from '@/features/auth/fields';
import type { DepartmentCode } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import { ScopeSummary } from './adminParts';
import { controlApi, type BranchScope, type MemberDetail } from './api';
import { RequireCapability } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useDateFormat, useDepartmentName, useLoad } from './model';
import { AreaLink, Fact, Facts, Loading, Pill, Result, Section } from './parts';
import { BranchScopeEditor } from './UsersPage';

/*
 * /company/users/:memberId (EP26) — one person's company access: role and
 * job title, departments, branch access and whether the membership is
 * active, plus the history of these changes. The account itself (name,
 * email, phone, password) belongs to the person and is not edited here.
 *
 * The server decides what may change (`canManage`, `protection`): the
 * Company Owner is never changed here, nobody changes their own access, and a
 * System Admin leaves other System Admins to the owner. Every save is checked
 * again on the server; the editors only reflect its answer.
 */
export function MemberDetailPage() {
  const { memberId = '' } = useParams();
  return (
    <RequireCapability capability="members.view">
      <MemberLoader key={memberId} memberId={memberId} />
    </RequireCapability>
  );
}

function MemberLoader({ memberId }: { memberId: string }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const { state, set } = useLoad(() => controlApi.member(memberId));
  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') {
    const missing = state.error instanceof ApiError && state.error.status === 404;
    return (
      <div className="grid gap-4">
        <BackLink />
        <Notice tone="error">{missing ? a.member.notFound : errorText(state.error, c)}</Notice>
      </div>
    );
  }
  return <Member data={state.data} replace={set} />;
}

function BackLink() {
  const a = useCopy(ADMIN_COPY);
  return (
    <AreaLink
      to="/company/users"
      className="inline-flex min-h-11 w-fit items-center gap-2 text-caption text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {a.member.back}
    </AreaLink>
  );
}

type Saved = { tone: 'success' | 'error'; text: string } | null;

function Member({ data, replace }: { data: MemberDetail; replace: (d: MemberDetail) => void }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const { date, dateTime } = useDateFormat();
  const m = data.member;
  const name = m.fullName ?? m.email;
  const editable = m.canManage;

  return (
    <div className="grid gap-8" data-member-detail={m.email}>
      <div className="grid gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight break-words text-text-primary">
            {name}
          </h1>
          <Pill tone={m.isOwner ? 'teal' : 'neutral'}>
            {m.isOwner && <ShieldCheck aria-hidden className="size-3.5" />}
            {auth.roles[m.role]}
          </Pill>
          <Pill tone={m.status === 'ACTIVE' ? 'teal' : 'warning'}>
            {a.people.statuses[m.status]}
          </Pill>
          {m.isSelf && <Pill tone="muted">{c.users.you}</Pill>}
        </div>
      </div>
      {data.protection && (
        <Notice tone="info">
          <span data-protection={data.protection}>{a.member.protection[data.protection]}</span>
        </Notice>
      )}
      {!data.canManage && <Notice tone="info">{c.shell.readOnly}</Notice>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-12">
        <div className="grid content-start gap-8">
          <Section id="member-identity-title" title={a.member.identity}>
            <Facts>
              <Fact term={a.member.name}>{m.fullName ?? c.common.notSet}</Fact>
              <Fact term={a.member.email}>
                <span className="break-all">{m.email}</span>
              </Fact>
              <Fact term={a.member.phone}>
                {m.phone ? <span className="tabular-nums">{m.phone}</span> : c.common.notSet}
              </Fact>
              <Fact term={c.users.jobTitle}>{m.jobTitle ?? c.common.notSet}</Fact>
              <Fact term={a.member.joined}>{date(m.joinedAt)}</Fact>
              <Fact term={a.member.lastSignIn}>
                {m.lastLoginAt ? dateTime(m.lastLoginAt) : a.people.never}
              </Fact>
            </Facts>
            <p className="mt-3 text-caption text-text-muted">{a.member.identityNote}</p>
          </Section>

          {editable ? (
            <RoleEditor data={data} replace={replace} />
          ) : (
            <Section id="member-role-title" title={a.member.roleTitle}>
              <p className="text-label text-text-primary">{auth.roles[m.role]}</p>
            </Section>
          )}

          {editable ? (
            <DepartmentEditor data={data} replace={replace} />
          ) : (
            <Section id="member-departments-title" title={a.member.departmentsTitle}>
              <DepartmentList data={data} />
            </Section>
          )}
        </div>

        <div className="grid content-start gap-8">
          {editable ? (
            <BranchEditor data={data} replace={replace} />
          ) : (
            <Section id="member-branches-title" title={a.member.branchesTitle}>
              {m.isOwner ? (
                <p className="text-label text-text-primary">{a.scope.allLong}</p>
              ) : (
                <ScopeSummary access={m.branchAccess} />
              )}
            </Section>
          )}

          <StatusPanel data={data} replace={replace} />

          <Section id="member-history-title" title={a.member.historyTitle}>
            {data.history.length === 0 ? (
              <p className="text-caption text-text-muted">{a.member.historyNone}</p>
            ) : (
              <ol className="grid gap-2.5" data-member-history>
                {data.history.map((e) => (
                  <li key={e.id} className="grid gap-0.5 border-l border-white/[0.08] pl-3">
                    <span className="text-label text-text-primary">
                      {c.security.events[e.type] ?? e.type}
                    </span>
                    <span className="text-caption text-text-muted">
                      {dateTime(e.occurredAt)}
                      {e.actor.kind === 'member' &&
                        ` · ${a.member.by(e.actor.fullName ?? e.actor.email)}`}
                      {e.actor.kind === 'platform' && ` · ${c.security.platform}`}
                      {e.actor.kind === 'system' && ` · ${c.security.system}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function DepartmentList({ data }: { data: MemberDetail }) {
  const c = useCopy(CONTROL_COPY);
  const deptName = useDepartmentName();
  const m = data.member;
  if (m.isOwner) return <p className="text-label text-text-primary">{c.users.allDepartments}</p>;
  if (!m.departments.length)
    return <p className="text-label text-text-secondary">{c.users.departmentsNone}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {m.departments.map((d) => (
        <li key={d.code}>
          <Pill tone="muted" className={d.active ? '' : 'line-through'}>
            {deptName(d.code)}
            {d.primary && <span className="text-brand-soft">· {c.users.primary}</span>}
            {!d.active && <span className="sr-only">({c.users.disabledDept})</span>}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

/** Saves through `run`, reloads the member, and reports in place. */
function useSave(data: MemberDetail, replace: (d: MemberDetail) => void) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const { reload: reloadOverview } = useControl();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Saved>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setResult(null);
    try {
      await fn();
      replace(await controlApi.member(data.member.id));
      setResult({ tone: 'success', text: a.member.saved });
      void reloadOverview().catch(() => undefined);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };
  return { busy, result, run };
}

function Editor({
  id,
  title,
  lead,
  onSubmit,
  busy,
  label,
  result,
  children,
  data,
}: {
  id: string;
  title: string;
  lead: string;
  onSubmit: () => void;
  busy: boolean;
  label: string;
  result: Saved;
  children: ReactNode;
  data?: string;
}) {
  const c = useCopy(CONTROL_COPY);
  return (
    <Section id={id} title={title}>
      <form
        noValidate
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
        className="grid gap-4"
        data-editor={data}
      >
        <p className="text-caption text-text-muted">{lead}</p>
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
            {busy ? c.common.saving : label}
          </button>
        </div>
        <div aria-live="polite">
          <Result result={result} />
        </div>
      </form>
    </Section>
  );
}

function RoleEditor({ data, replace }: { data: MemberDetail; replace: (d: MemberDetail) => void }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const base = useId();
  const m = data.member;
  const [role, setRole] = useState<CompanyRole>(m.role);
  const [jobTitle, setJobTitle] = useState(m.jobTitle ?? '');
  const { busy, result, run } = useSave(data, replace);
  const roles = data.assignableRoles.includes(m.role)
    ? data.assignableRoles
    : [m.role, ...data.assignableRoles];
  return (
    <Editor
      id="member-role-title"
      title={a.member.roleTitle}
      lead={a.member.roleLead}
      label={a.member.saveRole}
      busy={busy}
      result={result}
      data="role"
      onSubmit={() => {
        const patch: { role?: CompanyRole; jobTitle?: string | null } = {};
        if (role !== m.role) patch.role = role;
        if (jobTitle.trim() !== (m.jobTitle ?? '')) patch.jobTitle = jobTitle.trim() || null;
        if (Object.keys(patch).length) void run(() => controlApi.updateMember(m.id, patch));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id={`${base}-role`}
          label={c.users.role}
          value={role}
          onChange={(e) => setRole(e.target.value as CompanyRole)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {auth.roles[r]}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${base}-title`}
          label={`${c.users.jobTitle} (${c.common.optional})`}
          value={jobTitle}
          maxLength={120}
          onChange={(e) => setJobTitle(e.target.value)}
        />
      </div>
      {role === 'EXECUTIVE' && <p className="text-caption text-text-muted">{c.users.executiveNote}</p>}
    </Editor>
  );
}

function DepartmentEditor({
  data,
  replace,
}: {
  data: MemberDetail;
  replace: (d: MemberDetail) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const deptName = useDepartmentName();
  const base = useId();
  const m = data.member;
  const assigned = m.departments.filter((d) => d.active).map((d) => d.code);
  const [departments, setDepartments] = useState<DepartmentCode[]>(assigned);
  const [primary, setPrimary] = useState<DepartmentCode | null>(
    m.departments.find((d) => d.primary && d.active)?.code ?? null,
  );
  const { busy, result, run } = useSave(data, replace);
  const toggle = (code: DepartmentCode) =>
    setDepartments((list) => {
      const next = list.includes(code) ? list.filter((d) => d !== code) : [...list, code];
      if (!next.includes(primary as DepartmentCode)) setPrimary(next.length === 1 ? next[0]! : null);
      return next;
    });
  return (
    <Editor
      id="member-departments-title"
      title={a.member.departmentsTitle}
      lead={a.member.departmentsLead}
      label={a.member.saveDepartments}
      busy={busy}
      result={result}
      data="departments"
      onSubmit={() => void run(() => controlApi.setMemberDepartments(m.id, departments, primary))}
    >
      {data.enabledDepartments.length === 0 ? (
        <p className="text-caption text-text-muted">{c.users.noDepartmentsEnabled}</p>
      ) : (
        <fieldset>
          <legend className="sr-only">{a.member.departmentsTitle}</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.enabledDepartments.map((code) => {
              const on = departments.includes(code);
              return (
                <li
                  key={code}
                  className={cn(
                    'flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
                    on && 'bg-brand-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]',
                  )}
                >
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-label text-text-primary">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(code)}
                      className="size-4 accent-[var(--color-brand-primary)]"
                      data-assign={code}
                    />
                    {deptName(code)}
                  </label>
                  {on && departments.length > 1 && (
                    <label className="flex min-h-9 cursor-pointer items-center gap-1.5 text-caption text-text-secondary">
                      <input
                        type="radio"
                        name={`${base}-primary`}
                        checked={primary === code}
                        onChange={() => setPrimary(code)}
                        className="size-3.5 accent-[var(--color-brand-primary)]"
                      />
                      {c.users.primary}
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </Editor>
  );
}

function BranchEditor({ data, replace }: { data: MemberDetail; replace: (d: MemberDetail) => void }) {
  const a = useCopy(ADMIN_COPY);
  const base = useId();
  const m = data.member;
  const [scope, setScope] = useState<BranchScope>(m.branchAccess.scope);
  const [selected, setSelected] = useState<string[]>(m.branchAccess.branches.map((b) => b.id));
  const [error, setError] = useState<string | null>(null);
  const { busy, result, run } = useSave(data, replace);
  // Active branches can be granted; an inactive one already granted stays visible to remove.
  const options = data.branches.filter(
    (b) => b.status === 'ACTIVE' || selected.includes(b.id),
  );
  return (
    <Editor
      id="member-branches-title"
      title={a.member.branchesTitle}
      lead={a.member.branchesLead}
      label={a.member.saveBranches}
      busy={busy}
      result={result}
      data="branches"
      onSubmit={() => {
        if (scope === 'SELECTED_BRANCHES' && selected.length === 0) {
          setError(a.invite.chooseBranch);
          return;
        }
        setError(null);
        const active = selected.filter((id) =>
          data.branches.some((b) => b.id === id && b.status === 'ACTIVE'),
        );
        void run(() => controlApi.setMemberBranches(m.id, scope, active));
      }}
    >
      <BranchScopeEditor
        name={base}
        scope={scope}
        selected={selected}
        branches={options}
        onScope={setScope}
        onToggle={(id) =>
          setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
        }
        error={error}
      />
      {m.role === 'SYSTEM_ADMIN' && (
        <p className="text-caption text-text-muted">{a.member.adminNote}</p>
      )}
    </Editor>
  );
}

function StatusPanel({ data, replace }: { data: MemberDetail; replace: (d: MemberDetail) => void }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const m = data.member;
  const name = m.fullName ?? m.email;
  const [confirming, setConfirming] = useState(false);
  const { busy, result, run } = useSave(data, replace);
  return (
    <Section id="member-status-title" title={a.member.statusTitle}>
      <p className="text-label text-text-secondary">
        {m.status === 'ACTIVE' ? a.member.statusActive : a.member.statusDeactivated}
      </p>
      {m.canManage && (
        <div className="mt-4 grid gap-3">
          {m.status === 'ACTIVE' ? (
            !confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={buttonClasses('secondary', 'md', 'w-fit')}
                data-deactivate-member
              >
                {c.users.deactivate}
              </button>
            )
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => controlApi.setMemberActive(m.id, true))}
              className={buttonClasses('secondary', 'md', 'w-fit')}
              data-reactivate-member
            >
              {c.users.reactivate}
            </button>
          )}
          {confirming && (
            <div
              role="group"
              aria-label={c.users.deactivate}
              className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
            >
              <p className="text-label text-text-primary">{c.users.confirmDeactivate(name)}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() => controlApi.setMemberActive(m.id, false)).then(() =>
                      setConfirming(false),
                    )
                  }
                  className={buttonClasses('secondary', 'md')}
                  data-confirm-deactivate
                >
                  {c.common.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={buttonClasses('ghost', 'md')}
                >
                  {c.common.cancel}
                </button>
              </div>
            </div>
          )}
          <div aria-live="polite">
            <Result result={result} />
          </div>
        </div>
      )}
    </Section>
  );
}
