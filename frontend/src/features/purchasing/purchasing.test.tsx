import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { resetIdentityForTests } from '@/features/auth/session';
import type { BranchContext } from '@/features/company-center/api';
import type { BranchInfo, DepartmentCode } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { PrAction, PrContext, PrDetail, PrRow, PurchaseRequest } from './api';
import { PR_COPY } from './copy';

/*
 * EP29 purchase requests (UI). Everything shown comes from the server:
 * what the person may do (context, `actions`), the requests, their lines and
 * timeline. Enforcement — permissions, branches, transitions, races, company
 * isolation — is tested in backend/test/purchase-requests.test.ts.
 */

const HO: BranchInfo = {
  id: 'b0',
  code: '00000',
  name: 'Head Office',
  type: 'HEAD_OFFICE',
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

const PR = '/api/v1/purchase-requests';

const coreContext = (
  departments: DepartmentCode[],
  permissions: string[],
  role: CompanyRole,
): BranchContext => ({
  company: { id: 'c1', displayName: 'Alpha Trading' },
  role,
  scope: 'ALL_BRANCHES',
  branches: [HO],
  selected: HO,
  needsSelection: false,
  blocked: null,
  departments,
  permissions: permissions as BranchContext['permissions'],
});

const BUYER_CTX: PrContext = {
  createDepartments: ['PURCHASING'],
  decideDepartments: ['SALES', 'OPERATIONS', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING'],
  purchasingView: true,
  cancelApproved: true,
  branches: [{ id: 'b0', code: '00000', name: 'Head Office', type: 'HEAD_OFFICE' }],
  selectedBranch: { id: 'b0', code: '00000', name: 'Head Office', type: 'HEAD_OFFICE' },
};

const row = (over: Partial<PrRow> = {}): PrRow => ({
  id: 'pr1',
  number: 'PR-202610-000001',
  status: 'SUBMITTED',
  department: 'SALES',
  branch: { id: 'b0', code: '00000', name: 'Head Office' },
  requester: { name: 'Demo Sales', isMe: false },
  requestDate: '2026-10-29',
  needByDate: '2026-11-15',
  purpose: 'Samples for a new customer',
  lineCount: 2,
  updatedAt: '2026-10-29T03:00:00.000Z',
  ...over,
});

const request = (over: Partial<PurchaseRequest> = {}): PurchaseRequest => ({
  id: 'pr1',
  number: 'PR-202610-000001',
  status: 'DRAFT',
  department: 'PURCHASING',
  branch: { id: 'b0', code: '00000', name: 'Head Office' },
  requester: { memberId: 'm1', name: 'Demo Purchasing', isMe: true },
  requestDate: '2026-10-29',
  needByDate: null,
  purpose: 'Packaging for next month',
  submittedAt: null,
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  lines: [
    {
      id: 'l1',
      lineNo: 1,
      type: 'ITEM',
      item: { id: 'i1', code: 'PK-000001', name: 'Shipping box', active: true },
      description: null,
      unit: { id: 'u1', code: 'BOX', name: 'Box' },
      quantity: '50',
      note: null,
    },
  ],
  updatedAt: '2026-10-29T03:00:00.000Z',
  ...over,
});

const detail = (r: PurchaseRequest, actions: PrAction[]): PrDetail => ({
  request: r,
  actions,
  timeline: [
    {
      type: 'PURCHASE_REQUEST_CREATED',
      at: '2026-10-29T03:00:00.000Z',
      actor: { name: r.requester.name },
    },
  ],
});

const buyer = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...signedIn(
    identity({
      company: {
        id: 'c1',
        name: 'Alpha Trading',
        isDemo: false,
        role: 'DEPARTMENT_MANAGER',
        canEnterCore: true,
      },
    }),
  ),
  'GET /api/v1/company/context': ok(
    coreContext(
      ['PURCHASING'],
      [
        'purchasing.workspace.view',
        'purchasing.requests.view',
        'purchasing.requests.create',
        'purchasing.requests.approve',
      ],
      'DEPARTMENT_MANAGER',
    ),
  ),
  [`GET ${PR}/context`]: ok(BUYER_CTX),
  ...extra,
});

afterEach(() => resetIdentityForTests());

describe('Purchasing workspace and requests (EP29)', () => {
  it('CORE opens the Purchasing workspace; the landing counts come from the server', async () => {
    const api = fakeApi(
      buyer({
        [`GET ${PR}`]: (_b, q) =>
          ok({
            items: [],
            total: q.get('view') === 'mine' ? 3 : q.get('view') === 'queue' ? 2 : 5,
            page: 1,
            pageSize: 1,
            hasMore: false,
          }),
      }),
    );
    renderRoute('/core?lang=en');
    const open = await screen.findByRole('link', { name: 'Open the Purchasing workspace' });
    expect(open).toHaveAttribute('href', '/core/purchasing');
    expect(screen.getByRole('link', { name: 'Purchase requests' })).toHaveAttribute(
      'href',
      '/core/purchasing/requests',
    );
    await userEvent.setup().click(open);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Purchasing' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[data-tile="mine"]')).toHaveTextContent('3'),
    );
    expect(document.querySelector('[data-tile="queue"]')).toHaveTextContent('2');
    expect(document.querySelector('[data-tile="approved"]')).toHaveTextContent('5');
    expect(screen.getByRole('link', { name: 'New purchase request' })).toHaveAttribute(
      'href',
      '/core/purchasing/requests/new',
    );
    expect(api.called(`GET ${PR}`).map((c) => c.query.pageSize)).toEqual(['1', '1', '1']);
  });

  it('lists on the server: views, filters (current branch by default), search; status in words', async () => {
    const api = fakeApi(
      buyer({
        [`GET ${PR}`]: ok({
          items: [
            row(),
            row({
              id: 'pr2',
              number: 'PR-202610-000002',
              status: 'APPROVED',
              requester: { name: 'Me', isMe: true },
            }),
          ],
          total: 2,
          page: 1,
          pageSize: 25,
          hasMore: false,
        }),
      }),
    );
    renderRoute('/core/purchasing/requests?lang=en');
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('PR-202610-000001');
    expect(rows[0]).toHaveTextContent('Submitted');
    expect(rows[1]).toHaveTextContent('Approved');
    expect(api.called(`GET ${PR}`)[0]!.query).toMatchObject({
      view: 'all',
      branchId: 'b0',
      page: '1',
      pageSize: '25',
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'To decide' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'SUBMITTED');
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'samples');
    await waitFor(() =>
      expect(api.called(`GET ${PR}`).at(-1)!.query).toMatchObject({
        view: 'queue',
        status: 'SUBMITTED',
        q: 'samples',
      }),
    );
    expect(screen.getByRole('button', { name: 'To decide' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('empty state: create for requesters, a read-only explanation for others', async () => {
    fakeApi(
      buyer({ [`GET ${PR}`]: ok({ items: [], total: 0, page: 1, pageSize: 25, hasMore: false }) }),
    );
    const { unmount } = renderRoute('/core/purchasing/requests?lang=en');
    expect(await screen.findByText('No purchase requests yet')).toBeInTheDocument();
    expect(
      within(document.querySelector('[data-empty]')!).getByRole('link', {
        name: 'New purchase request',
      }),
    ).toBeInTheDocument();
    unmount();
    fakeApi(
      buyer({
        [`GET ${PR}/context`]: ok({
          ...BUYER_CTX,
          createDepartments: [],
          decideDepartments: [],
          cancelApproved: false,
        }),
        [`GET ${PR}`]: ok({ items: [], total: 0, page: 1, pageSize: 25, hasMore: false }),
      }),
    );
    renderRoute('/core/purchasing/requests?lang=en');
    expect(await screen.findByText(PR_COPY.en.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New purchase request' })).toBeNull();
  });

  it('creates a draft: one department is fixed, only filled fields are sent', async () => {
    const api = fakeApi(
      buyer({
        [`POST ${PR}`]: {
          status: 201,
          body: detail(request({ lines: [] }), ['edit', 'submit', 'cancel']),
        },
        [`GET ${PR}/pr1`]: ok(detail(request({ lines: [] }), ['edit', 'submit', 'cancel'])),
        [`GET ${PR}/item-options`]: ok({ items: [] }),
        [`GET ${PR}/unit-options`]: ok({ units: [] }),
      }),
    );
    renderRoute('/core/purchasing/requests/new?lang=en');
    const dept = await screen.findByRole('textbox', { name: 'Requesting department' });
    expect(dept).toHaveAttribute('readonly');
    expect(screen.getByText('Branch: 00000 · Head Office')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Purpose' }), 'Packaging for next month');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'PR-202610-000001' }),
    ).toBeInTheDocument();
    expect(api.called(`POST ${PR}`)[0]!.body).toEqual({
      department: 'PURCHASING',
      purpose: 'Packaging for next month',
    });
  });

  it('draft lines: item picker with unit precision, a described need, remove — quantities as text', async () => {
    const draft = request();
    const api = fakeApi(
      buyer({
        [`GET ${PR}/pr1`]: ok(detail(draft, ['edit', 'submit', 'cancel'])),
        [`GET ${PR}/item-options`]: ok({
          items: [
            {
              id: 'i2',
              code: 'FG-000001',
              name: 'Cream 50 ml',
              unit: { id: 'u2', code: 'PCS', name: 'Piece', precision: 0 },
            },
          ],
        }),
        [`GET ${PR}/unit-options`]: ok({
          units: [{ id: 'u3', code: 'KG', name: 'Kilogram', precision: 3 }],
        }),
        [`POST ${PR}/pr1/lines`]: {
          status: 201,
          body: detail(draft, ['edit', 'submit', 'cancel']),
        },
        [`DELETE ${PR}/pr1/lines/l1`]: ok(
          detail({ ...draft, lines: [] }, ['edit', 'submit', 'cancel']),
        ),
      }),
    );
    renderRoute('/core/purchasing/requests/pr1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Add line' }));
    const form = document.querySelector<HTMLElement>('[data-line-form]')!;
    const pick = within(form).getByRole('combobox', { name: 'Item' });
    await waitFor(() => expect(within(pick).getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(pick, 'i2');
    const qty = within(form).getByRole('textbox', { name: 'Quantity (PCS)' });
    await user.type(qty, '1.5');
    await user.click(within(form).getByRole('button', { name: 'Save line' }));
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    expect(within(form).getByText(PR_COPY.en.errors.QUANTITY_PRECISION!)).toBeInTheDocument();
    expect(api.called(`POST ${PR}/pr1/lines`)).toHaveLength(0);
    await user.clear(qty);
    await user.type(qty, '24');
    await user.click(within(form).getByRole('button', { name: 'Save line' }));
    await waitFor(() => expect(api.called(`POST ${PR}/pr1/lines`)).toHaveLength(1));
    expect(api.called(`POST ${PR}/pr1/lines`)[0]!.body).toEqual({
      type: 'ITEM',
      itemId: 'i2',
      quantity: '24',
      note: null,
    });

    await user.click(await screen.findByRole('button', { name: '+ Add line' }));
    const form2 = document.querySelector<HTMLElement>('[data-line-form]')!;
    await user.click(within(form2).getByRole('radio', { name: 'Other / service' }));
    await user.type(
      within(form2).getByRole('textbox', { name: 'Description' }),
      'Electrician visit',
    );
    await user.type(within(form2).getByRole('textbox', { name: 'Unit (free text)' }), 'job');
    await user.type(within(form2).getByRole('textbox', { name: 'Quantity' }), '1');
    await user.click(within(form2).getByRole('button', { name: 'Save line' }));
    await waitFor(() => expect(api.called(`POST ${PR}/pr1/lines`)).toHaveLength(2));
    expect(api.called(`POST ${PR}/pr1/lines`)[1]!.body).toEqual({
      type: 'NON_ITEM',
      description: 'Electrician visit',
      quantity: '1',
      unitId: null,
      unitText: 'job',
      note: null,
    });
    await user.click(screen.getByRole('button', { name: 'Remove #1' }));
    expect(await screen.findByText('No lines yet')).toBeInTheDocument();
  });

  it('submit and approve after an in-place confirmation; the timeline follows', async () => {
    let current = detail(request(), ['edit', 'submit', 'cancel']);
    const api = fakeApi(
      buyer({
        [`GET ${PR}/pr1`]: () => ok(current),
        [`GET ${PR}/item-options`]: ok({ items: [] }),
        [`GET ${PR}/unit-options`]: ok({ units: [] }),
        [`POST ${PR}/pr1/submit`]: () => {
          current = {
            request: request({ status: 'SUBMITTED', submittedAt: '2026-10-29T04:00:00.000Z' }),
            actions: ['approve', 'reject'],
            timeline: [
              ...current.timeline,
              {
                type: 'PURCHASE_REQUEST_SUBMITTED',
                at: '2026-10-29T04:00:00.000Z',
                actor: { name: 'Demo Purchasing' },
              },
            ],
          };
          return ok(current);
        },
        [`POST ${PR}/pr1/approve`]: () =>
          ok({
            request: request({ status: 'APPROVED', approvedBy: { name: 'Demo Purchasing' } }),
            actions: ['cancel'],
            timeline: [
              ...current.timeline,
              {
                type: 'PURCHASE_REQUEST_APPROVED',
                at: '2026-10-29T05:00:00.000Z',
                actor: { name: 'Demo Purchasing' },
              },
            ],
          }),
      }),
    );
    renderRoute('/core/purchasing/requests/pr1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Submit request' }));
    const confirm = screen.getByRole('group', { name: PR_COPY.en.confirm.submit });
    expect(within(confirm).getByRole('button', { name: 'Submit request' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(document.querySelector('[data-request]')).toHaveAttribute('data-status', 'SUBMITTED'),
    );
    expect(screen.queryByRole('button', { name: '+ Add line' })).toBeNull();
    expect(api.called(`POST ${PR}/pr1/submit`)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(
      within(screen.getByRole('group', { name: PR_COPY.en.confirm.approve })).getByRole('button', {
        name: 'Approve',
      }),
    );
    await waitFor(() =>
      expect(document.querySelector('[data-request]')).toHaveAttribute('data-status', 'APPROVED'),
    );
    const timeline = document.querySelector<HTMLElement>('[data-timeline]')!;
    expect(
      within(timeline)
        .getAllByRole('listitem')
        .map((li) => li.textContent?.split('Demo')[0]),
    ).toEqual(['Created', 'Submitted', 'Approved']);
  });

  it('reject needs a reason; Escape backs out; server refusals in words', async () => {
    const api = fakeApi(
      buyer({
        [`GET ${PR}/pr1`]: ok(detail(request({ status: 'SUBMITTED' }), ['approve', 'reject'])),
        [`POST ${PR}/pr1/reject`]: fail(409, 'PR_STATE_CHANGED'),
      }),
    );
    renderRoute('/core/purchasing/requests/pr1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const panel = screen.getByRole('group', { name: PR_COPY.en.confirm.reject });
    await user.click(within(panel).getByRole('button', { name: 'Reject' }));
    const reason = within(panel).getByRole('textbox', { name: 'Reason' });
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveFocus();
    expect(api.called(`POST ${PR}/pr1/reject`)).toHaveLength(0);
    await user.type(reason, 'Use existing stock');
    await user.click(within(panel).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText(PR_COPY.en.errors.PR_STATE_CHANGED!)).toBeInTheDocument();
    expect(api.called(`POST ${PR}/pr1/reject`)[0]!.body).toEqual({ reason: 'Use existing stock' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: PR_COPY.en.confirm.reject })).toBeNull();
  });

  it('read-only viewers see no action at all', async () => {
    fakeApi(
      buyer({
        [`GET ${PR}/context`]: ok({
          ...BUYER_CTX,
          createDepartments: [],
          decideDepartments: [],
          cancelApproved: false,
        }),
        [`GET ${PR}/pr1`]: ok(
          detail(
            request({
              status: 'SUBMITTED',
              requester: { memberId: 'm9', name: 'Someone', isMe: false },
            }),
            [],
          ),
        ),
      }),
    );
    renderRoute('/core/purchasing/requests/pr1?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'PR-202610-000001' });
    expect(document.querySelector('[data-actions]')).toBeNull();
    expect(document.querySelector('[data-header-form]')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add line' })).toBeNull();
  });

  it('speaks Thai, English and Simplified Chinese; purposes stay as written', async () => {
    for (const [lang, title, status] of [
      ['th', 'ใบขอซื้อ', 'ส่งแล้ว'],
      ['en', 'Purchase requests', 'Submitted'],
      ['zh', '请购单', '已提交'],
    ] as const) {
      fakeApi(
        buyer({
          [`GET ${PR}`]: ok({
            items: [row({ purpose: 'ตัวอย่างสินค้า' })],
            total: 1,
            page: 1,
            pageSize: 25,
            hasMore: false,
          }),
        }),
      );
      const { unmount } = renderRoute(`/core/purchasing/requests?lang=${lang}`);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(within(await screen.findByRole('table')).getByText(status)).toBeInTheDocument();
      expect(screen.getByText('ตัวอย่างสินค้า')).toBeInTheDocument();
      unmount();
      resetIdentityForTests();
    }
  });

  it('copy has the same shape in every language', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v).map((x) => `${k}.${x}`) : [k],
      );
    const th = keys(PR_COPY.th).sort();
    expect(keys(PR_COPY.en).sort()).toEqual(th);
    expect(keys(PR_COPY['zh-CN']).sort()).toEqual(th);
  });
});
