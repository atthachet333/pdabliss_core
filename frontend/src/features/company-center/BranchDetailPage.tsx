import { ArrowLeft, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { useCopy } from '@/i18n/useCopy';
import { ApiError } from '@/lib/api';
import { ADMIN_COPY } from './adminCopy';
import { BranchCode, BranchStatusPill } from './adminParts';
import { BranchForm } from './BranchesPage';
import { controlApi, type BranchDetail } from './api';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import {
  branchFields,
  errorText,
  oneLineAddress,
  useDateFormat,
  useDepartmentName,
  useLoad,
} from './model';
import { AreaLink, Fact, Facts, Loading, Pill, Section } from './parts';

/*
 * /company/branches/:branchId (EP26) — one branch: who it is (code, name,
 * Head Office or not, status), where (address, phone), and its access
 * configuration (people on all branches, people granted this branch, the
 * departments they bring). Not an operational dashboard: no figures beyond
 * people and departments. The branch is looked up inside the caller's company
 * on the server; another company's id is simply "not found".
 */
export function BranchDetailPage() {
  const { branchId = '' } = useParams();
  // A new id is a new page: remount so it loads afresh.
  return <BranchLoader key={branchId} branchId={branchId} />;
}

function BranchLoader({ branchId }: { branchId: string }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const { state, reload, set } = useLoad(() => controlApi.branchDetail(branchId));

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') {
    const missing = state.error instanceof ApiError && state.error.status === 404;
    return (
      <div className="grid gap-4">
        <BackLink />
        <Notice tone="error">{missing ? a.branchDetail.notFound : errorText(state.error, c)}</Notice>
      </div>
    );
  }
  return <Detail data={state.data} reload={reload} replace={set} />;
}

function BackLink() {
  const a = useCopy(ADMIN_COPY);
  return (
    <AreaLink
      to="/company/branches"
      className="inline-flex min-h-11 w-fit items-center gap-2 text-caption text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {a.branchDetail.back}
    </AreaLink>
  );
}

function Detail({
  data,
  reload,
  replace,
}: {
  data: BranchDetail;
  reload: () => Promise<BranchDetail>;
  replace: (d: BranchDetail) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const { reload: reloadOverview } = useControl();
  const b = data.branch;
  const head = b.type === 'HEAD_OFFICE';
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = async (text: string) => {
    setNotice({ tone: 'success', text });
    await Promise.all([reload(), reloadOverview()]).catch(() => undefined);
  };

  const setActive = async (active: boolean) => {
    setBusy(true);
    try {
      const { branch } = await controlApi.setBranchActive(b.id, active);
      replace({ ...data, branch });
      setConfirming(false);
      await refresh(active ? c.branches.reactivated : c.branches.deactivated);
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e, c) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8" data-branch-detail={b.code}>
      <div className="grid gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          <BranchCode code={b.code} head={head} />
          <h1 className="min-w-0 text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight break-words text-text-primary">
            {b.name}
          </h1>
          {head && <Pill tone="teal">{c.branches.headOffice}</Pill>}
          <BranchStatusPill status={b.status} />
        </div>
        <p className="text-caption text-text-muted">
          {[b.createdAt && a.branchDetail.created(date(b.createdAt)), b.updatedAt && a.branchDetail.updated(date(b.updatedAt))]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-12">
        <div className="grid content-start gap-8">
          <Section
            id="branch-identity-title"
            title={c.profile.address}
            aside={
              data.canManage &&
              !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setNotice(null);
                  }}
                  className={buttonClasses('secondary', 'md')}
                  data-edit-branch
                >
                  {a.branchDetail.edit}
                </button>
              )
            }
          >
            {editing ? (
              <BranchForm
                initial={branchFields(b)}
                branch={b}
                suggestedCode={null}
                onCancel={() => setEditing(false)}
                onSaved={(branch) => {
                  setEditing(false);
                  replace({ ...data, branch });
                  void refresh(c.branches.updated);
                }}
              />
            ) : (
              <Facts>
                <Fact term={c.branches.code}>
                  <span className="font-mono tabular-nums">{b.code}</span>
                </Fact>
                <Fact term={c.profile.addressLine1}>
                  <span className="flex items-start gap-1.5">
                    <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
                    {oneLineAddress(b)}
                  </span>
                </Fact>
                <Fact term={c.branches.phone}>
                  {b.phone ? (
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Phone aria-hidden className="size-3.5 text-text-muted" />
                      {b.phone}
                    </span>
                  ) : (
                    <span className="text-text-muted">{c.common.notSet}</span>
                  )}
                </Fact>
              </Facts>
            )}
          </Section>

          <Section id="branch-status-title" title={a.branchForm.status}>
            <p className="text-label text-text-secondary">
              {head
                ? a.branchDetail.headOfficeLocked
                : b.status === 'ACTIVE'
                  ? a.branchDetail.statusActive
                  : a.branchDetail.statusInactive}
            </p>
            {data.canManage && !head && b.status !== 'CLOSED' && (
              <div className="mt-4 grid gap-3">
                {b.status === 'ACTIVE' ? (
                  !confirming && (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className={buttonClasses('secondary', 'md', 'w-fit')}
                      data-deactivate-branch
                    >
                      {c.branches.deactivate}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setActive(true)}
                    className={buttonClasses('secondary', 'md', 'w-fit')}
                    data-reactivate-branch
                  >
                    {c.branches.reactivate}
                  </button>
                )}
                {confirming && (
                  <div
                    role="group"
                    aria-label={c.branches.deactivate}
                    className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
                  >
                    <p className="text-label text-text-primary">
                      {c.branches.confirmDeactivate(b.name)}
                    </p>
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
              </div>
            )}
          </Section>
        </div>

        <div className="grid content-start gap-8">
          <Section id="branch-access-title" title={a.branchDetail.accessTitle}>
            <p className="text-caption text-text-muted">{a.branchDetail.accessLead}</p>
            <ul className="mt-3 grid gap-1.5 text-label text-text-primary" data-branch-access>
              <li>{a.branchDetail.allBranches(data.access.allBranches)}</li>
              <li>{a.branchDetail.selected(data.access.selected)}</li>
            </ul>
            {data.people === null ? (
              <p className="mt-4 text-caption text-text-muted">{a.branchDetail.peopleHidden}</p>
            ) : (
              <div className="mt-5">
                <h3 className="text-label font-semibold text-text-primary">
                  {a.branchDetail.peopleTitle}
                </h3>
                {data.people.length === 0 ? (
                  <p className="mt-2 text-caption text-text-muted">{a.branchDetail.peopleNone}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-white/[0.06]" data-branch-people>
                    {data.people.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                        <AreaLink
                          to={`/company/users/${encodeURIComponent(p.id)}`}
                          className="min-w-0 flex-1 rounded text-label break-words text-text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {p.fullName ?? p.email}
                        </AreaLink>
                        <span className="text-caption text-text-muted">{auth.roles[p.role]}</span>
                        <Pill tone={p.scope === 'ALL_BRANCHES' ? 'muted' : 'teal'}>
                          {a.scope[p.scope]}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                )}
                {data.peopleTotal !== null && data.peopleTotal > data.people.length && (
                  <p className="mt-2 text-caption text-text-muted">
                    {a.branchDetail.peopleMore(data.people.length, data.peopleTotal)}
                  </p>
                )}
              </div>
            )}
          </Section>

          <Section id="branch-departments-title" title={a.branchDetail.departmentsTitle}>
            <p className="text-caption text-text-muted">{a.branchDetail.departmentsLead}</p>
            {data.access.departments.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5" data-branch-departments>
                {data.access.departments.map((code) => (
                  <li key={code}>
                    <Pill tone="teal">{deptName(code)}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-caption text-text-muted">{a.branchDetail.departmentsNone}</p>
            )}
            <p className="mt-4 text-caption text-text-muted">
              {a.branchDetail.companyDepartments}:{' '}
              {data.enabledDepartments.map(deptName).join(' · ') || c.common.none}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
