import { ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { SelectField } from '@/features/auth/fields';
import { BranchCode } from '@/features/company-center/adminParts';
import { useLoad } from '@/features/company-center/model';
import { AreaLink, AreaNavLink, Loading, PageTitle, Pill } from '@/features/company-center/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import {
  ITEM_TYPES,
  masterApi,
  RESOURCES,
  type MasterContext,
  type MasterList,
  type MasterRecord,
  type Resource,
} from './api';
import { MASTER_COPY, type MasterCopy } from './copy';
import { MasterCtx, useMaster } from './context';
import { RefText, StatusPill, TrackingBadges } from './parts';
import { readError } from './schema';
import { RecordPage } from './RecordPage';

/*
 * /company/master-data/* — operational master data (EP28), one lazy chunk:
 * the Company Control Center loads it only when someone opens Master Data.
 * One entry in the Control Center menu, six areas below it, each shown only
 * when the server says this person may view it (GET /master-data/context);
 * every call is authorized again by the server.
 *
 * Lists search, filter, sort and page on the SERVER (25 at a time, "Show
 * more"), as a real table on wide screens and labelled rows below 768 px.
 */

const PAGE_SIZE = 25;

export default function MasterDataArea() {
  const c = useCopy(MASTER_COPY);
  const { locale } = useLocale();
  const { state, reload } = useLoad(masterApi.context);
  if (state.status === 'loading') return <Loading label={c.loading} />;
  if (state.status === 'error')
    return <Notice tone="error">{readError(state.error, c).message}</Notice>;
  const ctx = state.data;
  const visible = RESOURCES.filter((r) => ctx.capabilities[r].view);
  return (
    <MasterCtx.Provider value={{ ctx, reload: () => void reload().catch(() => undefined) }}>
      <div className="grid grid-cols-1 gap-6" data-master-data>
        <nav aria-label={c.nav} className="border-b border-white/[0.07]">
          <ul className="flex [scrollbar-width:none] gap-5 overflow-x-auto">
            {visible.map((r) => (
              <li key={r} className="shrink-0">
                <AreaNavLink
                  to={`/company/master-data/${r}`}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex min-h-11 items-center border-b-2 px-1 text-label whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      isActive
                        ? 'border-brand-primary font-semibold text-text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary',
                    )
                  }
                  data-master-nav={r}
                >
                  {c.res[r].label}
                </AreaNavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Routes>
          <Route
            index
            element={
              visible.length ? (
                <Navigate to={`/company/master-data/${visible[0]!}`} replace state={{ locale }} />
              ) : (
                <>
                  <PageTitle title={c.title} lead={c.lead} />
                  <Notice tone="info">{c.noneVisible}</Notice>
                </>
              )
            }
          />
          <Route path=":resource" element={<Gate page="list" />} />
          <Route path=":resource/new" element={<Gate page="new" />} />
          <Route path=":resource/:id" element={<Gate page="detail" />} />
          <Route
            path="*"
            element={<Navigate to="/company/master-data" replace state={{ locale }} />}
          />
        </Routes>
      </div>
    </MasterCtx.Provider>
  );
}

/** Only known resources the person may view (the server refuses the rest anyway). */
function Gate({ page }: { page: 'list' | 'new' | 'detail' }) {
  const c = useCopy(MASTER_COPY);
  const { locale } = useLocale();
  const { ctx } = useMaster();
  const { resource, id } = useParams();
  const r = RESOURCES.find((x) => x === resource);
  if (!r) return <Navigate to="/company/master-data" replace state={{ locale }} />;
  if (!ctx.capabilities[r].view) return <Notice tone="info">{c.noAccess}</Notice>;
  if (page === 'list') return <ListPage key={r} resource={r} />;
  return <RecordPage key={`${r}-${id ?? 'new'}`} resource={r} id={page === 'new' ? null : id!} />;
}

type Filters = Record<string, string>;

/** Filters that are worth having per resource (no filter overload). */
function filterDefs(r: Resource, c: MasterCopy, ctx: MasterContext, categories: MasterRecord[]) {
  const defs: [key: string, label: string, options: [string, string][]][] = [];
  if (r === 'locations')
    defs.push([
      'branchId',
      c.f.branchId!,
      ctx.branches.map((b) => [b.id, `${b.code} · ${b.name}`]),
    ]);
  if (r === 'customers')
    defs.push([
      'kind',
      c.f.kind!,
      (['BUSINESS', 'INDIVIDUAL'] as const).map((k) => [k, c.kinds[k]]),
    ]);
  if (r === 'items') {
    defs.push(['type', c.f.type!, ITEM_TYPES.map((t) => [t, c.types[t]])]);
    defs.push([
      'categoryId',
      c.f.categoryId!,
      categories.map((x) => [x.id, `${x.code} · ${x.name}`]),
    ]);
    defs.push([
      'tracking',
      c.filters.tracking,
      (['stock', 'noStock', 'lot', 'expiry'] as const).map((k) => [
        k,
        c.filters.trackingOptions[k],
      ]),
    ]);
  }
  defs.push([
    'status',
    c.filters.status,
    (['ACTIVE', 'INACTIVE'] as const).map((s) => [s, c.statuses[s]]),
  ]);
  return defs;
}

/** The tracking filter in words → the API's precise parameters. */
const TRACKING_PARAMS: Record<string, Record<string, string>> = {
  stock: { inventoryTracked: 'true' },
  noStock: { inventoryTracked: 'false' },
  lot: { lotTracking: 'TRACKED' },
  expiry: { expiryTracking: 'TRACKED' },
};

function ListPage({ resource: r }: { resource: Resource }) {
  const c = useCopy(MASTER_COPY);
  const { ctx } = useMaster();
  const base = useId();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Filters>({ sort: 'code' });
  const [data, setData] = useState<MasterList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [categories, setCategories] = useState<MasterRecord[]>([]);
  const request = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (r === 'items')
      masterApi
        .list('categories', { pageSize: 100 })
        .then((l) => setCategories(l.items))
        .catch(() => undefined);
  }, [r]);

  const load = async (page: number) => {
    const n = ++request.current;
    const { tracking, ...rest } = filters;
    const params: Record<string, string | number | undefined> = {
      ...rest,
      q: debounced,
      page,
      pageSize: PAGE_SIZE,
    };
    const next = await masterApi.list(r, {
      ...params,
      ...(tracking ? TRACKING_PARAMS[tracking] : {}),
    });
    if (n !== request.current) return;
    setData((prev) =>
      page > 1 && prev ? { ...next, items: [...prev.items, ...next.items] } : next,
    );
    setError(null);
  };

  useEffect(() => {
    load(1).catch((e: unknown) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filters]);

  const filtered = !!debounced || Object.entries(filters).some(([k, v]) => k !== 'sort' && v);
  const defs = filterDefs(r, c, ctx, categories);
  const manage =
    ctx.capabilities[r].manage && (r !== 'locations' || ctx.branches.some((b) => b.canManage));

  return (
    <div className="grid grid-cols-1 gap-5" data-master-list={r}>
      <PageTitle
        title={c.res[r].label}
        lead={c.res[r].lead}
        action={
          manage ? (
            <AreaLink
              to={`/company/master-data/${r}/new`}
              className={buttonClasses('primary', 'md')}
              data-create
            >
              <Plus aria-hidden className="size-4" />
              {c.res[r].create}
            </AreaLink>
          ) : undefined
        }
      />
      {!ctx.capabilities[r].manage && <Notice tone="info">{c.readOnly}</Notice>}
      <div
        role="search"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] lg:items-end"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label
            htmlFor={`${base}-q`}
            className="mb-2 block text-label font-medium text-text-primary"
          >
            {c.filters.search}
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
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              placeholder={c.res[r].hint}
              aria-describedby={`${base}-count`}
              className="min-h-12 w-full rounded-xl bg-white/[0.04] py-2 pr-3 pl-9 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-search
            />
          </div>
        </div>
        {defs.map(([key, label, options]) => (
          <SelectField
            key={key}
            id={`${base}-${key}`}
            label={label}
            value={filters[key] ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
            data-filter={key}
          >
            <option value="">{c.filters.any}</option>
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </SelectField>
        ))}
        <SelectField
          id={`${base}-sort`}
          label={c.filters.sort}
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
          data-filter="sort"
        >
          {(['code', 'name', 'updated'] as const).map((s) => (
            <option key={s} value={s}>
              {c.filters.sorts[s]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${base}-count`} role="status" className="text-caption text-text-muted">
          {data ? c.results(data.total) : c.loading}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setFilters({ sort: filters.sort ?? 'code' });
            }}
            className={buttonClasses('ghost', 'md', 'px-3')}
          >
            {c.filters.clear}
          </button>
        )}
      </div>

      {error && !data ? (
        <Notice tone="error">{readError(error, c).message}</Notice>
      ) : !data ? (
        <Loading label={c.loading} />
      ) : data.items.length === 0 ? (
        <div className="grid justify-items-start gap-3 py-6" data-empty>
          <p className="text-label text-text-secondary">
            {filtered ? c.results(0) : c.res[r].empty}
          </p>
          {!filtered && !manage && <p className="text-caption text-text-muted">{c.readOnly}</p>}
        </div>
      ) : (
        <Rows resource={r} items={data.items} />
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
          {more ? c.loadingMore : c.showMore}
        </button>
      )}
    </div>
  );
}

/** Columns per resource: code and name first, then what people scan for. */
function columns(r: Resource, c: MasterCopy): [string, (x: MasterRecord) => ReactNode][] {
  const contact = (x: MasterRecord) => (
    <span className="grid text-caption text-text-secondary">
      {[x.contactName, x.phone, x.email].filter(Boolean).map((v) => (
        <span key={String(v)} className="break-all">
          {String(v)}
        </span>
      ))}
    </span>
  );
  const text = (key: string) => (x: MasterRecord) =>
    x[key] ? <span className="font-mono text-caption">{String(x[key])}</span> : c.none;
  switch (r) {
    case 'customers':
      return [
        [c.f.kind!, (x) => c.kinds[x.kind as 'BUSINESS']],
        [c.f.taxId!, text('taxId')],
        [c.f.contact!, contact],
      ];
    case 'suppliers':
      return [
        [c.f.taxId!, text('taxId')],
        [c.f.contact!, contact],
      ];
    case 'items':
      return [
        [c.f.type!, (x) => c.types[x.type!]],
        [c.f.baseUnitId!, (x) => <RefText r={x.baseUnit} />],
        [c.f.categoryId!, (x) => <RefText r={x.category} />],
        [c.f.tracking!, (x) => <TrackingBadges item={x} />],
      ];
    case 'units':
      return [
        [c.f.symbol!, (x) => (x.symbol as string) || c.none],
        [c.f.precision!, (x) => <span className="tabular-nums">{String(x.precision)}</span>],
      ];
    case 'categories':
      return [];
    case 'locations':
      return [
        [
          c.f.branchId!,
          (x) => (
            <span className="flex items-center gap-2">
              <BranchCode code={x.branch!.code} head={x.branch!.type === 'HEAD_OFFICE'} />
              <span className="text-caption break-words">{x.branch!.name}</span>
            </span>
          ),
        ],
        [c.f.parentId!, (x) => <RefText r={x.parent} />],
      ];
  }
}

function Rows({ resource: r, items }: { resource: Resource; items: MasterRecord[] }) {
  const c = useCopy(MASTER_COPY);
  const cols = columns(r, c);
  const cell =
    'block px-0 py-1 align-top md:table-cell md:px-3 md:py-3 md:first:pl-4 max-md:before:block max-md:before:text-caption max-md:before:text-text-muted max-md:before:content-[attr(data-label)]';
  return (
    <table className="w-full text-left text-label max-md:block" data-rows>
      <thead className="max-md:sr-only">
        <tr className="text-caption text-text-muted">
          <th scope="col" className="px-3 pb-2 font-medium first:pl-4">
            {c.f.code}
          </th>
          <th scope="col" className="px-3 pb-2 font-medium">
            {c.f.name}
          </th>
          {cols.map(([h]) => (
            <th key={h} scope="col" className="px-3 pb-2 font-medium">
              {h}
            </th>
          ))}
          <th scope="col" className="px-3 pb-2 font-medium">
            {c.f.status}
          </th>
        </tr>
      </thead>
      <tbody className="max-md:grid max-md:grid-cols-1 max-md:gap-2">
        {items.map((x) => (
          <tr
            key={x.id}
            className={cn(
              'border-t border-white/[0.06] max-md:grid max-md:grid-cols-1 max-md:gap-1 max-md:rounded-xl max-md:border-0 max-md:bg-white/[0.02] max-md:p-4',
              x.status !== 'ACTIVE' && 'opacity-75',
            )}
            data-record={x.code}
            data-status={x.status}
          >
            <td className={cn(cell, 'max-md:before:hidden')}>
              <AreaLink
                to={`/company/master-data/${r}/${encodeURIComponent(x.id)}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-md font-mono font-semibold whitespace-nowrap text-brand-soft hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:min-h-0"
                aria-label={c.open(x.code)}
              >
                {x.code}
                <ChevronRight aria-hidden className="size-3.5 md:hidden" />
              </AreaLink>
            </td>
            <td className={cn(cell, 'max-md:before:hidden')}>
              <span className="font-semibold break-words text-text-primary">{x.name}</span>
              {x.isDefault && (
                <Pill tone="teal" className="ml-2">
                  {c.default}
                </Pill>
              )}
            </td>
            {cols.map(([h, render]) => (
              <td key={h} data-label={h} className={cell}>
                {render(x)}
              </td>
            ))}
            <td data-label={c.f.status} className={cell}>
              <StatusPill status={x.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
