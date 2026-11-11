import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiRequest } from '@/lib/api';
import type { CompanyRole } from '@/features/auth/api';
import type { BranchInfo } from '@/features/company/api';
import { fail, fakeApi, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { BranchContext } from './api';

/*
 * EP38.4 CORE navigation (UI): one permission-driven menu (sidebar on desktop,
 * drawer on small screens), quick actions on the CORE home, the current page
 * marked, the working branch always named, a deep link kept through the branch
 * choice — and nothing a role cannot do. The workspaces and the server still
 * check every route and action (frontend visibility is not authorization).
 */

const branch = (id: string, code: string, name: string, type: BranchInfo['type']): BranchInfo => ({
  id,
  code,
  name,
  type,
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
const HO = branch('b0', '00000', 'Head Office', 'HEAD_OFFICE');
const DEMO = branch('b1', '00001', 'Demo Branch', 'BRANCH');

const SALES_STAFF = [
  'sales.workspace.view',
  'sales.orders.view',
  'sales.orders.create',
  'sales.customers.view',
  'sales.purchase_requests.create',
];
const as = (role: CompanyRole, permissions: string[], over: Partial<BranchContext> = {}) => ({
  ...signedIn(
    identity({ company: { id: 'c1', name: 'Alpha', isDemo: false, role, canEnterCore: true } }),
  ),
  'GET /api/v1/company/context': ok({
    company: { id: 'c1', displayName: 'Alpha' },
    role,
    scope: 'SELECTED_BRANCHES',
    branches: [HO, DEMO],
    selected: DEMO,
    needsSelection: false,
    blocked: null,
    departments: ['SALES'],
    permissions,
    ...over,
  } as BranchContext),
});
const sidebar = () => document.querySelector<HTMLElement>('[data-core-sidebar]')!;

describe('CORE navigation (EP38.4)', () => {
  it('Sales Staff: Sales and purchase-request entries only, quick actions, branch named, nothing managerial', async () => {
    fakeApi(as('DEPARTMENT_STAFF', SALES_STAFF));
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const nav = within(sidebar());
    expect(nav.getByRole('link', { name: 'Sales orders' })).toHaveAttribute('href', '/core/sales');
    expect(nav.getByRole('link', { name: 'New sales order' })).toHaveAttribute(
      'href',
      '/core/sales/orders/new',
    );
    expect(nav.getByRole('link', { name: 'New purchase request' })).toBeInTheDocument();
    // No department this person cannot work in, no manager-only entry.
    expect(nav.queryByRole('link', { name: 'Production' })).toBeNull();
    expect(nav.queryByRole('link', { name: 'Pending pick' })).toBeNull();
    expect(nav.queryByRole('link', { name: 'Purchase orders' })).toBeNull();
    expect(nav.getByRole('link', { name: 'CORE overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sidebar().querySelector('[data-nav-branch]')!.textContent).toBe('Demo Branch · 00001');
    expect(nav.getByRole('link', { name: 'Change branch' })).toHaveAttribute(
      'href',
      '/core/branch',
    );
    // Quick actions: one click to the most common work.
    const quick = within(document.querySelector<HTMLElement>('[data-quick-actions]')!);
    expect(quick.getByRole('link', { name: 'New sales order' })).toHaveAttribute(
      'href',
      '/core/sales/orders/new',
    );
    expect(quick.getByRole('link', { name: 'New purchase request' })).toBeInTheDocument();
    // The header leads back to the CORE home (never only to the Control Center).
    expect(document.querySelector('[data-core-home-link]')).toHaveAttribute('href', '/core');
  });

  it('a viewer of Sales without create rights sees the list, no "New", no quick action', async () => {
    fakeApi(as('EXECUTIVE', ['sales.workspace.view', 'sales.orders.view']));
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const nav = within(sidebar());
    expect(nav.getByRole('link', { name: 'Sales orders' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'New sales order' })).toBeNull();
    expect(document.querySelector('[data-quick-actions]')).toBeNull();
  });

  it('the mobile drawer: Menu opens a dialog with the same entries, Escape closes and returns focus', async () => {
    fakeApi(as('DEPARTMENT_STAFF', SALES_STAFF));
    const user = userEvent.setup();
    renderRoute('/core?lang=en');
    const menu = await screen.findByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    const dialog = screen.getByRole('dialog', { name: 'CORE menu' });
    expect(within(dialog).getByRole('link', { name: 'New sales order' })).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
    // Focus stays in the modal: Shift+Tab from the first control wraps to the last, Tab back again.
    const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button')];
    expect(document.activeElement).toBe(focusable[0]);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(focusable[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(menu).toHaveFocus();
  });

  it('a deep link survives the branch choice: back to New sales order, not the CORE home', async () => {
    const choose = {
      company: { id: 'c1', displayName: 'Alpha' },
      role: 'DEPARTMENT_STAFF',
      scope: 'SELECTED_BRANCHES',
      branches: [HO, DEMO],
      blocked: null,
      departments: ['SALES'],
      permissions: SALES_STAFF,
    };
    fakeApi({
      ...as('DEPARTMENT_STAFF', SALES_STAFF, { selected: null, needsSelection: true }),
      'POST /api/v1/company/context/branch': ok({
        ...choose,
        selected: DEMO,
        needsSelection: false,
      }),
      'GET /api/v1/sales/context': ok({
        orders: { view: true, create: true, confirm: false, cancel: false },
        branches: [
          { id: 'b0', code: '00000', name: 'Head Office', type: 'HEAD_OFFICE' },
          { id: 'b1', code: '00001', name: 'Demo Branch', type: 'BRANCH' },
        ],
        selectedBranch: { id: 'b1', code: '00001', name: 'Demo Branch', type: 'BRANCH' },
        counts: { myDrafts: 0, awaitingConfirmation: 0, confirmed: 0, withShortage: 0 },
        today: '2026-11-05',
      }),
      'GET /api/v1/master-data/customers': ok({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
    });
    const user = userEvent.setup();
    renderRoute('/core/sales/orders/new?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'Choose the branch you work in' });
    // Before a branch is chosen there is no menu to wander off with.
    expect(document.querySelector('[data-core-sidebar]')).toBeNull();
    await user.click(screen.getByRole('radio', { name: /00001/ }));
    await user.click(screen.getByRole('button', { name: 'Enter CORE' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New sales order' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(sidebar()).getByRole('link', { name: 'New sales order' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('Change branch returns to the page it was opened from, with focus on the content (EP39)', async () => {
    const sales = {
      'GET /api/v1/sales/context': ok({
        orders: { view: true, create: true, confirm: false, cancel: false },
        branches: [
          { id: 'b0', code: '00000', name: 'Head Office', type: 'HEAD_OFFICE' },
          { id: 'b1', code: '00001', name: 'Demo Branch', type: 'BRANCH' },
        ],
        selectedBranch: { id: 'b1', code: '00001', name: 'Demo Branch', type: 'BRANCH' },
        counts: { myDrafts: 0, awaitingConfirmation: 0, confirmed: 0, withShortage: 0 },
        today: '2026-11-05',
      }),
      'GET /api/v1/master-data/customers': ok({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
    };
    fakeApi({
      ...as('DEPARTMENT_STAFF', SALES_STAFF),
      ...sales,
      'POST /api/v1/company/context/branch': ok({
        company: { id: 'c1', displayName: 'Alpha' },
        role: 'DEPARTMENT_STAFF',
        scope: 'SELECTED_BRANCHES',
        branches: [HO, DEMO],
        selected: HO,
        needsSelection: false,
        blocked: null,
        departments: ['SALES'],
        permissions: SALES_STAFF,
      }),
    });
    const user = userEvent.setup();
    renderRoute('/core/sales/orders/new?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'New sales order' });
    await user.click(within(sidebar()).getByRole('link', { name: 'Change branch' }));
    await screen.findByRole('heading', { level: 1, name: 'Choose the branch you work in' });
    await user.click(screen.getByRole('radio', { name: /00000/ }));
    await user.click(screen.getByRole('button', { name: 'Enter CORE' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New sales order' }),
    ).toBeInTheDocument();
    // The button that had focus is gone: focus moves to the content, never stays on <body>.
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('main')));
  });

  it('speaks Thai and Simplified Chinese', async () => {
    fakeApi(as('DEPARTMENT_STAFF', SALES_STAFF));
    const { unmount } = renderRoute('/core?lang=th');
    expect(await within(document.body).findAllByText('สร้างคำสั่งขาย')).not.toHaveLength(0);
    expect(screen.getByText('ทางลัด')).toBeInTheDocument();
    unmount();
    fakeApi(as('DEPARTMENT_STAFF', SALES_STAFF));
    renderRoute('/core?lang=zh');
    expect(await within(document.body).findAllByText('新建销售订单')).not.toHaveLength(0);
    expect(screen.getByText('快捷操作')).toBeInTheDocument();
  });
});

describe('Owner override in the CORE frame (EP41)', () => {
  it('asks the owner in a dialog, then resends the decision once with the reason', async () => {
    let n = 0;
    const api = fakeApi({
      ...as('COMPANY_OWNER', SALES_STAFF),
      'POST /api/v1/sales/orders/so1/confirm': () =>
        ++n === 1
          ? fail(409, 'SELF_APPROVAL_NOT_ALLOWED', { decision: 'confirm', overridable: true })
          : ok({ order: { id: 'so1', status: 'CONFIRMED' } }),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const decided = apiRequest('POST', '/api/v1/sales/orders/so1/confirm', {});
    const dialog = await screen.findByRole('dialog', { name: 'Owner override' });
    const confirm = within(dialog).getByRole('button', { name: 'Approve with owner override' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Only approver on site today');
    await userEvent.click(confirm);
    await expect(decided).resolves.toMatchObject({ order: { status: 'CONFIRMED' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.called('POST /api/v1/sales/orders/so1/confirm').map((c) => c.body)).toEqual([
      {},
      { ownerOverride: { reason: 'Only approver on site today' } },
    ]);
  });

  it('cancelling the dialog sends nothing more', async () => {
    const api = fakeApi({
      ...as('COMPANY_OWNER', SALES_STAFF),
      'POST /api/v1/sales/orders/so1/confirm': fail(409, 'SELF_APPROVAL_NOT_ALLOWED', {
        overridable: true,
      }),
    });
    renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    const decided = apiRequest('POST', '/api/v1/sales/orders/so1/confirm', {}).catch(
      (e: unknown) => e,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Owner override' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await decided).toMatchObject({ code: 'SELF_APPROVAL_NOT_ALLOWED' });
    expect(api.called('POST /api/v1/sales/orders/so1/confirm')).toHaveLength(1);
  });
});

/*
 * EP42.3: the sidebar follows the work. The department of the current page lists all its
 * sections (the same codes as its own tab strip); the others keep their main entries. A
 * list's filters sit under its entry, and the one in use is the current page.
 */
const WAREHOUSE_STAFF = [
  'warehouse.workspace.view',
  'warehouse.receiving.view',
  'warehouse.receiving.process',
  'warehouse.inventory.view',
  'warehouse.transfers.create',
];
describe('CORE navigation follows the work (EP42.3)', () => {
  it('Warehouse sections appear while working in Warehouse; elsewhere only its main entries', async () => {
    fakeApi(as('DEPARTMENT_STAFF', WAREHOUSE_STAFF, { departments: ['WAREHOUSE'] }));
    const { router } = renderRoute('/core?lang=en');
    await screen.findByRole('heading', { level: 1, name: 'CORE Operations' });
    let nav = within(sidebar());
    expect(nav.getByRole('link', { name: 'Warehouse overview' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Goods receipts' })).toBeNull();
    expect(nav.queryByRole('link', { name: 'Cycle counts' })).toBeNull();
    await router.navigate('/core/warehouse/receipts', { state: { locale: 'en' } });
    await waitFor(() =>
      expect(within(sidebar()).getByRole('link', { name: 'Goods receipts' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    nav = within(sidebar());
    for (const [name, href] of [
      ['Pending receive', '/core/warehouse/pending-receive'],
      ['Lots & expiry', '/core/warehouse/lots'],
      ['Transfers', '/core/warehouse/transfers'],
      ['Cycle counts', '/core/warehouse/counts'],
      ['Picks', '/core/warehouse/picks'],
      ['Shipments', '/core/warehouse/shipments'],
    ])
      expect(nav.getByRole('link', { name })).toHaveAttribute('href', href);
    // Codes this person lacks stay out (production issues, finished goods).
    expect(nav.queryByRole('link', { name: 'Production issues' })).toBeNull();
    expect(nav.queryByRole('link', { name: 'Finished goods' })).toBeNull();
    expect(nav.getByRole('link', { name: 'Warehouse overview' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('Sales filters sit under Sales orders; the filter in use is the current page', async () => {
    fakeApi(as('DEPARTMENT_STAFF', SALES_STAFF));
    renderRoute('/core/sales?status=SUBMITTED&lang=en');
    const filters = await waitFor(() => {
      const el = sidebar().querySelector<HTMLElement>('[data-nav-filters]');
      expect(el).not.toBeNull();
      return within(el!);
    });
    expect(filters.getByRole('link', { name: 'Awaiting confirmation' })).toHaveAttribute(
      'href',
      '/core/sales?status=SUBMITTED',
    );
    expect(filters.getByRole('link', { name: 'Short of stock' })).toHaveAttribute(
      'href',
      '/core/sales?availability=SHORTAGE',
    );
    // The filter in use is the current page (?lang only names the language); the list is not.
    expect(filters.getByRole('link', { name: 'Awaiting confirmation' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar()).getByRole('link', { name: 'Sales orders' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
