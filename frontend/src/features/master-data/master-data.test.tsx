import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompanyRole } from '@/features/auth/api';
import { resetIdentityForTests } from '@/features/auth/session';
import type { ControlOverview } from '@/features/company-center/api';
import { CONTROL_COPY } from '@/features/company-center/copy';
import { eventLabel } from '@/features/company-center/model';
import { ADMIN_COPY } from '@/features/company-center/adminCopy';
import { PERMISSION_COPY } from '@/features/company-center/permissionCopy';
import { fakeApi, fail, identity, ok, signedIn } from '@/test/fakeApi';
import { renderRoute } from '@/test/render';
import type { MasterContext, MasterList, MasterRecord, Resource } from './api';
import { MASTER_COPY } from './copy';

/*
 * EP28 Master Data screens (UI). Capabilities, lists and records come from
 * the server; enforcement (permissions, branch access, company isolation,
 * Warehouse privacy) is tested in backend/test/master-data.test.ts.
 */

const member = (role: CompanyRole) =>
  identity({
    company: { id: 'c1', name: 'Alpha Trading', isDemo: false, role, canEnterCore: true },
  });

function overview(permissions: string[], role: CompanyRole): ControlOverview {
  return {
    company: {
      id: 'c1',
      displayName: 'Alpha Trading',
      legalName: null,
      englishName: null,
      taxId: null,
      registrationNumber: null,
      phone: null,
      website: null,
      contactEmail: null,
      industry: null,
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      isDemo: false,
      createdAt: '2026-10-20T03:00:00.000Z',
      activatedAt: '2026-10-21T03:00:00.000Z',
      logo: null,
    },
    me: {
      memberId: 'm1',
      role,
      jobTitle: null,
      permissions: permissions as ControlOverview['me']['permissions'],
      departments: [],
    },
    headOffice: null,
    plan: null,
    departments: { enabled: ['WAREHOUSE'], unassigned: [] },
    counts: {
      branches: { active: 2, total: 2 },
      members: { active: 3, deactivated: 0 },
      invitations: { open: 0, expired: 0 },
    },
    setup: { steps: [], complete: true },
    attention: [],
    access: { canEnterCore: true },
  };
}

const all = (view: boolean, manage: boolean) =>
  Object.fromEntries(
    (['customers', 'suppliers', 'items', 'units', 'categories', 'locations'] as Resource[]).map(
      (r) => [r, { view, manage }],
    ),
  ) as MasterContext['capabilities'];

const BRANCHES: MasterContext['branches'] = [
  {
    id: 'b0',
    code: '00000',
    name: 'Head Office',
    type: 'HEAD_OFFICE',
    status: 'ACTIVE',
    canManage: true,
  },
  { id: 'b1', code: '00001', name: 'Branch A', type: 'BRANCH', status: 'ACTIVE', canManage: true },
];
const ADMIN_CTX: MasterContext = {
  capabilities: all(true, true),
  companyWide: true,
  branches: BRANCHES,
};
const WAREHOUSE_CTX: MasterContext = {
  capabilities: {
    ...all(false, false),
    items: { view: true, manage: false },
    units: { view: true, manage: false },
    categories: { view: true, manage: false },
    locations: { view: true, manage: false },
  },
  companyWide: false,
  branches: [{ ...BRANCHES[1]!, canManage: false }],
};

const PCS = {
  id: 'u1',
  code: 'PCS',
  name: 'Piece',
  symbol: 'pc',
  precision: 0,
  status: 'ACTIVE' as const,
};
const KG = {
  id: 'u2',
  code: 'KG',
  name: 'Kilogram',
  symbol: 'kg',
  precision: 3,
  status: 'ACTIVE' as const,
};
const stamp = {
  updatedAt: '2026-10-29T03:00:00.000Z',
  createdAt: '2026-10-29T03:00:00.000Z',
  deactivatedAt: null,
};
const ITEM: MasterRecord = {
  id: 'i1',
  code: 'FG-000001',
  type: 'FINISHED_GOOD',
  name: 'Cream 50 ml',
  status: 'ACTIVE',
  description: null,
  sku: 'CR-50',
  barcode: null,
  baseUnit: PCS,
  category: { id: 'k1', code: 'FG', name: 'Finished goods', status: 'INACTIVE' },
  inventoryTracked: true,
  lotTracking: 'REQUIRED',
  expiryTracking: 'OPTIONAL',
  ...stamp,
};
const CUSTOMER: MasterRecord = {
  id: 'c_1',
  code: 'CUS-000001',
  kind: 'BUSINESS',
  name: 'บริษัท ตัวอย่าง จำกัด',
  legalName: null,
  taxId: '0105512345678',
  taxBranch: null,
  contactName: 'Somchai',
  phone: '+66812345678',
  email: 'buyer@example.com',
  lineId: null,
  billingAddress: null,
  shippingAddress: null,
  notes: null,
  status: 'ACTIVE',
  ...stamp,
};
const list = (items: MasterRecord[], canManage: boolean): MasterList => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 25,
  hasMore: false,
  canManage,
});

const MD = '/api/v1/master-data';
const ADMIN_CODES = ['company.profile.view', 'company.master_data.manage'];

const asAdmin = (extra: Parameters<typeof fakeApi>[0] = {}) => ({
  ...signedIn(member('SYSTEM_ADMIN')),
  'GET /api/v1/company/control': ok(overview(ADMIN_CODES, 'SYSTEM_ADMIN')),
  [`GET ${MD}/context`]: ok(ADMIN_CTX),
  ...extra,
});

afterEach(() => resetIdentityForTests());

describe('Master Data (EP28)', () => {
  it('is one Control Center entry with sub-navigation, for anyone allowed to view master data', async () => {
    fakeApi(asAdmin({ [`GET ${MD}/customers`]: ok(list([CUSTOMER], true)) }));
    renderRoute('/company/master-data?lang=en');
    const menu = await screen.findByRole('navigation', { name: 'Company Control Center menu' });
    expect(within(menu).getByRole('link', { name: 'Master Data' })).toHaveAttribute(
      'href',
      '/company/master-data',
    );
    const sub = await screen.findByRole('navigation', { name: 'Master Data menu' });
    expect(
      within(sub)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Customers', 'Suppliers', 'Items', 'Units', 'Categories', 'Locations']);
    // The index opens the first area the person may view.
    expect(await screen.findByRole('heading', { level: 1, name: 'Customers' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open CUS-000001' })).toBeInTheDocument();
  });

  it('hides the entry from people with no master-data view', async () => {
    fakeApi({
      ...signedIn(member('VIEWER')),
      'GET /api/v1/company/control': ok(
        overview(['company.profile.view', 'warehouse.workspace.view'], 'VIEWER'),
      ),
    });
    renderRoute('/company?lang=en');
    const menu = await screen.findByRole('navigation', { name: 'Company Control Center menu' });
    expect(within(menu).queryByRole('link', { name: 'Master Data' })).toBeNull();
  });

  it('Warehouse staff: safe item identity, tracking in words, read only', async () => {
    fakeApi({
      ...signedIn(member('DEPARTMENT_STAFF')),
      'GET /api/v1/company/control': ok(
        overview(
          ['company.profile.view', 'warehouse.items.view', 'warehouse.locations.view'],
          'DEPARTMENT_STAFF',
        ),
      ),
      [`GET ${MD}/context`]: ok(WAREHOUSE_CTX),
      [`GET ${MD}/items`]: ok(list([ITEM], false)),
      [`GET ${MD}/categories`]: ok(list([], false)),
    });
    renderRoute('/company/master-data/items?lang=en');
    const sub = await screen.findByRole('navigation', { name: 'Master Data menu' });
    expect(
      within(sub)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Items', 'Units', 'Categories', 'Locations']);
    const table = await screen.findByRole('table');
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByText('Lot · Required')).toBeInTheDocument();
    expect(within(row).getByText('Expiry · Optional')).toBeInTheDocument();
    expect(within(row).getByText('Stock')).toBeInTheDocument();
    expect(row).toHaveTextContent('Finished goods (Inactive)');
    expect(screen.getByText(MASTER_COPY.en.readOnly)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New item' })).toBeNull();
    // Customers are not part of this person's master data at all.
    expect(within(sub).queryByRole('link', { name: 'Customers' })).toBeNull();
  });

  it('searches, filters and sorts on the server', async () => {
    const api = fakeApi(
      asAdmin({
        [`GET ${MD}/items`]: ok(list([ITEM], true)),
        [`GET ${MD}/categories`]: ok(list([], true)),
      }),
    );
    renderRoute('/company/master-data/items?lang=en');
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'cr-50');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tracking' }), 'lot');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Item type' }), 'RAW_MATERIAL');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'updated');
    await waitFor(() => {
      const last = api.called(`GET ${MD}/items`).at(-1)!;
      expect(last.query).toMatchObject({
        q: 'cr-50',
        lotTracking: 'TRACKED',
        type: 'RAW_MATERIAL',
        sort: 'updated',
        page: '1',
        pageSize: '25',
      });
    });
  });

  it('shows a useful empty state, with Create only for managers', async () => {
    fakeApi(asAdmin({ [`GET ${MD}/suppliers`]: ok(list([], true)) }));
    renderRoute('/company/master-data/suppliers?lang=en');
    expect(await screen.findByText('No suppliers yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New supplier' })).toHaveAttribute(
      'href',
      '/company/master-data/suppliers/new',
    );
  });

  it('creates a customer: required fields first, only filled fields sent, server field errors on the field', async () => {
    let attempts = 0;
    const api = fakeApi(
      asAdmin({
        [`POST ${MD}/customers`]: () =>
          ++attempts === 1
            ? fail(409, 'DUPLICATE_VALUE', { field: 'code' })
            : { status: 201, body: { customer: { ...CUSTOMER, code: 'LEGACY-1' } } },
        [`GET ${MD}/customers/c_1`]: ok({
          customer: { ...CUSTOMER, code: 'LEGACY-1' },
          canManage: true,
        }),
      }),
    );
    renderRoute('/company/master-data/customers/new?lang=en');
    const user = userEvent.setup();
    const save = await screen.findByRole('button', { name: 'New customer' });
    await user.click(save);
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(api.called(`POST ${MD}/customers`)).toHaveLength(0);

    await user.type(name, 'Example Co.');
    const code = screen.getByRole('textbox', { name: 'Code' });
    expect(screen.getByText('Leave empty to generate (CUS-000001)')).toBeInTheDocument();
    await user.type(code, 'legacy-1');
    await user.click(save);
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getAllByText(MASTER_COPY.en.errors.DUPLICATE_VALUE).length).toBeGreaterThan(0);
    expect(api.called(`POST ${MD}/customers`)[0]!.body).toEqual({
      code: 'legacy-1',
      kind: 'BUSINESS',
      name: 'Example Co.',
    });
    await user.click(save);
    expect(
      await screen.findByRole('heading', { level: 1, name: CUSTOMER.name }),
    ).toBeInTheDocument();
    expect(screen.getByText('LEGACY-1')).toBeInTheDocument();
  });

  it('edits only what changed, and deactivates after an in-place confirmation', async () => {
    const api = fakeApi(
      asAdmin({
        [`GET ${MD}/customers/c_1`]: ok({ customer: CUSTOMER, canManage: true }),
        [`PATCH ${MD}/customers/c_1`]: (body) =>
          ok({ customer: { ...CUSTOMER, ...(body as object) } }),
        [`POST ${MD}/customers/c_1/deactivate`]: ok({
          customer: { ...CUSTOMER, status: 'INACTIVE', deactivatedAt: '2026-10-29T04:00:00.000Z' },
        }),
      }),
    );
    renderRoute('/company/master-data/customers/c_1?lang=en');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull(); // fixed after creation
    const email = screen.getByRole('textbox', { name: 'Email' });
    await user.clear(email);
    await user.type(screen.getByRole('textbox', { name: 'Contact person' }), ' Jr.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(api.called(`PATCH ${MD}/customers/c_1`)[0]!.body).toEqual({
      contactName: 'Somchai Jr.',
      email: '',
    });

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    const confirm = screen.getByRole('group', { name: 'Deactivate' });
    expect(confirm).toHaveTextContent('Deactivate CUS-000001?');
    expect(within(confirm).getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(document.querySelector('[data-record]')).toHaveAttribute('data-status', 'INACTIVE'),
    );
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('item: the generic edit leaves unit and tracking alone; they change through Unit & tracking', async () => {
    const api = fakeApi(
      asAdmin({
        [`GET ${MD}/items/i1`]: ok({ item: ITEM, canManage: true }),
        [`GET ${MD}/units`]: ok(list([PCS, KG] as unknown as MasterRecord[], true)),
        [`GET ${MD}/categories`]: ok(list([], true)),
        [`PUT ${MD}/items/i1/structure`]: fail(422, 'TRACKING_INVALID', {
          reason: 'EXPIRY_NEEDS_LOT',
        }),
      }),
    );
    renderRoute('/company/master-data/items/i1?lang=en');
    const user = userEvent.setup();
    const section = await screen.findByRole('region', { name: 'Unit & tracking' });
    const unit = within(section).getByRole('combobox', { name: 'Base unit' });
    await waitFor(() => expect(within(unit).getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(unit, 'u2');
    await user.selectOptions(within(section).getByRole('combobox', { name: 'Lot' }), 'NONE');
    await user.click(within(section).getByRole('button', { name: 'Save unit & tracking' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'This tracking is not allowed',
    );
    expect(api.called(`PUT ${MD}/items/i1/structure`)[0]!.body).toEqual({
      baseUnitId: 'u2',
      lotTracking: 'NONE',
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('region', { name: 'Edit' });
    expect(within(edit).queryByRole('combobox', { name: 'Base unit' })).toBeNull();
    expect(within(edit).queryByRole('combobox', { name: 'Item type' })).toBeNull();
  });

  it('locations: branch shown, default marked, filter by branch', async () => {
    const api = fakeApi(
      asAdmin({
        [`GET ${MD}/locations`]: ok(
          list(
            [
              {
                id: 'l1',
                code: 'MAIN',
                name: 'Main warehouse',
                status: 'ACTIVE',
                description: null,
                branch: {
                  id: 'b1',
                  code: '00001',
                  name: 'Branch A',
                  type: 'BRANCH',
                  status: 'ACTIVE',
                },
                parent: null,
                isDefault: true,
                ...stamp,
              },
            ],
            true,
          ),
        ),
      }),
    );
    renderRoute('/company/master-data/locations?lang=en');
    const table = await screen.findByRole('table');
    const row = within(table).getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('00001');
    expect(row).toHaveTextContent('Default');
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Branch' }), 'b1');
    await waitFor(() =>
      expect(api.called(`GET ${MD}/locations`).at(-1)!.query).toMatchObject({ branchId: 'b1' }),
    );
  });

  it('speaks Thai, English and Simplified Chinese; business names stay as entered', async () => {
    for (const [lang, heading, nav] of [
      ['th', 'ลูกค้า', 'เมนูข้อมูลหลัก'],
      ['en', 'Customers', 'Master Data menu'],
      ['zh', '客户', '主数据菜单'],
    ] as const) {
      fakeApi(asAdmin({ [`GET ${MD}/customers`]: ok(list([CUSTOMER], true)) }));
      const { unmount } = renderRoute(`/company/master-data/customers?lang=${lang}`);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: nav })).toBeInTheDocument();
      expect(await screen.findByText(CUSTOMER.name)).toBeInTheDocument();
      if (lang !== 'th') {
        const ui = document
          .querySelector('[data-master-data]')!
          .textContent!.replace(CUSTOMER.name, '');
        expect(ui).not.toMatch(/[฀-๿]/);
      }
      unmount();
      resetIdentityForTests();
    }
  });

  it('copy has the same shape in every language', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v).map((x) => `${k}.${x}`) : [k],
      );
    const th = keys(MASTER_COPY.th).sort();
    expect(keys(MASTER_COPY.en).sort()).toEqual(th);
    expect(keys(MASTER_COPY['zh-CN']).sort()).toEqual(th);
  });

  it('activity reads master-data events in words, by code', () => {
    const label = (type: string, lang: 'th' | 'en' | 'zh-CN') =>
      eventLabel(
        { type, details: { code: 'CUS-000001', name: 'ignored' } },
        CONTROL_COPY[lang],
        ADMIN_COPY[lang],
        PERMISSION_COPY[lang],
      );
    expect(label('CUSTOMER_CREATED', 'en')).toBe('Customer CUS-000001 created');
    expect(label('ITEM_CATEGORY_DEACTIVATED', 'en')).toBe('Item category CUS-000001 deactivated');
    expect(label('LOCATION_REACTIVATED', 'th')).toBe(
      'ตำแหน่งจัดเก็บ CUS-000001 เปิดใช้งานอีกครั้งแล้ว',
    );
    expect(label('CUSTOMER_CREATED', 'zh-CN')).toBe('客户 CUS-000001 已新建');
    expect(label('ITEM_STRUCTURE_CHANGED', 'zh-CN')).toContain('CUS-000001');
    expect(label('BRANCH_CREATED', 'en')).toBe('Branch created');
  });
});
