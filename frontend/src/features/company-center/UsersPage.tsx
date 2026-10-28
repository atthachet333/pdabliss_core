import { ChevronRight, MailPlus, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import type { CompanyRole } from '@/features/auth/api';
import { AUTH_COPY } from '@/features/auth/copy';
import { SelectField, TextField } from '@/features/auth/fields';
import type { DepartmentCode } from '@/features/company/api';
import type { Locale } from '@/i18n/locales';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import { BranchCode, FieldGroup, ScopeSummary } from './adminParts';
import {
  controlApi,
  type BranchRef,
  type BranchScope,
  type MemberList,
  type MemberQuery,
} from './api';
import { RequireCapability } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useDateFormat, useDepartmentName } from './model';
import { AreaLink, AreaNavLink, Loading, PageTitle, Pill, Result, Section } from './parts';

/*
 * /company/users (EP25; EP26: a people-management surface). Who has access,
 * with what role, in which departments and branches, whether they are active,
 * and when they last signed in. Search (name, email, job title) and filters
 * (role, status, department, branch) run on the SERVER, a page at a time, so
 * a company with hundreds of people never renders them all. Each row opens
 * the member's page (/company/users/:id) where access is managed. Owner and
 * System Admin invite; an Executive reads; department roles do not open this.
 *
 * One human = one account: departments and branches are access on that one
 * account, never extra accounts.
 */

const PAGE_SIZE = 25;
const ROLES: CompanyRole[] = [
  'COMPANY_OWNER',
  'SYSTEM_ADMIN',
  'EXECUTIVE',
  'DEPARTMENT_MANAGER',
  'DEPARTMENT_STAFF',
  'VIEWER',
];

export function UsersPage() {
  return (
    <RequireCapability capability="members.view">
      <People />
    </RequireCapability>
  );
}

/** People / Invitations — two views of the same administration. */
export function PeopleTabs() {
  const a = useCopy(ADMIN_COPY);
  const tab =
    'inline-flex min-h-11 items-center border-b-2 px-1 text-label transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none';
  return (
    <nav aria-label={a.people.tabsLabel} className="flex gap-6 border-b border-white/[0.07]">
      {(
        [
          ['/company/users', a.people.tabs.people, true],
          ['/company/users/invitations', a.people.tabs.invitations, false],
        ] as const
      ).map(([to, label, end]) => (
        <AreaNavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              tab,
              isActive
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )
          }
        >
          {label}
        </AreaNavLink>
      ))}
    </nav>
  );
}

type Filters = Required<Pick<MemberQuery, 'role' | 'status' | 'department'>> & { branch: string };
const NO_FILTERS: Filters = { role: '', status: '', department: '', branch: '' };

function People() {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const { reload: reloadOverview } = useControl();
  const base = useId();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [data, setData] = useState<MemberList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = async (page: number) => {
    const n = ++request.current;
    const next = await controlApi.members({ q: debounced, ...filters, page, pageSize: PAGE_SIZE });
    if (n !== request.current) return; // a newer search replaced this one
    setData((prev) =>
      page > 1 && prev ? { ...next, members: [...prev.members, ...next.members] } : next,
    );
    setError(null);
  };

  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filters]);

  if (!data && !error) return <Loading label={c.shell.loading} />;
  if (!data) return <Notice tone="error">{errorText(error, c)}</Notice>;
  const filtered = !!debounced || Object.values(filters).some(Boolean);

  const select = (key: keyof Filters, label: string, options: [string, string][]) => (
    <SelectField
      id={`${base}-${key}`}
      label={label}
      value={filters[key]}
      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
      data-filter={key}
    >
      <option value="">{a.people.any}</option>
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </SelectField>
  );

  return (
    <div className="grid gap-6">
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
      <PeopleTabs />
      {!data.canManage && <Notice tone="info">{c.shell.readOnly}</Notice>}
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      {inviting && (
        <Section id="invite-title" title={c.users.inviteTitle}>
          <InviteForm
            roles={data.assignableRoles}
            defaultLocale={data.defaultLocale}
            departments={data.enabledDepartments}
            branches={data.branches.filter((b) => b.status === 'ACTIVE')}
            onCancel={() => setInviting(false)}
            onSent={(email) => {
              setInviting(false);
              setNotice({ tone: 'success', text: c.users.sent(email) });
              void reloadOverview().catch(() => undefined);
            }}
          />
        </Section>
      )}

      <section aria-labelledby="members-title" className="grid gap-4">
        <h2 id="members-title" className="sr-only">
          {c.users.members}
        </h2>
        <div
          role="search"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] lg:items-end"
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label
              htmlFor={`${base}-q`}
              className="mb-2 block text-label font-medium text-text-primary"
            >
              {a.people.search}
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
              />
              <input
                id={`${base}-q`}
                type="search"
                value={q}
                maxLength={120}
                onChange={(e) => setQ(e.target.value)}
                placeholder={a.people.searchHint}
                aria-describedby={`${base}-count`}
                className="min-h-12 w-full rounded-xl bg-white/[0.04] py-2 pr-3 pl-9 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                data-member-search
              />
            </div>
          </div>
          {select(
            'role',
            a.people.role,
            ROLES.map((r) => [r, auth.roles[r]]),
          )}
          {select('status', a.people.status, [
            ['ACTIVE', a.people.statuses.ACTIVE],
            ['DEACTIVATED', a.people.statuses.DEACTIVATED],
          ])}
          {select(
            'department',
            a.people.department,
            data.enabledDepartments.map((d) => [d, deptName(d)]),
          )}
          {select(
            'branch',
            a.people.branch,
            data.branches.map((b) => [b.id, `${b.code} · ${b.name}`]),
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
            {a.people.results(data.total)} · {c.users.count(data.summary.active)}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setFilters(NO_FILTERS);
              }}
              className={buttonClasses('ghost', 'md', 'px-3')}
            >
              {a.people.clear}
            </button>
          )}
        </div>

        {data.members.length === 0 ? (
          <p className="py-6 text-label text-text-secondary">{a.people.none}</p>
        ) : (
          <MemberRows data={data} />
        )}
        {data.hasMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              load(data.page + 1)
                .catch((e: unknown) => setNotice({ tone: 'error', text: errorText(e, c) }))
                .finally(() => setLoadingMore(false));
            }}
            className={buttonClasses('secondary', 'md', 'w-fit')}
            data-show-more
          >
            {loadingMore ? a.people.loadingMore : a.people.showMore}
          </button>
        )}
      </section>
    </div>
  );
}

function MemberRows({ data }: { data: MemberList }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const cols =
    'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_1.25rem]';
  return (
    <div className="grid gap-1.5">
      <div
        aria-hidden
        className={cn('hidden gap-4 px-4 pb-1 text-caption text-text-muted lg:grid', cols)}
      >
        <span>{a.people.columns.person}</span>
        <span>{a.people.columns.role}</span>
        <span>{a.people.columns.departments}</span>
        <span>{a.people.columns.branches}</span>
        <span>{a.people.columns.status}</span>
        <span>{a.people.columns.lastSignIn}</span>
        <span />
      </div>
      <ul className="grid gap-1.5" data-member-list>
        {data.members.map((m) => {
          const name = m.fullName ?? m.email;
          const off = m.status === 'DEACTIVATED';
          return (
            <li key={m.id} data-member={m.email} data-role={m.role} data-status={m.status}>
              <AreaLink
                to={`/company/users/${encodeURIComponent(m.id)}`}
                className={cn(
                  'relative grid gap-x-4 gap-y-2 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none lg:items-center',
                  cols,
                  off ? 'opacity-75' : 'bg-white/[0.02]',
                )}
              >
                <span className="min-w-0 pr-6 lg:pr-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold break-words text-text-primary">
                      {name}
                    </span>
                    {m.isSelf && <Pill tone="muted">{c.users.you}</Pill>}
                  </span>
                  <span className="block text-caption break-all text-text-secondary">
                    {m.email}
                  </span>
                  {m.jobTitle && (
                    <span className="block text-caption text-text-muted">{m.jobTitle}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <Pill tone={m.isOwner ? 'teal' : 'neutral'} wrap>
                    {m.isOwner && <ShieldCheck aria-hidden className="size-3.5" />}
                    {auth.roles[m.role]}
                  </Pill>
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {m.isOwner ? (
                    <span className="text-caption text-text-muted">{c.users.allDepartments}</span>
                  ) : m.departments.length ? (
                    m.departments.map((d) => (
                      <Pill key={d.code} tone="muted" className={d.active ? '' : 'line-through'}>
                        {deptName(d.code)}
                        {!d.active && <span className="sr-only">({c.users.disabledDept})</span>}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-caption text-text-muted">{c.users.departmentsNone}</span>
                  )}
                </span>
                <span className="min-w-0" data-branch-scope={m.branchAccess.scope}>
                  <ScopeSummary access={m.branchAccess} compact />
                </span>
                <span>
                  <Pill tone={off ? 'warning' : 'teal'}>{a.people.statuses[m.status]}</Pill>
                </span>
                <span className="text-caption text-text-muted">
                  <span className="lg:hidden">{a.people.columns.lastSignIn}: </span>
                  {m.lastLoginAt ? date(m.lastLoginAt) : a.people.never}
                </span>
                <ChevronRight
                  aria-hidden
                  className="absolute top-3.5 right-3 size-4 text-text-muted lg:static"
                />
                <span className="sr-only">{a.people.open(name)}</span>
              </AreaLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Branch access editor: all branches, or a checklist of active branches (Head Office first). */
export function BranchScopeEditor({
  name,
  scope,
  selected,
  branches,
  onScope,
  onToggle,
  error,
  disabled,
}: {
  name: string;
  scope: BranchScope;
  selected: string[];
  branches: BranchRef[];
  onScope: (s: BranchScope) => void;
  onToggle: (id: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const a = useCopy(ADMIN_COPY);
  const c = useCopy(CONTROL_COPY);
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-3" data-branch-scope-editor>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['ALL_BRANCHES', 'SELECTED_BRANCHES'] as const).map((s) => (
          <label
            key={s}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
              scope === s && 'bg-brand-primary/[0.06] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]',
            )}
          >
            <input
              type="radio"
              name={`${name}-scope`}
              checked={scope === s}
              disabled={disabled}
              onChange={() => onScope(s)}
              className="mt-1 size-4 accent-[var(--color-brand-primary)]"
              data-scope={s}
            />
            <span>
              <span className="block text-label text-text-primary">{a.scope[s]}</span>
              {s === 'ALL_BRANCHES' && (
                <span className="block text-caption text-text-muted">{a.scope.allLong}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {scope === 'SELECTED_BRANCHES' && (
        <fieldset
          className="grid gap-1.5"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        >
          <legend className="sr-only">{a.member.branchesTitle}</legend>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-1.5">
            {branches.map((b) => (
              <li key={b.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)] has-[:checked]:bg-brand-primary/[0.06] has-[:checked]:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]">
                  <input
                    type="checkbox"
                    checked={selected.includes(b.id)}
                    disabled={disabled}
                    onChange={() => onToggle(b.id)}
                    className="size-4 accent-[var(--color-brand-primary)]"
                    data-branch-option={b.code}
                  />
                  <BranchCode code={b.code} head={b.type === 'HEAD_OFFICE'} />
                  <span className="min-w-0 break-words">
                    {b.type === 'HEAD_OFFICE' ? a.member.headOffice : b.name}
                    {b.status !== 'ACTIVE' && (
                      <span className="text-caption text-text-muted"> · {c.common.inactive}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && (
            <p id={errorId} role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}

function InviteForm({
  roles,
  defaultLocale,
  departments: enabled,
  branches,
  onCancel,
  onSent,
}: {
  roles: CompanyRole[];
  defaultLocale: Locale;
  departments: DepartmentCode[];
  branches: BranchRef[];
  onCancel: () => void;
  onSent: (email: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const base = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole>(
    roles.includes('DEPARTMENT_STAFF') ? 'DEPARTMENT_STAFF' : roles[0]!,
  );
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [departments, setDepartments] = useState<DepartmentCode[]>([]);
  const [scope, setScope] = useState<BranchScope>('ALL_BRANCHES');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);
    const value = email.trim();
    const badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const noBranch = scope === 'SELECTED_BRANCHES' && branchIds.length === 0;
    setError(badEmail ? c.profile.invalid.email : null);
    setBranchError(noBranch ? a.invite.chooseBranch : null);
    if (badEmail) {
      document.getElementById(`${base}-email`)?.focus();
      return;
    }
    if (noBranch) return;
    setBusy(true);
    try {
      await controlApi.invite({
        email: value,
        role,
        locale,
        departments,
        branchScope: scope,
        ...(scope === 'SELECTED_BRANCHES' ? { branchIds } : {}),
      });
      onSent(value);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-6" data-invite-form>
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
              {auth.roles[r]}
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
      {enabled.length > 0 && (
        <FieldGroup legend={a.invite.departments}>
          <p className="-mt-2 text-caption text-text-muted">{a.invite.departmentsHint}</p>
          <ul className="flex flex-wrap gap-2">
            {enabled.map((d) => (
              <li key={d}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] has-[:checked]:bg-brand-primary/[0.06] has-[:checked]:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]">
                  <input
                    type="checkbox"
                    checked={departments.includes(d)}
                    onChange={() =>
                      setDepartments((list) =>
                        list.includes(d) ? list.filter((x) => x !== d) : [...list, d],
                      )
                    }
                    className="size-4 accent-[var(--color-brand-primary)]"
                    data-invite-department={d}
                  />
                  {deptName(d)}
                </label>
              </li>
            ))}
          </ul>
        </FieldGroup>
      )}
      <FieldGroup legend={a.invite.branches}>
        <BranchScopeEditor
          name={`${base}-branches`}
          scope={scope}
          selected={branchIds}
          branches={branches}
          onScope={setScope}
          onToggle={(id) =>
            setBranchIds((list) =>
              list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
            )
          }
          error={branchError}
        />
      </FieldGroup>
      <p className="text-caption text-text-muted">
        {c.users.inviteNote} {a.invite.intentNote}
      </p>
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
