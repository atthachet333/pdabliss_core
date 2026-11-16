import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext, DepartmentAssignment } from '@/features/company-center/api';
import type { BranchInfo, DepartmentCode } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn, type Reply } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Overview, Trace, WorkItem } from './execApi';
import { EXEC_COPY } from './execCopy';

/*
 * EP48 Executive Command Center (UI). The server decides access, scope and content
 * (backend/test/ep48-executive.test.ts); here: who is offered the entry, the read-only page
 * (no action button), the branch filter, refresh rules and the document investigation.
 */

const branch = (id: string, code: string, name: string): BranchInfo => ({
  id,
  code,
  name,
  type: code === '00000' ? 'HEAD_OFFICE' : 'BRANCH',
  status: 'ACTIVE',
  address: {
    line1: '1 Road',
    line2: null,
    subdistrict: null,
    district: 'Demo',
    province: 'Bangkok',
    postalCode: '10110',
    countryCode: 'TH',
  },
  phone: null,
  deactivatedAt: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
});
const HO = branch('b0', '00000', 'Head Office');
const X = branch('b1', '00001', 'Demo Branch');
const ALL: DepartmentCode[] = [
  'SALES',
  'OPERATIONS',
  'WAREHOUSE',
  'PURCHASING',
  'ACCOUNTING',
  'EXECUTIVE',
];
const E = '/api/v1/executive';

const person = (
  role: CompanyRole,
  departments: DepartmentCode[],
  permissions: string[],
  assignment: DepartmentAssignment,
) => ({
  ...signedIn(
    identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role, canEnterCore: true } }),
  ),
  'GET /api/v1/company/context': ok({
    company: { id: 'c1', displayName: 'Alpha' },
    role,
    scope: 'ALL_BRANCHES',
    branches: [HO, X],
    selected: X,
    needsSelection: false,
    blocked: null,
    departments,
    permissions: permissions as BranchContext['permissions'],
    assignment,
  } satisfies BranchContext),
});
const EXEC = person(
  'EXECUTIVE',
  ALL,
  [
    ...ALL.map((d) => `${d.toLowerCase()}.workspace.view`),
    'executive.overview.view',
    'sales.orders.view',
  ],
  { status: 'OVERSIGHT', department: null },
);

const ref = { id: 'b1', code: '00001', name: 'Demo Branch' };
const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  kind: 'PRODUCTION_ORDER',
  id: 'mo1',
  number: 'MO-202611-000009',
  context: 'Face cream',
  branch: ref,
  department: 'OPERATIONS',
  next: 'PURCHASING',
  stage: 'MO_MATERIALS_SHORT',
  class: 'BLOCKED',
  reason: 'PRODUCTION_SHORTAGE',
  evidence: { code: 'MATERIALS_SHORT', count: 2 },
  date: '2026-11-20',
  dateKind: 'REQUIRED',
  overdueDays: null,
  since: '2026-11-14',
  ageDays: 2,
  link: '/core/production/orders/mo1',
  ...over,
});

const overview = (over: Partial<Overview> = {}): Overview => ({
  scope: {
    company: 'Alpha',
    branches: [{ id: 'b0', code: '00000', name: 'Head Office' }, ref],
    selected: 'all',
  },
  role: 'EXECUTIVE',
  readOnly: true,
  today: '2026-11-16',
  generatedAt: '2026-11-16T03:00:00.000Z',
  visible: ['SALES', 'OPERATIONS'],
  pulse: [
    {
      department: 'SALES',
      metrics: [
        {
          key: 'openOrders',
          value: 7,
          unit: 'DOCUMENTS',
          tone: 'info',
          link: '/core/dashboards/sales',
        },
        {
          key: 'deliveryExceptions',
          value: 1,
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: '/core/dashboards/sales',
        },
        { key: 'linesToDeliver', value: 12, unit: 'LINES', tone: 'info', link: null },
      ],
    },
    {
      department: 'OPERATIONS',
      metrics: [
        {
          key: 'awaitingMaterials',
          value: 1,
          unit: 'DOCUMENTS',
          tone: 'blocked',
          link: '/core/dashboards/operations',
        },
      ],
    },
  ],
  departments: [
    {
      department: 'OPERATIONS',
      open: 4,
      waiting: 3,
      blocked: 0,
      overdue: 1,
      stages: [{ key: 'MO_AWAITING_APPROVAL', value: 3 }],
      completed: [{ key: 'MO_COMPLETED', value: 2 }],
      waitsOn: [{ department: 'PURCHASING', value: 1 }],
      awaitedBy: [],
      link: '/core/dashboards/operations',
    },
  ],
  bottlenecks: [
    {
      key: 'PURCHASING_TO_PRODUCTION',
      from: 'PURCHASING',
      to: 'OPERATIONS',
      total: 1,
      classes: [{ key: 'BLOCKED', value: 1 }],
      stages: [{ key: 'MO_MATERIALS_SHORT', value: 1 }],
      items: [item()],
    },
    {
      key: 'SALES_TO_WAREHOUSE',
      from: 'SALES',
      to: 'WAREHOUSE',
      total: 0,
      classes: [],
      stages: [],
      items: [],
    },
  ],
  queue: {
    total: 2,
    items: [
      item(),
      item({
        kind: 'SALES_ORDER',
        id: 'so1',
        number: 'SO-202611-000003',
        context: 'Siam Retail',
        department: 'SALES',
        next: 'WAREHOUSE',
        stage: 'SO_AWAITING_PICK',
        class: 'OVERDUE',
        reason: 'OVERDUE_DELIVERY',
        evidence: { code: 'LINES_NOT_PICKED', open: 1, total: 2 },
        date: '2026-11-12',
        dateKind: 'REQUESTED',
        overdueDays: 4,
        link: '/core/sales/orders/so1',
      }),
    ],
  },
  branchComparison: {
    keys: ['sales.openOrders', 'operations.awaitingMaterials'],
    rows: [
      {
        branch: { id: 'b0', code: '00000', name: 'Head Office' },
        values: { 'sales.openOrders': 2, 'operations.awaitingMaterials': 0 },
      },
      { branch: ref, values: { 'sales.openOrders': 5, 'operations.awaitingMaterials': 1 } },
    ],
  },
  activity: [
    {
      kind: 'SALES_ORDER',
      id: 'so9',
      number: 'SO-202611-000009',
      event: 'SO_CONFIRMED',
      at: '2026-11-16T02:00:00.000Z',
      branch: ref,
      department: 'SALES',
      link: '/core/sales/orders/so9',
    },
  ],
  notes: ['NO_FINANCIALS', 'NO_TRENDS', 'DRAFTS_EXCLUDED'],
  ...over,
});

const loaded = async () => {
  const page = await screen.findByRole('heading', { level: 1, name: 'Executive Command Center' });
  await waitFor(() => expect(document.querySelector('[data-exec-section="queue"]')).not.toBeNull());
  return page;
};

describe('EP48 Executive Command Center', () => {
  it('Owner and Executive are offered the Command Center; a department member, an Executive-department member and the System Admin are not', async () => {
    fakeApi(EXEC);
    const { unmount } = renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    expect(document.querySelector('[data-open-command-center]')).toHaveAttribute(
      'href',
      '/core/executive',
    );
    expect(document.querySelector('[data-nav-command-center] a')).toHaveAttribute(
      'href',
      '/core/executive',
    );
    unmount();
    for (const [role, perms, assignment] of [
      [
        'DEPARTMENT_MANAGER',
        ['sales.workspace.view', 'sales.orders.view'],
        { status: 'ASSIGNED', department: 'SALES' },
      ],
      [
        'DEPARTMENT_MANAGER',
        ['executive.workspace.view', 'executive.overview.view'],
        { status: 'ASSIGNED', department: 'EXECUTIVE' },
      ],
      ['SYSTEM_ADMIN', [], { status: 'ADMINISTRATIVE', department: null }],
    ] as const) {
      fakeApi({
        ...person(
          role,
          perms.length ? (['SALES'] as DepartmentCode[]) : [],
          [...perms],
          assignment as DepartmentAssignment,
        ),
        'GET /api/v1/dashboards/sales': fail(404, 'X'),
      });
      const r = renderRoute('/core?lang=en');
      await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
      expect(document.querySelector('[data-open-command-center]'), role).toBeNull();
      expect(document.querySelector('[data-nav-command-center]'), role).toBeNull();
      r.unmount();
    }
  });

  it('the page is read-only: priority reasons, evidence, next department, branch — and no action button but Refresh', async () => {
    const api = fakeApi({ ...EXEC, [`GET ${E}/overview`]: ok(overview()) });
    renderRoute('/core/executive?lang=en');
    await loaded();
    expect(api.called(`GET ${E}/overview`)[0]!.query).toEqual({ branch: 'all' });
    const queue = document.querySelector<HTMLElement>('[data-exec-section="queue"]')!;
    const rows = within(queue).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Production blocked by shortage');
    expect(rows[0]).toHaveTextContent('2 material(s) short — cannot be released until available');
    expect(rows[0]).toHaveTextContent('Next: Purchasing');
    expect(rows[0]).toHaveTextContent('Demo Branch · 00001');
    expect(rows[1]).toHaveTextContent('Delivery past requested date');
    expect(rows[1]).toHaveTextContent('1 of 2 lines not fully picked');
    expect(rows[1]).toHaveTextContent('4 day(s) overdue');
    expect(
      within(rows[0]!).getByRole('link', { name: /^Production order MO-202611-000009$/ }),
    ).toHaveAttribute('href', '/core/production/orders/mo1');
    expect(within(rows[0]!).getByRole('link', { name: /Investigate/ })).toHaveAttribute(
      'href',
      '/core/executive/documents/production-order/mo1',
    );
    const main = document.querySelector<HTMLElement>('[data-exec-center]')!;
    expect(
      within(main)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Refresh']);
    // Sections and statements.
    for (const s of ['pulse', 'bottlenecks', 'health', 'branches', 'activity'])
      expect(document.querySelector(`[data-exec-section="${s}"]`), s).not.toBeNull();
    expect(screen.getByText(/No financial figures/)).toBeVisible();
    expect(document.querySelector('[data-metric="linesToDeliver"]')).toHaveTextContent('12 lines');
    expect(screen.getByText('No open work at this handoff.')).toBeVisible();
    const table = screen.getByRole('table', { name: 'Measures by branch' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('rowheader', { name: 'Demo Branch · 00001' })).toBeVisible();
  });

  it('the branch filter asks the server for that branch and starts from nothing (no stale scope)', async () => {
    const api = fakeApi({
      ...EXEC,
      [`GET ${E}/overview`]: (_b: unknown, q: URLSearchParams) =>
        ok(overview({ scope: { ...overview().scope, selected: q.get('branch') ?? 'all' } })),
    });
    const user = userEvent.setup();
    const { router } = renderRoute('/core/executive?lang=en');
    await loaded();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Branch' }), 'b1');
    await waitFor(() =>
      expect(api.called(`GET ${E}/overview`).at(-1)!.query).toEqual({ branch: 'b1' }),
    );
    expect(router.state.location.search).toContain('branch=b1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveValue('b1'));
  });

  it('an answer for another scope is never shown; a refusal replaces what was on screen', async () => {
    let reply: Reply = ok(overview({ scope: { ...overview().scope, selected: 'b0' } }));
    fakeApi({ ...EXEC, [`GET ${E}/overview`]: () => reply });
    renderRoute('/core/executive?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Executive Command Center' });
    await waitFor(() => expect(document.querySelector('[data-exec-error]')).not.toBeNull());
    expect(document.querySelector('[data-exec-section]')).toBeNull();
    reply = ok(overview());
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await loaded();
    reply = fail(403, 'PERMISSION_DENIED');
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(document.querySelector('[data-exec-section]')).toBeNull());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You do not have access to the Executive Command Center.',
    );
  });

  it('document investigation: the work item, the related documents and the way to the document', async () => {
    const trace: Trace = {
      document: {
        kind: 'PRODUCTION_ORDER',
        id: 'mo1',
        number: 'MO-202611-000009',
        status: 'APPROVED',
        context: 'Face cream',
        branch: ref,
        link: '/core/production/orders/mo1',
      },
      item: item(),
      related: [
        {
          kind: 'SALES_ORDER',
          id: 'so1',
          number: 'SO-202611-000003',
          status: 'CONFIRMED',
          at: '2026-11-10',
          link: '/core/sales/orders/so1',
        },
        {
          kind: 'MATERIAL_ISSUE',
          id: 'mi1',
          number: 'MI-202611-000001',
          status: 'DRAFT',
          at: null,
          link: null,
        },
      ],
    };
    fakeApi({ ...EXEC, [`GET ${E}/documents/production-order/mo1`]: ok(trace) });
    renderRoute('/core/executive/documents/production-order/mo1?lang=zh');
    expect(await screen.findByRole('heading', { level: 1, name: /单据调查/ })).toBeVisible();
    await waitFor(() =>
      expect(document.querySelector('[data-exec-related="SALES_ORDER"]')).not.toBeNull(),
    );
    expect(screen.getByRole('link', { name: '打开单据' })).toHaveAttribute(
      'href',
      '/core/production/orders/mo1',
    );
    expect(document.querySelector('[data-exec-item]')).toHaveTextContent('生产因物料短缺受阻');
    // No "investigate" link to itself; a related document without permission has no link.
    expect(document.querySelector('[data-exec-trace]')).toBeNull();
    expect(document.querySelector('[data-exec-related="MATERIAL_ISSUE"] a')).toBeNull();
  });

  it('a refused document (another branch, a guessed id) shows a plain refusal', async () => {
    fakeApi({ ...EXEC, [`GET ${E}/documents/sales-order/x`]: fail(404, 'NOT_FOUND') });
    renderRoute('/core/executive/documents/sales-order/x?lang=th');
    await waitFor(() => expect(document.querySelector('[data-exec-error="404"]')).not.toBeNull());
  });

  it('copy: every key has Thai, English and Chinese text of the same shape', () => {
    const th = EXEC_COPY.th;
    for (const locale of ['en', 'zh-CN'] as const) {
      const other = EXEC_COPY[locale];
      for (const k of [
        'stages',
        'classes',
        'reasons',
        'evidence',
        'flows',
        'events',
        'completed',
        'compare',
        'notes',
        'relatedKinds',
        'units',
      ] as const)
        expect(Object.keys(other[k]).sort(), `${locale} ${k}`).toEqual(Object.keys(th[k]).sort());
      for (const d of Object.keys(th.metrics))
        expect(Object.keys(other.metrics[d]!).sort(), `${locale} ${d}`).toEqual(
          Object.keys(th.metrics[d]!).sort(),
        );
    }
  });
});
