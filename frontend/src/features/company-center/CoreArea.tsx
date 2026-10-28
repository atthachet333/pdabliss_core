import {
  ArrowLeft,
  ArrowRight,
  Building,
  LogOut,
  MapPin,
  Repeat2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getDepartment } from '@/config/departments';
import { authApi, type Identity } from '@/features/auth/api';
import { Notice } from '@/features/auth/AuthFrame';
import { AUTH_COPY } from '@/features/auth/copy';
import { withLocale } from '@/features/auth/localeState';
import { clearIdentity } from '@/features/auth/session';
import { departmentId } from '@/features/company/api';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import type { BranchInfo } from '@/features/company/api';
import { ADMIN_COPY } from './adminCopy';
import { BranchCode } from './adminParts';
import { controlApi, type BranchContext } from './api';
import { CONTROL_COPY } from './copy';
import { PERMISSION_COPY } from './permissionCopy';
import { errorText, locationSummary, oneLineAddress, useLoad } from './model';
import { AreaLink, Loading, Pill } from './parts';

/*
 * CORE Operations entry (EP25): Company → branch → CORE.
 *
 * The branch context lives on the SERVER (the session): exactly one active
 * branch is selected automatically; with several, the person chooses here.
 * The departments listed are the ones the server says this person may open
 * — enabled for the company AND permitted for them. Department workspaces
 * themselves arrive in later episodes; nothing here pretends otherwise, and
 * no business figure is shown.
 *
 * EP26: the server lists only the branches this person may work in (branch
 * access). One → selected automatically; several → chosen here, Head Office
 * apart from the other branches; none → a plain blocked state. Choosing a
 * branch outside the person's access is refused by the server regardless.
 */

/** "Head Office · 00000" or "Chiang Mai · 00001" — how the working branch is named. */
function useBranchLabel() {
  const a = useCopy(ADMIN_COPY);
  return (b: Pick<BranchInfo, 'type' | 'name' | 'code'>) =>
    `${b.type === 'HEAD_OFFICE' ? a.selector.headOffice : b.name} · ${b.code}`;
}
export function CoreArea({ identity }: { identity: Identity }) {
  const c = useCopy(CONTROL_COPY);
  const { state, set, fail, reload } = useLoad(controlApi.context);
  const { locale } = useLocale();
  usePageMeta(c.core.title, c.core.lead, { index: false });

  // The branch context can change behind this tab (access removed, branch
  // closed, membership deactivated). Ask the server again whenever the tab
  // comes back, so a branch the person may no longer use is never left on
  // screen. A refusal replaces the context; a network blip keeps it.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState !== 'visible') return;
      controlApi.context().then(set, (e: unknown) => {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) fail(e);
      });
    };
    document.addEventListener('visibilitychange', revalidate);
    return () => document.removeEventListener('visibilitychange', revalidate);
  }, [set, fail]);

  if (state.status === 'loading') {
    return (
      <CoreFrame identity={identity} context={null}>
        <Loading label={c.shell.loading} />
      </CoreFrame>
    );
  }
  if (state.status === 'error') {
    return (
      <CoreFrame identity={identity} context={null}>
        <div className="grid max-w-xl gap-4 py-8">
          <Notice tone="error">{errorText(state.error, c)}</Notice>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void reload().catch(() => undefined)}
              className={buttonClasses('secondary', 'md')}
            >
              {c.shell.retry}
            </button>
            <AreaLink to="/company" className={buttonClasses('ghost', 'md')}>
              {c.enter.back}
            </AreaLink>
          </div>
        </div>
      </CoreFrame>
    );
  }
  const ctx = state.data;
  return (
    <CoreFrame identity={identity} context={ctx}>
      <Routes>
        <Route
          index
          element={
            ctx.blocked ? (
              <Blocked />
            ) : ctx.needsSelection ? (
              <Navigate to="/core/branch" replace {...withLocale(locale)} />
            ) : (
              <OperationsHome context={ctx} />
            )
          }
        />
        <Route
          path="branch"
          element={
            ctx.blocked ? (
              <Blocked />
            ) : (
              <BranchSelector context={ctx} onSelected={set} onStale={reload} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/core" replace {...withLocale(locale)} />} />
      </Routes>
    </CoreFrame>
  );
}

function CoreFrame({
  identity,
  context,
  children,
}: {
  identity: Identity;
  context: BranchContext | null;
  children: ReactNode;
}) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const ad = useCopy(ADMIN_COPY);
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const branchLabel = useBranchLabel();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body)
      document.getElementById('main')?.focus({ preventScroll: true });
  }, []);

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(c.common.error);
        return;
      }
    }
    clearIdentity();
    navigate('/login', { replace: true, ...withLocale(locale) });
  };

  return (
    <div className="min-h-dvh bg-surface-dark" data-area="core">
      <a
        href="#main"
        className="sr-only z-90 rounded-full bg-brand-primary px-4 py-2 text-text-inverse focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.shell.skipToContent}
      </a>
      <div
        aria-hidden
        className="h-[3px] bg-[linear-gradient(90deg,rgb(25_195_154/0.9),rgb(62_240_192/0.75)_45%,rgb(90_169_255/0.35))]"
      />
      <header className="border-b border-white/[0.06] bg-[rgb(6_16_20/0.9)]">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <AreaLink to="/" aria-label={a.common.home} className="shrink-0">
            <span className="max-md:hidden">
              <Logo compact />
            </span>
            <LogoMark className="size-9 md:hidden" />
          </AreaLink>
          <span aria-hidden className="h-7 w-px bg-white/[0.1]" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-mono text-[0.6875rem] tracking-[0.16em] text-brand-soft uppercase">
              CORE
            </p>
            <p className="truncate text-label font-semibold text-text-primary">
              {context?.company.displayName ?? identity.company?.name}
            </p>
          </div>
          {context?.selected && (
            <p
              className="flex min-w-0 items-center gap-2 text-caption text-text-secondary max-md:order-last max-md:w-full"
              data-selected-branch={context.selected.code}
            >
              <Building aria-hidden className="size-4 shrink-0 text-brand-soft" />
              <span className="min-w-0 truncate">
                <span className="text-text-muted max-sm:sr-only">{ad.selector.current}: </span>
                <span className="font-semibold text-text-primary">
                  {branchLabel(context.selected)}
                </span>
              </span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <AreaLink to="/company" className={buttonClasses('ghost', 'md', 'px-3.5')}>
              <ArrowLeft aria-hidden className="size-4" />
              <span className="max-lg:sr-only">{c.core.controlCenter}</span>
            </AreaLink>
            <button
              type="button"
              onClick={() => void signOut()}
              className={buttonClasses('secondary', 'md', 'px-3.5')}
            >
              <LogOut aria-hidden className="size-4" />
              <span className="max-xl:sr-only">{c.shell.signOut}</span>
            </button>
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[100rem] px-4 pt-8 pb-20 outline-none sm:px-6 lg:px-8"
      >
        {error && (
          <div className="mb-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

/** Refusals that mean the branch list on screen is out of date. */
const STALE_BRANCH = new Set(['BRANCH_NOT_ALLOWED', 'BRANCH_INACTIVE', 'BRANCH_NOT_FOUND']);

function BranchSelector({
  context,
  onSelected,
  onStale,
}: {
  context: BranchContext;
  onSelected: (ctx: BranchContext) => void;
  /** Re-read the context from the server (the list on screen was out of date). */
  onStale: () => Promise<unknown>;
}) {
  const c = useCopy(CONTROL_COPY);
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<string | null>(context.selected?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legendId = useId();
  const a = useCopy(ADMIN_COPY);
  const head = context.branches.filter((b) => b.type === 'HEAD_OFFICE');
  const others = context.branches.filter((b) => b.type !== 'HEAD_OFFICE');
  const groups = (
    [
      ['head', head],
      ['branches', others],
    ] as const
  ).filter(([, list]) => list.length > 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      onSelected(await controlApi.selectBranch(choice));
      navigate('/core', { replace: true, ...withLocale(locale) });
    } catch (err) {
      setError(errorText(err, c));
      setBusy(false);
      if (err instanceof ApiError && STALE_BRANCH.has(err.code)) {
        setChoice(null);
        void onStale().catch(() => undefined);
      }
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6" data-branch-selector>
      <div>
        <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight text-text-primary">
          {c.enter.title}
        </h1>
        <p className="mt-2 text-label leading-relaxed text-text-secondary">{c.enter.lead}</p>
      </div>
      {context.branches.length === 0 ? (
        <Notice tone="info">{c.enter.none}</Notice>
      ) : (
        <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-6">
          {context.scope === 'SELECTED_BRANCHES' && (
            <p className="text-caption text-text-muted">
              {a.selector.scope(context.branches.length)}
            </p>
          )}
          {groups.map(([group, branches]) => (
            <fieldset key={group} aria-labelledby={`${legendId}-${group}`} className="grid gap-2.5">
              <legend
                id={`${legendId}-${group}`}
                className="mb-1 flex w-full items-center gap-3 text-caption font-semibold tracking-wide text-text-muted uppercase"
              >
                <span className="shrink-0">
                  {group === 'head' ? a.selector.headOffice : a.selector.branches}
                </span>
                <span aria-hidden className="h-px flex-1 bg-white/[0.07]" />
              </legend>
              {branches.map((b) => (
                <label
                  key={b.id}
                  data-branch-option={b.code}
                  className={cn(
                    'flex cursor-pointer items-start gap-4 rounded-xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-glow motion-reduce:transition-none',
                    choice === b.id
                      ? 'bg-brand-primary/[0.08] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]'
                      : 'hover:bg-white/[0.03]',
                  )}
                >
                  <input
                    type="radio"
                    name="branch"
                    value={b.id}
                    checked={choice === b.id}
                    onChange={() => setChoice(b.id)}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-brand-primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <BranchCode code={b.code} head={b.type === 'HEAD_OFFICE'} />
                      <span className="text-label font-semibold break-words text-text-primary">
                        {b.name}
                      </span>
                      {b.type === 'HEAD_OFFICE' && <Pill tone="teal">{c.branches.headOffice}</Pill>}
                    </span>
                    <span className="mt-1 flex items-start gap-1.5 text-caption text-text-secondary">
                      <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {locationSummary(b) || oneLineAddress(b)}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!choice || busy}
              className={buttonClasses('primary', 'lg')}
              data-continue
            >
              {busy ? c.enter.continuing : c.enter.continue}
              <ArrowRight aria-hidden className="size-5" />
            </button>
            <AreaLink to="/company" className={buttonClasses('ghost', 'md')}>
              {c.enter.back}
            </AreaLink>
          </div>
        </form>
      )}
    </div>
  );
}

/** No active branch is open to this person: say so plainly; nothing to choose. */
function Blocked() {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(ADMIN_COPY);
  return (
    <div className="mx-auto grid max-w-2xl gap-5 py-6" data-core-blocked>
      <ShieldAlert aria-hidden className="size-8 text-warning" />
      <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight text-text-primary">
        {a.selector.blockedTitle}
      </h1>
      <p className="text-label leading-relaxed text-text-secondary">{a.selector.blockedBody}</p>
      <AreaLink to="/company" className={buttonClasses('secondary', 'md', 'w-fit')}>
        {c.enter.back}
      </AreaLink>
    </div>
  );
}

/** Actions that approve or manage (the rest of a department's non-view actions are day-to-day work). */
const MANAGE_ACTIONS = /.(approve|cancel|delete|export|manage|update_status)$/;

function OperationsHome({ context }: { context: BranchContext }) {
  const c = useCopy(CONTROL_COPY);
  const p = useCopy(PERMISSION_COPY);
  const a = useCopy(AUTH_COPY);
  const { locale } = useLocale();
  const branchLabel = useBranchLabel();
  const branch = context.selected!;
  return (
    <div className="grid gap-8" data-core-home>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold tracking-tight text-text-primary">
            {c.core.title}
          </h1>
          <p className="mt-2 text-label text-text-secondary">{c.core.lead}</p>
          <p className="mt-3 flex flex-wrap gap-2">
            <Pill tone="teal" wrap>
              {c.core.branch}: {branchLabel(branch)}
            </Pill>
            <Pill tone="muted">{a.roles[context.role]}</Pill>
          </p>
        </div>
        {context.branches.length > 1 && (
          <AreaLink
            to="/core/branch"
            className={buttonClasses('secondary', 'md')}
            data-change-branch
          >
            <Repeat2 aria-hidden className="size-4" />
            {c.core.changeBranch}
          </AreaLink>
        )}
      </div>

      <section aria-labelledby="core-departments-title" className="grid gap-4">
        <h2 id="core-departments-title" className="text-body font-semibold text-text-primary">
          {c.core.departments}
        </h2>
        {context.departments.length === 0 ? (
          <Notice tone="info">{c.core.none}</Notice>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-core-departments>
            {context.departments.map((code) => {
              const d = getDepartment(departmentId(code), locale);
              // What the server says this person may do here — presentation only.
              const mine = (context.permissions ?? []).filter((x) =>
                x.startsWith(`${code.toLowerCase()}.`),
              );
              const level = mine.some((x) => MANAGE_ACTIONS.test(x))
                ? p.coreLevel.manage
                : mine.some((x) => !x.endsWith('.view'))
                  ? p.coreLevel.work
                  : p.coreLevel.readOnly;
              return (
                <li
                  key={code}
                  data-department={code}
                  className="flex gap-4 rounded-2xl bg-white/[0.025] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]"
                >
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-primary/[0.12] text-brand-soft"
                  >
                    <d.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-label font-semibold text-text-primary">{d.name}</h3>
                    <p className="mt-0.5 text-caption text-text-muted">{d.purpose}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                      <Pill tone="muted" data-level>
                        {level}
                      </Pill>
                      {c.core.later}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex items-start gap-2 text-caption text-text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-soft" />
          {c.core.rule}
        </p>
      </section>
    </div>
  );
}
