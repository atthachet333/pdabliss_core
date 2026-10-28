import { MailPlus, ShieldCheck, UserRound } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import type { CompanyRole } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { SelectField, TextField } from '@/features/auth/fields';
import type { DepartmentCode } from '@/features/company/api';
import type { Locale } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { controlApi, type Member, type MemberList } from './api';
import { RequireCapability } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, initials, useDateFormat, useDepartmentName, useLoad } from './model';
import { Loading, PageTitle, Pill, Result, Section } from './parts';

/*
 * /company/users — the people of the company and its open invitations.
 * Owner and System Admin manage; an Executive reads; department roles do not
 * open this page. What the caller may change on each person comes from the
 * server (`canManage`): the Company Owner is never manageable, nobody changes
 * their own access, and a System Admin leaves other System Admins to the owner.
 *
 * One human = one account: departments are assignments on that one account.
 */

export function UsersPage() {
  return (
    <RequireCapability capability="members.view">
      <Users />
    </RequireCapability>
  );
}

function Users() {
  const c = useCopy(CONTROL_COPY);
  const { reload: reloadOverview } = useControl();
  const { state, set } = useLoad(controlApi.members);
  const [inviting, setInviting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const data = state.data;
  const active = data.members.filter((m) => m.status === 'ACTIVE').length;

  const updated = (next: MemberList, text: string) => {
    set(next);
    setNotice({ tone: 'success', text });
    void reloadOverview().catch(() => undefined);
  };

  return (
    <div className="grid gap-8">
      <PageTitle
        title={c.users.title}
        lead={c.users.lead}
        action={
          data.canManage && !inviting ? (
            <button
              type="button"
              onClick={() => {
                setInviting(true);
                setNotice(null);
              }}
              className={buttonClasses('primary', 'md')}
              data-invite
            >
              <MailPlus aria-hidden className="size-4" />
              {c.users.invite}
            </button>
          ) : undefined
        }
      />
      {!data.canManage && <Notice tone="info">{c.shell.readOnly}</Notice>}
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      {inviting && (
        <Section id="invite-title" title={c.users.inviteTitle}>
          <InviteForm
            roles={data.assignableRoles}
            defaultLocale={data.defaultLocale}
            onCancel={() => setInviting(false)}
            onSent={async (email) => {
              setInviting(false);
              setNotice({ tone: 'success', text: c.users.sent(email) });
              set(await controlApi.members());
              void reloadOverview().catch(() => undefined);
            }}
          />
        </Section>
      )}

      <Section
        id="members-title"
        title={c.users.members}
        aside={<span className="text-caption text-text-muted">{c.users.count(active)}</span>}
      >
        <ul className="grid gap-3" data-member-list>
          {data.members.map((m) => (
            <li key={m.id}>
              <MemberRow
                member={m}
                data={data}
                open={open === m.id}
                onToggle={() => {
                  setOpen(open === m.id ? null : m.id);
                  setNotice(null);
                }}
                onUpdated={(next, text) => {
                  updated(next, text);
                  setOpen(null);
                }}
                onError={(text) => setNotice({ tone: 'error', text })}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Invitations
        data={data}
        onChanged={(next, text) => updated(next, text)}
        onError={(text) => setNotice({ tone: 'error', text })}
      />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-caption font-semibold text-text-secondary"
    >
      {initials(name)}
    </span>
  );
}

function MemberRow({
  member: m,
  data,
  open,
  onToggle,
  onUpdated,
  onError,
}: {
  member: Member;
  data: MemberList;
  open: boolean;
  onToggle: () => void;
  onUpdated: (next: MemberList, text: string) => void;
  onError: (text: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const panelId = useId();
  const name = m.fullName ?? m.email;
  const off = m.status === 'DEACTIVATED';

  return (
    <article
      aria-label={name}
      data-member={m.email}
      data-role={m.role}
      data-status={m.status}
      className={cn(
        'grid gap-4 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] sm:p-5',
        off ? 'opacity-75' : 'bg-white/[0.025]',
      )}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-label font-semibold break-words text-text-primary">{name}</span>
              {m.isSelf && <Pill tone="muted">{c.users.you}</Pill>}
              {off && <Pill tone="warning">{c.users.deactivatedNote}</Pill>}
            </p>
            <p className="text-caption break-all text-text-secondary">{m.email}</p>
            <p className="text-caption text-text-muted">
              {[m.jobTitle, m.phone].filter(Boolean).join(' · ') || null}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone={m.isOwner ? 'teal' : 'neutral'}>
            {m.isOwner && <ShieldCheck aria-hidden className="size-3.5" />}
            {a.roles[m.role]}
          </Pill>
          {m.isOwner ? (
            <span className="text-caption text-text-muted">{c.users.allDepartments}</span>
          ) : m.departments.length ? (
            m.departments.map((d) => (
              <Pill key={d.code} tone="muted" className={d.active ? '' : 'line-through'}>
                {deptName(d.code)}
                {d.primary && <span className="text-brand-soft">· {c.users.primary}</span>}
                {!d.active && <span className="sr-only">({c.users.disabledDept})</span>}
              </Pill>
            ))
          ) : (
            <span className="text-caption text-text-muted">{c.users.departmentsNone}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {m.canManage ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={panelId}
              className={buttonClasses('secondary', 'md')}
              data-manage={m.email}
            >
              {c.users.manage}
            </button>
          ) : (
            data.canManage && (
              <span className="text-caption text-text-muted">
                {m.isOwner ? c.users.owner : m.isSelf ? null : c.users.protectedNote}
              </span>
            )
          )}
        </div>
      </div>
      <p className="text-caption text-text-muted">
        {c.users.joined(date(m.joinedAt))} ·{' '}
        {m.lastLoginAt ? c.users.lastLogin(date(m.lastLoginAt)) : c.users.neverLoggedIn}
      </p>
      <div id={panelId} hidden={!open}>
        {open && <ManagePanel member={m} data={data} onUpdated={onUpdated} onError={onError} />}
      </div>
    </article>
  );
}

function ManagePanel({
  member: m,
  data,
  onUpdated,
  onError,
}: {
  member: Member;
  data: MemberList;
  onUpdated: (next: MemberList, text: string) => void;
  onError: (text: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const base = useId();
  const [role, setRole] = useState<CompanyRole>(m.role);
  const [jobTitle, setJobTitle] = useState(m.jobTitle ?? '');
  const assignedActive = m.departments.filter((d) => d.active).map((d) => d.code);
  const [departments, setDepartments] = useState<DepartmentCode[]>(assignedActive);
  const [primary, setPrimary] = useState<DepartmentCode | null>(
    m.departments.find((d) => d.primary && d.active)?.code ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const roles = data.assignableRoles.includes(m.role)
    ? data.assignableRoles
    : [m.role, ...data.assignableRoles];
  const name = m.fullName ?? m.email;

  const toggle = (code: DepartmentCode) => {
    setDepartments((list) => {
      const next = list.includes(code) ? list.filter((d) => d !== code) : [...list, code];
      if (!next.includes(primary as DepartmentCode))
        setPrimary(next.length === 1 ? next[0]! : null);
      return next;
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      let next: MemberList | null = null;
      const patch: { role?: CompanyRole; jobTitle?: string | null } = {};
      if (role !== m.role) patch.role = role;
      if (jobTitle.trim() !== (m.jobTitle ?? '')) patch.jobTitle = jobTitle.trim() || null;
      if (Object.keys(patch).length) next = await controlApi.updateMember(m.id, patch);
      const before = [...assignedActive].sort().join();
      const beforePrimary = m.departments.find((d) => d.primary && d.active)?.code ?? null;
      if ([...departments].sort().join() !== before || primary !== beforePrimary) {
        next = await controlApi.setMemberDepartments(m.id, departments, primary);
      }
      if (next) onUpdated(next, c.users.accessSaved);
      else setResult({ tone: 'success', text: c.profile.nothing });
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (activeNow: boolean) => {
    setBusy(true);
    try {
      onUpdated(await controlApi.setMemberActive(m.id, activeNow), c.users.accessSaved);
    } catch (err) {
      onError(errorText(err, c));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void save(e)}
      aria-label={c.users.manageTitle(name)}
      className="grid gap-5 border-t border-white/[0.07] pt-4"
      data-manage-panel={m.email}
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
              {a.roles[r]}
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
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-label font-medium text-text-primary">
          {c.users.departments}
        </legend>
        {role === 'EXECUTIVE' && (
          <p className="text-caption text-text-muted">{c.users.executiveNote}</p>
        )}
        {data.enabledDepartments.length === 0 ? (
          <p className="text-caption text-text-muted">{c.users.noDepartmentsEnabled}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
          {busy ? c.common.saving : c.users.saveAccess}
        </button>
        {m.status === 'ACTIVE' ? (
          !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={buttonClasses('ghost', 'md')}
            >
              {c.users.deactivate}
            </button>
          )
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setActive(true)}
            className={buttonClasses('ghost', 'md')}
          >
            {c.users.reactivate}
          </button>
        )}
      </div>
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
              onClick={() => void setActive(false)}
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
      <Result result={result} />
    </form>
  );
}

function InviteForm({
  roles,
  defaultLocale,
  onCancel,
  onSent,
}: {
  roles: CompanyRole[];
  defaultLocale: Locale;
  onCancel: () => void;
  onSent: (email: string) => Promise<void>;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const base = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole>(
    roles.includes('DEPARTMENT_STAFF') ? 'DEPARTMENT_STAFF' : roles[0]!,
  );
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(c.profile.invalid.email);
      document.getElementById(`${base}-email`)?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await controlApi.invite({ email: value, role, locale });
      await onSent(value);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-4" data-invite-form>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <TextField
          id={`${base}-email`}
          label={c.users.email}
          type="email"
          autoComplete="off"
          value={email}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <SelectField
          id={`${base}-role`}
          label={c.users.role}
          value={role}
          onChange={(e) => setRole(e.target.value as CompanyRole)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {a.roles[r]}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${base}-locale`}
          label={c.users.language}
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {(['th', 'en', 'zh-CN'] as const).map((l) => (
            <option key={l} value={l}>
              {c.settings.languages[l]}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="text-caption text-text-muted">{c.users.inviteNote}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className={buttonClasses('primary', 'md')}>
          <MailPlus aria-hidden className="size-4" />
          {busy ? c.users.sending : c.users.send}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses('ghost', 'md')}>
          {c.common.cancel}
        </button>
      </div>
      <Result result={result} />
    </form>
  );
}

function Invitations({
  data,
  onChanged,
  onError,
}: {
  data: MemberList;
  onChanged: (next: MemberList, text: string) => void;
  onError: (text: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const { date } = useDateFormat();
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await controlApi.revokeInvitation(id);
      onChanged(await controlApi.members(), c.users.revoked);
    } catch (err) {
      onError(errorText(err, c));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section id="invitations-title" title={c.users.invitations}>
      {data.invitations.length === 0 ? (
        <p className="text-label text-text-secondary">{c.users.invitationsNone}</p>
      ) : (
        <ul className="grid gap-2" data-invitation-list>
          {data.invitations.map((i) => (
            <li
              key={i.id}
              data-invitation={i.email}
              data-state={i.state}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
            >
              <UserRound aria-hidden className="size-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-label break-all text-text-primary">{i.email}</p>
                <p className="text-caption text-text-muted">
                  {a.roles[i.role]} · {c.users.invitedBy(i.invitedBy.fullName ?? i.invitedBy.email)}
                </p>
              </div>
              {i.state === 'EXPIRED' ? (
                <Pill tone="warning">{c.users.expired}</Pill>
              ) : (
                <span className="text-caption text-text-secondary">
                  {c.users.expires(date(i.expiresAt))}
                </span>
              )}
              {data.canManage && (
                <button
                  type="button"
                  disabled={busy === i.id}
                  onClick={() => void revoke(i.id)}
                  className={buttonClasses('ghost', 'md')}
                >
                  {c.users.revoke}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
