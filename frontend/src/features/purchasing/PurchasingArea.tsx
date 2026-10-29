import { FilePlus2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { controlClass } from '@/components/ui/fieldStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { FieldError, SelectField, TextField } from '@/features/auth/fields';
import type { DepartmentCode } from '@/features/company/api';
import { BranchCode } from '@/features/company-center/adminParts';
import { CELL, useDateFormat, useDepartmentName, useLoad } from '@/features/company-center/model';
import { SearchBox } from '@/features/company-center/SearchBox';
import { AreaLink, Loading, PageTitle, Pill } from '@/features/company-center/parts';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import {
  PR_STATUSES,
  prApi,
  type PrContext,
  type PrList,
  type PrStatus,
  type PrView,
  type PurchaseRequest,
} from './api';
import { PR_COPY, prError } from './copy';
import { RequestPage } from './RequestPage';

/*
 * /core/purchasing/* — purchase requests (EP29), one lazy chunk loaded from
 * CORE. The landing is the Purchasing workspace (counts read from the API —
 * nothing invented); `requests` is the list, `requests/new` creates a draft
 * in the selected branch, `requests/:id` is one request. What a person may
 * do comes from GET /purchase-requests/context and each request's `actions`;
 * the server checks every call again.
 */

const BASE = '/core/purchasing';

const TONE: Record<PrStatus, 'teal' | 'neutral' | 'warning' | 'muted'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'teal',
  REJECTED: 'muted',
  CANCELLED: 'muted',
};

export function StatusPill({ status }: { status: PrStatus }) {
  const c = useCopy(PR_COPY);
  return (
    <Pill
      tone={TONE[status]}
      className={status === 'CANCELLED' ? 'line-through' : undefined}
      data-status={status}
    >
      {c.statuses[status]}
    </Pill>
  );
}

export default function PurchasingArea() {
  const c = useCopy(PR_COPY);
  const cc = useCopy(CONTROL_COPY);
  const { state } = useLoad(prApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error') return <Notice tone="error">{prError(state.error, c, cc)}</Notice>;
  const ctx = state.data;
  const any =
    ctx.createDepartments.length > 0 || ctx.purchasingView || ctx.decideDepartments.length > 0;
  return (
    <div className="grid grid-cols-1 gap-6" data-purchasing>
      <Routes>
        <Route index element={<Workspace ctx={ctx} any={any} />} />
        <Route path="requests" element={<ListPage ctx={ctx} />} />
        <Route path="requests/new" element={<CreatePage ctx={ctx} />} />
        <Route path="requests/:id" element={<Detail ctx={ctx} />} />
        <Route path="*" element={<Navigate to={BASE} replace />} />
      </Routes>
    </div>
  );
}

function Detail({ ctx }: { ctx: PrContext }) {
  const { id } = useParams();
  return <RequestPage key={id} id={id!} ctx={ctx} />;
}

/** The Purchasing workspace: real counts and the way to the list and to a new request. */
function Workspace({ ctx, any }: { ctx: PrContext; any: boolean }) {
  const c = useCopy(PR_COPY);
  const [counts, setCounts] = useState<Partial<Record<'mine' | 'queue' | 'approved', number>>>({});
  const queue = ctx.purchasingView || ctx.decideDepartments.length > 0;
  useEffect(() => {
    const load = (key: 'mine' | 'queue' | 'approved', params: Record<string, string>) =>
      prApi
        .list({ ...params, pageSize: 1 })
        .then((l) => setCounts((s) => ({ ...s, [key]: l.total })))
        .catch(() => undefined);
    void load('mine', { view: 'mine' });
    if (queue) {
      void load('queue', { view: 'queue' });
      void load('approved', { status: 'APPROVED' });
    }
  }, [queue]);
  if (!any) return <Notice tone="info">{c.noAccess}</Notice>;
  const tiles: ['mine' | 'queue' | 'approved', string][] = [
    ['mine', `${BASE}/requests?view=mine`],
    ...(queue
      ? ([
          ['queue', `${BASE}/requests?view=queue`],
          ['approved', `${BASE}/requests?status=APPROVED`],
        ] as ['queue' | 'approved', string][])
      : []),
  ];
  return (
    <>
      <PageTitle
        title={c.workspace}
        lead={c.workspaceLead}
        action={
          ctx.createDepartments.length ? (
            <AreaLink
              to={`${BASE}/requests/new`}
              className={buttonClasses('primary', 'md')}
              data-create
            >
              <FilePlus2 aria-hidden className="size-4" />
              {c.create}
            </AreaLink>
          ) : undefined
        }
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-tiles>
        {tiles.map(([key, to]) => (
          <li key={key}>
            <AreaLink
              to={to}
              className="grid min-h-24 gap-1 rounded-2xl bg-white/[0.025] p-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-tile={key}
            >
              <span className="text-label text-text-secondary">
                {key === 'approved' ? c.statuses.APPROVED : c.views[key]}
              </span>
              <span className="text-h3 font-semibold text-text-primary tabular-nums">
                {counts[key] ?? '—'}
              </span>
            </AreaLink>
          </li>
        ))}
      </ul>
      <AreaLink
        to={`${BASE}/requests`}
        className="w-fit text-label text-brand-soft underline-offset-4 hover:underline"
      >
        {c.title} →
      </AreaLink>
    </>
  );
}

function ListPage({ ctx }: { ctx: PrContext }) {
  const c = useCopy(PR_COPY);
  const cc = useCopy(CONTROL_COPY);
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const base = useId();
  const [initial] = useSearchParams();
  const views: PrView[] = [
    'all',
    'mine',
    ...(ctx.decideDepartments.length ? (['department'] as const) : []),
    ...(ctx.purchasingView || ctx.decideDepartments.length ? (['queue'] as const) : []),
  ];
  const [view, setView] = useState<PrView>((initial.get('view') as PrView | null) ?? 'all');
  const [filters, setFilters] = useState<Record<string, string>>({
    status: initial.get('status') ?? '',
    department: '',
    branchId: ctx.selectedBranch?.id ?? '',
  });
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [data, setData] = useState<PrList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const load = async (page: number) => {
    const n = ++request.current;
    const next = await prApi.list({ view, ...filters, q: debounced, page, pageSize: 25 });
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next,
    );
    setError(null);
  };
  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filters, debounced]);

  const departments = [...new Set([...ctx.createDepartments, ...ctx.decideDepartments])];
  const select = (key: string, label: string, options: [string, string][], any = c.f.any) => (
    <SelectField
      id={`${base}-${key}`}
      label={label}
      value={filters[key] ?? ''}
      onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
      data-filter={key}
    >
      <option value="">{any}</option>
      {options.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </SelectField>
  );

  return (
    <>
      <PageTitle
        title={c.title}
        lead={c.lead}
        action={
          ctx.createDepartments.length ? (
            <AreaLink
              to={`${BASE}/requests/new`}
              className={buttonClasses('primary', 'md')}
              data-create
            >
              <FilePlus2 aria-hidden className="size-4" />
              {c.create}
            </AreaLink>
          ) : undefined
        }
      />
      <nav
        aria-label={c.nav}
        className="flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-white/[0.07]"
      >
        {views.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              view === v
                ? 'border-brand-primary font-semibold text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
            data-view={v}
          >
            {c.views[v]}
          </button>
        ))}
      </nav>
      {!ctx.createDepartments.length && <Notice tone="info">{c.readOnly}</Notice>}
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-end"
      >
        <SearchBox
          id={`${base}-q`}
          label={c.f.search}
          value={q}
          onChange={setQ}
          placeholder={c.f.searchHint}
          describedBy={`${base}-count`}
        />
        {select(
          'status',
          c.f.status,
          PR_STATUSES.map((s) => [s, c.statuses[s]]),
        )}
        {select(
          'department',
          c.f.department,
          departments.map((d) => [d, deptName(d)]),
        )}
        {select(
          'branchId',
          c.f.branch,
          ctx.branches.map((b) => [b.id, `${b.code} · ${b.name}`]),
          c.f.allBranches,
        )}
      </div>
      <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
        {data ? c.count(data.total) : c.loading}
      </p>
      {error && !data ? (
        <Notice tone="error">{prError(error, c, cc)}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <div className="grid justify-items-start gap-3 py-6" data-empty>
          <p className="text-label text-text-secondary">{c.empty}</p>
          {ctx.createDepartments.length > 0 && (
            <AreaLink to={`${BASE}/requests/new`} className={buttonClasses('secondary', 'md')}>
              {c.create}
            </AreaLink>
          )}
        </div>
      ) : (
        <table className="w-full text-left text-label max-md:block" data-rows>
          <thead className="max-md:sr-only">
            <tr className="text-caption text-text-muted">
              {[
                c.f.number,
                c.f.status,
                c.f.department,
                c.f.branch,
                c.f.requester,
                c.f.requestDate,
                c.f.needBy,
                c.f.lines,
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    'px-3 pb-2 font-medium first:pl-4',
                    // 768–1023 px: the need-by date waits for wider screens (it stays in the stacked rows).
                    h === c.f.needBy && 'md:max-lg:hidden',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
            {data.items.map((r) => {
              const cell = (label: string, content: ReactNode, extra = '') => (
                <td data-label={label} className={cn(CELL, extra)}>
                  {content}
                </td>
              );
              return (
                <tr
                  key={r.id}
                  className="border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4"
                  data-request={r.number}
                >
                  {cell(
                    c.f.number,
                    <>
                      <AreaLink
                        to={`${BASE}/requests/${encodeURIComponent(r.id)}`}
                        className="inline-flex min-h-11 items-center font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-0"
                      >
                        {r.number}
                      </AreaLink>
                      {r.purpose && (
                        <span className="block max-w-36 truncate text-caption text-text-muted lg:max-w-72">
                          {r.purpose}
                        </span>
                      )}
                    </>,
                    'max-md:before:hidden',
                  )}
                  {cell(c.f.status, <StatusPill status={r.status} />)}
                  {cell(c.f.department, deptName(r.department))}
                  {cell(
                    c.f.branch,
                    <BranchCode code={r.branch.code} head={r.branch.code === '00000'} />,
                  )}
                  {cell(c.f.requester, r.requester.name)}
                  {cell(c.f.requestDate, date(r.requestDate))}
                  {cell(c.f.needBy, r.needByDate ? date(r.needByDate) : '—', 'md:max-lg:hidden')}
                  {cell(c.f.lines, <span className="tabular-nums">{r.lineCount}</span>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {data?.hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={() => {
            setMore(true);
            load(data.page + 1)
              .catch((e: unknown) => setError(e))
              .finally(() => setMore(false));
          }}
          className={buttonClasses('secondary', 'md', 'w-fit')}
          data-show-more
        >
          {more ? c.loading : c.showMore}
        </button>
      )}
    </>
  );
}

/** A new DRAFT in the selected branch; lines are added on the request's page. */
function CreatePage({ ctx }: { ctx: PrContext }) {
  const c = useCopy(PR_COPY);
  const navigate = useNavigate();
  const { locale } = useLocale();
  if (!ctx.createDepartments.length) return <Notice tone="info">{c.readOnly}</Notice>;
  if (!ctx.selectedBranch) return <Notice tone="info">{c.noBranch}</Notice>;
  return (
    <>
      <AreaLink
        to={`${BASE}/requests`}
        className="inline-flex min-h-11 w-fit items-center text-label text-text-secondary hover:text-text-primary"
      >
        ← {c.back}
      </AreaLink>
      <PageTitle title={c.create} lead={c.createLead} />
      <p className="text-label text-text-secondary">
        {c.inBranch(`${ctx.selectedBranch.code} · ${ctx.selectedBranch.name}`)}
      </p>
      <HeaderForm
        ctx={ctx}
        submitLabel={c.createDraft}
        onSubmit={async (body) => {
          const created = await prApi.create(body as Parameters<typeof prApi.create>[0]);
          void navigate(`${BASE}/requests/${encodeURIComponent(created.request.id)}`, {
            state: { locale },
          });
        }}
      />
    </>
  );
}

/**
 * The request header — department (chosen only when there is a choice),
 * purpose and need-by date. Creates a draft (no `request`) or saves a
 * draft's changes (only what changed is sent).
 */
export function HeaderForm({
  ctx,
  request,
  submitLabel,
  onSubmit,
}: {
  ctx: PrContext;
  request?: PurchaseRequest;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const c = useCopy(PR_COPY);
  const cc = useCopy(CONTROL_COPY);
  const deptName = useDepartmentName();
  const base = useId();
  const one = ctx.createDepartments.length === 1;
  const [department, setDepartment] = useState<DepartmentCode | ''>(
    request?.department ?? (one ? ctx.createDepartments[0]! : ''),
  );
  const [purpose, setPurpose] = useState(request?.purpose ?? '');
  const [needBy, setNeedBy] = useState(request?.needByDate ?? '');
  const [deptError, setDeptError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!department) {
      setDeptError(c.required);
      document.getElementById(`${base}-dept`)?.focus();
      return;
    }
    const body: Record<string, unknown> = {};
    if (department !== request?.department) body.department = department;
    if (purpose.trim() !== (request?.purpose ?? '')) body.purpose = purpose.trim();
    if (needBy !== (request?.needByDate ?? '')) body.needByDate = needBy;
    if (!Object.keys(body).length) return;
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit(body);
    } catch (err) {
      setMessage(prError(err, c, cc));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="grid max-w-3xl grid-cols-1 gap-4"
      data-header-form
    >
      {one ? (
        !request && (
          <TextField
            id={`${base}-dept`}
            label={c.f.department}
            value={deptName(department as DepartmentCode)}
            readOnly
          />
        )
      ) : (
        <SelectField
          id={`${base}-dept`}
          label={c.f.department}
          value={department}
          error={deptError}
          onChange={(e) => {
            setDepartment(e.target.value as DepartmentCode);
            setDeptError(null);
          }}
        >
          {!request && <option value="">—</option>}
          {ctx.createDepartments.map((d) => (
            <option key={d} value={d}>
              {deptName(d)}
            </option>
          ))}
        </SelectField>
      )}
      <PurposeField
        id={`${base}-purpose`}
        label={c.f.purpose}
        value={purpose}
        onChange={setPurpose}
      />
      <TextField
        id={`${base}-need`}
        type="date"
        label={c.f.needBy}
        value={needBy}
        onChange={(e) => setNeedBy(e.target.value)}
        className="sm:max-w-xs"
      />
      <div aria-live="polite">{message && <Notice tone="error">{message}</Notice>}</div>
      <button
        type="submit"
        disabled={busy}
        className={buttonClasses(request ? 'secondary' : 'primary', 'md', 'w-fit')}
        data-save-header
      >
        {busy ? c.saving : submitLabel}
      </button>
    </form>
  );
}

export function PurposeField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={1000}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={controlClass(!!error, true)}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
