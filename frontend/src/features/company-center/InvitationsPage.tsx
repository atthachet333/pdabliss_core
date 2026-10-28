import { MailCheck, RotateCw, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { ADMIN_COPY } from './adminCopy';
import { ScopeSummary } from './adminParts';
import { controlApi, type InvitationList, type InvitationRecord, type InvitationState } from './api';
import { RequireCapability } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useDateFormat, useDepartmentName } from './model';
import { Loading, PageTitle, Pill } from './parts';
import { PeopleTabs } from './UsersPage';

/*
 * /company/users/invitations (EP26) — every invitation and where it stands:
 * pending, expired, accepted or revoked, with the intended role, departments
 * and branch access, who sent it and when. Pending (and expired-but-pending)
 * invitations can be resent — the server revokes the old one and mails a
 * fresh link, so the old link never works again — or revoked. A System Admin
 * leaves System Admin invitations to the owner (the server says so per row).
 */

const STATES: (InvitationState | 'ALL')[] = ['PENDING', 'EXPIRED', 'ACCEPTED', 'REVOKED', 'ALL'];

export function InvitationsPage() {
  return (
    <RequireCapability capability="members.view">
      <Invitations />
    </RequireCapability>
  );
}

function Invitations() {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const { reload: reloadOverview } = useControl();
  const [params, setParams] = useSearchParams();
  const requested = params.get('state') as InvitationState | 'ALL' | null;
  const state = requested && STATES.includes(requested) ? requested : 'PENDING';
  const [data, setData] = useState<InvitationList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);

  const load = async (page: number) => {
    const n = ++request.current;
    const next = await controlApi.invitations(state, page);
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, invitations: [...prev.invitations, ...next.invitations] } : next,
    );
    setError(null);
  };

  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const changed = async (text: string) => {
    setNotice({ tone: 'success', text });
    await Promise.all([load(1), reloadOverview()]).catch(() => undefined);
  };

  return (
    <div className="grid gap-6">
      <PageTitle title={c.users.title} lead={a.invitations.lead} />
      <PeopleTabs />
      <div
        role="radiogroup"
        aria-label={a.invitations.stateLabel}
        className="flex flex-wrap gap-2"
        data-invitation-states
      >
        {STATES.map((s) => {
          const on = s === state;
          const count = s !== 'ALL' && data ? data.counts[s] : null;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setNotice(null);
                setParams(s === 'PENDING' ? {} : { state: s }, { replace: true });
              }}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none',
                on
                  ? 'bg-brand-primary/[0.12] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                  : 'text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)] hover:text-text-primary',
              )}
              data-state-filter={s}
            >
              {a.invitations.states[s]}
              {count !== null && (
                <span className="font-mono text-caption text-text-muted tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite">{notice && <Notice tone={notice.tone}>{notice.text}</Notice>}</div>

      {!data && !error ? (
        <Loading label={c.shell.loading} />
      ) : !data ? (
        <Notice tone="error">{errorText(error, c)}</Notice>
      ) : data.invitations.length === 0 ? (
        <p className="py-6 text-label text-text-secondary">{a.invitations.none}</p>
      ) : (
        <ul className="grid gap-1.5" data-invitation-list>
          {data.invitations.map((i) => (
            <InvitationRow
              key={i.id}
              invitation={i}
              onChanged={(text) => void changed(text)}
              onError={(text) => setNotice({ tone: 'error', text })}
            />
          ))}
        </ul>
      )}
      {data?.hasMore && (
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
        >
          {a.invitations.showMore}
        </button>
      )}
    </div>
  );
}

function InvitationRow({
  invitation: i,
  onChanged,
  onError,
}: {
  invitation: InvitationRecord;
  onChanged: (text: string) => void;
  onError: (text: string) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  const auth = useCopy(AUTH_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const open = i.state === 'PENDING' || i.state === 'EXPIRED';

  const act = async (fn: () => Promise<unknown>, text: string) => {
    setBusy(true);
    try {
      await fn();
      onChanged(text);
    } catch (e) {
      onError(errorText(e, c));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const when =
    i.state === 'ACCEPTED' && i.acceptedAt
      ? a.invitations.accepted(date(i.acceptedAt))
      : i.state === 'REVOKED' && i.revokedAt
        ? a.invitations.revoked(date(i.revokedAt))
        : i.state === 'EXPIRED'
          ? a.invitations.expired(date(i.expiresAt))
          : a.invitations.expires(date(i.expiresAt));

  return (
    <li
      data-invitation={i.email}
      data-state={i.state}
      className="grid gap-3 rounded-xl bg-white/[0.02] px-4 py-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.06)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        {i.state === 'ACCEPTED' ? (
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-soft" />
        ) : (
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-text-muted" />
        )}
        <div className="min-w-0">
          <p className="text-label break-all text-text-primary">{i.email}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
            <span>{auth.roles[i.role]}</span>
            {i.resent && <Pill tone="muted">{a.invitations.resentTag}</Pill>}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className="flex flex-wrap gap-1">
          {i.departments.length ? (
            i.departments.map((d) => (
              <Pill key={d} tone="muted">
                {deptName(d)}
              </Pill>
            ))
          ) : (
            <span className="text-caption text-text-muted">{a.invitations.departmentsNone}</span>
          )}
        </span>
        <ScopeSummary access={i.branchAccess} compact />
      </div>
      <div className="grid gap-0.5 text-caption">
        <span className="flex flex-wrap items-center gap-2">
          <Pill
            tone={
              i.state === 'ACCEPTED' ? 'teal' : i.state === 'PENDING' ? 'neutral' : 'warning'
            }
          >
            {a.invitations.states[i.state]}
          </Pill>
        </span>
        <span className="text-text-secondary">{when}</span>
        <span className="text-text-muted">
          {a.invitations.sent(date(i.createdAt))} ·{' '}
          {a.invitations.by(i.invitedBy.fullName ?? i.invitedBy.email)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {i.canManage && open && !confirming && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() => controlApi.resendInvitation(i.id), a.invitations.resent)
              }
              className={buttonClasses('secondary', 'md')}
              data-resend={i.email}
            >
              <RotateCw aria-hidden className="size-4" />
              {a.invitations.resend}
            </button>
            {i.state === 'PENDING' && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={buttonClasses('ghost', 'md')}
                data-revoke={i.email}
              >
                {a.invitations.revoke}
              </button>
            )}
          </>
        )}
      </div>
      {confirming && (
        <div
          role="group"
          aria-label={a.invitations.revoke}
          className="grid gap-3 rounded-xl bg-warning/[0.06] p-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)] lg:col-span-4"
        >
          <p className="text-label text-text-primary">{a.invitations.confirmRevoke(i.email)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => controlApi.revokeInvitation(i.id), c.users.revoked)}
              className={buttonClasses('secondary', 'md')}
              data-confirm-revoke
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
    </li>
  );
}
