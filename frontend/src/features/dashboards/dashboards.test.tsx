import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchContext, DepartmentAssignment } from '@/features/company-center/api';
import type { BranchInfo, DepartmentCode } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn, type Reply } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { Dashboard, QueueItem } from './dashApi';
import { DASH_COPY } from './dashCopy';

/*
 * EP47 department dashboards (UI). The server decides scope and content
 * (backend/test/ep47-dashboards.test.ts); here: the role-aware landing, the KPI
 * hierarchy, read-only work queues ("Your step" only where the server says so,
 * no transaction button anywhere), and the refresh rules — a refusal clears what
 * was shown, a network failure keeps it marked stale, another branch's answer is
 * never shown.
 */

const X: BranchInfo = {
  id: 'b1',
  code: '00001',
  name: 'Demo Branch',
  type: 'BRANCH',
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
};
const D = '/api/v1/dashboards';

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
    scope: 'SELECTED_BRANCHES',
    branches: [X],
    selected: X,
    needsSelection: false,
    blocked: null,
    departments,
    permissions: permissions as BranchContext['permissions'],
    assignment,
  } satisfies BranchContext),
});

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  id: 'so1',
  kind: 'SALES_ORDER',
  number: 'SO-202611-000012',
  status: 'SUBMITTED',
  context: 'Siam Retail',
  action: 'SALES_ORDER.CONFIRM',
  responsible: 'SALES',
  canAct: false,
  date: '2026-11-10',
  dateKind: 'REQUESTED',
  overdue: true,
  progress: null,
  quantity: null,
  amount: null,
  link: '/core/sales/orders/so1',
  ...over,
});

const sales = (over: Partial<Dashboard> = {}): Dashboard => ({
  department: 'SALES',
  branch: { id: 'b1', code: '00001', name: 'Demo Branch' },
  today: '2026-11-16',
  generatedAt: '2026-11-16T03:00:00.000Z',
  access: 'OPERATE',
  manufacturingMode: null,
  metrics: [
    { key: 'awaitingConfirmation', value: 1, tone: 'attention', link: '/core/sales' },
    { key: 'deliveryExceptions', value: 2, tone: 'blocked', link: '/core/sales' },
    { key: 'awaitingFulfilment', value: 4, tone: 'progress', link: '/core/sales' },
    { key: 'completedRecently', value: 3, tone: 'done', link: '/core/sales' },
  ],
  queues: [
    {
      key: 'work',
      total: 9,
      items: [
        item(),
        item({
          id: 'so2',
          number: 'SO-202611-000014',
          status: 'CONFIRMED.ALLOCATION',
          action: 'SALES_ORDER.ALLOCATE',
          overdue: false,
          progress: { open: 1, total: 2 },
        }),
        item({
          id: 'so3',
          number: 'SO-202611-000003',
          status: 'CONFIRMED.FULFILMENT',
          action: 'SALES_ORDER.FULFIL',
          responsible: 'WAREHOUSE',
          overdue: false,
        }),
      ],
    },
    { key: 'completed', total: 0, items: [] },
  ],
  notes: [],
  ...over,
});

/** The dashboard region once its numbers are on screen. */
const loaded = async (name: string) => {
  const dash = await screen.findByRole('region', { name });
  await waitFor(() => expect(dash.querySelector('[data-metric]')).not.toBeNull());
  return dash;
};

const SALES_STAFF = person(
  'DEPARTMENT_STAFF',
  ['SALES'],
  ['sales.workspace.view', 'sales.orders.view', 'sales.orders.create'],
  { status: 'ASSIGNED', department: 'SALES' },
);

describe('EP47 department dashboards', () => {
  it('a department member lands on their ONE dashboard: KPI groups, read-only queue, links to the documents', async () => {
    const api = fakeApi({ ...SALES_STAFF, [`GET ${D}/sales`]: ok(sales()) });
    renderRoute('/core?lang=en');
    const dash = await loaded('Sales dashboard');
    expect(api.called(`GET ${D}/sales`)).toHaveLength(1);
    // Heading levels below the CORE home's h1.
    expect(within(dash).getByRole('heading', { level: 2, name: 'Sales dashboard' })).toBeVisible();
    const groups = within(dash)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(groups).toEqual([
      'Needs attention',
      'In progress',
      'Done and other',
      'Work queue',
      'Recently delivered',
    ]);
    // Blocked and attention numbers lead; each number opens its list.
    const tile = dash.querySelector('[data-metric="deliveryExceptions"] a')!;
    expect(tile).toHaveTextContent('Delivery exceptions2');
    expect(tile).toHaveAttribute('href', '/core/sales');
    // Queue rows: the document, its status, the next step and who owns it.
    const rows = within(dash)
      .getAllByRole('listitem')
      .filter((li) => li.dataset.queueItem);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('link', { name: /SO-202611-000012/ })).toHaveAttribute(
      'href',
      '/core/sales/orders/so1',
    );
    expect(rows[0]).toHaveTextContent('Confirm order');
    expect(rows[0]).toHaveTextContent('Next: Sales');
    expect(rows[0]).toHaveTextContent('Overdue');
    expect(rows[1]).toHaveTextContent('1 of 2 lines open');
    expect(rows[2]).toHaveTextContent('Next: Warehouse');
    expect(within(dash).queryByText('Your step')).toBeNull();
    expect(within(dash).getByText('Showing 3 of 9')).toBeVisible();
    expect(within(dash).getByText('No open work in this queue.')).toBeVisible();
    // The only button is Refresh — no transaction is started from a dashboard.
    expect(
      within(dash)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Refresh']);
    // The department-card list is replaced by the dashboard for a one-department member.
    expect(document.querySelector('[data-core-departments]')).toBeNull();
  });

  it('"Your step" appears only on rows the server marks as actionable for this person', async () => {
    fakeApi({
      ...SALES_STAFF,
      [`GET ${D}/sales`]: ok(
        sales({
          access: 'MANAGE',
          queues: [{ key: 'work', total: 1, items: [item({ canAct: true })] }],
        }),
      ),
    });
    renderRoute('/core?lang=th');
    const dash = await loaded('แดชบอร์ดฝ่ายขาย');
    expect(within(dash).getByText('ขั้นตอนของคุณ')).toBeVisible();
    expect(within(dash).getByText('จัดการและอนุมัติ')).toBeVisible();
  });

  it('the Owner navigates across departments; the Executive card stays for EP48', async () => {
    const all = ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'EXECUTIVE'];
    fakeApi(
      person(
        'COMPANY_OWNER',
        all as DepartmentCode[],
        [
          ...all.map((d) => `${d.toLowerCase()}.workspace.view`),
          'sales.orders.view',
          'operations.orders.view',
        ],
        { status: 'CROSS_DEPARTMENT', department: null },
      ),
    );
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-open-dashboard]')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/core/dashboards/sales',
      '/core/dashboards/operations',
      '/core/dashboards/warehouse',
      '/core/dashboards/purchasing',
      '/core/dashboards/accounting',
    ]);
    expect(document.querySelector('[data-open-dashboard="EXECUTIVE"]')).toBeNull();
    expect(document.querySelector('[data-dashboard]')).toBeNull();
  });

  it('System Admin: administration, never a work queue', async () => {
    const api = fakeApi(
      person('SYSTEM_ADMIN', [], [], { status: 'ADMINISTRATIVE', department: null }),
    );
    renderRoute('/core?lang=en');
    await screen.findAllByText(/no department work/);
    expect(document.querySelector('[data-admin-functions]')).toHaveAttribute('href', '/company');
    expect(document.querySelector('[data-dashboard]')).toBeNull();
    expect(api.calls.some((c) => c.path.startsWith(D))).toBe(false);
  });

  it('an unassigned member sees the no-department state and no operational request is made', async () => {
    const api = fakeApi(
      person('DEPARTMENT_STAFF', [], [], { status: 'UNASSIGNED', department: null }),
    );
    renderRoute('/core?lang=en');
    expect(
      await screen.findByText(/department/i, { selector: '[data-no-department]' }),
    ).toBeVisible();
    expect(api.calls.some((c) => c.path.startsWith(D))).toBe(false);
  });

  it('a revoked permission replaces the numbers on screen — they never stay visible', async () => {
    let reply: Reply = ok(sales());
    fakeApi({ ...SALES_STAFF, [`GET ${D}/sales`]: () => reply });
    renderRoute('/core?lang=en');
    const dash = await loaded('Sales dashboard');
    reply = fail(403, 'PERMISSION_DENIED', { permission: 'sales.workspace.view' });
    await userEvent.click(within(dash).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(dash.querySelector('[data-metric]')).toBeNull());
    expect(within(dash).getByRole('alert')).toHaveTextContent(
      'You no longer have access to this dashboard.',
    );
    expect(dash.querySelector('[data-queue-item]')).toBeNull();
  });

  it('a network failure keeps the last result, marked stale; Refresh recovers', async () => {
    let up = true;
    fakeApi({
      ...SALES_STAFF,
      [`GET ${D}/sales`]: () => (up ? ok(sales()) : fail(503, 'UNAVAILABLE')),
    });
    renderRoute('/core?lang=en');
    const dash = await screen.findByRole('region', { name: 'Sales dashboard' });
    await within(dash).findByText('Delivery exceptions');
    up = false;
    await userEvent.click(within(dash).getByRole('button', { name: 'Refresh' }));
    expect(await within(dash).findByText(/Could not refresh/)).toBeVisible();
    expect(dash.querySelector('[data-metric="deliveryExceptions"]')).not.toBeNull();
    up = true;
    await userEvent.click(within(dash).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(within(dash).queryByText(/Could not refresh/)).toBeNull());
  });

  it('an answer for another branch is never shown (the session branch changed elsewhere)', async () => {
    fakeApi({
      ...SALES_STAFF,
      [`GET ${D}/sales`]: ok(sales({ branch: { id: 'b2', code: '00002', name: 'Other' } })),
    });
    renderRoute('/core?lang=en');
    const dash = await screen.findByRole('region', { name: 'Sales dashboard' });
    await waitFor(() => expect(dash.querySelector('[data-dashboard-error]')).not.toBeNull());
    expect(dash.querySelector('[data-metric]')).toBeNull();
  });

  it('a session that ended asks to sign in again', async () => {
    fakeApi({ ...SALES_STAFF, [`GET ${D}/sales`]: fail(401, 'UNAUTHORIZED') });
    renderRoute('/core?lang=zh');
    const dash = await screen.findByRole('region', { name: '销售仪表板' });
    expect(await within(dash).findByRole('link', { name: '登录' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('Accounting states its limited scope; Production shows the manufacturing mode', async () => {
    fakeApi({
      ...person(
        'DEPARTMENT_MANAGER',
        ['ACCOUNTING'],
        ['accounting.workspace.view', 'accounting.deposits.view'],
        { status: 'ASSIGNED', department: 'ACCOUNTING' },
      ),
      [`GET ${D}/accounting`]: ok(
        sales({
          department: 'ACCOUNTING',
          metrics: [{ key: 'depositsPending', value: 1, tone: 'attention', link: null }],
          queues: [
            {
              key: 'deposits',
              total: 1,
              items: [
                item({
                  kind: 'SUPPLIER_DEPOSIT',
                  number: 'PO-202611-000002',
                  status: 'PENDING',
                  action: 'SUPPLIER_DEPOSIT.CONFIRM',
                  responsible: 'ACCOUNTING',
                  canAct: true,
                  dateKind: 'DEPOSIT_DUE',
                  amount: { value: '1816.86', currency: 'THB' },
                  link: '/core/accounting/deposits/po2',
                }),
              ],
            },
          ],
          notes: ['ACCOUNTING_SCOPE'],
        }),
      ),
    });
    renderRoute('/core?lang=en');
    const dash = await loaded('Accounting dashboard');
    expect(within(dash).getByText(/not part of CORE/)).toBeVisible();
    expect(dash.querySelector('[data-queue-item]')).toHaveTextContent('1,816.86');
    // A metric without a list screen is not a link.
    expect(dash.querySelector('[data-metric="depositsPending"] a')).toBeNull();
  });

  it('a refusal of another CORE request re-checks the dashboard once; its own refusal never loops', async () => {
    let reply: Reply = ok(sales());
    const api = fakeApi({ ...SALES_STAFF, [`GET ${D}/sales`]: () => reply });
    renderRoute('/core?lang=en');
    const dash = await loaded('Sales dashboard');
    reply = fail(403, 'PERMISSION_DENIED');
    act(() => {
      window.dispatchEvent(
        new CustomEvent('core:authorization-changed', { detail: 'PERMISSION_DENIED' }),
      );
    });
    await waitFor(() => expect(dash.querySelector('[data-dashboard-error]')).not.toBeNull());
    const n = api.called(`GET ${D}/sales`).length;
    await new Promise((r) => setTimeout(r, 300));
    expect(api.called(`GET ${D}/sales`)).toHaveLength(n);
    expect(n).toBe(2);
  });

  it('copy: every metric, action and status has Thai, English and Chinese text of the same shape', () => {
    const th = DASH_COPY.th;
    for (const locale of ['en', 'zh-CN'] as const) {
      const other = DASH_COPY[locale];
      for (const dept of Object.keys(th.metrics) as (keyof typeof th.metrics)[])
        expect(Object.keys(other.metrics[dept]).sort(), `${locale} ${dept}`).toEqual(
          Object.keys(th.metrics[dept]).sort(),
        );
      for (const k of ['actions', 'kinds', 'statuses', 'dates', 'reasons', 'notes'] as const)
        expect(Object.keys(other[k]).sort(), `${locale} ${k}`).toEqual(Object.keys(th[k]).sort());
    }
  });

  it('refreshes on its own only while the tab is visible (2-minute interval)', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = fakeApi({ ...SALES_STAFF, [`GET ${D}/sales`]: ok(sales()) });
      renderRoute('/core?lang=en');
      await screen.findByRole('region', { name: 'Sales dashboard' });
      await waitFor(() => expect(api.called(`GET ${D}/sales`)).toHaveLength(1));
      await act(async () => {
        vi.advanceTimersByTime(120_000);
      });
      await waitFor(() => expect(api.called(`GET ${D}/sales`)).toHaveLength(2));
      const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      await act(async () => {
        vi.advanceTimersByTime(240_000);
      });
      expect(api.called(`GET ${D}/sales`)).toHaveLength(2);
      hidden.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
