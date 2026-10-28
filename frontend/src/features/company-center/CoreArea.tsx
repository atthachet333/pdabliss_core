import {
  ArrowLeft,
  ArrowRight,
  Building,
  LogOut,
  MapPin,
  Repeat2,
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
import { controlApi, type BranchContext } from './api';
import { CONTROL_COPY } from './copy';
import { errorText, oneLineAddress, useLoad } from './model';
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
 */
export function CoreArea({ identity }: { identity: Identity }) {
  const c = useCopy(CONTROL_COPY);
  const { state, set, reload } = useLoad(controlApi.context);
  const { locale } = useLocale();
  usePageMeta(c.core.title, c.core.lead, { index: false });

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
            ctx.needsSelection ? (
              <Navigate to="/core/branch" replace {...withLocale(locale)} />
            ) : (
              <OperationsHome context={ctx} />
            )
          }
        />
        <Route path="branch" element={<BranchSelector context={ctx} onSelected={set} />} />
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
  const { t, locale } = useLocale();
  const navigate = useNavigate();
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
              className="flex min-w-0 items-center gap-2 text-caption text-text-secondary max-md:hidden"
              data-selected-branch={context.selected.code}
            >
              <Building aria-hidden className="size-4 shrink-0 text-brand-soft" />
              <span className="truncate">
                <span className="sr-only">{c.core.branch}: </span>
                {context.selected.name} ·{' '}
                <span className="font-mono tabular-nums">{context.selected.code}</span>
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

function BranchSelector({
  context,
  onSelected,
}: {
  context: BranchContext;
  onSelected: (ctx: BranchContext) => void;
}) {
  const c = useCopy(CONTROL_COPY);
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<string | null>(context.selected?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legendId = useId();

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
        <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-5">
          <fieldset aria-labelledby={legendId} className="grid gap-3">
            <legend id={legendId} className="sr-only">
              {c.enter.choose}
            </legend>
            {context.branches.map((b) => (
              <label
                key={b.id}
                data-branch-option={b.code}
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-2xl p-4 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-glow motion-reduce:transition-none sm:p-5',
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
                    <span className="text-label font-semibold text-text-primary">{b.name}</span>
                    <span className="font-mono text-caption text-text-muted tabular-nums">
                      {b.code}
                    </span>
                    {b.type === 'HEAD_OFFICE' && <Pill tone="teal">{c.branches.headOffice}</Pill>}
                  </span>
                  <span className="mt-1 flex items-start gap-1.5 text-caption text-text-secondary">
                    <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{oneLineAddress(b)}</span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
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

function OperationsHome({ context }: { context: BranchContext }) {
  const c = useCopy(CONTROL_COPY);
  const a = useCopy(AUTH_COPY);
  const { locale } = useLocale();
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
              {c.core.branch}: {branch.name} · {branch.code}
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
                    <p className="mt-3 text-caption text-text-secondary">{c.core.later}</p>
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
